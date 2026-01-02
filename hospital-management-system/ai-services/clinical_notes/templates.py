"""Clinical Note Templates and Prompts"""

# SOAP Note Template
SOAP_NOTE_TEMPLATE = """
SUBJECTIVE:
{subjective}

OBJECTIVE:
{objective}

ASSESSMENT:
{assessment}

PLAN:
{plan}
"""

# Discharge Summary Template
DISCHARGE_SUMMARY_TEMPLATE = """
DISCHARGE SUMMARY

Patient Name: {patient_name}
Date of Admission: {admission_date}
Date of Discharge: {discharge_date}
Attending Physician: {physician}

ADMISSION DIAGNOSIS:
{admission_diagnosis}

DISCHARGE DIAGNOSIS:
{discharge_diagnosis}

HOSPITAL COURSE:
{hospital_course}

PROCEDURES PERFORMED:
{procedures}

DISCHARGE MEDICATIONS:
{medications}

DISCHARGE INSTRUCTIONS:
{instructions}

FOLLOW-UP:
{follow_up}

CONDITION AT DISCHARGE:
{condition}
"""

# Progress Note Template
PROGRESS_NOTE_TEMPLATE = """
PROGRESS NOTE

Date: {date}
Time: {time}
Provider: {provider}

INTERVAL HISTORY:
{interval_history}

CURRENT STATUS:
{current_status}

VITAL SIGNS:
{vital_signs}

PHYSICAL EXAMINATION:
{physical_exam}

LABORATORY/IMAGING:
{lab_imaging}

ASSESSMENT:
{assessment}

PLAN:
{plan}
"""

# Procedure Note Template
PROCEDURE_NOTE_TEMPLATE = """
PROCEDURE NOTE

Date: {date}
Procedure: {procedure_name}
Surgeon: {surgeon}
Assistant: {assistant}

INDICATION:
{indication}

PREOPERATIVE DIAGNOSIS:
{preop_diagnosis}

POSTOPERATIVE DIAGNOSIS:
{postop_diagnosis}

ANESTHESIA:
{anesthesia}

PROCEDURE DESCRIPTION:
{description}

FINDINGS:
{findings}

SPECIMENS:
{specimens}

ESTIMATED BLOOD LOSS:
{blood_loss}

COMPLICATIONS:
{complications}

DISPOSITION:
{disposition}
"""

# Consultation Note Template
CONSULTATION_NOTE_TEMPLATE = """
CONSULTATION NOTE

Date: {date}
Consulting Service: {service}
Consultant: {consultant}
Referring Physician: {referring}

REASON FOR CONSULTATION:
{reason}

HISTORY OF PRESENT ILLNESS:
{hpi}

PAST MEDICAL HISTORY:
{pmh}

CURRENT MEDICATIONS:
{medications}

ALLERGIES:
{allergies}

REVIEW OF SYSTEMS:
{ros}

PHYSICAL EXAMINATION:
{physical_exam}

DIAGNOSTIC STUDIES:
{diagnostics}

ASSESSMENT:
{assessment}

RECOMMENDATIONS:
{recommendations}
"""

# Emergency Department Note Template
ED_NOTE_TEMPLATE = """
EMERGENCY DEPARTMENT NOTE

Date/Time of Arrival: {arrival}
Chief Complaint: {chief_complaint}
Mode of Arrival: {arrival_mode}
Acuity Level: {acuity}

HISTORY OF PRESENT ILLNESS:
{hpi}

PAST MEDICAL HISTORY:
{pmh}

MEDICATIONS:
{medications}

ALLERGIES:
{allergies}

SOCIAL HISTORY:
{social}

VITAL SIGNS:
{vitals}

PHYSICAL EXAMINATION:
{physical_exam}

DIAGNOSTIC WORKUP:
{workup}

MEDICAL DECISION MAKING:
{mdm}

DIAGNOSIS:
{diagnosis}

DISPOSITION:
{disposition}

DISCHARGE INSTRUCTIONS:
{instructions}
"""

# System prompts for AI generation
SYSTEM_PROMPTS = {
    "soap": """You are a medical documentation assistant helping physicians create SOAP notes.
Generate professional, accurate, and concise clinical documentation based on the provided information.
Use standard medical terminology and abbreviations appropriately.
Ensure all relevant clinical details are captured.
Format the note in proper SOAP structure (Subjective, Objective, Assessment, Plan).""",

    "discharge": """You are a medical documentation assistant specializing in discharge summaries.
Create comprehensive discharge summaries that include all necessary information for continuity of care.
Include admission/discharge diagnoses, hospital course, medications, and follow-up instructions.
Use clear language for patient instructions while maintaining medical accuracy.""",

    "progress": """You are a medical documentation assistant for progress notes.
Document the patient's clinical progress since the last assessment.
Include relevant interval history, current status, and updated plan of care.
Be concise but thorough in capturing clinical changes.""",

    "procedure": """You are a medical documentation assistant for procedure notes.
Create detailed operative/procedure reports with all required elements.
Include indication, technique, findings, and any complications.
Use precise anatomical and procedural terminology.""",

    "consultation": """You are a medical documentation assistant for consultation notes.
Generate thorough consultation reports addressing the specific question asked.
Include your specialty-specific assessment and clear recommendations.
Provide actionable guidance for the primary team.""",

    "emergency": """You are a medical documentation assistant for emergency department notes.
Create comprehensive ED documentation capturing the acute presentation.
Include medical decision-making rationale and disposition planning.
Document time-sensitive elements accurately.""",

    "summarize": """You are a medical documentation assistant.
Summarize the provided clinical information concisely while preserving all critical details.
Highlight key findings, diagnoses, and action items.
Use bullet points for clarity when appropriate.""",

    "enhance": """You are a medical documentation assistant.
Enhance and improve the provided clinical note while maintaining factual accuracy.
Improve clarity, completeness, and professional language.
Add appropriate medical terminology where beneficial.
Do not add fictional information - only reorganize and enhance existing content.""",

    "extract": """You are a medical information extraction assistant.
Extract structured data from the provided clinical text.
Identify key entities: diagnoses, medications, procedures, vital signs, lab values.
Return data in a structured format.""",
}

# Common medical abbreviations for expansion
MEDICAL_ABBREVIATIONS = {
    "htn": "hypertension",
    "dm": "diabetes mellitus",
    "dm2": "type 2 diabetes mellitus",
    "cad": "coronary artery disease",
    "chf": "congestive heart failure",
    "copd": "chronic obstructive pulmonary disease",
    "ckd": "chronic kidney disease",
    "esrd": "end-stage renal disease",
    "afib": "atrial fibrillation",
    "mi": "myocardial infarction",
    "cva": "cerebrovascular accident",
    "tia": "transient ischemic attack",
    "dvt": "deep vein thrombosis",
    "pe": "pulmonary embolism",
    "uti": "urinary tract infection",
    "sob": "shortness of breath",
    "cp": "chest pain",
    "abd": "abdominal",
    "n/v": "nausea/vomiting",
    "bm": "bowel movement",
    "prn": "as needed",
    "bid": "twice daily",
    "tid": "three times daily",
    "qid": "four times daily",
    "qd": "once daily",
    "qhs": "at bedtime",
    "po": "by mouth",
    "iv": "intravenous",
    "im": "intramuscular",
    "sq": "subcutaneous",
    "wbc": "white blood cell count",
    "rbc": "red blood cell count",
    "hgb": "hemoglobin",
    "hct": "hematocrit",
    "plt": "platelet count",
    "bmp": "basic metabolic panel",
    "cmp": "comprehensive metabolic panel",
    "cbc": "complete blood count",
    "ua": "urinalysis",
    "ekg": "electrocardiogram",
    "cxr": "chest x-ray",
    "ct": "computed tomography",
    "mri": "magnetic resonance imaging",
    "us": "ultrasound",
    "er": "emergency room",
    "or": "operating room",
    "icu": "intensive care unit",
    "pacu": "post-anesthesia care unit",
    "npo": "nothing by mouth",
    "f/u": "follow-up",
    "h/o": "history of",
    "c/o": "complains of",
    "r/o": "rule out",
    "s/p": "status post",
    "yo": "year old",
    "y/o": "year old",
    "m": "male",
    "f": "female",
    "bp": "blood pressure",
    "hr": "heart rate",
    "rr": "respiratory rate",
    "t": "temperature",
    "o2": "oxygen saturation",
    "spo2": "oxygen saturation",
    "bmi": "body mass index",
    "wnl": "within normal limits",
    "nad": "no acute distress",
    "a&o": "alert and oriented",
    "aox3": "alert and oriented times 3",
    "rom": "range of motion",
    "dtrs": "deep tendon reflexes",
    "cn": "cranial nerves",
    "heent": "head, eyes, ears, nose, throat",
    "perrla": "pupils equal, round, reactive to light and accommodation",
    "rrr": "regular rate and rhythm",
    "ctab": "clear to auscultation bilaterally",
    "ntnd": "non-tender, non-distended",
    "bss": "bowel sounds present",
    "+bs": "positive bowel sounds",
    "cva": "costovertebral angle",
    "ext": "extremities",
    "le": "lower extremity",
    "ue": "upper extremity",
    "bil": "bilateral",
    "r": "right",
    "l": "left",
}

# Note type configurations
NOTE_TYPES = {
    "soap": {
        "name": "SOAP Note",
        "description": "Subjective, Objective, Assessment, Plan format",
        "template": SOAP_NOTE_TEMPLATE,
        "required_fields": ["subjective", "objective", "assessment", "plan"],
        "system_prompt": SYSTEM_PROMPTS["soap"],
    },
    "discharge": {
        "name": "Discharge Summary",
        "description": "Comprehensive discharge documentation",
        "template": DISCHARGE_SUMMARY_TEMPLATE,
        "required_fields": ["patient_name", "admission_date", "discharge_date", "discharge_diagnosis"],
        "system_prompt": SYSTEM_PROMPTS["discharge"],
    },
    "progress": {
        "name": "Progress Note",
        "description": "Daily progress documentation",
        "template": PROGRESS_NOTE_TEMPLATE,
        "required_fields": ["date", "provider", "assessment", "plan"],
        "system_prompt": SYSTEM_PROMPTS["progress"],
    },
    "procedure": {
        "name": "Procedure Note",
        "description": "Operative/procedural documentation",
        "template": PROCEDURE_NOTE_TEMPLATE,
        "required_fields": ["procedure_name", "surgeon", "indication", "description"],
        "system_prompt": SYSTEM_PROMPTS["procedure"],
    },
    "consultation": {
        "name": "Consultation Note",
        "description": "Specialist consultation documentation",
        "template": CONSULTATION_NOTE_TEMPLATE,
        "required_fields": ["service", "consultant", "reason", "recommendations"],
        "system_prompt": SYSTEM_PROMPTS["consultation"],
    },
    "emergency": {
        "name": "ED Note",
        "description": "Emergency department documentation",
        "template": ED_NOTE_TEMPLATE,
        "required_fields": ["chief_complaint", "hpi", "diagnosis", "disposition"],
        "system_prompt": SYSTEM_PROMPTS["emergency"],
    },
}
