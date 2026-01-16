"""
Insurance Coding Knowledge Base

Contains mappings, rules, and reference data for insurance coding:
- Common ICD-10 to CPT mappings
- Medical necessity rules
- Denial reason codes
- Modifier guidelines
- UAE/DHA specific rules
"""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass


@dataclass
class CodeMapping:
    """Represents an ICD-10 to CPT mapping with medical necessity info"""
    icd10_code: str
    cpt_codes: List[str]
    validity_score: float  # 0.0 to 1.0
    is_required: bool
    documentation_requirements: List[str]


@dataclass
class DenialReason:
    """Common claim denial reasons"""
    code: str
    description: str
    resolution_steps: List[str]


class InsuranceCodingKnowledgeBase:
    """
    Knowledge base for insurance coding rules and mappings.
    Used for rule-based fallback when AI is unavailable.
    """

    def __init__(self):
        self.version = "1.0.0"
        self._load_mappings()
        self._load_denial_reasons()
        self._load_modifier_rules()
        self._load_specialty_mappings()

    def _load_mappings(self):
        """Load common ICD-10 to CPT mappings"""
        # Common respiratory conditions
        self.icd_cpt_mappings: Dict[str, List[CodeMapping]] = {
            # Upper Respiratory Infections
            "J06.9": [  # Acute upper respiratory infection, unspecified
                CodeMapping("J06.9", ["99213", "99214"], 0.9, False,
                           ["Document symptoms", "Physical exam findings"]),
                CodeMapping("J06.9", ["87880"], 0.8, False,
                           ["Strep test if indicated"]),
            ],
            "J18.9": [  # Pneumonia, unspecified
                CodeMapping("J18.9", ["99214", "99215"], 0.95, False,
                           ["Document respiratory findings", "Auscultation results"]),
                CodeMapping("J18.9", ["71046", "71047"], 0.9, False,
                           ["Chest X-ray for confirmation"]),
                CodeMapping("J18.9", ["94640"], 0.7, False,
                           ["Nebulizer treatment if indicated"]),
            ],
            "J45.909": [  # Asthma, unspecified
                CodeMapping("J45.909", ["99213", "99214"], 0.9, False,
                           ["Document asthma severity", "Current symptoms"]),
                CodeMapping("J45.909", ["94010", "94060"], 0.85, True,
                           ["Spirometry for diagnosis/monitoring"]),
                CodeMapping("J45.909", ["94640"], 0.8, False,
                           ["Nebulizer treatment if acute"]),
            ],

            # Diabetes conditions
            "E11.9": [  # Type 2 diabetes without complications
                CodeMapping("E11.9", ["99213", "99214"], 0.9, False,
                           ["Document HbA1c", "Current management"]),
                CodeMapping("E11.9", ["83036"], 0.95, True,
                           ["HbA1c test"]),
                CodeMapping("E11.9", ["82947"], 0.85, False,
                           ["Glucose level"]),
            ],
            "E11.65": [  # Type 2 diabetes with hyperglycemia
                CodeMapping("E11.65", ["99214", "99215"], 0.9, False,
                           ["Document blood glucose levels", "Treatment plan"]),
                CodeMapping("E11.65", ["83036"], 0.95, True,
                           ["HbA1c test"]),
                CodeMapping("E11.65", ["80053"], 0.85, False,
                           ["Comprehensive metabolic panel"]),
            ],

            # Hypertension
            "I10": [  # Essential hypertension
                CodeMapping("I10", ["99213", "99214"], 0.9, False,
                           ["Document BP readings", "Current medications"]),
                CodeMapping("I10", ["80053"], 0.7, False,
                           ["Metabolic panel if new diagnosis"]),
                CodeMapping("I10", ["93000"], 0.6, False,
                           ["ECG if cardiac symptoms"]),
            ],

            # Musculoskeletal
            "M54.5": [  # Low back pain
                CodeMapping("M54.5", ["99213", "99214"], 0.9, False,
                           ["Document pain location", "Physical exam"]),
                CodeMapping("M54.5", ["72148"], 0.7, False,
                           ["MRI if red flags present"]),
                CodeMapping("M54.5", ["97110"], 0.8, False,
                           ["Physical therapy"]),
            ],

            # Preventive care
            "Z00.00": [  # General adult medical examination
                CodeMapping("Z00.00", ["99395", "99396", "99397"], 0.95, True,
                           ["Age-appropriate preventive visit"]),
                CodeMapping("Z00.00", ["80061"], 0.85, False,
                           ["Lipid panel"]),
                CodeMapping("Z00.00", ["85025"], 0.8, False,
                           ["CBC"]),
            ],
        }

        # CPT code categories for suggestion
        self.cpt_categories = {
            "E&M": {
                "office_visit": ["99211", "99212", "99213", "99214", "99215"],
                "new_patient": ["99201", "99202", "99203", "99204", "99205"],
                "preventive": ["99381", "99382", "99383", "99384", "99385",
                              "99391", "99392", "99393", "99394", "99395"],
            },
            "Laboratory": {
                "chemistry": ["80053", "80048", "82947", "83036", "84443"],
                "hematology": ["85025", "85027", "85610"],
                "microbiology": ["87880", "87804", "87081"],
            },
            "Radiology": {
                "xray": ["71046", "71047", "73030", "73110"],
                "ct": ["70450", "71250", "72125"],
                "mri": ["70551", "72148", "73221"],
                "ultrasound": ["76700", "76856", "93306"],
            },
            "Procedures": {
                "injections": ["20610", "20605", "96372"],
                "minor_procedures": ["11102", "11103", "12001", "12002"],
            },
        }

    def _load_denial_reasons(self):
        """Load common denial reasons and resolutions"""
        self.denial_reasons: Dict[str, DenialReason] = {
            "CO-4": DenialReason(
                "CO-4",
                "The procedure code is inconsistent with the modifier used",
                ["Review modifier usage", "Ensure modifier matches procedure",
                 "Check payer-specific modifier requirements"]
            ),
            "CO-11": DenialReason(
                "CO-11",
                "The diagnosis is inconsistent with the procedure",
                ["Verify ICD-10 code supports medical necessity",
                 "Add additional diagnosis codes if applicable",
                 "Request clinical documentation"]
            ),
            "CO-16": DenialReason(
                "CO-16",
                "Claim/service lacks information needed for adjudication",
                ["Review claim for missing fields",
                 "Ensure all required attachments included",
                 "Verify patient eligibility information"]
            ),
            "CO-18": DenialReason(
                "CO-18",
                "Exact duplicate claim/service",
                ["Check if service was already billed",
                 "Verify service date",
                 "If legitimate, use modifier 76 or 77"]
            ),
            "CO-50": DenialReason(
                "CO-50",
                "Non-covered service",
                ["Verify coverage with payer",
                 "Check for policy exclusions",
                 "Appeal with medical necessity documentation"]
            ),
            "CO-97": DenialReason(
                "CO-97",
                "Payment adjusted due to bundling",
                ["Review CCI edits",
                 "Check if modifier 59 is appropriate",
                 "Verify services are distinct"]
            ),
            "CO-151": DenialReason(
                "CO-151",
                "Prior authorization required but not obtained",
                ["Obtain prior authorization",
                 "Appeal with medical necessity",
                 "Check retroactive auth options"]
            ),
            "CO-197": DenialReason(
                "CO-197",
                "Precertification/authorization/notification absent",
                ["Submit prior authorization request",
                 "Include clinical documentation",
                 "Request expedited review if urgent"]
            ),
        }

    def _load_modifier_rules(self):
        """Load CPT modifier usage rules"""
        self.modifier_rules = {
            "25": {
                "description": "Significant, separately identifiable E/M service",
                "applies_to": ["99211", "99212", "99213", "99214", "99215"],
                "rules": [
                    "Use when E/M is separate from procedure same day",
                    "Document distinct medical necessity",
                    "Must be above and beyond procedure's E/M"
                ],
                "common_denials": ["Documentation insufficient", "Not separately identifiable"]
            },
            "59": {
                "description": "Distinct procedural service",
                "applies_to": ["all_procedures"],
                "rules": [
                    "Use to indicate separate session/surgery/incision/site",
                    "Overrides CCI bundling edits",
                    "Consider more specific modifiers first (XE, XS, XP, XU)"
                ],
                "common_denials": ["Services are bundled", "Same operative session"]
            },
            "76": {
                "description": "Repeat procedure by same physician",
                "applies_to": ["all_procedures"],
                "rules": [
                    "Same procedure, same day, same physician",
                    "Document medical necessity for repeat"
                ],
                "common_denials": ["Duplicate billing", "No documentation of repeat need"]
            },
            "77": {
                "description": "Repeat procedure by another physician",
                "applies_to": ["all_procedures"],
                "rules": [
                    "Same procedure, same day, different physician",
                    "Document why repeat by different physician needed"
                ],
                "common_denials": ["Duplicate billing"]
            },
            "26": {
                "description": "Professional component",
                "applies_to": ["radiology", "pathology"],
                "rules": [
                    "Physician interpretation only",
                    "Use when not owning equipment"
                ],
                "common_denials": ["TC already billed", "Global service expected"]
            },
            "TC": {
                "description": "Technical component",
                "applies_to": ["radiology", "pathology"],
                "rules": [
                    "Technical/equipment portion only",
                    "Use when another physician interprets"
                ],
                "common_denials": ["26 modifier already billed"]
            },
        }

    def _load_specialty_mappings(self):
        """Load specialty-specific coding patterns"""
        self.specialty_patterns = {
            "internal_medicine": {
                "common_icd": ["I10", "E11.9", "J06.9", "M54.5", "Z00.00"],
                "common_cpt": ["99213", "99214", "80053", "83036", "85025"],
                "typical_modifiers": ["25"],
            },
            "cardiology": {
                "common_icd": ["I10", "I25.10", "I48.91", "I50.9", "R00.0"],
                "common_cpt": ["93000", "93306", "93010", "99214", "99215"],
                "typical_modifiers": ["26", "TC"],
            },
            "orthopedics": {
                "common_icd": ["M54.5", "M25.511", "M17.11", "S83.511A"],
                "common_cpt": ["20610", "73030", "72148", "97110", "99213"],
                "typical_modifiers": ["59", "RT", "LT"],
            },
            "dermatology": {
                "common_icd": ["L70.0", "L30.9", "D22.9", "L82.1"],
                "common_cpt": ["11102", "11103", "17110", "99213", "99214"],
                "typical_modifiers": ["59", "25"],
            },
            "pediatrics": {
                "common_icd": ["J06.9", "J20.9", "H66.90", "Z00.129"],
                "common_cpt": ["99391", "99392", "99213", "87880", "92551"],
                "typical_modifiers": ["25"],
            },
        }

        # UAE/DHA specific rules
        self.dha_rules = {
            "pre_auth_required": [
                "71250", "71260",  # CT Chest
                "72148", "72149",  # MRI Lumbar
                "70551", "70552",  # MRI Brain
                "27447",  # TKR
                "29881",  # Knee arthroscopy
            ],
            "max_visits_per_year": {
                "physical_therapy": 20,
                "chiropractic": 12,
                "mental_health": 30,
            },
            "excluded_codes": [],  # Codes not covered by DHA
            "requires_referral": [
                "99241", "99242", "99243", "99244", "99245",  # Consultations
            ],
        }

    def get_cpt_for_icd(self, icd10_code: str) -> List[CodeMapping]:
        """Get recommended CPT codes for an ICD-10 code"""
        # Try exact match first
        if icd10_code in self.icd_cpt_mappings:
            return self.icd_cpt_mappings[icd10_code]

        # Try category match (first 3 characters)
        category = icd10_code[:3]
        matches = []
        for icd, mappings in self.icd_cpt_mappings.items():
            if icd.startswith(category):
                matches.extend(mappings)

        return matches

    def validate_icd_cpt_pair(self, icd10_code: str, cpt_code: str) -> Dict[str, Any]:
        """
        Validate if an ICD-10 + CPT pair is medically appropriate.
        Returns validation result with score and reasoning.
        """
        mappings = self.get_cpt_for_icd(icd10_code)

        for mapping in mappings:
            if cpt_code in mapping.cpt_codes:
                return {
                    "valid": True,
                    "score": mapping.validity_score,
                    "is_required": mapping.is_required,
                    "documentation": mapping.documentation_requirements,
                    "reason": "Code pair found in medical necessity mappings"
                }

        # Check if CPT is in a reasonable category for the diagnosis
        icd_category = self._get_icd_category(icd10_code)
        cpt_category = self._get_cpt_category(cpt_code)

        if self._categories_compatible(icd_category, cpt_category):
            return {
                "valid": True,
                "score": 0.5,
                "is_required": False,
                "documentation": ["Document medical necessity", "Provide clinical rationale"],
                "reason": "Categories are compatible but no explicit mapping found"
            }

        return {
            "valid": False,
            "score": 0.1,
            "is_required": False,
            "documentation": ["Strong documentation required", "Medical necessity justification needed"],
            "reason": "No mapping found - may require additional documentation"
        }

    def _get_icd_category(self, icd_code: str) -> str:
        """Get the category for an ICD-10 code"""
        first_char = icd_code[0].upper()
        category_map = {
            "A": "infectious", "B": "infectious",
            "C": "neoplasm", "D": "neoplasm",
            "E": "endocrine",
            "F": "mental",
            "G": "nervous",
            "H": "eye_ear",
            "I": "circulatory",
            "J": "respiratory",
            "K": "digestive",
            "L": "skin",
            "M": "musculoskeletal",
            "N": "genitourinary",
            "O": "pregnancy",
            "P": "perinatal",
            "Q": "congenital",
            "R": "symptoms",
            "S": "injury", "T": "injury",
            "V": "external", "W": "external", "X": "external", "Y": "external",
            "Z": "health_status",
        }
        return category_map.get(first_char, "other")

    def _get_cpt_category(self, cpt_code: str) -> str:
        """Get the category for a CPT code"""
        try:
            code_num = int(cpt_code)
            if 99201 <= code_num <= 99499:
                return "E&M"
            elif 70000 <= code_num <= 79999:
                return "radiology"
            elif 80000 <= code_num <= 89999:
                return "laboratory"
            elif 90000 <= code_num <= 99199:
                return "medicine"
            elif 10000 <= code_num <= 69999:
                return "surgery"
            else:
                return "other"
        except ValueError:
            return "other"

    def _categories_compatible(self, icd_category: str, cpt_category: str) -> bool:
        """Check if ICD and CPT categories are generally compatible"""
        # E&M is compatible with everything
        if cpt_category == "E&M":
            return True

        # Laboratory is compatible with most diagnoses
        if cpt_category == "laboratory":
            return True

        # Specific compatibility rules
        compatibility = {
            "respiratory": ["radiology", "medicine", "laboratory"],
            "circulatory": ["radiology", "medicine", "laboratory", "surgery"],
            "musculoskeletal": ["radiology", "medicine", "surgery"],
            "digestive": ["radiology", "medicine", "laboratory", "surgery"],
            "endocrine": ["laboratory", "medicine"],
            "injury": ["radiology", "surgery", "medicine"],
        }

        return cpt_category in compatibility.get(icd_category, [])

    def get_denial_resolution(self, denial_code: str) -> Optional[DenialReason]:
        """Get resolution steps for a denial code"""
        return self.denial_reasons.get(denial_code)

    def get_modifier_guidance(self, modifier: str) -> Optional[Dict]:
        """Get guidance for using a specific modifier"""
        return self.modifier_rules.get(modifier)

    def requires_pre_auth(self, cpt_code: str) -> bool:
        """Check if a CPT code requires pre-authorization (DHA rules)"""
        return cpt_code in self.dha_rules["pre_auth_required"]

    def get_specialty_codes(self, specialty: str) -> Dict[str, List[str]]:
        """Get common codes for a medical specialty"""
        return self.specialty_patterns.get(specialty.lower().replace(" ", "_"), {})


# Singleton instance
knowledge_base = InsuranceCodingKnowledgeBase()
