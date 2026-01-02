"""
Smart Order Sets AI Service
Provides AI-powered order recommendations for clinical decision support.
Includes diagnosis-based recommendations, evidence-based bundles, and patient-specific adjustments.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from enum import Enum
import logging
from datetime import datetime
import uuid

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Smart Order Sets AI Service",
    description="AI-powered clinical order recommendations",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============= Enums =============

class OrderCategory(str, Enum):
    LABORATORY = "laboratory"
    IMAGING = "imaging"
    MEDICATION = "medication"
    PROCEDURE = "procedure"
    NURSING = "nursing"
    CONSULT = "consult"


class UrgencyLevel(str, Enum):
    STAT = "stat"
    URGENT = "urgent"
    ROUTINE = "routine"
    PRN = "prn"


class SeverityLevel(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MODERATE = "moderate"
    LOW = "low"


# ============= Pydantic Models =============

class PatientContext(BaseModel):
    age: Optional[int] = None
    weight: Optional[float] = None  # kg
    gender: Optional[str] = None
    allergies: Optional[List[str]] = []
    currentMedications: Optional[List[str]] = []
    renalFunction: Optional[str] = None  # normal, mild, moderate, severe, dialysis
    hepaticFunction: Optional[str] = None  # normal, mild, moderate, severe
    pregnancyStatus: Optional[str] = None  # not_pregnant, pregnant, breastfeeding
    comorbidities: Optional[List[str]] = []
    recentLabResults: Optional[Dict[str, Any]] = {}


class DiagnosisRequest(BaseModel):
    diagnosis: str
    icdCode: Optional[str] = None
    symptoms: Optional[List[str]] = []
    patientContext: Optional[PatientContext] = None
    includeAlternatives: Optional[bool] = True


class BundleRequest(BaseModel):
    bundleId: str
    patientContext: Optional[PatientContext] = None


class CustomizeRequest(BaseModel):
    bundleId: Optional[str] = None
    selectedOrders: List[Dict[str, Any]]
    patientContext: PatientContext
    customizations: Optional[Dict[str, Any]] = {}


class PlaceOrdersRequest(BaseModel):
    patientId: str
    orders: List[Dict[str, Any]]
    providerId: str
    notes: Optional[str] = None


class OrderRecommendation(BaseModel):
    id: str
    name: str
    category: OrderCategory
    urgency: UrgencyLevel
    confidence: float
    rationale: str
    alternatives: Optional[List[Dict[str, Any]]] = []
    warnings: Optional[List[str]] = []
    dosing: Optional[Dict[str, Any]] = None
    estimatedCost: Optional[float] = None
    evidenceLevel: Optional[str] = None


class DrugInteraction(BaseModel):
    drug1: str
    drug2: str
    severity: SeverityLevel
    description: str
    recommendation: str


# ============= Knowledge Base =============

# ICD-10 to Order Recommendations Database
DIAGNOSIS_ORDER_DATABASE = {
    # Sepsis Bundle (SEP-1)
    "A41.9": {
        "name": "Sepsis, unspecified organism",
        "category": "infectious",
        "orders": {
            "laboratory": [
                {"name": "CBC with Differential", "urgency": "stat", "confidence": 0.98, "rationale": "Evaluate for leukocytosis/leukopenia, assess infection severity"},
                {"name": "Comprehensive Metabolic Panel", "urgency": "stat", "confidence": 0.97, "rationale": "Assess organ function and electrolyte status"},
                {"name": "Lactate Level", "urgency": "stat", "confidence": 0.99, "rationale": "Key marker for sepsis severity and tissue hypoperfusion"},
                {"name": "Blood Cultures x2", "urgency": "stat", "confidence": 0.98, "rationale": "Identify causative organism before antibiotics"},
                {"name": "Procalcitonin", "urgency": "urgent", "confidence": 0.85, "rationale": "Biomarker to guide antibiotic therapy"},
                {"name": "Urinalysis with Culture", "urgency": "stat", "confidence": 0.88, "rationale": "Rule out urinary source"},
                {"name": "Coagulation Panel (PT/INR, PTT)", "urgency": "urgent", "confidence": 0.82, "rationale": "Assess for DIC"},
            ],
            "imaging": [
                {"name": "Chest X-Ray", "urgency": "stat", "confidence": 0.92, "rationale": "Evaluate for pneumonia or pulmonary source"},
                {"name": "CT Abdomen/Pelvis with Contrast", "urgency": "urgent", "confidence": 0.75, "rationale": "Consider if source unclear, evaluate for abscess"},
            ],
            "medication": [
                {"name": "Vancomycin", "urgency": "stat", "confidence": 0.88, "rationale": "Empiric MRSA coverage",
                 "dosing": {"standard": "25-30 mg/kg loading dose IV", "renalAdjust": True}},
                {"name": "Piperacillin-Tazobactam", "urgency": "stat", "confidence": 0.90, "rationale": "Broad-spectrum empiric coverage",
                 "dosing": {"standard": "4.5g IV q6h", "renalAdjust": True}},
                {"name": "Normal Saline", "urgency": "stat", "confidence": 0.95, "rationale": "Fluid resuscitation 30mL/kg",
                 "dosing": {"standard": "30 mL/kg IV bolus"}},
                {"name": "Norepinephrine", "urgency": "stat", "confidence": 0.80, "rationale": "Vasopressor if hypotensive after fluids",
                 "dosing": {"standard": "0.1-0.3 mcg/kg/min IV", "note": "Titrate to MAP >= 65"}},
            ],
            "procedure": [
                {"name": "Central Line Placement", "urgency": "urgent", "confidence": 0.75, "rationale": "For vasopressor administration and CVP monitoring"},
                {"name": "Arterial Line Placement", "urgency": "urgent", "confidence": 0.70, "rationale": "Continuous BP monitoring if hemodynamically unstable"},
            ],
        },
        "bundle": "sepsis-bundle",
        "evidenceLevel": "Level 1 (Surviving Sepsis Campaign 2021)",
    },

    # Chest Pain / ACS Workup
    "I21.9": {
        "name": "Acute myocardial infarction, unspecified",
        "category": "cardiovascular",
        "orders": {
            "laboratory": [
                {"name": "Troponin I/T (Serial)", "urgency": "stat", "confidence": 0.99, "rationale": "Cardiac biomarker for myocardial injury"},
                {"name": "CBC", "urgency": "stat", "confidence": 0.90, "rationale": "Baseline hematology"},
                {"name": "BMP", "urgency": "stat", "confidence": 0.92, "rationale": "Assess renal function, electrolytes"},
                {"name": "BNP/NT-proBNP", "urgency": "stat", "confidence": 0.85, "rationale": "Assess for heart failure"},
                {"name": "Lipid Panel", "urgency": "routine", "confidence": 0.88, "rationale": "Cardiovascular risk assessment"},
                {"name": "Coagulation Panel", "urgency": "stat", "confidence": 0.85, "rationale": "Pre-procedure evaluation"},
                {"name": "Type and Screen", "urgency": "urgent", "confidence": 0.80, "rationale": "In case of intervention"},
            ],
            "imaging": [
                {"name": "12-Lead ECG", "urgency": "stat", "confidence": 0.99, "rationale": "Assess for STEMI/ischemic changes"},
                {"name": "Chest X-Ray", "urgency": "stat", "confidence": 0.92, "rationale": "Evaluate for pulmonary edema, cardiomegaly"},
                {"name": "Echocardiogram", "urgency": "urgent", "confidence": 0.88, "rationale": "Assess wall motion abnormalities, EF"},
            ],
            "medication": [
                {"name": "Aspirin", "urgency": "stat", "confidence": 0.98, "rationale": "Antiplatelet therapy",
                 "dosing": {"standard": "325 mg PO chewed", "contraindications": ["aspirin allergy", "active bleeding"]}},
                {"name": "Clopidogrel", "urgency": "stat", "confidence": 0.92, "rationale": "Dual antiplatelet therapy",
                 "dosing": {"standard": "600 mg PO loading, then 75 mg daily"}},
                {"name": "Heparin", "urgency": "stat", "confidence": 0.90, "rationale": "Anticoagulation",
                 "dosing": {"standard": "60 units/kg IV bolus, then 12 units/kg/hr"}},
                {"name": "Atorvastatin", "urgency": "stat", "confidence": 0.92, "rationale": "High-intensity statin therapy",
                 "dosing": {"standard": "80 mg PO"}},
                {"name": "Metoprolol", "urgency": "urgent", "confidence": 0.85, "rationale": "Beta-blocker for rate control",
                 "dosing": {"standard": "5 mg IV q5min x3, then 25-50 mg PO q6h", "contraindications": ["hypotension", "bradycardia", "heart block"]}},
                {"name": "Nitroglycerin", "urgency": "stat", "confidence": 0.88, "rationale": "Chest pain relief, reduce preload",
                 "dosing": {"standard": "0.4 mg SL q5min x3, then IV 5-200 mcg/min", "contraindications": ["hypotension", "right ventricular MI"]}},
            ],
            "consult": [
                {"name": "Cardiology Consult", "urgency": "stat", "confidence": 0.98, "rationale": "Urgent cardiac catheterization evaluation"},
            ],
        },
        "bundle": "acs-bundle",
        "evidenceLevel": "Level 1 (ACC/AHA Guidelines)",
    },

    # Community Acquired Pneumonia
    "J18.9": {
        "name": "Pneumonia, unspecified organism",
        "category": "respiratory",
        "orders": {
            "laboratory": [
                {"name": "CBC with Differential", "urgency": "stat", "confidence": 0.95, "rationale": "Assess WBC count and infection severity"},
                {"name": "BMP", "urgency": "stat", "confidence": 0.90, "rationale": "Evaluate renal function, electrolytes"},
                {"name": "Blood Cultures x2", "urgency": "stat", "confidence": 0.88, "rationale": "Identify bacteremia"},
                {"name": "Sputum Culture", "urgency": "urgent", "confidence": 0.80, "rationale": "Identify causative organism"},
                {"name": "Procalcitonin", "urgency": "urgent", "confidence": 0.82, "rationale": "Guide antibiotic therapy"},
                {"name": "Arterial Blood Gas", "urgency": "stat", "confidence": 0.85, "rationale": "Assess oxygenation and acid-base status"},
                {"name": "Legionella Urinary Antigen", "urgency": "urgent", "confidence": 0.75, "rationale": "Rule out Legionella pneumonia"},
                {"name": "Strep pneumoniae Urinary Antigen", "urgency": "urgent", "confidence": 0.75, "rationale": "Rapid pneumococcal detection"},
            ],
            "imaging": [
                {"name": "Chest X-Ray PA/Lateral", "urgency": "stat", "confidence": 0.98, "rationale": "Confirm pneumonia diagnosis, assess extent"},
                {"name": "CT Chest without Contrast", "urgency": "urgent", "confidence": 0.70, "rationale": "If X-ray inconclusive or complications suspected"},
            ],
            "medication": [
                {"name": "Ceftriaxone", "urgency": "stat", "confidence": 0.92, "rationale": "Empiric CAP coverage",
                 "dosing": {"standard": "1g IV q24h", "renalAdjust": False}},
                {"name": "Azithromycin", "urgency": "stat", "confidence": 0.90, "rationale": "Atypical coverage",
                 "dosing": {"standard": "500 mg IV/PO daily"}},
                {"name": "Oxygen Therapy", "urgency": "stat", "confidence": 0.88, "rationale": "Maintain SpO2 > 92%",
                 "dosing": {"standard": "Titrate to SpO2 > 92%"}},
            ],
            "nursing": [
                {"name": "Incentive Spirometry", "urgency": "routine", "confidence": 0.85, "rationale": "Prevent atelectasis"},
                {"name": "Continuous Pulse Oximetry", "urgency": "stat", "confidence": 0.90, "rationale": "Monitor oxygenation"},
            ],
        },
        "bundle": "cap-bundle",
        "evidenceLevel": "Level 1 (IDSA/ATS Guidelines)",
    },

    # Diabetic Ketoacidosis
    "E11.10": {
        "name": "Type 2 diabetes mellitus with ketoacidosis",
        "category": "endocrine",
        "orders": {
            "laboratory": [
                {"name": "Comprehensive Metabolic Panel", "urgency": "stat", "confidence": 0.99, "rationale": "Assess glucose, electrolytes, anion gap, renal function"},
                {"name": "Venous Blood Gas", "urgency": "stat", "confidence": 0.95, "rationale": "Assess pH, bicarbonate, base deficit"},
                {"name": "Beta-Hydroxybutyrate", "urgency": "stat", "confidence": 0.95, "rationale": "Confirm ketosis, monitor resolution"},
                {"name": "CBC", "urgency": "stat", "confidence": 0.88, "rationale": "Assess for infection as precipitant"},
                {"name": "Urinalysis", "urgency": "stat", "confidence": 0.85, "rationale": "Assess for UTI as trigger, ketones"},
                {"name": "Serum Osmolality", "urgency": "stat", "confidence": 0.82, "rationale": "Assess hyperosmolarity"},
                {"name": "Phosphorus, Magnesium", "urgency": "stat", "confidence": 0.85, "rationale": "Will decrease with insulin therapy"},
                {"name": "HbA1c", "urgency": "routine", "confidence": 0.80, "rationale": "Assess glycemic control"},
            ],
            "imaging": [
                {"name": "Chest X-Ray", "urgency": "urgent", "confidence": 0.75, "rationale": "Rule out infection as precipitant"},
            ],
            "medication": [
                {"name": "Regular Insulin IV Drip", "urgency": "stat", "confidence": 0.98, "rationale": "Correct hyperglycemia and ketosis",
                 "dosing": {"standard": "0.1 units/kg/hr IV after bolus 0.1 units/kg"}},
                {"name": "Normal Saline", "urgency": "stat", "confidence": 0.98, "rationale": "Volume resuscitation",
                 "dosing": {"standard": "1-2 L in first hour, then 250-500 mL/hr"}},
                {"name": "Potassium Chloride", "urgency": "stat", "confidence": 0.95, "rationale": "Replace K+ as insulin shifts it intracellularly",
                 "dosing": {"standard": "20-40 mEq/L in IV fluids, titrate to K+ 4-5"}},
                {"name": "Sodium Bicarbonate", "urgency": "urgent", "confidence": 0.60, "rationale": "Only if pH < 6.9",
                 "dosing": {"standard": "100 mEq in 400 mL water over 2 hrs if pH < 6.9"}},
            ],
            "nursing": [
                {"name": "Hourly Glucose Monitoring", "urgency": "stat", "confidence": 0.98, "rationale": "Titrate insulin drip"},
                {"name": "Strict I/O Monitoring", "urgency": "stat", "confidence": 0.95, "rationale": "Fluid balance assessment"},
                {"name": "Q2H Electrolyte Monitoring", "urgency": "stat", "confidence": 0.92, "rationale": "Monitor K+, anion gap"},
            ],
        },
        "bundle": "dka-bundle",
        "evidenceLevel": "Level 1 (ADA Guidelines)",
    },

    # Stroke/CVA
    "I63.9": {
        "name": "Cerebral infarction, unspecified",
        "category": "neurological",
        "orders": {
            "laboratory": [
                {"name": "CBC", "urgency": "stat", "confidence": 0.95, "rationale": "Baseline, check platelets for tPA eligibility"},
                {"name": "Comprehensive Metabolic Panel", "urgency": "stat", "confidence": 0.92, "rationale": "Glucose, renal function"},
                {"name": "Coagulation Panel (PT/INR, PTT)", "urgency": "stat", "confidence": 0.98, "rationale": "tPA eligibility - must be < 1.7 INR"},
                {"name": "Troponin", "urgency": "stat", "confidence": 0.80, "rationale": "Cardiac source evaluation"},
                {"name": "Type and Screen", "urgency": "stat", "confidence": 0.75, "rationale": "In case of intervention"},
                {"name": "Lipid Panel", "urgency": "routine", "confidence": 0.82, "rationale": "Stroke risk factors"},
                {"name": "HbA1c", "urgency": "routine", "confidence": 0.80, "rationale": "Diabetes screening"},
            ],
            "imaging": [
                {"name": "CT Head without Contrast", "urgency": "stat", "confidence": 0.99, "rationale": "Rule out hemorrhage, determine tPA eligibility"},
                {"name": "CT Angiography Head/Neck", "urgency": "stat", "confidence": 0.95, "rationale": "Identify large vessel occlusion for thrombectomy"},
                {"name": "CT Perfusion", "urgency": "stat", "confidence": 0.88, "rationale": "Assess salvageable penumbra"},
                {"name": "MRI Brain with DWI", "urgency": "urgent", "confidence": 0.85, "rationale": "Confirm infarct location and extent"},
                {"name": "Carotid Doppler Ultrasound", "urgency": "urgent", "confidence": 0.80, "rationale": "Evaluate carotid stenosis"},
                {"name": "Echocardiogram with Bubble", "urgency": "urgent", "confidence": 0.78, "rationale": "Evaluate cardiac source, PFO"},
            ],
            "medication": [
                {"name": "Alteplase (tPA)", "urgency": "stat", "confidence": 0.95, "rationale": "Thrombolysis within 4.5 hours of symptom onset",
                 "dosing": {"standard": "0.9 mg/kg IV (max 90 mg), 10% bolus, 90% over 60 min",
                          "contraindications": ["INR > 1.7", "platelets < 100k", "recent surgery", "hemorrhage on CT"]}},
                {"name": "Aspirin", "urgency": "urgent", "confidence": 0.92, "rationale": "Antiplatelet - wait 24h after tPA",
                 "dosing": {"standard": "325 mg PO/PR"}},
                {"name": "Atorvastatin", "urgency": "urgent", "confidence": 0.90, "rationale": "High-intensity statin",
                 "dosing": {"standard": "80 mg PO daily"}},
            ],
            "consult": [
                {"name": "Neurology Consult - Stroke", "urgency": "stat", "confidence": 0.99, "rationale": "Stroke team activation"},
                {"name": "Interventional Neuroradiology", "urgency": "stat", "confidence": 0.88, "rationale": "Thrombectomy evaluation if LVO"},
            ],
            "nursing": [
                {"name": "NIH Stroke Scale Q1H", "urgency": "stat", "confidence": 0.95, "rationale": "Monitor neurological status"},
                {"name": "Neuro Checks Q1H", "urgency": "stat", "confidence": 0.95, "rationale": "Detect deterioration"},
                {"name": "BP Management Protocol", "urgency": "stat", "confidence": 0.92, "rationale": "Permissive HTN unless tPA given"},
                {"name": "NPO/Dysphagia Screening", "urgency": "stat", "confidence": 0.90, "rationale": "Aspiration prevention"},
            ],
        },
        "bundle": "stroke-bundle",
        "evidenceLevel": "Level 1 (AHA/ASA Guidelines)",
    },

    # GI Bleeding
    "K92.2": {
        "name": "Gastrointestinal hemorrhage, unspecified",
        "category": "gastrointestinal",
        "orders": {
            "laboratory": [
                {"name": "CBC", "urgency": "stat", "confidence": 0.99, "rationale": "Assess hemoglobin, platelet count"},
                {"name": "Type and Crossmatch 4 units", "urgency": "stat", "confidence": 0.95, "rationale": "Prepare for transfusion"},
                {"name": "Comprehensive Metabolic Panel", "urgency": "stat", "confidence": 0.92, "rationale": "BUN/Cr ratio, renal function"},
                {"name": "Coagulation Panel", "urgency": "stat", "confidence": 0.90, "rationale": "Assess coagulopathy"},
                {"name": "Lactate", "urgency": "stat", "confidence": 0.85, "rationale": "Assess tissue perfusion"},
                {"name": "Liver Function Tests", "urgency": "urgent", "confidence": 0.82, "rationale": "Assess for liver disease/varices"},
            ],
            "imaging": [
                {"name": "CT Angiography Abdomen", "urgency": "urgent", "confidence": 0.80, "rationale": "Localize bleeding source if unstable"},
            ],
            "medication": [
                {"name": "Pantoprazole", "urgency": "stat", "confidence": 0.95, "rationale": "PPI for suspected upper GI bleed",
                 "dosing": {"standard": "80 mg IV bolus, then 8 mg/hr drip"}},
                {"name": "Octreotide", "urgency": "stat", "confidence": 0.85, "rationale": "If variceal bleed suspected",
                 "dosing": {"standard": "50 mcg IV bolus, then 50 mcg/hr drip"}},
                {"name": "Packed Red Blood Cells", "urgency": "stat", "confidence": 0.90, "rationale": "Transfuse for Hgb < 7 (or < 8 if CAD)",
                 "dosing": {"standard": "Transfuse to goal Hgb 7-9"}},
                {"name": "Fresh Frozen Plasma", "urgency": "urgent", "confidence": 0.75, "rationale": "If INR > 1.5",
                 "dosing": {"standard": "2-4 units IV"}},
            ],
            "procedure": [
                {"name": "Large Bore IV Access x2", "urgency": "stat", "confidence": 0.98, "rationale": "Resuscitation access"},
                {"name": "Nasogastric Tube", "urgency": "urgent", "confidence": 0.80, "rationale": "Assess for upper vs lower GI source"},
            ],
            "consult": [
                {"name": "Gastroenterology Consult", "urgency": "stat", "confidence": 0.98, "rationale": "Urgent endoscopy"},
                {"name": "Interventional Radiology", "urgency": "urgent", "confidence": 0.75, "rationale": "Embolization if endoscopy fails"},
            ],
        },
        "bundle": "gi-bleed-bundle",
        "evidenceLevel": "Level 1 (ACG Guidelines)",
    },

    # Acute Kidney Injury
    "N17.9": {
        "name": "Acute kidney failure, unspecified",
        "category": "renal",
        "orders": {
            "laboratory": [
                {"name": "Comprehensive Metabolic Panel", "urgency": "stat", "confidence": 0.99, "rationale": "Assess creatinine trend, electrolytes"},
                {"name": "Urinalysis with Microscopy", "urgency": "stat", "confidence": 0.95, "rationale": "Assess for ATN, GN, obstruction"},
                {"name": "Urine Electrolytes (FENa)", "urgency": "stat", "confidence": 0.90, "rationale": "Differentiate prerenal vs intrinsic"},
                {"name": "CBC", "urgency": "stat", "confidence": 0.85, "rationale": "Assess for hemolysis, anemia"},
                {"name": "Creatine Kinase", "urgency": "urgent", "confidence": 0.80, "rationale": "Rule out rhabdomyolysis"},
                {"name": "Phosphorus, Calcium, Magnesium", "urgency": "stat", "confidence": 0.88, "rationale": "Electrolyte management"},
                {"name": "Uric Acid", "urgency": "urgent", "confidence": 0.75, "rationale": "Tumor lysis syndrome"},
            ],
            "imaging": [
                {"name": "Renal Ultrasound", "urgency": "urgent", "confidence": 0.95, "rationale": "Rule out obstruction, assess kidney size"},
            ],
            "medication": [
                {"name": "Normal Saline", "urgency": "urgent", "confidence": 0.85, "rationale": "Volume resuscitation if prerenal",
                 "dosing": {"standard": "250-500 mL/hr, assess response"}},
                {"name": "Hold Nephrotoxins", "urgency": "stat", "confidence": 0.98, "rationale": "Stop NSAIDs, aminoglycosides, contrast"},
            ],
            "consult": [
                {"name": "Nephrology Consult", "urgency": "urgent", "confidence": 0.90, "rationale": "Dialysis evaluation, AKI management"},
            ],
            "nursing": [
                {"name": "Strict I/O Monitoring", "urgency": "stat", "confidence": 0.95, "rationale": "Assess fluid balance"},
                {"name": "Daily Weights", "urgency": "stat", "confidence": 0.90, "rationale": "Fluid status assessment"},
                {"name": "Foley Catheter", "urgency": "urgent", "confidence": 0.85, "rationale": "Accurate urine output monitoring"},
            ],
        },
        "bundle": "aki-bundle",
        "evidenceLevel": "Level 1 (KDIGO Guidelines)",
    },
}

# Evidence-based Order Bundles
ORDER_BUNDLES = {
    "sepsis-bundle": {
        "id": "sepsis-bundle",
        "name": "Sepsis Bundle (SEP-1)",
        "description": "Evidence-based sepsis management bundle per Surviving Sepsis Campaign 2021",
        "category": "critical-care",
        "timeConstraints": {
            "1-hour": ["Blood Cultures", "Lactate Level", "Broad-spectrum Antibiotics", "IV Fluids 30mL/kg"],
            "3-hour": ["Repeat Lactate if initial > 2"],
            "6-hour": ["Vasopressors if hypotensive after fluids", "Repeat Lactate if initial elevated"],
        },
        "components": [
            {"name": "Lactate Level", "category": "laboratory", "required": True, "timeframe": "1 hour"},
            {"name": "Blood Cultures x2", "category": "laboratory", "required": True, "timeframe": "1 hour"},
            {"name": "Broad-spectrum Antibiotics", "category": "medication", "required": True, "timeframe": "1 hour"},
            {"name": "IV Crystalloid 30mL/kg", "category": "medication", "required": True, "timeframe": "3 hours", "condition": "Hypotension or Lactate >= 4"},
            {"name": "Vasopressors", "category": "medication", "required": False, "timeframe": "1 hour", "condition": "MAP < 65 after fluids"},
            {"name": "Repeat Lactate", "category": "laboratory", "required": False, "timeframe": "6 hours", "condition": "Initial Lactate > 2"},
        ],
        "qualityMetrics": ["Door to antibiotic time", "3-hour bundle compliance", "6-hour bundle compliance"],
        "evidenceLevel": "Level 1A",
    },
    "acs-bundle": {
        "id": "acs-bundle",
        "name": "Acute Coronary Syndrome Bundle",
        "description": "Evidence-based ACS management per ACC/AHA Guidelines",
        "category": "cardiology",
        "timeConstraints": {
            "10-minute": ["12-Lead ECG"],
            "30-minute": ["Aspirin", "Clopidogrel loading if NSTEMI"],
            "90-minute": ["PCI for STEMI (door-to-balloon)"],
        },
        "components": [
            {"name": "12-Lead ECG", "category": "imaging", "required": True, "timeframe": "10 minutes"},
            {"name": "Troponin (Serial)", "category": "laboratory", "required": True, "timeframe": "immediate"},
            {"name": "Aspirin 325mg", "category": "medication", "required": True, "timeframe": "immediate"},
            {"name": "P2Y12 Inhibitor", "category": "medication", "required": True, "timeframe": "30 minutes"},
            {"name": "Anticoagulation", "category": "medication", "required": True, "timeframe": "30 minutes"},
            {"name": "Beta-blocker", "category": "medication", "required": False, "condition": "No contraindications"},
            {"name": "High-intensity Statin", "category": "medication", "required": True, "timeframe": "24 hours"},
        ],
        "qualityMetrics": ["Door-to-ECG time", "Door-to-balloon time", "DAPT compliance"],
        "evidenceLevel": "Level 1A",
    },
    "stroke-bundle": {
        "id": "stroke-bundle",
        "name": "Acute Stroke Bundle",
        "description": "Evidence-based acute stroke management per AHA/ASA Guidelines",
        "category": "neurology",
        "timeConstraints": {
            "10-minute": ["Neurology notification", "Glucose check"],
            "25-minute": ["CT Head completed"],
            "45-minute": ["CT interpretation", "tPA decision"],
            "60-minute": ["tPA administration if eligible"],
        },
        "components": [
            {"name": "CT Head without Contrast", "category": "imaging", "required": True, "timeframe": "25 minutes"},
            {"name": "Glucose Check", "category": "laboratory", "required": True, "timeframe": "10 minutes"},
            {"name": "Coagulation Panel", "category": "laboratory", "required": True, "timeframe": "45 minutes"},
            {"name": "tPA (Alteplase)", "category": "medication", "required": False, "timeframe": "60 minutes", "condition": "Eligible, within 4.5 hours"},
            {"name": "CT Angiography", "category": "imaging", "required": False, "condition": "LVO screening"},
            {"name": "NIH Stroke Scale", "category": "nursing", "required": True, "timeframe": "immediate"},
            {"name": "Dysphagia Screen", "category": "nursing", "required": True, "timeframe": "before oral intake"},
        ],
        "qualityMetrics": ["Door-to-CT time", "Door-to-needle time", "Door-to-groin time"],
        "evidenceLevel": "Level 1A",
    },
    "dka-bundle": {
        "id": "dka-bundle",
        "name": "Diabetic Ketoacidosis Bundle",
        "description": "Evidence-based DKA management per ADA Guidelines",
        "category": "endocrine",
        "components": [
            {"name": "Comprehensive Metabolic Panel", "category": "laboratory", "required": True, "timeframe": "immediate"},
            {"name": "Venous Blood Gas", "category": "laboratory", "required": True, "timeframe": "immediate"},
            {"name": "Beta-Hydroxybutyrate", "category": "laboratory", "required": True, "timeframe": "immediate"},
            {"name": "IV Fluids (NS 1-2L)", "category": "medication", "required": True, "timeframe": "1 hour"},
            {"name": "Regular Insulin Drip", "category": "medication", "required": True, "timeframe": "after K+ confirmed"},
            {"name": "Potassium Replacement", "category": "medication", "required": True, "condition": "K+ < 5.3"},
            {"name": "Hourly Glucose Monitoring", "category": "nursing", "required": True},
            {"name": "Q2H Electrolyte Monitoring", "category": "nursing", "required": True},
        ],
        "qualityMetrics": ["Time to insulin", "Anion gap closure time", "Hypoglycemia events"],
        "evidenceLevel": "Level 1A",
    },
    "cap-bundle": {
        "id": "cap-bundle",
        "name": "Community-Acquired Pneumonia Bundle",
        "description": "Evidence-based CAP management per IDSA/ATS Guidelines",
        "category": "pulmonology",
        "components": [
            {"name": "Chest X-Ray", "category": "imaging", "required": True, "timeframe": "4 hours"},
            {"name": "Blood Cultures", "category": "laboratory", "required": True, "condition": "Severe CAP"},
            {"name": "Respiratory Pathogen Panel", "category": "laboratory", "required": False},
            {"name": "Empiric Antibiotics", "category": "medication", "required": True, "timeframe": "4 hours"},
            {"name": "Oxygen Therapy", "category": "medication", "required": True, "condition": "SpO2 < 92%"},
            {"name": "CURB-65 Score", "category": "nursing", "required": True, "timeframe": "admission"},
        ],
        "qualityMetrics": ["Time to first antibiotic", "Appropriate antibiotic selection", "Length of stay"],
        "evidenceLevel": "Level 1A",
    },
    "gi-bleed-bundle": {
        "id": "gi-bleed-bundle",
        "name": "GI Bleeding Bundle",
        "description": "Evidence-based GI bleeding management per ACG Guidelines",
        "category": "gastroenterology",
        "components": [
            {"name": "Type and Crossmatch", "category": "laboratory", "required": True, "timeframe": "immediate"},
            {"name": "CBC, BMP, Coags", "category": "laboratory", "required": True, "timeframe": "immediate"},
            {"name": "Large Bore IV x2", "category": "procedure", "required": True, "timeframe": "immediate"},
            {"name": "IV PPI", "category": "medication", "required": True, "timeframe": "1 hour"},
            {"name": "Blood Transfusion", "category": "medication", "required": False, "condition": "Hgb < 7"},
            {"name": "Endoscopy", "category": "procedure", "required": True, "timeframe": "24 hours", "condition": "Stable; urgent if unstable"},
            {"name": "Glasgow-Blatchford Score", "category": "nursing", "required": True},
        ],
        "qualityMetrics": ["Time to endoscopy", "Transfusion threshold adherence", "Rebleed rate"],
        "evidenceLevel": "Level 1A",
    },
    "aki-bundle": {
        "id": "aki-bundle",
        "name": "Acute Kidney Injury Bundle",
        "description": "Evidence-based AKI management per KDIGO Guidelines",
        "category": "nephrology",
        "components": [
            {"name": "Comprehensive Metabolic Panel", "category": "laboratory", "required": True, "timeframe": "immediate"},
            {"name": "Urinalysis with Microscopy", "category": "laboratory", "required": True, "timeframe": "immediate"},
            {"name": "FENa / Urine Electrolytes", "category": "laboratory", "required": True},
            {"name": "Renal Ultrasound", "category": "imaging", "required": True, "timeframe": "24 hours"},
            {"name": "Hold Nephrotoxins", "category": "medication", "required": True, "timeframe": "immediate"},
            {"name": "Fluid Challenge", "category": "medication", "required": False, "condition": "If prerenal suspected"},
            {"name": "Strict I/O", "category": "nursing", "required": True},
            {"name": "Daily Weights", "category": "nursing", "required": True},
        ],
        "qualityMetrics": ["Time to nephrology consult", "Nephrotoxin discontinuation", "Dialysis timing"],
        "evidenceLevel": "Level 1A",
    },
}

# Drug Interaction Database
DRUG_INTERACTIONS = {
    "warfarin": {
        "aspirin": {"severity": "high", "description": "Increased bleeding risk", "recommendation": "Use with caution, consider GI prophylaxis"},
        "ibuprofen": {"severity": "critical", "description": "Significantly increased bleeding risk, GI hemorrhage", "recommendation": "Avoid combination"},
        "amiodarone": {"severity": "high", "description": "Increased INR, bleeding risk", "recommendation": "Reduce warfarin dose 30-50%"},
        "fluconazole": {"severity": "high", "description": "Increased INR", "recommendation": "Reduce warfarin dose, monitor INR closely"},
        "metronidazole": {"severity": "moderate", "description": "Increased anticoagulant effect", "recommendation": "Monitor INR closely"},
    },
    "metformin": {
        "contrast_dye": {"severity": "high", "description": "Lactic acidosis risk", "recommendation": "Hold 48h before/after contrast"},
        "alcohol": {"severity": "moderate", "description": "Increased lactic acidosis risk", "recommendation": "Limit alcohol intake"},
    },
    "simvastatin": {
        "clarithromycin": {"severity": "critical", "description": "Rhabdomyolysis risk", "recommendation": "Use alternative macrolide or statin"},
        "amiodarone": {"severity": "high", "description": "Myopathy risk", "recommendation": "Limit simvastatin to 20mg"},
        "grapefruit_juice": {"severity": "moderate", "description": "Increased statin levels", "recommendation": "Avoid grapefruit"},
    },
    "digoxin": {
        "amiodarone": {"severity": "high", "description": "Increased digoxin levels, toxicity", "recommendation": "Reduce digoxin dose 50%"},
        "verapamil": {"severity": "high", "description": "Increased digoxin levels, bradycardia", "recommendation": "Reduce digoxin dose 30-50%"},
        "clarithromycin": {"severity": "high", "description": "Increased digoxin levels", "recommendation": "Monitor levels closely"},
    },
    "lisinopril": {
        "potassium": {"severity": "high", "description": "Hyperkalemia risk", "recommendation": "Monitor K+ closely"},
        "spironolactone": {"severity": "high", "description": "Hyperkalemia risk", "recommendation": "Monitor K+ very closely"},
        "nsaids": {"severity": "moderate", "description": "Reduced antihypertensive effect, AKI risk", "recommendation": "Avoid if possible"},
    },
    "clopidogrel": {
        "omeprazole": {"severity": "moderate", "description": "Reduced antiplatelet effect", "recommendation": "Use pantoprazole instead"},
        "esomeprazole": {"severity": "moderate", "description": "Reduced antiplatelet effect", "recommendation": "Use pantoprazole instead"},
    },
}

# Renal Dosing Adjustments
RENAL_DOSING = {
    "vancomycin": {
        "normal": "15-20 mg/kg q8-12h",
        "mild": "15-20 mg/kg q12h",
        "moderate": "15-20 mg/kg q24h",
        "severe": "15-20 mg/kg q48h, follow levels",
        "dialysis": "15-20 mg/kg loading, redose per levels post-HD",
    },
    "piperacillin-tazobactam": {
        "normal": "4.5g q6h",
        "mild": "4.5g q6h",
        "moderate": "4.5g q8h",
        "severe": "4.5g q12h",
        "dialysis": "4.5g q12h, dose after HD",
    },
    "enoxaparin": {
        "normal": "1 mg/kg q12h",
        "mild": "1 mg/kg q12h",
        "moderate": "1 mg/kg q24h",
        "severe": "1 mg/kg q24h, monitor anti-Xa",
        "dialysis": "Use unfractionated heparin instead",
    },
    "gabapentin": {
        "normal": "300-600mg TID",
        "mild": "300mg BID-TID",
        "moderate": "300mg daily-BID",
        "severe": "300mg daily",
        "dialysis": "300mg after each HD session",
    },
    "metformin": {
        "normal": "500-1000mg BID",
        "mild": "500-1000mg BID",
        "moderate": "500mg BID (max 1000mg/day)",
        "severe": "Contraindicated",
        "dialysis": "Contraindicated",
    },
}


# ============= Smart Orders AI Class =============

class SmartOrdersAI:
    """AI-powered Smart Order Sets recommendation engine"""

    def __init__(self):
        self.model_version = "1.0.0"

    def get_recommendations(
        self,
        diagnosis: str,
        icd_code: Optional[str] = None,
        symptoms: Optional[List[str]] = None,
        patient_context: Optional[PatientContext] = None,
        include_alternatives: bool = True
    ) -> Dict[str, Any]:
        """
        Generate order recommendations based on diagnosis and patient context.
        """
        recommendations = {
            "laboratory": [],
            "imaging": [],
            "medication": [],
            "procedure": [],
            "nursing": [],
            "consult": [],
        }

        warnings = []
        bundle_suggestion = None

        # Find matching diagnosis in database
        matched_icd = None
        if icd_code and icd_code in DIAGNOSIS_ORDER_DATABASE:
            matched_icd = icd_code
        else:
            # Search by diagnosis name
            diagnosis_lower = diagnosis.lower()
            for icd, data in DIAGNOSIS_ORDER_DATABASE.items():
                if diagnosis_lower in data["name"].lower() or any(
                    keyword in diagnosis_lower
                    for keyword in ["sepsis", "chest pain", "mi", "pneumonia", "dka", "stroke", "cva", "gi bleed", "aki"]
                ):
                    if "sepsis" in diagnosis_lower:
                        matched_icd = "A41.9"
                    elif "chest pain" in diagnosis_lower or "mi" in diagnosis_lower or "myocardial" in diagnosis_lower:
                        matched_icd = "I21.9"
                    elif "pneumonia" in diagnosis_lower:
                        matched_icd = "J18.9"
                    elif "dka" in diagnosis_lower or "ketoacidosis" in diagnosis_lower:
                        matched_icd = "E11.10"
                    elif "stroke" in diagnosis_lower or "cva" in diagnosis_lower:
                        matched_icd = "I63.9"
                    elif "gi bleed" in diagnosis_lower or "gastrointestinal" in diagnosis_lower:
                        matched_icd = "K92.2"
                    elif "aki" in diagnosis_lower or "acute kidney" in diagnosis_lower:
                        matched_icd = "N17.9"
                    break

        if matched_icd and matched_icd in DIAGNOSIS_ORDER_DATABASE:
            diagnosis_data = DIAGNOSIS_ORDER_DATABASE[matched_icd]

            # Process each category
            for category in recommendations.keys():
                if category in diagnosis_data.get("orders", {}):
                    for order in diagnosis_data["orders"][category]:
                        rec = self._process_order(order, category, patient_context)
                        if rec:
                            recommendations[category].append(rec)

            bundle_suggestion = diagnosis_data.get("bundle")

        # Apply patient-specific adjustments
        if patient_context:
            warnings = self._check_patient_warnings(recommendations, patient_context)
            recommendations = self._adjust_for_patient(recommendations, patient_context)

        # Calculate cost estimates
        total_estimated_cost = self._estimate_total_cost(recommendations)

        return {
            "diagnosisCode": matched_icd,
            "diagnosisName": DIAGNOSIS_ORDER_DATABASE.get(matched_icd, {}).get("name", diagnosis),
            "recommendations": recommendations,
            "bundleSuggestion": bundle_suggestion,
            "warnings": warnings,
            "totalEstimatedCost": total_estimated_cost,
            "evidenceLevel": DIAGNOSIS_ORDER_DATABASE.get(matched_icd, {}).get("evidenceLevel", "Expert Opinion"),
            "modelVersion": self.model_version,
            "generatedAt": datetime.utcnow().isoformat(),
        }

    def _process_order(
        self,
        order: Dict[str, Any],
        category: str,
        patient_context: Optional[PatientContext]
    ) -> Dict[str, Any]:
        """Process a single order and generate recommendation"""
        rec = {
            "id": str(uuid.uuid4()),
            "name": order["name"],
            "category": category,
            "urgency": order.get("urgency", "routine"),
            "confidence": order.get("confidence", 0.8),
            "rationale": order.get("rationale", ""),
            "warnings": [],
            "alternatives": [],
        }

        # Add dosing information for medications
        if category == "medication" and "dosing" in order:
            rec["dosing"] = order["dosing"]

            # Adjust for renal function
            if patient_context and patient_context.renalFunction:
                drug_name = order["name"].lower().replace(" ", "-")
                if drug_name in RENAL_DOSING:
                    renal_level = patient_context.renalFunction.lower()
                    if renal_level in RENAL_DOSING[drug_name]:
                        rec["dosing"]["adjusted"] = RENAL_DOSING[drug_name][renal_level]
                        rec["dosing"]["adjustmentReason"] = f"Renal function: {renal_level}"

        # Estimate cost
        rec["estimatedCost"] = self._estimate_order_cost(order["name"], category)

        return rec

    def _check_patient_warnings(
        self,
        recommendations: Dict[str, List],
        patient_context: PatientContext
    ) -> List[Dict[str, str]]:
        """Check for patient-specific warnings (allergies, interactions, contraindications)"""
        warnings = []

        # Check allergies
        if patient_context.allergies:
            allergy_map = {
                "penicillin": ["amoxicillin", "ampicillin", "piperacillin"],
                "sulfa": ["sulfamethoxazole", "bactrim"],
                "aspirin": ["aspirin", "ibuprofen", "naproxen"],
                "nsaid": ["ibuprofen", "naproxen", "ketorolac"],
                "morphine": ["morphine", "codeine", "hydromorphone"],
            }

            for med_rec in recommendations.get("medication", []):
                med_name = med_rec["name"].lower()
                for allergy in patient_context.allergies:
                    allergy_lower = allergy.lower()
                    if allergy_lower in med_name:
                        warnings.append({
                            "type": "allergy",
                            "severity": "critical",
                            "medication": med_rec["name"],
                            "allergy": allergy,
                            "message": f"Patient allergic to {allergy}. Avoid {med_rec['name']}.",
                        })
                    elif allergy_lower in allergy_map:
                        for related_drug in allergy_map[allergy_lower]:
                            if related_drug in med_name:
                                warnings.append({
                                    "type": "allergy",
                                    "severity": "high",
                                    "medication": med_rec["name"],
                                    "allergy": allergy,
                                    "message": f"Patient allergic to {allergy}. {med_rec['name']} may cross-react.",
                                })

        # Check drug interactions with current medications
        if patient_context.currentMedications:
            for med_rec in recommendations.get("medication", []):
                new_med = med_rec["name"].lower()
                for current_med in patient_context.currentMedications:
                    current_med_lower = current_med.lower()

                    # Check interaction database
                    for drug, interactions in DRUG_INTERACTIONS.items():
                        if drug in current_med_lower:
                            for interacting_drug, interaction_info in interactions.items():
                                if interacting_drug in new_med or new_med in interacting_drug:
                                    warnings.append({
                                        "type": "interaction",
                                        "severity": interaction_info["severity"],
                                        "drug1": current_med,
                                        "drug2": med_rec["name"],
                                        "description": interaction_info["description"],
                                        "recommendation": interaction_info["recommendation"],
                                    })

        # Check contraindications
        if patient_context.renalFunction == "dialysis":
            for med_rec in recommendations.get("medication", []):
                if "metformin" in med_rec["name"].lower():
                    warnings.append({
                        "type": "contraindication",
                        "severity": "critical",
                        "medication": med_rec["name"],
                        "reason": "Dialysis patient",
                        "message": "Metformin contraindicated in dialysis patients.",
                    })

        if patient_context.pregnancyStatus == "pregnant":
            teratogenic = ["warfarin", "methotrexate", "isotretinoin", "statins", "ace inhibitors"]
            for med_rec in recommendations.get("medication", []):
                for drug in teratogenic:
                    if drug in med_rec["name"].lower():
                        warnings.append({
                            "type": "contraindication",
                            "severity": "critical",
                            "medication": med_rec["name"],
                            "reason": "Pregnancy",
                            "message": f"{med_rec['name']} is contraindicated in pregnancy.",
                        })

        return warnings

    def _adjust_for_patient(
        self,
        recommendations: Dict[str, List],
        patient_context: PatientContext
    ) -> Dict[str, List]:
        """Adjust recommendations based on patient context"""
        adjusted = recommendations.copy()

        # Weight-based dosing
        if patient_context.weight:
            for med_rec in adjusted.get("medication", []):
                if "dosing" in med_rec and "mg/kg" in str(med_rec.get("dosing", {}).get("standard", "")):
                    # Calculate weight-based dose
                    standard_dose = med_rec["dosing"]["standard"]
                    # This is simplified - in production would parse and calculate
                    med_rec["dosing"]["calculated"] = f"Based on weight {patient_context.weight}kg"

        # Age adjustments
        if patient_context.age:
            if patient_context.age > 65:
                for med_rec in adjusted.get("medication", []):
                    if "benzodiazepine" in med_rec["name"].lower() or \
                       "diphenhydramine" in med_rec["name"].lower():
                        med_rec["warnings"] = med_rec.get("warnings", [])
                        med_rec["warnings"].append("Use with caution in elderly patients (Beers criteria)")

            if patient_context.age < 18:
                # Pediatric adjustments would be applied here
                pass

        return adjusted

    def _estimate_order_cost(self, order_name: str, category: str) -> float:
        """Estimate cost of an order (simplified)"""
        cost_map = {
            "laboratory": {
                "CBC": 15.0,
                "Comprehensive Metabolic Panel": 25.0,
                "Basic Metabolic Panel": 20.0,
                "Blood Cultures": 50.0,
                "Troponin": 35.0,
                "Lactate": 20.0,
                "Procalcitonin": 45.0,
                "Coagulation Panel": 30.0,
                "default": 25.0,
            },
            "imaging": {
                "Chest X-Ray": 75.0,
                "CT Head": 350.0,
                "CT Angiography": 500.0,
                "CT Abdomen": 450.0,
                "MRI": 800.0,
                "Ultrasound": 150.0,
                "ECG": 35.0,
                "Echocardiogram": 250.0,
                "default": 200.0,
            },
            "medication": {
                "Vancomycin": 45.0,
                "Piperacillin-Tazobactam": 55.0,
                "Normal Saline": 5.0,
                "Aspirin": 2.0,
                "Clopidogrel": 8.0,
                "Alteplase": 8500.0,
                "default": 25.0,
            },
            "procedure": {
                "Central Line": 350.0,
                "Arterial Line": 200.0,
                "Intubation": 500.0,
                "default": 300.0,
            },
            "consult": {
                "default": 150.0,
            },
            "nursing": {
                "default": 0.0,
            },
        }

        category_costs = cost_map.get(category, {"default": 50.0})

        for key, cost in category_costs.items():
            if key != "default" and key.lower() in order_name.lower():
                return cost

        return category_costs.get("default", 50.0)

    def _estimate_total_cost(self, recommendations: Dict[str, List]) -> float:
        """Calculate total estimated cost"""
        total = 0.0
        for category, orders in recommendations.items():
            for order in orders:
                total += order.get("estimatedCost", 0)
        return round(total, 2)

    def get_bundles(self) -> List[Dict[str, Any]]:
        """Get all available order bundles"""
        bundles = []
        for bundle_id, bundle_data in ORDER_BUNDLES.items():
            bundles.append({
                "id": bundle_data["id"],
                "name": bundle_data["name"],
                "description": bundle_data["description"],
                "category": bundle_data["category"],
                "componentCount": len(bundle_data["components"]),
                "evidenceLevel": bundle_data.get("evidenceLevel", "Expert Opinion"),
            })
        return bundles

    def get_bundle_details(self, bundle_id: str) -> Optional[Dict[str, Any]]:
        """Get detailed information about a specific bundle"""
        if bundle_id in ORDER_BUNDLES:
            return ORDER_BUNDLES[bundle_id]
        return None

    def customize_bundle(
        self,
        bundle_id: Optional[str],
        selected_orders: List[Dict[str, Any]],
        patient_context: PatientContext,
        customizations: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Customize a bundle or order set for a specific patient"""
        result = {
            "orders": [],
            "warnings": [],
            "modifications": [],
            "totalEstimatedCost": 0.0,
        }

        for order in selected_orders:
            customized_order = order.copy()

            # Apply patient-specific adjustments
            if order.get("category") == "medication":
                # Renal dosing adjustment
                if patient_context.renalFunction:
                    drug_key = order["name"].lower().replace(" ", "-")
                    if drug_key in RENAL_DOSING:
                        renal_level = patient_context.renalFunction.lower()
                        if renal_level in RENAL_DOSING[drug_key]:
                            customized_order["adjustedDosing"] = RENAL_DOSING[drug_key][renal_level]
                            result["modifications"].append({
                                "order": order["name"],
                                "type": "renal_adjustment",
                                "reason": f"Adjusted for {renal_level} renal function",
                                "newDose": RENAL_DOSING[drug_key][renal_level],
                            })

                # Weight-based dosing
                if patient_context.weight and customizations:
                    if customizations.get("useWeightBasedDosing"):
                        customized_order["calculatedDose"] = f"Based on {patient_context.weight}kg"

            result["orders"].append(customized_order)

        # Check for warnings
        all_meds = [o for o in selected_orders if o.get("category") == "medication"]
        if all_meds:
            recommendations = {"medication": all_meds}
            result["warnings"] = self._check_patient_warnings(recommendations, patient_context)

        # Calculate total cost
        for order in result["orders"]:
            cost = self._estimate_order_cost(order["name"], order.get("category", "laboratory"))
            order["estimatedCost"] = cost
            result["totalEstimatedCost"] += cost

        result["totalEstimatedCost"] = round(result["totalEstimatedCost"], 2)

        return result

    def check_drug_interactions(self, medications: List[str]) -> List[Dict[str, Any]]:
        """Check for drug interactions among a list of medications"""
        interactions = []

        meds_lower = [m.lower() for m in medications]

        for i, med1 in enumerate(meds_lower):
            for med2 in meds_lower[i+1:]:
                # Check in interaction database
                for drug, drug_interactions in DRUG_INTERACTIONS.items():
                    if drug in med1:
                        for interacting_drug, info in drug_interactions.items():
                            if interacting_drug in med2:
                                interactions.append({
                                    "drug1": medications[meds_lower.index(med1)],
                                    "drug2": medications[meds_lower.index(med2)],
                                    "severity": info["severity"],
                                    "description": info["description"],
                                    "recommendation": info["recommendation"],
                                })
                    elif drug in med2:
                        for interacting_drug, info in drug_interactions.items():
                            if interacting_drug in med1:
                                interactions.append({
                                    "drug1": medications[meds_lower.index(med2)],
                                    "drug2": medications[meds_lower.index(med1)],
                                    "severity": info["severity"],
                                    "description": info["description"],
                                    "recommendation": info["recommendation"],
                                })

        return interactions


# Initialize AI instance
smart_orders_ai = SmartOrdersAI()


# ============= API Endpoints =============

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "smart-orders-ai",
        "version": smart_orders_ai.model_version,
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.post("/api/recommend")
async def get_recommendations(request: DiagnosisRequest):
    """Get AI-powered order recommendations for a diagnosis"""
    try:
        recommendations = smart_orders_ai.get_recommendations(
            diagnosis=request.diagnosis,
            icd_code=request.icdCode,
            symptoms=request.symptoms,
            patient_context=request.patientContext,
            include_alternatives=request.includeAlternatives,
        )
        return recommendations
    except Exception as e:
        logger.error(f"Error generating recommendations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/bundles")
async def get_bundles():
    """Get all available order bundles"""
    try:
        bundles = smart_orders_ai.get_bundles()
        return {"bundles": bundles}
    except Exception as e:
        logger.error(f"Error getting bundles: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/bundles/{bundle_id}")
async def get_bundle_details(bundle_id: str):
    """Get details of a specific order bundle"""
    try:
        bundle = smart_orders_ai.get_bundle_details(bundle_id)
        if not bundle:
            raise HTTPException(status_code=404, detail="Bundle not found")
        return bundle
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting bundle details: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/customize")
async def customize_bundle(request: CustomizeRequest):
    """Customize orders for a specific patient"""
    try:
        result = smart_orders_ai.customize_bundle(
            bundle_id=request.bundleId,
            selected_orders=request.selectedOrders,
            patient_context=request.patientContext,
            customizations=request.customizations,
        )
        return result
    except Exception as e:
        logger.error(f"Error customizing bundle: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/check-interactions")
async def check_interactions(medications: List[str]):
    """Check for drug interactions"""
    try:
        interactions = smart_orders_ai.check_drug_interactions(medications)
        return {
            "interactions": interactions,
            "hasInteractions": len(interactions) > 0,
            "criticalCount": len([i for i in interactions if i["severity"] == "critical"]),
            "highCount": len([i for i in interactions if i["severity"] == "high"]),
        }
    except Exception as e:
        logger.error(f"Error checking interactions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/place")
async def place_orders(request: PlaceOrdersRequest):
    """Place selected orders (simulation endpoint)"""
    try:
        # In production, this would integrate with the hospital's order management system
        order_ids = [str(uuid.uuid4()) for _ in request.orders]

        return {
            "success": True,
            "message": f"Successfully placed {len(request.orders)} orders",
            "orderIds": order_ids,
            "patientId": request.patientId,
            "providerId": request.providerId,
            "placedAt": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        logger.error(f"Error placing orders: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/history/{patient_id}")
async def get_order_history(patient_id: str):
    """Get patient's order history (simulation endpoint)"""
    try:
        # In production, this would query the database
        # Returning mock data for demonstration
        return {
            "patientId": patient_id,
            "orders": [
                {
                    "id": str(uuid.uuid4()),
                    "date": "2024-01-15T10:30:00Z",
                    "diagnosis": "Sepsis",
                    "orderCount": 15,
                    "status": "completed",
                },
                {
                    "id": str(uuid.uuid4()),
                    "date": "2024-01-10T14:45:00Z",
                    "diagnosis": "Community Acquired Pneumonia",
                    "orderCount": 8,
                    "status": "completed",
                },
            ],
        }
    except Exception as e:
        logger.error(f"Error getting order history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Run the application
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8013)
