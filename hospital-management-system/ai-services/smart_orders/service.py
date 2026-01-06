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
import os
import asyncio

# OpenAI integration
try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    OpenAI = None

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

    # COPD Exacerbation
    "J44.1": {
        "name": "Chronic obstructive pulmonary disease with acute exacerbation",
        "category": "respiratory",
        "orders": {
            "laboratory": [
                {"name": "Arterial Blood Gas", "urgency": "stat", "confidence": 0.95, "rationale": "Assess oxygenation, CO2 retention, pH"},
                {"name": "CBC with Differential", "urgency": "stat", "confidence": 0.90, "rationale": "Assess for infection, polycythemia"},
                {"name": "BMP", "urgency": "stat", "confidence": 0.88, "rationale": "Electrolytes, renal function, bicarbonate"},
                {"name": "BNP/NT-proBNP", "urgency": "urgent", "confidence": 0.82, "rationale": "Rule out concurrent heart failure"},
                {"name": "Procalcitonin", "urgency": "urgent", "confidence": 0.78, "rationale": "Guide antibiotic therapy"},
                {"name": "Sputum Culture", "urgency": "urgent", "confidence": 0.75, "rationale": "If purulent sputum present"},
                {"name": "Respiratory Viral Panel", "urgency": "urgent", "confidence": 0.72, "rationale": "Identify viral trigger"},
            ],
            "imaging": [
                {"name": "Chest X-Ray PA/Lateral", "urgency": "stat", "confidence": 0.95, "rationale": "Rule out pneumonia, pneumothorax"},
                {"name": "CT Chest without Contrast", "urgency": "urgent", "confidence": 0.65, "rationale": "If X-ray inconclusive or PE suspected"},
            ],
            "medication": [
                {"name": "Albuterol Nebulizer", "urgency": "stat", "confidence": 0.98, "rationale": "Bronchodilation",
                 "dosing": {"standard": "2.5 mg q20min x3, then q4h PRN"}},
                {"name": "Ipratropium Nebulizer", "urgency": "stat", "confidence": 0.95, "rationale": "Anticholinergic bronchodilation",
                 "dosing": {"standard": "0.5 mg q20min x3, then q4-6h"}},
                {"name": "Prednisone/Methylprednisolone", "urgency": "stat", "confidence": 0.95, "rationale": "Reduce airway inflammation",
                 "dosing": {"standard": "Prednisone 40 mg PO daily x5 days or Methylprednisolone 125 mg IV x1"}},
                {"name": "Azithromycin", "urgency": "urgent", "confidence": 0.80, "rationale": "If signs of bacterial infection",
                 "dosing": {"standard": "500 mg PO/IV day 1, then 250 mg daily x4 days"}},
                {"name": "Oxygen Therapy", "urgency": "stat", "confidence": 0.95, "rationale": "Target SpO2 88-92% to avoid CO2 retention",
                 "dosing": {"standard": "Titrate to SpO2 88-92%"}},
            ],
            "procedure": [
                {"name": "BiPAP/NIPPV", "urgency": "stat", "confidence": 0.85, "rationale": "If respiratory acidosis or distress"},
            ],
            "nursing": [
                {"name": "Continuous Pulse Oximetry", "urgency": "stat", "confidence": 0.95, "rationale": "Monitor oxygenation"},
                {"name": "Respiratory Rate Monitoring", "urgency": "stat", "confidence": 0.92, "rationale": "Assess work of breathing"},
                {"name": "Peak Flow Monitoring", "urgency": "routine", "confidence": 0.80, "rationale": "Assess response to bronchodilators"},
            ],
            "consult": [
                {"name": "Pulmonology Consult", "urgency": "urgent", "confidence": 0.75, "rationale": "If severe or not responding"},
                {"name": "Respiratory Therapy", "urgency": "stat", "confidence": 0.90, "rationale": "Nebulizer treatments, airway management"},
            ],
        },
        "bundle": "copd-bundle",
        "evidenceLevel": "Level 1 (GOLD Guidelines 2023)",
    },

    # Heart Failure
    "I50.9": {
        "name": "Heart failure, unspecified",
        "category": "cardiovascular",
        "orders": {
            "laboratory": [
                {"name": "BNP/NT-proBNP", "urgency": "stat", "confidence": 0.98, "rationale": "Confirm diagnosis, assess severity, guide therapy"},
                {"name": "Comprehensive Metabolic Panel", "urgency": "stat", "confidence": 0.95, "rationale": "Renal function, electrolytes for diuretic therapy"},
                {"name": "CBC", "urgency": "stat", "confidence": 0.88, "rationale": "Assess for anemia as exacerbating factor"},
                {"name": "Troponin", "urgency": "stat", "confidence": 0.90, "rationale": "Rule out ACS as precipitant"},
                {"name": "TSH", "urgency": "urgent", "confidence": 0.78, "rationale": "Rule out thyroid disease as cause"},
                {"name": "Liver Function Tests", "urgency": "urgent", "confidence": 0.75, "rationale": "Assess hepatic congestion"},
                {"name": "Iron Studies", "urgency": "routine", "confidence": 0.70, "rationale": "Iron deficiency common in HF"},
                {"name": "Lipid Panel", "urgency": "routine", "confidence": 0.72, "rationale": "Cardiovascular risk assessment"},
            ],
            "imaging": [
                {"name": "Chest X-Ray", "urgency": "stat", "confidence": 0.95, "rationale": "Assess pulmonary congestion, cardiomegaly"},
                {"name": "Echocardiogram", "urgency": "urgent", "confidence": 0.98, "rationale": "Assess EF, valvular function, wall motion"},
                {"name": "12-Lead ECG", "urgency": "stat", "confidence": 0.92, "rationale": "Assess rhythm, ischemia, LVH"},
            ],
            "medication": [
                {"name": "Furosemide", "urgency": "stat", "confidence": 0.95, "rationale": "Diuresis for volume overload",
                 "dosing": {"standard": "40 mg IV (or 2.5x home dose)", "renalAdjust": True}},
                {"name": "Oxygen Therapy", "urgency": "stat", "confidence": 0.88, "rationale": "If hypoxic",
                 "dosing": {"standard": "Titrate to SpO2 > 94%"}},
                {"name": "Nitroglycerin", "urgency": "urgent", "confidence": 0.80, "rationale": "Reduce preload if hypertensive",
                 "dosing": {"standard": "5-200 mcg/min IV", "contraindications": ["hypotension", "SBP < 90"]}},
                {"name": "ACE Inhibitor/ARB", "urgency": "urgent", "confidence": 0.85, "rationale": "Neurohormonal blockade if not hypotensive",
                 "dosing": {"standard": "Continue home dose or start low if new", "renalAdjust": True}},
                {"name": "Beta-Blocker", "urgency": "routine", "confidence": 0.82, "rationale": "Continue if stable, hold if decompensated",
                 "dosing": {"standard": "Continue home dose", "contraindications": ["cardiogenic shock", "severe bradycardia"]}},
            ],
            "nursing": [
                {"name": "Daily Weights", "urgency": "stat", "confidence": 0.98, "rationale": "Monitor fluid status"},
                {"name": "Strict I/O Monitoring", "urgency": "stat", "confidence": 0.95, "rationale": "Assess diuretic response"},
                {"name": "Fluid Restriction", "urgency": "stat", "confidence": 0.90, "rationale": "1.5-2L daily",
                 "dosing": {"standard": "1.5-2 L/day fluid restriction"}},
                {"name": "Sodium Restricted Diet", "urgency": "stat", "confidence": 0.88, "rationale": "< 2g sodium daily"},
                {"name": "Telemetry Monitoring", "urgency": "stat", "confidence": 0.92, "rationale": "Arrhythmia detection"},
            ],
            "consult": [
                {"name": "Cardiology Consult", "urgency": "urgent", "confidence": 0.90, "rationale": "HF management, advanced therapies evaluation"},
            ],
        },
        "bundle": "hf-bundle",
        "evidenceLevel": "Level 1 (ACC/AHA HF Guidelines 2022)",
    },

    # Pulmonary Embolism
    "I26.9": {
        "name": "Pulmonary embolism without acute cor pulmonale",
        "category": "cardiovascular",
        "orders": {
            "laboratory": [
                {"name": "D-Dimer", "urgency": "stat", "confidence": 0.92, "rationale": "If low/intermediate pretest probability"},
                {"name": "Troponin", "urgency": "stat", "confidence": 0.90, "rationale": "Risk stratification, RV strain"},
                {"name": "BNP/NT-proBNP", "urgency": "stat", "confidence": 0.88, "rationale": "Risk stratification"},
                {"name": "CBC", "urgency": "stat", "confidence": 0.85, "rationale": "Baseline for anticoagulation"},
                {"name": "Comprehensive Metabolic Panel", "urgency": "stat", "confidence": 0.88, "rationale": "Renal function for anticoagulation dosing"},
                {"name": "Coagulation Panel (PT/INR, PTT)", "urgency": "stat", "confidence": 0.90, "rationale": "Baseline coagulation status"},
                {"name": "Type and Screen", "urgency": "urgent", "confidence": 0.75, "rationale": "If considering thrombolysis"},
                {"name": "ABG", "urgency": "urgent", "confidence": 0.78, "rationale": "If hypoxic or respiratory distress"},
            ],
            "imaging": [
                {"name": "CT Pulmonary Angiography (CTPA)", "urgency": "stat", "confidence": 0.98, "rationale": "Definitive diagnosis of PE"},
                {"name": "Chest X-Ray", "urgency": "stat", "confidence": 0.85, "rationale": "Exclude other causes, baseline"},
                {"name": "12-Lead ECG", "urgency": "stat", "confidence": 0.90, "rationale": "RV strain pattern, S1Q3T3"},
                {"name": "Echocardiogram", "urgency": "urgent", "confidence": 0.88, "rationale": "RV function, risk stratification"},
                {"name": "Lower Extremity Doppler", "urgency": "urgent", "confidence": 0.80, "rationale": "Source of DVT"},
            ],
            "medication": [
                {"name": "Heparin", "urgency": "stat", "confidence": 0.95, "rationale": "Anticoagulation",
                 "dosing": {"standard": "80 units/kg IV bolus, then 18 units/kg/hr"}},
                {"name": "Enoxaparin", "urgency": "stat", "confidence": 0.92, "rationale": "Alternative anticoagulation",
                 "dosing": {"standard": "1 mg/kg SC q12h", "renalAdjust": True}},
                {"name": "Rivaroxaban", "urgency": "urgent", "confidence": 0.88, "rationale": "DOAC option if stable",
                 "dosing": {"standard": "15 mg PO BID x21 days, then 20 mg daily", "contraindications": ["CrCl < 30", "pregnancy"]}},
                {"name": "Alteplase (tPA)", "urgency": "stat", "confidence": 0.90, "rationale": "Massive PE with hemodynamic instability",
                 "dosing": {"standard": "100 mg IV over 2 hours", "contraindications": ["recent surgery", "active bleeding", "stroke"]}},
                {"name": "Oxygen Therapy", "urgency": "stat", "confidence": 0.90, "rationale": "Maintain SpO2 > 92%",
                 "dosing": {"standard": "Titrate to SpO2 > 92%"}},
            ],
            "procedure": [
                {"name": "IVC Filter Placement", "urgency": "urgent", "confidence": 0.70, "rationale": "If anticoagulation contraindicated"},
            ],
            "nursing": [
                {"name": "Continuous Pulse Oximetry", "urgency": "stat", "confidence": 0.95, "rationale": "Monitor oxygenation"},
                {"name": "Telemetry Monitoring", "urgency": "stat", "confidence": 0.92, "rationale": "Arrhythmia, RV strain monitoring"},
                {"name": "Fall Precautions", "urgency": "stat", "confidence": 0.88, "rationale": "Anticoagulation bleeding risk"},
            ],
            "consult": [
                {"name": "Pulmonology Consult", "urgency": "urgent", "confidence": 0.85, "rationale": "PE management"},
                {"name": "Interventional Radiology", "urgency": "urgent", "confidence": 0.75, "rationale": "Catheter-directed therapy if indicated"},
            ],
        },
        "bundle": "pe-bundle",
        "evidenceLevel": "Level 1 (ESC/AHA PE Guidelines)",
    },

    # Atrial Fibrillation
    "I48.91": {
        "name": "Unspecified atrial fibrillation",
        "category": "cardiovascular",
        "orders": {
            "laboratory": [
                {"name": "CBC", "urgency": "stat", "confidence": 0.88, "rationale": "Baseline, assess for anemia"},
                {"name": "Comprehensive Metabolic Panel", "urgency": "stat", "confidence": 0.90, "rationale": "Electrolytes, renal function"},
                {"name": "TSH", "urgency": "stat", "confidence": 0.92, "rationale": "Hyperthyroidism as cause"},
                {"name": "Troponin", "urgency": "stat", "confidence": 0.85, "rationale": "Rule out ACS as precipitant"},
                {"name": "BNP/NT-proBNP", "urgency": "urgent", "confidence": 0.80, "rationale": "Assess for heart failure"},
                {"name": "Coagulation Panel", "urgency": "stat", "confidence": 0.88, "rationale": "Baseline for anticoagulation"},
                {"name": "Magnesium", "urgency": "stat", "confidence": 0.85, "rationale": "Low Mg can precipitate arrhythmia"},
            ],
            "imaging": [
                {"name": "12-Lead ECG", "urgency": "stat", "confidence": 0.99, "rationale": "Confirm AF, assess rate, rule out WPW"},
                {"name": "Chest X-Ray", "urgency": "stat", "confidence": 0.85, "rationale": "Assess heart size, pulmonary congestion"},
                {"name": "Echocardiogram", "urgency": "urgent", "confidence": 0.95, "rationale": "LV function, valvular disease, LA size"},
                {"name": "TEE", "urgency": "urgent", "confidence": 0.88, "rationale": "If cardioversion planned, rule out LAA thrombus"},
            ],
            "medication": [
                {"name": "Metoprolol", "urgency": "stat", "confidence": 0.92, "rationale": "Rate control",
                 "dosing": {"standard": "5 mg IV q5min x3 (max 15 mg), then 25-100 mg PO BID",
                          "contraindications": ["hypotension", "bradycardia", "severe HF"]}},
                {"name": "Diltiazem", "urgency": "stat", "confidence": 0.90, "rationale": "Rate control alternative",
                 "dosing": {"standard": "0.25 mg/kg IV bolus, then 5-15 mg/hr infusion",
                          "contraindications": ["hypotension", "HFrEF", "WPW"]}},
                {"name": "Amiodarone", "urgency": "urgent", "confidence": 0.85, "rationale": "Rate/rhythm control if HF",
                 "dosing": {"standard": "150 mg IV over 10 min, then 1 mg/min x6h, then 0.5 mg/min"}},
                {"name": "Digoxin", "urgency": "urgent", "confidence": 0.75, "rationale": "Rate control in HF patients",
                 "dosing": {"standard": "0.25-0.5 mg IV, then 0.125-0.25 mg daily", "renalAdjust": True}},
                {"name": "Heparin", "urgency": "urgent", "confidence": 0.90, "rationale": "Anticoagulation if AF > 48h or unknown",
                 "dosing": {"standard": "80 units/kg bolus, then 18 units/kg/hr"}},
                {"name": "Apixaban", "urgency": "urgent", "confidence": 0.92, "rationale": "DOAC for stroke prevention",
                 "dosing": {"standard": "5 mg PO BID (2.5 mg if age > 80, weight < 60 kg, or Cr > 1.5)",
                          "contraindications": ["CrCl < 25", "mechanical valve"]}},
            ],
            "nursing": [
                {"name": "Continuous Telemetry", "urgency": "stat", "confidence": 0.98, "rationale": "Monitor heart rate and rhythm"},
                {"name": "Vital Signs q4h", "urgency": "stat", "confidence": 0.90, "rationale": "Hemodynamic monitoring"},
                {"name": "CHA2DS2-VASc Score", "urgency": "stat", "confidence": 0.95, "rationale": "Stroke risk stratification"},
            ],
            "consult": [
                {"name": "Cardiology Consult", "urgency": "urgent", "confidence": 0.90, "rationale": "Rate vs rhythm control strategy"},
                {"name": "Electrophysiology", "urgency": "routine", "confidence": 0.75, "rationale": "Ablation candidacy evaluation"},
            ],
        },
        "bundle": "afib-bundle",
        "evidenceLevel": "Level 1 (ACC/AHA AF Guidelines 2023)",
    },

    # Hypertensive Crisis
    "I16.9": {
        "name": "Hypertensive crisis, unspecified",
        "category": "cardiovascular",
        "orders": {
            "laboratory": [
                {"name": "Comprehensive Metabolic Panel", "urgency": "stat", "confidence": 0.95, "rationale": "Renal function, electrolytes"},
                {"name": "CBC", "urgency": "stat", "confidence": 0.85, "rationale": "Microangiopathic hemolytic anemia"},
                {"name": "Urinalysis", "urgency": "stat", "confidence": 0.90, "rationale": "Proteinuria, hematuria - renal damage"},
                {"name": "Troponin", "urgency": "stat", "confidence": 0.88, "rationale": "Myocardial injury assessment"},
                {"name": "BNP/NT-proBNP", "urgency": "stat", "confidence": 0.82, "rationale": "Heart failure assessment"},
                {"name": "Peripheral Blood Smear", "urgency": "urgent", "confidence": 0.75, "rationale": "Schistocytes if MAHA suspected"},
                {"name": "LDH, Haptoglobin", "urgency": "urgent", "confidence": 0.72, "rationale": "Hemolysis markers"},
                {"name": "Urine Drug Screen", "urgency": "urgent", "confidence": 0.70, "rationale": "Cocaine, amphetamines"},
            ],
            "imaging": [
                {"name": "12-Lead ECG", "urgency": "stat", "confidence": 0.95, "rationale": "LVH, ischemia, arrhythmia"},
                {"name": "Chest X-Ray", "urgency": "stat", "confidence": 0.92, "rationale": "Pulmonary edema, cardiomegaly"},
                {"name": "CT Head without Contrast", "urgency": "stat", "confidence": 0.90, "rationale": "If neurological symptoms - stroke, hemorrhage"},
                {"name": "Echocardiogram", "urgency": "urgent", "confidence": 0.85, "rationale": "LV function, aortic dissection"},
                {"name": "CT Angiography Chest", "urgency": "urgent", "confidence": 0.80, "rationale": "If aortic dissection suspected"},
            ],
            "medication": [
                {"name": "Nicardipine", "urgency": "stat", "confidence": 0.95, "rationale": "Titratable IV antihypertensive",
                 "dosing": {"standard": "5 mg/hr IV, increase 2.5 mg/hr q5-15min, max 15 mg/hr"}},
                {"name": "Labetalol", "urgency": "stat", "confidence": 0.92, "rationale": "Alpha/beta blockade",
                 "dosing": {"standard": "20 mg IV, then 40-80 mg q10min (max 300 mg) or 0.5-2 mg/min infusion",
                          "contraindications": ["bradycardia", "heart block", "asthma", "cocaine use"]}},
                {"name": "Nitroprusside", "urgency": "stat", "confidence": 0.85, "rationale": "Severe hypertensive emergency",
                 "dosing": {"standard": "0.25-10 mcg/kg/min IV", "note": "Requires arterial line monitoring"}},
                {"name": "Esmolol", "urgency": "stat", "confidence": 0.88, "rationale": "If aortic dissection suspected",
                 "dosing": {"standard": "500 mcg/kg IV bolus, then 50-200 mcg/kg/min"}},
                {"name": "Nitroglycerin", "urgency": "stat", "confidence": 0.82, "rationale": "If ACS or pulmonary edema",
                 "dosing": {"standard": "5-200 mcg/min IV", "contraindications": ["aortic stenosis", "hypertrophic cardiomyopathy"]}},
                {"name": "Hydralazine", "urgency": "urgent", "confidence": 0.78, "rationale": "If pregnancy (eclampsia)",
                 "dosing": {"standard": "10-20 mg IV q4-6h"}},
            ],
            "procedure": [
                {"name": "Arterial Line Placement", "urgency": "stat", "confidence": 0.90, "rationale": "Continuous BP monitoring"},
            ],
            "nursing": [
                {"name": "Continuous BP Monitoring", "urgency": "stat", "confidence": 0.98, "rationale": "Arterial line or q5min cuff"},
                {"name": "Neurological Checks q1h", "urgency": "stat", "confidence": 0.92, "rationale": "Monitor for stroke"},
                {"name": "Telemetry Monitoring", "urgency": "stat", "confidence": 0.90, "rationale": "Arrhythmia detection"},
                {"name": "Strict I/O Monitoring", "urgency": "stat", "confidence": 0.85, "rationale": "Renal function assessment"},
            ],
            "consult": [
                {"name": "Cardiology Consult", "urgency": "urgent", "confidence": 0.85, "rationale": "End-organ damage evaluation"},
                {"name": "Nephrology Consult", "urgency": "urgent", "confidence": 0.78, "rationale": "If AKI present"},
                {"name": "Neurology Consult", "urgency": "urgent", "confidence": 0.82, "rationale": "If neurological symptoms"},
            ],
        },
        "bundle": "htn-emergency-bundle",
        "evidenceLevel": "Level 1 (ACC/AHA Hypertension Guidelines)",
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
    "copd-bundle": {
        "id": "copd-bundle",
        "name": "COPD Exacerbation Bundle",
        "description": "Evidence-based COPD exacerbation management per GOLD Guidelines 2023",
        "category": "pulmonology",
        "components": [
            {"name": "Arterial Blood Gas", "category": "laboratory", "required": True, "timeframe": "immediate"},
            {"name": "Chest X-Ray", "category": "imaging", "required": True, "timeframe": "2 hours"},
            {"name": "Short-acting Bronchodilators", "category": "medication", "required": True, "timeframe": "immediate"},
            {"name": "Systemic Corticosteroids", "category": "medication", "required": True, "timeframe": "1 hour"},
            {"name": "Oxygen Therapy", "category": "medication", "required": True, "condition": "Target SpO2 88-92%"},
            {"name": "Antibiotics", "category": "medication", "required": False, "condition": "If increased purulent sputum"},
            {"name": "BiPAP/NIPPV", "category": "procedure", "required": False, "condition": "If respiratory acidosis"},
            {"name": "Continuous Pulse Oximetry", "category": "nursing", "required": True},
        ],
        "qualityMetrics": ["Time to bronchodilator", "Appropriate corticosteroid use", "NIPPV utilization when indicated"],
        "evidenceLevel": "Level 1A",
    },
    "hf-bundle": {
        "id": "hf-bundle",
        "name": "Heart Failure Bundle",
        "description": "Evidence-based acute decompensated HF management per ACC/AHA Guidelines 2022",
        "category": "cardiology",
        "components": [
            {"name": "BNP/NT-proBNP", "category": "laboratory", "required": True, "timeframe": "immediate"},
            {"name": "Comprehensive Metabolic Panel", "category": "laboratory", "required": True, "timeframe": "immediate"},
            {"name": "Chest X-Ray", "category": "imaging", "required": True, "timeframe": "2 hours"},
            {"name": "Echocardiogram", "category": "imaging", "required": True, "timeframe": "24 hours"},
            {"name": "IV Diuretics", "category": "medication", "required": True, "timeframe": "1 hour"},
            {"name": "Oxygen Therapy", "category": "medication", "required": False, "condition": "If hypoxic"},
            {"name": "Daily Weights", "category": "nursing", "required": True},
            {"name": "Strict I/O Monitoring", "category": "nursing", "required": True},
            {"name": "Fluid Restriction", "category": "nursing", "required": True, "condition": "1.5-2 L/day"},
            {"name": "Sodium Restriction", "category": "nursing", "required": True, "condition": "< 2g/day"},
        ],
        "qualityMetrics": ["Time to diuresis", "Net fluid balance at 24h", "Readmission rate"],
        "evidenceLevel": "Level 1A",
    },
    "pe-bundle": {
        "id": "pe-bundle",
        "name": "Pulmonary Embolism Bundle",
        "description": "Evidence-based PE management per ESC/AHA Guidelines",
        "category": "pulmonology",
        "components": [
            {"name": "CT Pulmonary Angiography", "category": "imaging", "required": True, "timeframe": "2 hours"},
            {"name": "Troponin", "category": "laboratory", "required": True, "timeframe": "immediate"},
            {"name": "BNP/NT-proBNP", "category": "laboratory", "required": True, "timeframe": "immediate"},
            {"name": "Echocardiogram", "category": "imaging", "required": False, "condition": "If submassive/massive PE"},
            {"name": "Anticoagulation", "category": "medication", "required": True, "timeframe": "immediate"},
            {"name": "Thrombolysis", "category": "medication", "required": False, "condition": "If massive PE with hemodynamic instability"},
            {"name": "Oxygen Therapy", "category": "medication", "required": True, "condition": "If hypoxic"},
            {"name": "Continuous Pulse Oximetry", "category": "nursing", "required": True},
            {"name": "Telemetry Monitoring", "category": "nursing", "required": True},
        ],
        "qualityMetrics": ["Time to anticoagulation", "Appropriate risk stratification", "30-day mortality"],
        "evidenceLevel": "Level 1A",
    },
    "afib-bundle": {
        "id": "afib-bundle",
        "name": "Atrial Fibrillation Bundle",
        "description": "Evidence-based AF management per ACC/AHA Guidelines 2023",
        "category": "cardiology",
        "timeConstraints": {
            "15-minute": ["12-Lead ECG"],
            "1-hour": ["Rate control medication if HR > 110"],
            "24-hour": ["Anticoagulation decision based on CHA2DS2-VASc"],
        },
        "components": [
            {"name": "12-Lead ECG", "category": "imaging", "required": True, "timeframe": "15 minutes"},
            {"name": "TSH", "category": "laboratory", "required": True, "timeframe": "24 hours"},
            {"name": "Electrolytes", "category": "laboratory", "required": True, "timeframe": "immediate"},
            {"name": "Rate Control Medication", "category": "medication", "required": True, "timeframe": "1 hour", "condition": "If HR > 110"},
            {"name": "Anticoagulation", "category": "medication", "required": False, "condition": "Based on CHA2DS2-VASc score"},
            {"name": "Echocardiogram", "category": "imaging", "required": True, "timeframe": "48 hours"},
            {"name": "Continuous Telemetry", "category": "nursing", "required": True},
            {"name": "CHA2DS2-VASc Calculation", "category": "nursing", "required": True, "timeframe": "admission"},
        ],
        "qualityMetrics": ["Rate control achieved", "Appropriate anticoagulation", "Stroke risk documentation"],
        "evidenceLevel": "Level 1A",
    },
    "htn-emergency-bundle": {
        "id": "htn-emergency-bundle",
        "name": "Hypertensive Emergency Bundle",
        "description": "Evidence-based hypertensive emergency management per ACC/AHA Guidelines",
        "category": "cardiology",
        "timeConstraints": {
            "5-minute": ["Continuous BP monitoring"],
            "15-minute": ["IV antihypertensive initiated"],
            "1-hour": ["25% BP reduction achieved"],
        },
        "components": [
            {"name": "Continuous BP Monitoring", "category": "nursing", "required": True, "timeframe": "5 minutes"},
            {"name": "12-Lead ECG", "category": "imaging", "required": True, "timeframe": "15 minutes"},
            {"name": "Comprehensive Metabolic Panel", "category": "laboratory", "required": True, "timeframe": "immediate"},
            {"name": "Urinalysis", "category": "laboratory", "required": True, "timeframe": "immediate"},
            {"name": "IV Antihypertensive", "category": "medication", "required": True, "timeframe": "15 minutes"},
            {"name": "CT Head", "category": "imaging", "required": False, "condition": "If neurological symptoms"},
            {"name": "Chest X-Ray", "category": "imaging", "required": True, "timeframe": "1 hour"},
            {"name": "Arterial Line", "category": "procedure", "required": False, "condition": "For severe cases"},
            {"name": "Neurological Checks", "category": "nursing", "required": True, "timeframe": "hourly"},
        ],
        "qualityMetrics": ["Time to IV antihypertensive", "BP reduction at 1h", "End-organ assessment documented"],
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
        "ciprofloxacin": {"severity": "high", "description": "Increased INR", "recommendation": "Monitor INR closely, consider dose reduction"},
        "rifampin": {"severity": "critical", "description": "Significantly decreased INR", "recommendation": "May need 2-3x warfarin dose, close monitoring"},
        "vitamin_k": {"severity": "high", "description": "Decreased anticoagulation", "recommendation": "Consistent vitamin K intake"},
    },
    "metformin": {
        "contrast_dye": {"severity": "high", "description": "Lactic acidosis risk", "recommendation": "Hold 48h before/after contrast"},
        "alcohol": {"severity": "moderate", "description": "Increased lactic acidosis risk", "recommendation": "Limit alcohol intake"},
        "cimetidine": {"severity": "moderate", "description": "Increased metformin levels", "recommendation": "Monitor blood glucose"},
    },
    "simvastatin": {
        "clarithromycin": {"severity": "critical", "description": "Rhabdomyolysis risk", "recommendation": "Use alternative macrolide or statin"},
        "amiodarone": {"severity": "high", "description": "Myopathy risk", "recommendation": "Limit simvastatin to 20mg"},
        "grapefruit_juice": {"severity": "moderate", "description": "Increased statin levels", "recommendation": "Avoid grapefruit"},
        "diltiazem": {"severity": "high", "description": "Myopathy risk", "recommendation": "Limit simvastatin to 10mg"},
        "verapamil": {"severity": "high", "description": "Myopathy risk", "recommendation": "Limit simvastatin to 10mg"},
        "cyclosporine": {"severity": "critical", "description": "Severe myopathy risk", "recommendation": "Avoid combination"},
    },
    "digoxin": {
        "amiodarone": {"severity": "high", "description": "Increased digoxin levels, toxicity", "recommendation": "Reduce digoxin dose 50%"},
        "verapamil": {"severity": "high", "description": "Increased digoxin levels, bradycardia", "recommendation": "Reduce digoxin dose 30-50%"},
        "clarithromycin": {"severity": "high", "description": "Increased digoxin levels", "recommendation": "Monitor levels closely"},
        "quinidine": {"severity": "high", "description": "Doubled digoxin levels", "recommendation": "Reduce digoxin dose 50%"},
        "spironolactone": {"severity": "moderate", "description": "Increased digoxin levels", "recommendation": "Monitor levels"},
    },
    "lisinopril": {
        "potassium": {"severity": "high", "description": "Hyperkalemia risk", "recommendation": "Monitor K+ closely"},
        "spironolactone": {"severity": "high", "description": "Hyperkalemia risk", "recommendation": "Monitor K+ very closely"},
        "nsaids": {"severity": "moderate", "description": "Reduced antihypertensive effect, AKI risk", "recommendation": "Avoid if possible"},
        "lithium": {"severity": "high", "description": "Increased lithium levels", "recommendation": "Monitor lithium levels closely"},
        "trimethoprim": {"severity": "high", "description": "Hyperkalemia risk", "recommendation": "Monitor K+ closely"},
    },
    "clopidogrel": {
        "omeprazole": {"severity": "moderate", "description": "Reduced antiplatelet effect", "recommendation": "Use pantoprazole instead"},
        "esomeprazole": {"severity": "moderate", "description": "Reduced antiplatelet effect", "recommendation": "Use pantoprazole instead"},
        "fluoxetine": {"severity": "moderate", "description": "Reduced clopidogrel activation", "recommendation": "Consider alternative antidepressant"},
    },
    "heparin": {
        "aspirin": {"severity": "high", "description": "Increased bleeding risk", "recommendation": "Monitor closely, use with caution"},
        "nsaids": {"severity": "high", "description": "Increased bleeding risk", "recommendation": "Avoid combination if possible"},
        "warfarin": {"severity": "high", "description": "Increased bleeding risk during transition", "recommendation": "Overlap carefully per protocol"},
    },
    "metoprolol": {
        "verapamil": {"severity": "critical", "description": "Severe bradycardia, heart block", "recommendation": "Avoid combination"},
        "diltiazem": {"severity": "high", "description": "Bradycardia, hypotension", "recommendation": "Use with extreme caution"},
        "clonidine": {"severity": "high", "description": "Rebound hypertension on withdrawal", "recommendation": "Taper beta-blocker first"},
        "fluoxetine": {"severity": "moderate", "description": "Increased metoprolol levels", "recommendation": "Monitor HR and BP"},
    },
    "furosemide": {
        "aminoglycosides": {"severity": "high", "description": "Ototoxicity, nephrotoxicity", "recommendation": "Monitor renal function and hearing"},
        "nsaids": {"severity": "moderate", "description": "Reduced diuretic effect", "recommendation": "May need dose adjustment"},
        "digoxin": {"severity": "high", "description": "Hypokalemia increases digoxin toxicity", "recommendation": "Monitor K+ and digoxin levels"},
        "lithium": {"severity": "high", "description": "Increased lithium levels", "recommendation": "Monitor lithium levels"},
    },
    "amiodarone": {
        "simvastatin": {"severity": "high", "description": "Myopathy risk", "recommendation": "Limit simvastatin to 20mg"},
        "warfarin": {"severity": "high", "description": "Increased INR", "recommendation": "Reduce warfarin dose 30-50%"},
        "digoxin": {"severity": "high", "description": "Increased digoxin toxicity", "recommendation": "Reduce digoxin dose 50%"},
        "diltiazem": {"severity": "high", "description": "Bradycardia, heart block", "recommendation": "Use with caution"},
        "metoprolol": {"severity": "high", "description": "Bradycardia, hypotension", "recommendation": "Monitor closely"},
        "fluoroquinolone": {"severity": "high", "description": "QT prolongation", "recommendation": "Avoid combination"},
    },
    "fluoroquinolone": {
        "antacids": {"severity": "moderate", "description": "Reduced absorption", "recommendation": "Separate doses by 2 hours"},
        "warfarin": {"severity": "high", "description": "Increased INR", "recommendation": "Monitor INR"},
        "theophylline": {"severity": "high", "description": "Increased theophylline toxicity", "recommendation": "Monitor levels"},
        "nsaids": {"severity": "moderate", "description": "CNS stimulation, seizure risk", "recommendation": "Use with caution"},
        "amiodarone": {"severity": "high", "description": "QT prolongation", "recommendation": "Avoid combination"},
    },
    "ssri": {
        "maoi": {"severity": "critical", "description": "Serotonin syndrome", "recommendation": "Contraindicated - 14 day washout"},
        "tramadol": {"severity": "high", "description": "Serotonin syndrome risk", "recommendation": "Use with caution"},
        "warfarin": {"severity": "moderate", "description": "Increased bleeding risk", "recommendation": "Monitor INR"},
        "nsaids": {"severity": "high", "description": "GI bleeding risk", "recommendation": "Consider GI prophylaxis"},
        "triptans": {"severity": "moderate", "description": "Serotonin syndrome risk", "recommendation": "Monitor for symptoms"},
    },
    "tramadol": {
        "ssri": {"severity": "high", "description": "Serotonin syndrome, seizure risk", "recommendation": "Use with caution"},
        "carbamazepine": {"severity": "moderate", "description": "Reduced tramadol efficacy", "recommendation": "May need dose adjustment"},
        "maoi": {"severity": "critical", "description": "Serotonin syndrome", "recommendation": "Contraindicated"},
    },
    "theophylline": {
        "ciprofloxacin": {"severity": "high", "description": "Increased theophylline levels", "recommendation": "Reduce dose, monitor levels"},
        "erythromycin": {"severity": "high", "description": "Increased theophylline levels", "recommendation": "Monitor levels closely"},
        "rifampin": {"severity": "high", "description": "Decreased theophylline levels", "recommendation": "May need dose increase"},
    },
    "lithium": {
        "nsaids": {"severity": "high", "description": "Increased lithium levels", "recommendation": "Monitor levels, avoid if possible"},
        "ace_inhibitor": {"severity": "high", "description": "Increased lithium levels", "recommendation": "Monitor lithium levels closely"},
        "diuretics": {"severity": "high", "description": "Increased lithium levels", "recommendation": "Monitor lithium levels closely"},
        "metronidazole": {"severity": "moderate", "description": "Increased lithium levels", "recommendation": "Monitor levels"},
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
        self.model_version = "2.0.0"
        self.openai_client = None
        self._init_openai()

    def _init_openai(self):
        """Initialize OpenAI client if available"""
        if OPENAI_AVAILABLE:
            api_key = os.getenv("OPENAI_API_KEY")
            if api_key:
                try:
                    self.openai_client = OpenAI(api_key=api_key)
                    logger.info("OpenAI client initialized for Smart Orders AI")
                except Exception as e:
                    logger.warning(f"Failed to initialize OpenAI client: {e}")
                    self.openai_client = None
            else:
                logger.info("OpenAI API key not found, AI-enhanced features disabled")
        else:
            logger.info("OpenAI package not available, AI-enhanced features disabled")

    def is_ai_available(self) -> bool:
        """Check if OpenAI integration is available"""
        return self.openai_client is not None

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
            # Search by diagnosis name using keyword mapping
            diagnosis_lower = diagnosis.lower()

            # Enhanced keyword to ICD mapping
            keyword_icd_map = {
                "sepsis": "A41.9",
                "septic": "A41.9",
                "chest pain": "I21.9",
                "mi": "I21.9",
                "myocardial infarction": "I21.9",
                "heart attack": "I21.9",
                "stemi": "I21.9",
                "nstemi": "I21.9",
                "acs": "I21.9",
                "acute coronary": "I21.9",
                "pneumonia": "J18.9",
                "community acquired pneumonia": "J18.9",
                "cap": "J18.9",
                "dka": "E11.10",
                "diabetic ketoacidosis": "E11.10",
                "ketoacidosis": "E11.10",
                "stroke": "I63.9",
                "cva": "I63.9",
                "cerebrovascular": "I63.9",
                "cerebral infarction": "I63.9",
                "gi bleed": "K92.2",
                "gastrointestinal bleed": "K92.2",
                "gi hemorrhage": "K92.2",
                "upper gi bleed": "K92.2",
                "lower gi bleed": "K92.2",
                "melena": "K92.2",
                "hematemesis": "K92.2",
                "aki": "N17.9",
                "acute kidney injury": "N17.9",
                "acute renal failure": "N17.9",
                "copd": "J44.1",
                "copd exacerbation": "J44.1",
                "chronic obstructive": "J44.1",
                "emphysema exacerbation": "J44.1",
                "heart failure": "I50.9",
                "chf": "I50.9",
                "congestive heart": "I50.9",
                "hfref": "I50.9",
                "hfpef": "I50.9",
                "acute decompensated heart failure": "I50.9",
                "adhf": "I50.9",
                "pulmonary embolism": "I26.9",
                "pe": "I26.9",
                "pulmonary embolus": "I26.9",
                "dvt with pe": "I26.9",
                "atrial fibrillation": "I48.91",
                "afib": "I48.91",
                "a-fib": "I48.91",
                "af": "I48.91",
                "atrial flutter": "I48.91",
                "hypertensive crisis": "I16.9",
                "hypertensive emergency": "I16.9",
                "hypertensive urgency": "I16.9",
                "malignant hypertension": "I16.9",
            }

            # Find matching diagnosis
            for keyword, icd in keyword_icd_map.items():
                if keyword in diagnosis_lower:
                    matched_icd = icd
                    break

            # Also check against database names if no keyword match
            if not matched_icd:
                for icd, data in DIAGNOSIS_ORDER_DATABASE.items():
                    if diagnosis_lower in data["name"].lower():
                        matched_icd = icd
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

    def check_medication_interactions_detailed(
        self,
        medications: List[str],
        patient_context: Optional[PatientContext] = None
    ) -> Dict[str, Any]:
        """
        Enhanced drug interaction checking with severity levels and patient context.
        Returns detailed interaction analysis with severity categorization.
        """
        result = {
            "interactions": [],
            "summary": {
                "total": 0,
                "critical": 0,
                "high": 0,
                "moderate": 0,
                "low": 0,
            },
            "patientWarnings": [],
            "recommendations": [],
            "timestamp": datetime.utcnow().isoformat(),
        }

        # Get basic interactions
        interactions = self.check_drug_interactions(medications)

        # Categorize by severity
        for interaction in interactions:
            result["interactions"].append(interaction)
            result["summary"]["total"] += 1
            severity = interaction.get("severity", "moderate")
            if severity in result["summary"]:
                result["summary"][severity] += 1

        # Add patient-specific warnings if context provided
        if patient_context:
            # Check against current medications
            if patient_context.currentMedications:
                all_meds = medications + patient_context.currentMedications
                current_interactions = self.check_drug_interactions(all_meds)
                for interaction in current_interactions:
                    if interaction not in result["interactions"]:
                        interaction["source"] = "current_medication"
                        result["interactions"].append(interaction)
                        result["summary"]["total"] += 1
                        severity = interaction.get("severity", "moderate")
                        if severity in result["summary"]:
                            result["summary"][severity] += 1

            # Check for condition-specific interactions
            if patient_context.comorbidities:
                condition_warnings = self._check_condition_interactions(
                    medications, patient_context.comorbidities
                )
                result["patientWarnings"].extend(condition_warnings)

        # Generate recommendations based on severity
        if result["summary"]["critical"] > 0:
            result["recommendations"].append({
                "priority": "critical",
                "message": "CRITICAL drug interactions detected. Review immediately with clinical pharmacist.",
                "action": "Do not administer until reviewed",
            })
        if result["summary"]["high"] > 0:
            result["recommendations"].append({
                "priority": "high",
                "message": "High-severity interactions detected. Consider alternative medications.",
                "action": "Monitor closely if proceeding",
            })

        return result

    def _check_condition_interactions(
        self,
        medications: List[str],
        conditions: List[str]
    ) -> List[Dict[str, str]]:
        """Check for medication-condition interactions"""
        warnings = []

        # Condition-medication contraindications
        condition_contraindications = {
            "asthma": ["propranolol", "metoprolol", "atenolol", "carvedilol", "nsaids"],
            "copd": ["propranolol", "metoprolol", "atenolol"],
            "heart failure": ["nsaids", "ibuprofen", "verapamil", "diltiazem", "thiazolidinediones"],
            "renal failure": ["nsaids", "metformin", "lithium", "aminoglycosides"],
            "liver disease": ["acetaminophen", "methotrexate", "statins"],
            "diabetes": ["corticosteroids", "thiazides", "beta-blockers"],
            "gi bleed": ["nsaids", "aspirin", "anticoagulants", "clopidogrel"],
            "bradycardia": ["beta-blockers", "verapamil", "diltiazem", "digoxin"],
            "hypotension": ["ace inhibitors", "diuretics", "nitrates", "alpha-blockers"],
            "hyperkalemia": ["ace inhibitors", "arbs", "potassium", "spironolactone"],
            "seizure disorder": ["tramadol", "bupropion", "meperidine", "fluoroquinolones"],
            "myasthenia gravis": ["aminoglycosides", "fluoroquinolones", "beta-blockers", "magnesium"],
        }

        meds_lower = [m.lower() for m in medications]
        conditions_lower = [c.lower() for c in conditions]

        for condition in conditions_lower:
            for cond_key, contraindicated_meds in condition_contraindications.items():
                if cond_key in condition:
                    for med in meds_lower:
                        for contra_med in contraindicated_meds:
                            if contra_med in med:
                                warnings.append({
                                    "type": "condition_contraindication",
                                    "severity": "high",
                                    "medication": med,
                                    "condition": condition,
                                    "message": f"{med} may be contraindicated or require caution in patients with {condition}",
                                })

        return warnings

    def check_contraindications(
        self,
        orders: List[Dict[str, Any]],
        patient_context: PatientContext
    ) -> Dict[str, Any]:
        """
        Comprehensive contraindication checking against patient allergies and conditions.
        """
        result = {
            "contraindications": [],
            "allergyAlerts": [],
            "conditionWarnings": [],
            "safeOrders": [],
            "unsafeOrders": [],
            "timestamp": datetime.utcnow().isoformat(),
        }

        # Extended allergy cross-reactivity map
        allergy_cross_react = {
            "penicillin": {
                "related": ["amoxicillin", "ampicillin", "piperacillin", "nafcillin", "oxacillin"],
                "cross_class": ["cephalosporins"],  # ~10% cross-reactivity
                "severity": "critical",
            },
            "sulfa": {
                "related": ["sulfamethoxazole", "sulfasalazine", "sulfadiazine"],
                "cross_class": ["thiazides", "furosemide", "celecoxib"],  # Possible
                "severity": "high",
            },
            "aspirin": {
                "related": ["ibuprofen", "naproxen", "ketorolac", "indomethacin"],
                "cross_class": ["nsaids"],
                "severity": "critical",
            },
            "nsaid": {
                "related": ["ibuprofen", "naproxen", "ketorolac", "diclofenac", "meloxicam"],
                "cross_class": [],
                "severity": "critical",
            },
            "morphine": {
                "related": ["codeine", "hydrocodone", "oxycodone", "hydromorphone"],
                "cross_class": ["opioids"],
                "severity": "high",
            },
            "codeine": {
                "related": ["hydrocodone", "dihydrocodeine"],
                "cross_class": [],
                "severity": "high",
            },
            "cephalosporin": {
                "related": ["cefazolin", "ceftriaxone", "cefepime", "cephalexin"],
                "cross_class": [],
                "severity": "critical",
            },
            "fluoroquinolone": {
                "related": ["ciprofloxacin", "levofloxacin", "moxifloxacin"],
                "cross_class": [],
                "severity": "critical",
            },
            "ace inhibitor": {
                "related": ["lisinopril", "enalapril", "ramipril", "benazepril"],
                "cross_class": [],  # ARBs generally safe
                "severity": "high",
            },
            "contrast": {
                "related": ["iodinated contrast", "gadolinium"],
                "cross_class": [],
                "severity": "critical",
            },
            "latex": {
                "related": [],
                "cross_class": ["bananas", "avocado", "kiwi"],  # Latex-fruit syndrome
                "severity": "high",
            },
        }

        for order in orders:
            is_safe = True
            order_name_lower = order.get("name", "").lower()

            # Check allergies
            if patient_context.allergies:
                for allergy in patient_context.allergies:
                    allergy_lower = allergy.lower()

                    # Direct match
                    if allergy_lower in order_name_lower:
                        result["allergyAlerts"].append({
                            "order": order["name"],
                            "allergy": allergy,
                            "type": "direct_match",
                            "severity": "critical",
                            "message": f"ALERT: Patient allergic to {allergy}. Do NOT administer {order['name']}.",
                        })
                        is_safe = False
                        continue

                    # Cross-reactivity check
                    for allergy_key, allergy_info in allergy_cross_react.items():
                        if allergy_key in allergy_lower or allergy_lower in allergy_key:
                            # Check related drugs
                            for related in allergy_info["related"]:
                                if related in order_name_lower:
                                    result["allergyAlerts"].append({
                                        "order": order["name"],
                                        "allergy": allergy,
                                        "type": "cross_reactivity",
                                        "severity": allergy_info["severity"],
                                        "message": f"Cross-reactivity risk: {order['name']} may cross-react with {allergy} allergy.",
                                    })
                                    is_safe = False

            # Check condition contraindications
            if patient_context.comorbidities:
                condition_checks = self._check_condition_interactions(
                    [order.get("name", "")], patient_context.comorbidities
                )
                if condition_checks:
                    result["conditionWarnings"].extend(condition_checks)
                    is_safe = False

            # Check pregnancy contraindications
            if patient_context.pregnancyStatus == "pregnant":
                pregnancy_contraindicated = [
                    "warfarin", "methotrexate", "isotretinoin", "statins",
                    "ace inhibitors", "arbs", "tetracycline", "fluoroquinolone",
                    "valproic acid", "phenytoin", "lithium", "misoprostol",
                ]
                for drug in pregnancy_contraindicated:
                    if drug in order_name_lower:
                        result["contraindications"].append({
                            "order": order["name"],
                            "reason": "Pregnancy",
                            "severity": "critical",
                            "message": f"{order['name']} is contraindicated in pregnancy (Category D/X).",
                        })
                        is_safe = False

            # Check renal contraindications
            if patient_context.renalFunction in ["severe", "dialysis"]:
                renal_contraindicated = ["metformin", "nsaids", "lithium"]
                for drug in renal_contraindicated:
                    if drug in order_name_lower:
                        result["contraindications"].append({
                            "order": order["name"],
                            "reason": f"Severe renal impairment ({patient_context.renalFunction})",
                            "severity": "critical",
                            "message": f"{order['name']} is contraindicated in {patient_context.renalFunction}.",
                        })
                        is_safe = False

            # Check hepatic contraindications
            if patient_context.hepaticFunction in ["severe"]:
                hepatic_caution = ["acetaminophen", "statins", "methotrexate", "valproic acid"]
                for drug in hepatic_caution:
                    if drug in order_name_lower:
                        result["contraindications"].append({
                            "order": order["name"],
                            "reason": "Severe hepatic impairment",
                            "severity": "high",
                            "message": f"{order['name']} requires caution or is contraindicated in severe liver disease.",
                        })
                        is_safe = False

            # Categorize order
            if is_safe:
                result["safeOrders"].append(order)
            else:
                result["unsafeOrders"].append(order)

        return result

    async def get_ai_enhanced_recommendations(
        self,
        diagnosis: str,
        patient_context: Optional[PatientContext] = None
    ) -> Dict[str, Any]:
        """
        Use GPT-4 to provide AI-enhanced order recommendations with patient-specific analysis.
        Falls back to rule-based recommendations if OpenAI is unavailable.
        """
        # First get rule-based recommendations
        rule_based = self.get_recommendations(
            diagnosis=diagnosis,
            patient_context=patient_context
        )

        if not self.openai_client:
            rule_based["aiEnhanced"] = False
            rule_based["aiMessage"] = "AI enhancement unavailable. Using rule-based recommendations."
            return rule_based

        try:
            # Build patient context string
            patient_info = ""
            if patient_context:
                patient_info = f"""
Patient Information:
- Age: {patient_context.age or 'Unknown'}
- Weight: {patient_context.weight or 'Unknown'} kg
- Gender: {patient_context.gender or 'Unknown'}
- Allergies: {', '.join(patient_context.allergies) if patient_context.allergies else 'None reported'}
- Current Medications: {', '.join(patient_context.currentMedications) if patient_context.currentMedications else 'None reported'}
- Renal Function: {patient_context.renalFunction or 'Unknown'}
- Hepatic Function: {patient_context.hepaticFunction or 'Unknown'}
- Pregnancy Status: {patient_context.pregnancyStatus or 'Not applicable'}
- Comorbidities: {', '.join(patient_context.comorbidities) if patient_context.comorbidities else 'None reported'}
"""

            prompt = f"""You are a clinical decision support AI assisting with order recommendations.

Diagnosis: {diagnosis}
{patient_info}

Based on the diagnosis and patient context, provide:
1. Any additional considerations for this specific patient
2. Medication dosing adjustments needed
3. Additional warnings or precautions specific to this patient
4. Alternative medications if any are contraindicated
5. Priority of orders (what should be done first)

Respond in JSON format with the following structure:
{{
    "additionalConsiderations": ["consideration1", "consideration2"],
    "dosingAdjustments": [{{"medication": "name", "adjustment": "details", "reason": "why"}}],
    "warnings": [{{"medication": "name", "warning": "details", "severity": "high/moderate/low"}}],
    "alternatives": [{{"original": "name", "alternative": "name", "reason": "why"}}],
    "priorityOrder": ["order1", "order2", "order3"],
    "clinicalPearls": ["pearl1", "pearl2"]
}}

Be specific and clinically relevant. Focus on patient safety."""

            response = self.openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a clinical pharmacist and physician assistant AI. Provide evidence-based recommendations. Always prioritize patient safety. Be concise but thorough."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=1500,
            )

            ai_response = response.choices[0].message.content

            # Parse AI response
            import json
            try:
                # Try to extract JSON from response
                json_start = ai_response.find('{')
                json_end = ai_response.rfind('}') + 1
                if json_start != -1 and json_end > json_start:
                    ai_analysis = json.loads(ai_response[json_start:json_end])
                else:
                    ai_analysis = {"rawResponse": ai_response}
            except json.JSONDecodeError:
                ai_analysis = {"rawResponse": ai_response}

            # Merge AI analysis with rule-based recommendations
            rule_based["aiEnhanced"] = True
            rule_based["aiAnalysis"] = ai_analysis
            rule_based["aiMessage"] = "AI-enhanced recommendations generated successfully."

            # Add AI warnings to the main warnings list
            if "warnings" in ai_analysis:
                for warning in ai_analysis["warnings"]:
                    rule_based["warnings"].append({
                        "type": "ai_recommendation",
                        "severity": warning.get("severity", "moderate"),
                        "medication": warning.get("medication", ""),
                        "message": warning.get("warning", ""),
                    })

            return rule_based

        except Exception as e:
            logger.error(f"Error getting AI-enhanced recommendations: {e}")
            rule_based["aiEnhanced"] = False
            rule_based["aiMessage"] = f"AI enhancement failed: {str(e)}. Using rule-based recommendations."
            return rule_based

    def customize_bundle_enhanced(
        self,
        bundle_id: str,
        patient_context: PatientContext,
        customizations: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Enhanced bundle customization with automatic adjustments based on patient factors.
        Includes renal/hepatic dosing, contraindication removal, and alternatives.
        """
        # Get base bundle
        bundle = self.get_bundle_details(bundle_id)
        if not bundle:
            return {"error": "Bundle not found", "bundleId": bundle_id}

        result = {
            "bundleId": bundle_id,
            "bundleName": bundle.get("name"),
            "originalComponents": bundle.get("components", []),
            "adjustedOrders": [],
            "removedOrders": [],
            "addedAlternatives": [],
            "modifications": [],
            "warnings": [],
            "timestamp": datetime.utcnow().isoformat(),
        }

        # Process each component
        for component in bundle.get("components", []):
            order = {
                "name": component["name"],
                "category": component.get("category"),
                "required": component.get("required", False),
                "timeframe": component.get("timeframe"),
                "condition": component.get("condition"),
            }

            should_include = True
            modifications = []

            # Check contraindications
            if patient_context.allergies:
                for allergy in patient_context.allergies:
                    if allergy.lower() in component["name"].lower():
                        should_include = False
                        result["removedOrders"].append({
                            "order": component["name"],
                            "reason": f"Patient allergy to {allergy}",
                        })
                        # Find alternative
                        alternative = self._find_alternative(component["name"], allergy)
                        if alternative:
                            result["addedAlternatives"].append({
                                "original": component["name"],
                                "alternative": alternative["name"],
                                "reason": f"Alternative due to {allergy} allergy",
                            })
                            order = alternative.copy()
                            should_include = True

            # Renal dosing adjustments
            if component.get("category") == "medication" and patient_context.renalFunction:
                drug_key = component["name"].lower().replace(" ", "-")
                if drug_key in RENAL_DOSING:
                    renal_level = patient_context.renalFunction.lower()
                    if renal_level in RENAL_DOSING[drug_key]:
                        adjusted_dose = RENAL_DOSING[drug_key][renal_level]
                        if "contraindicated" in adjusted_dose.lower():
                            should_include = False
                            result["removedOrders"].append({
                                "order": component["name"],
                                "reason": f"Contraindicated in {renal_level} renal function",
                            })
                        else:
                            order["adjustedDose"] = adjusted_dose
                            modifications.append({
                                "type": "renal_adjustment",
                                "original": "standard dose",
                                "adjusted": adjusted_dose,
                                "reason": f"Renal function: {renal_level}",
                            })

            # Hepatic dosing adjustments
            if component.get("category") == "medication" and patient_context.hepaticFunction:
                hepatic_level = patient_context.hepaticFunction.lower()
                hepatic_caution_drugs = {
                    "acetaminophen": {"mild": "Reduce dose 50%", "moderate": "Reduce dose 75%", "severe": "Avoid"},
                    "statins": {"mild": "Monitor LFTs", "moderate": "Reduce dose 50%", "severe": "Avoid"},
                    "warfarin": {"mild": "Monitor INR closely", "moderate": "Reduce dose 25-50%", "severe": "Use with extreme caution"},
                }
                for drug, adjustments in hepatic_caution_drugs.items():
                    if drug in component["name"].lower():
                        if hepatic_level in adjustments:
                            adj = adjustments[hepatic_level]
                            if "avoid" in adj.lower():
                                should_include = False
                                result["removedOrders"].append({
                                    "order": component["name"],
                                    "reason": f"Avoid in {hepatic_level} hepatic function",
                                })
                            else:
                                order["hepaticAdjustment"] = adj
                                modifications.append({
                                    "type": "hepatic_adjustment",
                                    "original": "standard dose",
                                    "adjusted": adj,
                                    "reason": f"Hepatic function: {hepatic_level}",
                                })

            # Weight-based dosing
            if patient_context.weight and component.get("category") == "medication":
                weight_based_drugs = ["vancomycin", "heparin", "enoxaparin", "tpa", "alteplase"]
                for drug in weight_based_drugs:
                    if drug in component["name"].lower():
                        order["weightBasedDose"] = f"Calculate based on {patient_context.weight} kg"
                        modifications.append({
                            "type": "weight_based",
                            "weight": patient_context.weight,
                            "note": "Requires weight-based dosing calculation",
                        })

            # Age-based considerations
            if patient_context.age:
                if patient_context.age > 65:
                    elderly_caution = ["benzodiazepines", "antihistamines", "opioids", "nsaids"]
                    for drug in elderly_caution:
                        if drug in component["name"].lower():
                            result["warnings"].append({
                                "type": "age_related",
                                "medication": component["name"],
                                "message": f"Use with caution in elderly (age {patient_context.age}). Consider reduced dose. Beers Criteria.",
                            })

            if should_include:
                order["modifications"] = modifications
                result["adjustedOrders"].append(order)

            if modifications:
                result["modifications"].extend(modifications)

        return result

    def _find_alternative(self, medication: str, allergy: str) -> Optional[Dict[str, Any]]:
        """Find an alternative medication when original is contraindicated"""
        alternatives = {
            "penicillin": {
                "amoxicillin": {"name": "Azithromycin", "category": "medication", "note": "Macrolide alternative"},
                "ampicillin": {"name": "Azithromycin", "category": "medication", "note": "Macrolide alternative"},
                "piperacillin": {"name": "Aztreonam + Metronidazole", "category": "medication", "note": "Alternative for gram-negative coverage"},
            },
            "cephalosporin": {
                "ceftriaxone": {"name": "Azithromycin", "category": "medication", "note": "Alternative for CAP"},
                "cefazolin": {"name": "Vancomycin", "category": "medication", "note": "Alternative for surgical prophylaxis"},
            },
            "sulfa": {
                "sulfamethoxazole": {"name": "Ciprofloxacin", "category": "medication", "note": "Fluoroquinolone alternative"},
            },
            "aspirin": {
                "aspirin": {"name": "Clopidogrel", "category": "medication", "note": "Alternative antiplatelet"},
            },
            "nsaid": {
                "ibuprofen": {"name": "Acetaminophen", "category": "medication", "note": "Non-NSAID analgesic"},
                "ketorolac": {"name": "Acetaminophen IV", "category": "medication", "note": "Non-NSAID analgesic"},
            },
            "ace inhibitor": {
                "lisinopril": {"name": "Losartan", "category": "medication", "note": "ARB alternative"},
                "enalapril": {"name": "Valsartan", "category": "medication", "note": "ARB alternative"},
            },
            "morphine": {
                "morphine": {"name": "Hydromorphone", "category": "medication", "note": "May still cross-react"},
            },
        }

        allergy_lower = allergy.lower()
        med_lower = medication.lower()

        for allergy_key, med_alternatives in alternatives.items():
            if allergy_key in allergy_lower:
                for med_key, alt in med_alternatives.items():
                    if med_key in med_lower:
                        return alt

        return None


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


# ============= Enhanced API Endpoints =============

class InteractionCheckRequest(BaseModel):
    medications: List[str]
    patientContext: Optional[PatientContext] = None


class ContraindicationCheckRequest(BaseModel):
    orders: List[Dict[str, Any]]
    patientContext: PatientContext


class AIRecommendationRequest(BaseModel):
    diagnosis: str
    patientContext: Optional[PatientContext] = None


class EnhancedCustomizeRequest(BaseModel):
    bundleId: str
    patientContext: PatientContext
    customizations: Optional[Dict[str, Any]] = None


@app.post("/api/check-interactions-detailed")
async def check_interactions_detailed(request: InteractionCheckRequest):
    """
    Enhanced drug interaction checking with severity levels and patient context.
    Returns detailed analysis including:
    - Interaction severity categorization (critical/high/moderate/low)
    - Patient-specific warnings based on comorbidities
    - Recommendations for each interaction
    """
    try:
        result = smart_orders_ai.check_medication_interactions_detailed(
            medications=request.medications,
            patient_context=request.patientContext,
        )
        return result
    except Exception as e:
        logger.error(f"Error checking detailed interactions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/check-contraindications")
async def check_contraindications(request: ContraindicationCheckRequest):
    """
    Comprehensive contraindication checking against patient allergies and conditions.
    Checks:
    - Direct allergy matches
    - Cross-reactivity risks
    - Condition-specific contraindications
    - Pregnancy contraindications
    - Renal/hepatic contraindications
    Returns safe and unsafe orders with detailed warnings.
    """
    try:
        result = smart_orders_ai.check_contraindications(
            orders=request.orders,
            patient_context=request.patientContext,
        )
        return result
    except Exception as e:
        logger.error(f"Error checking contraindications: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/recommend-ai")
async def get_ai_recommendations(request: AIRecommendationRequest):
    """
    AI-enhanced order recommendations using GPT-4.
    Provides personalized analysis including:
    - Patient-specific dosing adjustments
    - Additional warnings and precautions
    - Alternative medication suggestions
    - Priority ordering of tests/treatments
    - Clinical pearls
    Falls back to rule-based if OpenAI unavailable.
    """
    try:
        result = await smart_orders_ai.get_ai_enhanced_recommendations(
            diagnosis=request.diagnosis,
            patient_context=request.patientContext,
        )
        return result
    except Exception as e:
        logger.error(f"Error getting AI recommendations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/customize-enhanced")
async def customize_bundle_enhanced(request: EnhancedCustomizeRequest):
    """
    Enhanced bundle customization with automatic patient-specific adjustments.
    Features:
    - Automatic renal dosing adjustments
    - Hepatic function adjustments
    - Weight-based dosing calculations
    - Age-related warnings (Beers criteria for elderly)
    - Contraindication removal with alternatives
    """
    try:
        result = smart_orders_ai.customize_bundle_enhanced(
            bundle_id=request.bundleId,
            patient_context=request.patientContext,
            customizations=request.customizations,
        )
        return result
    except Exception as e:
        logger.error(f"Error customizing bundle: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/ai-status")
async def get_ai_status():
    """Check if AI-enhanced features are available"""
    return {
        "aiAvailable": smart_orders_ai.is_ai_available(),
        "modelVersion": smart_orders_ai.model_version,
        "features": {
            "aiEnhancedRecommendations": smart_orders_ai.is_ai_available(),
            "ruleBasedRecommendations": True,
            "drugInteractionChecking": True,
            "contraindicationChecking": True,
            "enhancedBundleCustomization": True,
        },
        "supportedDiagnoses": list(DIAGNOSIS_ORDER_DATABASE.keys()),
        "supportedBundles": list(ORDER_BUNDLES.keys()),
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.get("/api/diagnoses")
async def get_supported_diagnoses():
    """Get all supported diagnoses with their ICD codes"""
    diagnoses = []
    for icd_code, data in DIAGNOSIS_ORDER_DATABASE.items():
        diagnoses.append({
            "icdCode": icd_code,
            "name": data["name"],
            "category": data.get("category"),
            "bundle": data.get("bundle"),
            "evidenceLevel": data.get("evidenceLevel"),
        })
    return {"diagnoses": diagnoses, "count": len(diagnoses)}


# Run the application
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8013)
