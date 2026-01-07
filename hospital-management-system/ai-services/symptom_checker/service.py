"""
Symptom Checker AI Service
FastAPI service for patient symptom analysis, triage, and department recommendation
Provides conversational symptom collection with red flag detection

Uses GPT-4o for intelligent symptom analysis with rule-based safety fallback.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
from datetime import datetime, timedelta
from enum import Enum
import uuid
import logging
import re
import random
import json

# Import shared OpenAI client
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from shared.openai_client import openai_manager, TaskComplexity

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Symptom Checker AI Service",
    description="AI-powered patient symptom analysis, triage, and department recommendation system",
    version="2.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# Enums and Constants
# =============================================================================

class TriageLevel(str, Enum):
    EMERGENCY = "EMERGENCY"
    URGENT = "URGENT"
    ROUTINE = "ROUTINE"
    SELF_CARE = "SELF_CARE"


class SessionStatus(str, Enum):
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    ABANDONED = "ABANDONED"
    RED_FLAG_DETECTED = "RED_FLAG_DETECTED"


# =============================================================================
# Data Models - Request/Response
# =============================================================================

class PatientInfo(BaseModel):
    patientId: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    medicalHistory: Optional[List[str]] = []
    currentMedications: Optional[List[str]] = []
    allergies: Optional[List[str]] = []


class StartSessionRequest(BaseModel):
    patientInfo: Optional[PatientInfo] = None
    initialSymptoms: Optional[List[str]] = []
    hospitalId: Optional[str] = None


class StartSessionResponse(BaseModel):
    sessionId: str
    status: str
    message: str
    nextQuestions: List[Dict[str, Any]]
    progress: int
    redFlagDetected: bool = False
    redFlagMessage: Optional[str] = None


class RespondRequest(BaseModel):
    sessionId: str
    responses: List[Dict[str, Any]]  # List of {questionId: str, answer: Any}


class RespondResponse(BaseModel):
    sessionId: str
    status: str
    message: Optional[str] = None
    nextQuestions: Optional[List[Dict[str, Any]]] = None
    progress: int
    isComplete: bool
    redFlagDetected: bool = False
    redFlagMessage: Optional[str] = None
    triageLevel: Optional[str] = None


class GetSessionResponse(BaseModel):
    sessionId: str
    status: str
    patientInfo: Optional[Dict[str, Any]] = None
    collectedSymptoms: List[str]
    answers: Dict[str, Any]
    progress: int
    redFlags: List[Dict[str, Any]]
    createdAt: str
    lastUpdatedAt: str


class PossibleCondition(BaseModel):
    name: str
    confidence: float  # 0.0 - 1.0
    icdCode: Optional[str] = None
    description: Optional[str] = None
    severity: str  # mild, moderate, severe


class CompleteRequest(BaseModel):
    sessionId: str


class CompleteResponse(BaseModel):
    sessionId: str
    triageLevel: str  # EMERGENCY, URGENT, ROUTINE, SELF_CARE
    recommendedDepartment: str
    urgencyScore: int  # 1-10
    redFlags: List[str]
    nextQuestions: List[str]  # Follow-up questions for healthcare provider
    possibleConditions: List[Dict[str, Any]]
    recommendedAction: str
    estimatedWaitTime: Optional[Dict[str, Any]] = None
    selfCareAdvice: List[str]
    whenToSeekHelp: List[str]
    symptomsSummary: List[str]
    disclaimer: str


# =============================================================================
# Knowledge Base - Red Flag Symptoms
# =============================================================================

RED_FLAG_SYMPTOMS = {
    "chest_pain_cardiac": {
        "keywords": [
            "chest pain", "chest pressure", "chest tightness", "crushing chest",
            "chest heaviness", "elephant on chest", "squeezing chest",
            "pain radiating to arm", "pain radiating to jaw", "pain in left arm"
        ],
        "severity": 10,
        "message": "CRITICAL: Chest pain with these characteristics may indicate a cardiac emergency. Call emergency services (911) immediately.",
        "triageLevel": TriageLevel.EMERGENCY,
        "department": "Emergency/Cardiology"
    },
    "difficulty_breathing_severe": {
        "keywords": [
            "can't breathe", "severe difficulty breathing", "gasping for air",
            "choking", "turning blue", "lips turning blue", "cyanosis",
            "extremely short of breath", "suffocating"
        ],
        "severity": 10,
        "message": "CRITICAL: Severe breathing difficulty requires immediate emergency care. Call 911.",
        "triageLevel": TriageLevel.EMERGENCY,
        "department": "Emergency"
    },
    "stroke_symptoms": {
        "keywords": [
            "face drooping", "arm weakness", "slurred speech", "sudden confusion",
            "sudden severe headache", "worst headache of life", "thunderclap headache",
            "sudden numbness", "sudden vision loss", "sudden difficulty walking",
            "sudden dizziness", "loss of balance", "facial droop"
        ],
        "severity": 10,
        "message": "CRITICAL: These symptoms may indicate a stroke. TIME IS CRITICAL. Call 911 immediately. Remember FAST: Face, Arms, Speech, Time.",
        "triageLevel": TriageLevel.EMERGENCY,
        "department": "Emergency/Neurology"
    },
    "severe_bleeding": {
        "keywords": [
            "severe bleeding", "uncontrolled bleeding", "bleeding won't stop",
            "coughing up blood", "vomiting blood", "blood in stool", "black stool",
            "massive blood loss", "spurting blood", "arterial bleeding"
        ],
        "severity": 10,
        "message": "CRITICAL: Severe or uncontrolled bleeding requires immediate emergency care.",
        "triageLevel": TriageLevel.EMERGENCY,
        "department": "Emergency"
    },
    "loss_of_consciousness": {
        "keywords": [
            "passed out", "fainted", "unconscious", "blacked out", "collapsed",
            "loss of consciousness", "unresponsive", "can't wake up"
        ],
        "severity": 9,
        "message": "CRITICAL: Loss of consciousness requires immediate medical evaluation.",
        "triageLevel": TriageLevel.EMERGENCY,
        "department": "Emergency"
    },
    "seizure": {
        "keywords": [
            "seizure", "convulsion", "shaking uncontrollably", "epileptic fit",
            "fitting", "jerking movements"
        ],
        "severity": 9,
        "message": "URGENT: Seizure activity requires emergency evaluation, especially if first occurrence or prolonged.",
        "triageLevel": TriageLevel.EMERGENCY,
        "department": "Emergency/Neurology"
    },
    "severe_allergic_reaction": {
        "keywords": [
            "throat swelling", "tongue swelling", "face swelling", "anaphylaxis",
            "allergic reaction breathing", "hives spreading", "severe allergic",
            "throat closing", "difficulty swallowing with swelling"
        ],
        "severity": 10,
        "message": "CRITICAL: Severe allergic reaction (anaphylaxis) is life-threatening. Use epinephrine if available and call 911.",
        "triageLevel": TriageLevel.EMERGENCY,
        "department": "Emergency"
    },
    "suicidal_ideation": {
        "keywords": [
            "suicidal", "want to die", "end my life", "kill myself", "self harm",
            "hurt myself", "don't want to live", "better off dead", "suicide"
        ],
        "severity": 10,
        "message": "URGENT: If you're having thoughts of self-harm, please reach out immediately. National Suicide Prevention Lifeline: 988. You are not alone and help is available.",
        "triageLevel": TriageLevel.EMERGENCY,
        "department": "Emergency/Psychiatry"
    },
    "severe_abdominal_pain": {
        "keywords": [
            "worst abdominal pain", "severe abdominal pain", "rigid abdomen",
            "board-like abdomen", "sudden severe stomach pain", "unbearable stomach pain"
        ],
        "severity": 8,
        "message": "URGENT: Severe abdominal pain may indicate a surgical emergency. Seek immediate medical attention.",
        "triageLevel": TriageLevel.URGENT,
        "department": "Emergency/Surgery"
    },
    "high_fever": {
        "keywords": [
            "fever over 104", "fever over 40", "extremely high fever",
            "high fever with rash", "fever with stiff neck", "fever with confusion"
        ],
        "severity": 8,
        "message": "URGENT: Very high fever or fever with concerning symptoms requires prompt medical evaluation.",
        "triageLevel": TriageLevel.URGENT,
        "department": "Emergency/Internal Medicine"
    },
    "severe_pain": {
        "keywords": [
            "worst pain ever", "10/10 pain", "unbearable pain", "excruciating pain",
            "screaming in pain", "can't tolerate pain"
        ],
        "severity": 7,
        "message": "URGENT: Severe uncontrolled pain requires prompt medical attention.",
        "triageLevel": TriageLevel.URGENT,
        "department": "Emergency"
    },
    "head_injury": {
        "keywords": [
            "head trauma", "hit my head", "concussion", "head injury",
            "confused after head injury", "vomiting after head injury",
            "drowsy after head injury", "memory loss after injury"
        ],
        "severity": 8,
        "message": "URGENT: Head injury with any neurological symptoms requires immediate evaluation.",
        "triageLevel": TriageLevel.URGENT,
        "department": "Emergency/Neurosurgery"
    },
    "diabetic_emergency": {
        "keywords": [
            "very low blood sugar", "blood sugar below 50", "diabetic coma",
            "diabetic confusion", "fruity breath diabetic", "very high blood sugar"
        ],
        "severity": 8,
        "message": "URGENT: Diabetic emergency requires immediate medical attention.",
        "triageLevel": TriageLevel.URGENT,
        "department": "Emergency/Endocrinology"
    }
}


# =============================================================================
# Knowledge Base - Symptoms and Departments
# =============================================================================

SYMPTOM_TO_DEPARTMENT = {
    # Cardiovascular
    "chest pain": "Cardiology",
    "palpitations": "Cardiology",
    "irregular heartbeat": "Cardiology",
    "shortness of breath": "Cardiology/Pulmonology",
    "leg swelling": "Cardiology",
    "high blood pressure": "Cardiology",

    # Respiratory
    "cough": "Pulmonology",
    "wheezing": "Pulmonology",
    "difficulty breathing": "Pulmonology",
    "asthma": "Pulmonology",
    "chronic cough": "Pulmonology",

    # Gastrointestinal
    "abdominal pain": "Gastroenterology",
    "nausea": "Gastroenterology",
    "vomiting": "Gastroenterology",
    "diarrhea": "Gastroenterology",
    "constipation": "Gastroenterology",
    "heartburn": "Gastroenterology",
    "bloating": "Gastroenterology",
    "blood in stool": "Gastroenterology",

    # Neurological
    "headache": "Neurology",
    "migraine": "Neurology",
    "dizziness": "Neurology",
    "numbness": "Neurology",
    "tingling": "Neurology",
    "seizure": "Neurology",
    "memory problems": "Neurology",
    "tremor": "Neurology",

    # Musculoskeletal
    "back pain": "Orthopedics",
    "joint pain": "Orthopedics/Rheumatology",
    "muscle pain": "Orthopedics",
    "knee pain": "Orthopedics",
    "hip pain": "Orthopedics",
    "shoulder pain": "Orthopedics",
    "fracture": "Orthopedics",
    "sprain": "Orthopedics",

    # Dermatological
    "rash": "Dermatology",
    "itching": "Dermatology",
    "skin lesion": "Dermatology",
    "acne": "Dermatology",
    "eczema": "Dermatology",
    "psoriasis": "Dermatology",

    # ENT
    "ear pain": "ENT",
    "hearing loss": "ENT",
    "sore throat": "ENT",
    "nasal congestion": "ENT",
    "sinus pain": "ENT",
    "nosebleed": "ENT",
    "difficulty swallowing": "ENT",

    # Ophthalmology
    "eye pain": "Ophthalmology",
    "vision problems": "Ophthalmology",
    "blurry vision": "Ophthalmology",
    "eye redness": "Ophthalmology",
    "double vision": "Ophthalmology",

    # Urology
    "urinary frequency": "Urology",
    "painful urination": "Urology",
    "blood in urine": "Urology",
    "urinary incontinence": "Urology",
    "kidney stones": "Urology",

    # Mental Health
    "anxiety": "Psychiatry",
    "depression": "Psychiatry",
    "insomnia": "Psychiatry",
    "panic attacks": "Psychiatry",
    "mood changes": "Psychiatry",

    # Women's Health
    "menstrual problems": "Gynecology",
    "pelvic pain": "Gynecology",
    "pregnancy symptoms": "Obstetrics",
    "breast lump": "Gynecology/Oncology",

    # General/Systemic
    "fever": "Internal Medicine",
    "fatigue": "Internal Medicine",
    "weight loss": "Internal Medicine",
    "night sweats": "Internal Medicine",
    "swollen lymph nodes": "Internal Medicine",
}

SYMPTOM_PATTERNS = {
    "headache": {
        "follow_up_questions": [
            "Where is the headache located?",
            "How severe is the pain (1-10)?",
            "How long have you had this headache?",
            "Is it throbbing, constant, or pressure-like?",
            "Do you have any sensitivity to light or sound?",
            "Have you experienced nausea or vomiting?",
            "Have you had any recent head injury?"
        ],
        "possible_conditions": [
            {"name": "Tension Headache", "icdCode": "G44.2", "severity": "mild"},
            {"name": "Migraine", "icdCode": "G43.9", "severity": "moderate"},
            {"name": "Cluster Headache", "icdCode": "G44.0", "severity": "severe"},
            {"name": "Sinusitis", "icdCode": "J32.9", "severity": "mild"},
        ],
        "department": "Neurology"
    },
    "chest pain": {
        "follow_up_questions": [
            "Is the pain sharp, dull, or pressure-like?",
            "Does the pain radiate to your arm, jaw, or back?",
            "Is the pain worse with exertion?",
            "How long does the pain last?",
            "Are you experiencing shortness of breath?",
            "Do you have any sweating or nausea?",
            "Have you had any recent injury or strain?"
        ],
        "possible_conditions": [
            {"name": "Musculoskeletal Pain", "icdCode": "R07.89", "severity": "mild"},
            {"name": "Costochondritis", "icdCode": "M94.0", "severity": "mild"},
            {"name": "GERD/Acid Reflux", "icdCode": "K21.0", "severity": "mild"},
            {"name": "Anxiety-related Chest Pain", "icdCode": "F41.9", "severity": "mild"},
            {"name": "Angina", "icdCode": "I20.9", "severity": "severe"},
        ],
        "department": "Cardiology"
    },
    "abdominal pain": {
        "follow_up_questions": [
            "Where exactly is the pain located?",
            "Is the pain constant or does it come and go?",
            "Have you noticed any change in bowel movements?",
            "Do you have nausea, vomiting, or fever?",
            "Is the pain related to eating?",
            "Have you noticed any blood in stool or vomit?",
            "When did the pain start?"
        ],
        "possible_conditions": [
            {"name": "Gastritis", "icdCode": "K29.7", "severity": "mild"},
            {"name": "IBS", "icdCode": "K58.9", "severity": "moderate"},
            {"name": "GERD", "icdCode": "K21.0", "severity": "mild"},
            {"name": "Gastroenteritis", "icdCode": "A09", "severity": "moderate"},
            {"name": "Appendicitis", "icdCode": "K37", "severity": "severe"},
        ],
        "department": "Gastroenterology"
    },
    "cough": {
        "follow_up_questions": [
            "How long have you had this cough?",
            "Is the cough dry or productive (bringing up mucus)?",
            "What color is the mucus if any?",
            "Do you have any fever or chills?",
            "Is the cough worse at night?",
            "Are you experiencing shortness of breath?",
            "Do you have any wheezing?"
        ],
        "possible_conditions": [
            {"name": "Upper Respiratory Infection", "icdCode": "J06.9", "severity": "mild"},
            {"name": "Bronchitis", "icdCode": "J40", "severity": "moderate"},
            {"name": "Allergies", "icdCode": "J30.9", "severity": "mild"},
            {"name": "Asthma", "icdCode": "J45.9", "severity": "moderate"},
            {"name": "Pneumonia", "icdCode": "J18.9", "severity": "severe"},
        ],
        "department": "Pulmonology"
    },
    "back pain": {
        "follow_up_questions": [
            "Where on your back is the pain?",
            "Did the pain start suddenly or gradually?",
            "Is there any numbness or tingling in your legs?",
            "Does the pain radiate down your legs?",
            "Is the pain worse with certain activities?",
            "Have you had any recent injury?",
            "Do you have any weakness in your legs?"
        ],
        "possible_conditions": [
            {"name": "Muscle Strain", "icdCode": "M54.5", "severity": "mild"},
            {"name": "Disc Herniation", "icdCode": "M51.2", "severity": "moderate"},
            {"name": "Sciatica", "icdCode": "M54.3", "severity": "moderate"},
            {"name": "Degenerative Disc Disease", "icdCode": "M51.3", "severity": "moderate"},
            {"name": "Spinal Stenosis", "icdCode": "M48.0", "severity": "moderate"},
        ],
        "department": "Orthopedics"
    },
    "fatigue": {
        "follow_up_questions": [
            "How long have you been experiencing fatigue?",
            "Is the fatigue constant or does it come and go?",
            "How is your sleep quality?",
            "Have you experienced any weight changes?",
            "Are you under significant stress?",
            "Do you have any other symptoms like fever or pain?",
            "Have you had any recent illness?"
        ],
        "possible_conditions": [
            {"name": "Anemia", "icdCode": "D64.9", "severity": "moderate"},
            {"name": "Thyroid Disorder", "icdCode": "E03.9", "severity": "moderate"},
            {"name": "Depression", "icdCode": "F32.9", "severity": "moderate"},
            {"name": "Sleep Disorder", "icdCode": "G47.9", "severity": "mild"},
            {"name": "Chronic Fatigue Syndrome", "icdCode": "R53.82", "severity": "moderate"},
        ],
        "department": "Internal Medicine"
    },
    "fever": {
        "follow_up_questions": [
            "What is your current temperature?",
            "How long have you had the fever?",
            "Do you have any other symptoms like cough, sore throat, or body aches?",
            "Have you recently traveled?",
            "Have you been exposed to anyone who is sick?",
            "Do you have any rash?",
            "Have you taken any medication for the fever?"
        ],
        "possible_conditions": [
            {"name": "Viral Infection", "icdCode": "B34.9", "severity": "mild"},
            {"name": "Bacterial Infection", "icdCode": "A49.9", "severity": "moderate"},
            {"name": "Influenza", "icdCode": "J11.1", "severity": "moderate"},
            {"name": "COVID-19", "icdCode": "U07.1", "severity": "moderate"},
            {"name": "Urinary Tract Infection", "icdCode": "N39.0", "severity": "moderate"},
        ],
        "department": "Internal Medicine"
    },
    "rash": {
        "follow_up_questions": [
            "Where on your body is the rash?",
            "When did the rash first appear?",
            "Is the rash itchy, painful, or neither?",
            "Have you started any new medications recently?",
            "Have you been exposed to any new products or plants?",
            "Do you have any fever or other symptoms?",
            "Is the rash spreading?"
        ],
        "possible_conditions": [
            {"name": "Allergic Reaction", "icdCode": "L50.9", "severity": "mild"},
            {"name": "Eczema", "icdCode": "L30.9", "severity": "mild"},
            {"name": "Contact Dermatitis", "icdCode": "L25.9", "severity": "mild"},
            {"name": "Viral Exanthem", "icdCode": "B09", "severity": "mild"},
            {"name": "Drug Reaction", "icdCode": "L27.0", "severity": "moderate"},
        ],
        "department": "Dermatology"
    }
}


# =============================================================================
# Question Bank
# =============================================================================

QUESTION_BANK = {
    "initial": {
        "id": "main_symptoms",
        "type": "multitext",
        "question": "What symptoms are you experiencing today?",
        "placeholder": "Describe your main symptoms...",
        "helpText": "Please list all the symptoms you're currently experiencing",
        "required": True,
        "priority": 1
    },
    "body_location": {
        "id": "body_location",
        "type": "select",
        "question": "Which part of your body is primarily affected?",
        "options": [
            {"value": "head_neck", "label": "Head/Neck (headache, sore throat, ear pain)"},
            {"value": "chest", "label": "Chest (breathing, heart, cough)"},
            {"value": "abdomen", "label": "Abdomen/Stomach (digestive issues)"},
            {"value": "back_spine", "label": "Back/Spine"},
            {"value": "arms_hands", "label": "Arms/Hands"},
            {"value": "legs_feet", "label": "Legs/Feet"},
            {"value": "skin", "label": "Skin (rash, itching)"},
            {"value": "general", "label": "Whole Body/General (fever, fatigue)"},
            {"value": "mental", "label": "Mental/Emotional"}
        ],
        "required": True,
        "priority": 2
    },
    "severity": {
        "id": "severity",
        "type": "scale",
        "question": "On a scale of 1-10, how severe are your symptoms?",
        "min": 1,
        "max": 10,
        "labels": {"1": "Barely noticeable", "5": "Moderate", "10": "Worst imaginable"},
        "required": True,
        "priority": 3
    },
    "duration": {
        "id": "duration",
        "type": "select",
        "question": "How long have you been experiencing these symptoms?",
        "options": [
            {"value": "just_started", "label": "Just started (minutes to hours)"},
            {"value": "today", "label": "Started today"},
            {"value": "1-3_days", "label": "1-3 days"},
            {"value": "4-7_days", "label": "4-7 days"},
            {"value": "1-2_weeks", "label": "1-2 weeks"},
            {"value": "2-4_weeks", "label": "2-4 weeks"},
            {"value": "more_than_month", "label": "More than a month"},
            {"value": "chronic", "label": "Chronic (recurring over months/years)"}
        ],
        "required": True,
        "priority": 4
    },
    "onset": {
        "id": "onset",
        "type": "select",
        "question": "How did your symptoms begin?",
        "options": [
            {"value": "sudden", "label": "Suddenly (came on quickly)"},
            {"value": "gradual", "label": "Gradually (slowly got worse)"},
            {"value": "after_injury", "label": "After an injury or accident"},
            {"value": "after_activity", "label": "After specific activity"},
            {"value": "upon_waking", "label": "Upon waking up"},
            {"value": "unknown", "label": "Not sure/Can't remember"}
        ],
        "required": True,
        "priority": 5
    },
    "pattern": {
        "id": "pattern",
        "type": "select",
        "question": "How do your symptoms behave over time?",
        "options": [
            {"value": "constant", "label": "Constant (always present)"},
            {"value": "intermittent", "label": "Comes and goes"},
            {"value": "worsening", "label": "Getting progressively worse"},
            {"value": "improving", "label": "Gradually improving"},
            {"value": "fluctuating", "label": "Fluctuates throughout the day"}
        ],
        "required": True,
        "priority": 6
    },
    "associated_symptoms": {
        "id": "associated_symptoms",
        "type": "multiselect",
        "question": "Are you experiencing any of these additional symptoms?",
        "options": [
            {"value": "fever", "label": "Fever or chills"},
            {"value": "fatigue", "label": "Fatigue or weakness"},
            {"value": "nausea", "label": "Nausea or vomiting"},
            {"value": "headache", "label": "Headache"},
            {"value": "dizziness", "label": "Dizziness or lightheadedness"},
            {"value": "shortness_of_breath", "label": "Shortness of breath"},
            {"value": "chest_discomfort", "label": "Chest discomfort"},
            {"value": "loss_of_appetite", "label": "Loss of appetite"},
            {"value": "weight_changes", "label": "Unexplained weight changes"},
            {"value": "sleep_problems", "label": "Sleep problems"},
            {"value": "sweating", "label": "Unusual sweating"},
            {"value": "none", "label": "None of these"}
        ],
        "required": False,
        "priority": 7
    },
    "medical_history": {
        "id": "medical_history",
        "type": "multiselect",
        "question": "Do you have any of these medical conditions?",
        "options": [
            {"value": "diabetes", "label": "Diabetes"},
            {"value": "hypertension", "label": "High blood pressure"},
            {"value": "heart_disease", "label": "Heart disease"},
            {"value": "asthma_copd", "label": "Asthma or COPD"},
            {"value": "kidney_disease", "label": "Kidney disease"},
            {"value": "liver_disease", "label": "Liver disease"},
            {"value": "cancer", "label": "Cancer (current or past)"},
            {"value": "autoimmune", "label": "Autoimmune condition"},
            {"value": "mental_health", "label": "Mental health condition"},
            {"value": "none", "label": "None of these"}
        ],
        "required": False,
        "priority": 8
    },
    "current_medications": {
        "id": "current_medications",
        "type": "text",
        "question": "Are you currently taking any medications?",
        "placeholder": "List medications or type 'none'",
        "helpText": "Include prescription and over-the-counter medications",
        "required": False,
        "priority": 9
    },
    "allergies": {
        "id": "allergies",
        "type": "text",
        "question": "Do you have any known allergies?",
        "placeholder": "List allergies or type 'none'",
        "helpText": "Include drug allergies, food allergies, and environmental allergies",
        "required": False,
        "priority": 10
    },
    "previous_treatment": {
        "id": "previous_treatment",
        "type": "text",
        "question": "Have you tried any treatments for these symptoms?",
        "placeholder": "e.g., medications, rest, ice...",
        "helpText": "Describe what you've tried and whether it helped",
        "required": False,
        "priority": 11
    },
    "recent_changes": {
        "id": "recent_changes",
        "type": "text",
        "question": "Have there been any recent changes in your life or health?",
        "placeholder": "e.g., travel, new medication, stress, diet changes...",
        "helpText": "This helps identify potential triggers",
        "required": False,
        "priority": 12
    }
}

QUESTION_FLOW = [
    "main_symptoms",
    "body_location",
    "severity",
    "duration",
    "associated_symptoms",
]


# =============================================================================
# Session Storage (In-memory - use Redis/DB in production)
# =============================================================================

sessions: Dict[str, Dict[str, Any]] = {}


# =============================================================================
# Helper Functions
# =============================================================================

def check_red_flags(text: str) -> List[Dict[str, Any]]:
    """Check for red flag symptoms in the provided text"""
    text_lower = text.lower()
    detected_flags = []

    for flag_id, flag_data in RED_FLAG_SYMPTOMS.items():
        for keyword in flag_data["keywords"]:
            if keyword in text_lower:
                detected_flags.append({
                    "flagId": flag_id,
                    "keyword": keyword,
                    "severity": flag_data["severity"],
                    "message": flag_data["message"],
                    "triageLevel": flag_data["triageLevel"].value,
                    "department": flag_data["department"]
                })
                break  # Only detect each flag once

    return detected_flags


def check_all_responses_for_red_flags(answers: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Check all collected answers for red flag symptoms"""
    all_text = ""
    for key, value in answers.items():
        if isinstance(value, str):
            all_text += " " + value
        elif isinstance(value, list):
            all_text += " " + " ".join(str(v) for v in value)

    return check_red_flags(all_text)


def calculate_urgency_score(session_data: Dict[str, Any]) -> int:
    """Calculate urgency score (1-10) based on session data"""
    answers = session_data.get("answers", {})
    red_flags = session_data.get("redFlags", [])

    score = 3  # Base score

    # Red flags have highest impact
    if red_flags:
        max_severity = max(rf.get("severity", 5) for rf in red_flags)
        score = max(score, max_severity)

    # Severity from patient rating
    severity = answers.get("severity", 5)
    if isinstance(severity, (int, float)):
        if severity >= 9:
            score = max(score, 9)
        elif severity >= 7:
            score = max(score, 7)
        elif severity >= 5:
            score = max(score, 5)

    # Duration adjustments
    duration = answers.get("duration", "")
    if duration in ["just_started"]:
        # Sudden onset can be more concerning
        score = max(score, score + 1)
    elif duration in ["chronic", "more_than_month"]:
        # Chronic issues are less emergent but need attention
        pass

    # Pattern adjustments
    pattern = answers.get("pattern", "")
    if pattern == "worsening":
        score = min(score + 2, 10)

    # Associated symptoms
    associated = answers.get("associated_symptoms", [])
    high_risk_symptoms = ["shortness_of_breath", "chest_discomfort", "fever", "dizziness"]
    for symptom in associated:
        if symptom in high_risk_symptoms:
            score = min(score + 1, 10)

    return min(max(score, 1), 10)


def determine_triage_level(urgency_score: int, red_flags: List[Dict]) -> TriageLevel:
    """Determine triage level based on urgency score and red flags"""
    # Emergency if any emergency red flags
    if any(rf.get("triageLevel") == "EMERGENCY" for rf in red_flags):
        return TriageLevel.EMERGENCY

    if urgency_score >= 8:
        return TriageLevel.EMERGENCY
    elif urgency_score >= 6:
        return TriageLevel.URGENT
    elif urgency_score >= 4:
        return TriageLevel.ROUTINE
    else:
        return TriageLevel.SELF_CARE


def get_recommended_department(symptoms: List[str], body_location: str, answers: Dict) -> str:
    """Determine recommended department based on symptoms and body location"""
    # Check symptoms against department mapping
    for symptom in symptoms:
        symptom_lower = symptom.lower()
        for key, department in SYMPTOM_TO_DEPARTMENT.items():
            if key in symptom_lower:
                return department

    # Fall back to body location
    body_location_map = {
        "head_neck": "ENT/Neurology",
        "chest": "Cardiology/Pulmonology",
        "abdomen": "Gastroenterology",
        "back_spine": "Orthopedics",
        "arms_hands": "Orthopedics",
        "legs_feet": "Orthopedics",
        "skin": "Dermatology",
        "general": "Internal Medicine",
        "mental": "Psychiatry"
    }

    return body_location_map.get(body_location, "General Practice")


def get_possible_conditions(symptoms: List[str], answers: Dict) -> List[Dict[str, Any]]:
    """Get possible conditions based on symptoms"""
    conditions = []
    symptom_text = " ".join(symptoms).lower()

    for pattern, data in SYMPTOM_PATTERNS.items():
        if pattern in symptom_text:
            for condition in data.get("possible_conditions", []):
                # Adjust confidence based on matching
                base_confidence = random.uniform(0.4, 0.7)
                conditions.append({
                    "name": condition["name"],
                    "confidence": round(base_confidence, 2),
                    "icdCode": condition.get("icdCode"),
                    "severity": condition.get("severity", "moderate"),
                    "description": f"Possible condition based on reported symptoms. Clinical evaluation required for diagnosis."
                })

    # Remove duplicates and limit
    seen_names = set()
    unique_conditions = []
    for c in conditions:
        if c["name"] not in seen_names:
            seen_names.add(c["name"])
            unique_conditions.append(c)

    # Sort by confidence
    unique_conditions.sort(key=lambda x: x["confidence"], reverse=True)

    if not unique_conditions:
        unique_conditions = [{
            "name": "Further Evaluation Needed",
            "confidence": 0.0,
            "severity": "unknown",
            "description": "Your symptoms require professional medical evaluation for proper diagnosis."
        }]

    return unique_conditions[:5]


def get_self_care_advice(symptoms: List[str], triage_level: TriageLevel) -> List[str]:
    """Generate self-care advice based on symptoms"""
    advice = [
        "Get adequate rest and sleep",
        "Stay well-hydrated by drinking plenty of water",
        "Monitor your symptoms and note any changes"
    ]

    symptom_text = " ".join(symptoms).lower()

    if "pain" in symptom_text:
        advice.append("Consider over-the-counter pain relievers as directed on the package")
        advice.append("Apply ice or heat as appropriate for comfort")

    if "fever" in symptom_text:
        advice.append("Use fever-reducing medication (acetaminophen/ibuprofen) as directed")
        advice.append("Keep cool with light clothing and rest")

    if "cough" in symptom_text or "sore throat" in symptom_text:
        advice.append("Use honey or throat lozenges for comfort")
        advice.append("Use a humidifier if air is dry")

    if "headache" in symptom_text:
        advice.append("Rest in a quiet, dark room")
        advice.append("Avoid screen time and bright lights")

    if "stomach" in symptom_text or "nausea" in symptom_text or "abdominal" in symptom_text:
        advice.append("Eat small, bland meals")
        advice.append("Avoid spicy, fatty, or acidic foods")

    if triage_level in [TriageLevel.EMERGENCY, TriageLevel.URGENT]:
        advice.insert(0, "These are general suggestions - seek medical attention as recommended")

    return advice


def get_when_to_seek_help(triage_level: TriageLevel, body_location: str) -> List[str]:
    """Get guidance on when to seek medical help"""
    warnings = [
        "Symptoms suddenly worsen",
        "New symptoms develop",
        "Fever above 103F (39.4C)",
        "Symptoms persist beyond expected duration"
    ]

    if body_location == "chest":
        warnings.extend([
            "Chest pain spreads to arm, jaw, or back",
            "Difficulty breathing worsens",
            "Irregular heartbeat or palpitations",
            "Sweating with chest discomfort"
        ])
    elif body_location in ["head_neck"]:
        warnings.extend([
            "Severe or worst headache of your life",
            "Confusion or difficulty speaking",
            "Vision changes or loss",
            "Stiff neck with fever"
        ])
    elif body_location == "abdomen":
        warnings.extend([
            "Severe abdominal pain that doesn't improve",
            "Blood in stool or vomit",
            "Signs of dehydration",
            "Abdominal swelling or rigidity"
        ])

    if triage_level == TriageLevel.EMERGENCY:
        warnings.insert(0, "SEEK IMMEDIATE MEDICAL ATTENTION - Do not delay")
    elif triage_level == TriageLevel.URGENT:
        warnings.insert(0, "Seek medical attention within the next few hours")

    return warnings


def get_estimated_wait_time(department: str, triage_level: TriageLevel) -> Dict[str, Any]:
    """Estimate wait time based on department and triage level"""
    base_times = {
        "Emergency": {"min": 0, "max": 15},
        "Cardiology": {"min": 15, "max": 45},
        "Neurology": {"min": 20, "max": 60},
        "Gastroenterology": {"min": 30, "max": 90},
        "Orthopedics": {"min": 30, "max": 90},
        "Pulmonology": {"min": 20, "max": 60},
        "Dermatology": {"min": 45, "max": 120},
        "ENT": {"min": 30, "max": 90},
        "Internal Medicine": {"min": 30, "max": 90},
        "General Practice": {"min": 20, "max": 60},
    }

    # Find matching department
    base = {"min": 30, "max": 90}
    for dept, times in base_times.items():
        if dept.lower() in department.lower():
            base = times
            break

    # Adjust for triage level
    multipliers = {
        TriageLevel.EMERGENCY: 0.3,
        TriageLevel.URGENT: 0.6,
        TriageLevel.ROUTINE: 1.0,
        TriageLevel.SELF_CARE: 1.2
    }

    multiplier = multipliers.get(triage_level, 1.0)

    return {
        "estimatedMinutes": int((base["min"] + base["max"]) / 2 * multiplier),
        "rangeMinutes": {
            "min": int(base["min"] * multiplier),
            "max": int(base["max"] * multiplier)
        },
        "note": "Wait times are estimates and may vary based on current patient volume and acuity."
    }


def get_follow_up_questions_for_provider(symptoms: List[str], answers: Dict) -> List[str]:
    """Generate follow-up questions for healthcare provider"""
    questions = [
        "Have you experienced these symptoms before?",
        "Are there any activities that make symptoms better or worse?",
        "Have you recently traveled or been exposed to illness?"
    ]

    symptom_text = " ".join(symptoms).lower()

    for pattern, data in SYMPTOM_PATTERNS.items():
        if pattern in symptom_text:
            questions.extend(data.get("follow_up_questions", [])[:3])

    # Remove duplicates
    return list(dict.fromkeys(questions))[:8]


def get_recommended_action(triage_level: TriageLevel, department: str) -> str:
    """Get recommended action based on triage level"""
    actions = {
        TriageLevel.EMERGENCY: f"SEEK IMMEDIATE EMERGENCY CARE. Go to the nearest Emergency Room or call 911. Your symptoms require urgent evaluation by {department}.",
        TriageLevel.URGENT: f"Seek medical attention within the next few hours. Contact {department} or visit urgent care. If symptoms worsen, go to Emergency Room.",
        TriageLevel.ROUTINE: f"Schedule an appointment with {department} within the next few days. Monitor symptoms and seek earlier care if they worsen.",
        TriageLevel.SELF_CARE: f"Your symptoms appear manageable with self-care. If symptoms persist beyond a few days or worsen, schedule an appointment with {department}."
    }
    return actions.get(triage_level, "Please consult a healthcare provider for proper evaluation.")


# =============================================================================
# API Endpoints
# =============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "Symptom Checker AI",
        "version": "2.0.0",
        "timestamp": datetime.now().isoformat(),
        "activeSessions": len(sessions),
        "aiAvailable": openai_manager.is_available(),
        "model": "gpt-4o (complex medical reasoning)" if openai_manager.is_available() else "rule-based fallback"
    }


@app.post("/api/symptom-checker/start", response_model=StartSessionResponse)
async def start_session(request: StartSessionRequest):
    """Start a new symptom checking session"""
    session_id = str(uuid.uuid4())

    # Initialize session
    session = {
        "id": session_id,
        "status": SessionStatus.ACTIVE.value,
        "patientInfo": request.patientInfo.dict() if request.patientInfo else {},
        "hospitalId": request.hospitalId,
        "currentQuestionIndex": 0,
        "answers": {},
        "collectedSymptoms": request.initialSymptoms or [],
        "redFlags": [],
        "createdAt": datetime.now().isoformat(),
        "lastUpdatedAt": datetime.now().isoformat()
    }

    # Check initial symptoms for red flags
    if request.initialSymptoms:
        for symptom in request.initialSymptoms:
            flags = check_red_flags(symptom)
            session["redFlags"].extend(flags)

    sessions[session_id] = session

    # Check if we have emergency red flags immediately
    emergency_flags = [rf for rf in session["redFlags"] if rf.get("triageLevel") == "EMERGENCY"]
    if emergency_flags:
        session["status"] = SessionStatus.RED_FLAG_DETECTED.value
        return StartSessionResponse(
            sessionId=session_id,
            status=session["status"],
            message=emergency_flags[0]["message"],
            nextQuestions=[],
            progress=100,
            redFlagDetected=True,
            redFlagMessage=emergency_flags[0]["message"]
        )

    # Get first questions
    first_questions = [QUESTION_BANK["initial"]]
    if request.initialSymptoms and len(request.initialSymptoms) > 0:
        # Skip initial symptom question, go to body location
        session["answers"]["main_symptoms"] = request.initialSymptoms
        session["currentQuestionIndex"] = 1
        first_questions = [QUESTION_BANK["body_location"], QUESTION_BANK["severity"]]

    return StartSessionResponse(
        sessionId=session_id,
        status=session["status"],
        message="Welcome to the Symptom Checker. I'll ask you a few questions to better understand your symptoms and provide guidance.",
        nextQuestions=first_questions,
        progress=0,
        redFlagDetected=len(session["redFlags"]) > 0,
        redFlagMessage=session["redFlags"][0]["message"] if session["redFlags"] else None
    )


@app.post("/api/symptom-checker/respond", response_model=RespondResponse)
async def submit_response(request: RespondRequest):
    """Submit responses and get next questions"""
    if request.sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = sessions[request.sessionId]

    if session.get("status") in [SessionStatus.COMPLETED.value, SessionStatus.RED_FLAG_DETECTED.value]:
        raise HTTPException(status_code=400, detail="Session already completed")

    # Process responses
    for response in request.responses:
        question_id = response.get("questionId")
        answer = response.get("answer")

        if question_id:
            session["answers"][question_id] = answer

            # Check for red flags in text responses
            if isinstance(answer, str):
                flags = check_red_flags(answer)
                for flag in flags:
                    existing_ids = [f.get("flagId") for f in session["redFlags"]]
                    if flag["flagId"] not in existing_ids:
                        session["redFlags"].append(flag)

            # Collect symptoms from main_symptoms response
            if question_id == "main_symptoms":
                if isinstance(answer, list):
                    session["collectedSymptoms"].extend(answer)
                elif isinstance(answer, str):
                    # Parse comma-separated symptoms
                    symptoms = [s.strip() for s in answer.split(',')]
                    session["collectedSymptoms"].extend(symptoms)

    session["lastUpdatedAt"] = datetime.now().isoformat()

    # Calculate progress based on answered questions
    answered_questions = set(session["answers"].keys())
    required_questions = set(QUESTION_FLOW)
    answered_count = len(answered_questions.intersection(required_questions))
    progress = min(int((answered_count / len(QUESTION_FLOW)) * 100), 100)

    # Check for emergency red flags
    emergency_flags = [rf for rf in session["redFlags"] if rf.get("triageLevel") == "EMERGENCY"]
    if emergency_flags:
        session["status"] = SessionStatus.RED_FLAG_DETECTED.value
        return RespondResponse(
            sessionId=request.sessionId,
            status=session["status"],
            message=None,
            nextQuestions=None,
            progress=100,
            isComplete=True,
            redFlagDetected=True,
            redFlagMessage=emergency_flags[0]["message"],
            triageLevel=TriageLevel.EMERGENCY.value
        )

    # Determine next questions - only ask what hasn't been answered
    next_questions = []
    for question_key in QUESTION_FLOW:
        if question_key not in session["answers"]:
            # Map question key to QUESTION_BANK - handle "initial" -> "main_symptoms"
            bank_key = "initial" if question_key == "main_symptoms" else question_key
            if bank_key in QUESTION_BANK:
                next_questions.append(QUESTION_BANK[bank_key])
            elif question_key in QUESTION_BANK:
                next_questions.append(QUESTION_BANK[question_key])
            if len(next_questions) >= 2:  # Send 2 questions at a time for speed
                break

    # Check if complete
    is_complete = len(next_questions) == 0

    if is_complete:
        session["status"] = SessionStatus.COMPLETED.value
        urgency_score = calculate_urgency_score(session)
        triage_level = determine_triage_level(urgency_score, session["redFlags"])

        return RespondResponse(
            sessionId=request.sessionId,
            status=session["status"],
            message="Assessment complete. Your results are ready.",
            nextQuestions=None,
            progress=100,
            isComplete=True,
            redFlagDetected=len(session["redFlags"]) > 0,
            redFlagMessage=session["redFlags"][0]["message"] if session["redFlags"] else None,
            triageLevel=triage_level.value
        )

    # Generate contextual message based on symptoms
    message = None
    symptoms = session.get("collectedSymptoms", [])
    if symptoms and len(symptoms) > 0:
        symptom_text = symptoms[0] if isinstance(symptoms[0], str) else str(symptoms[0])
        if len(symptom_text) > 50:
            symptom_text = symptom_text[:50] + "..."
        message = f"Got it. Let me understand more about your {symptom_text.lower()}."

    return RespondResponse(
        sessionId=request.sessionId,
        status=session["status"],
        message=message,
        nextQuestions=next_questions,
        progress=progress,
        isComplete=False,
        redFlagDetected=len(session["redFlags"]) > 0
    )


@app.get("/api/symptom-checker/session/{session_id}", response_model=GetSessionResponse)
async def get_session(session_id: str):
    """Get session details"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = sessions[session_id]

    return GetSessionResponse(
        sessionId=session["id"],
        status=session["status"],
        patientInfo=session.get("patientInfo"),
        collectedSymptoms=session.get("collectedSymptoms", []),
        answers=session.get("answers", {}),
        progress=min(int((len([q for q in QUESTION_FLOW if q in session.get("answers", {})]) / len(QUESTION_FLOW)) * 100), 100),
        redFlags=session.get("redFlags", []),
        createdAt=session.get("createdAt", datetime.now().isoformat()),
        lastUpdatedAt=session.get("lastUpdatedAt", datetime.now().isoformat())
    )


@app.post("/api/symptom-checker/complete", response_model=CompleteResponse)
async def complete_assessment(request: CompleteRequest):
    """Complete the assessment and get full triage result - AI-enhanced when available"""
    if request.sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = sessions[request.sessionId]
    answers = session.get("answers", {})
    red_flags = session.get("redFlags", [])
    symptoms = session.get("collectedSymptoms", [])
    patient_info = session.get("patientInfo", {})

    # Extract main symptom info
    main_symptoms = answers.get("main_symptoms", [])
    if isinstance(main_symptoms, str):
        symptoms.append(main_symptoms)
    elif isinstance(main_symptoms, list):
        symptoms.extend(main_symptoms)

    symptoms = list(set(symptoms))  # Remove duplicates

    # Get body location
    body_location = answers.get("body_location", "general")

    # Try AI-powered analysis first
    ai_result = None
    if openai_manager.is_available():
        try:
            ai_result = await SymptomCheckerAI._ai_analyze_symptoms(
                symptoms=symptoms,
                patient_age=patient_info.get("age"),
                patient_gender=patient_info.get("gender"),
                medical_history=patient_info.get("medicalHistory", []),
                body_location=body_location,
                severity=answers.get("severity"),
                duration=answers.get("duration"),
                associated_symptoms=answers.get("associated_symptoms", [])
            )
        except Exception as e:
            logger.error(f"AI analysis failed, using rule-based fallback: {e}")

    # Calculate rule-based urgency and triage (always as safety check)
    rule_urgency_score = calculate_urgency_score(session)
    rule_triage_level = determine_triage_level(rule_urgency_score, red_flags)

    # Use AI results if available, with rule-based safety escalation
    if ai_result:
        # Parse AI triage level
        ai_triage_str = ai_result.get("triageLevel", "ROUTINE")
        try:
            triage_level = TriageLevel(ai_triage_str)
        except ValueError:
            triage_level = rule_triage_level

        # Safety check: escalate if rule-based system detects emergency
        if rule_triage_level == TriageLevel.EMERGENCY:
            triage_level = TriageLevel.EMERGENCY

        urgency_score = ai_result.get("urgencyScore", rule_urgency_score)
        department = ai_result.get("recommendedDepartment", "General Practice")
        possible_conditions = ai_result.get("possibleConditions", [])
        self_care = ai_result.get("selfCareAdvice", [])
        when_to_seek = ai_result.get("whenToSeekHelp", [])
        follow_up = ai_result.get("followUpQuestions", [])
        recommended_action = ai_result.get("recommendedAction", "")

        # Merge AI red flags with rule-based red flags
        ai_red_flags = ai_result.get("redFlags", [])
        red_flag_symptoms = list(set([rf.get("keyword", "") for rf in red_flags] + ai_red_flags))
    else:
        # Fallback to rule-based assessment
        triage_level = rule_triage_level
        urgency_score = rule_urgency_score
        department = get_recommended_department(symptoms, body_location, answers)
        possible_conditions = get_possible_conditions(symptoms, answers)
        self_care = get_self_care_advice(symptoms, triage_level)
        when_to_seek = get_when_to_seek_help(triage_level, body_location)
        follow_up = get_follow_up_questions_for_provider(symptoms, answers)
        recommended_action = get_recommended_action(triage_level, department)
        red_flag_symptoms = [rf.get("keyword", "") for rf in red_flags]

    # If red flags present, use their department (safety override)
    if red_flags:
        department = red_flags[0].get("department", department)

    # Get estimated wait time
    wait_time = get_estimated_wait_time(department, triage_level)

    # Ensure recommended action is set
    if not recommended_action:
        recommended_action = get_recommended_action(triage_level, department)

    # Mark session as completed
    session["status"] = SessionStatus.COMPLETED.value
    session["lastUpdatedAt"] = datetime.now().isoformat()

    return CompleteResponse(
        sessionId=request.sessionId,
        triageLevel=triage_level.value,
        recommendedDepartment=department,
        urgencyScore=urgency_score,
        redFlags=red_flag_symptoms,
        nextQuestions=follow_up,
        possibleConditions=possible_conditions,
        recommendedAction=recommended_action,
        estimatedWaitTime=wait_time,
        selfCareAdvice=self_care,
        whenToSeekHelp=when_to_seek,
        symptomsSummary=symptoms,
        disclaimer="IMPORTANT: This symptom checker is for informational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition. Never disregard professional medical advice or delay in seeking it because of something you have read here. If you think you may have a medical emergency, call your doctor or emergency services immediately."
    )


@app.delete("/api/symptom-checker/session/{session_id}")
async def delete_session(session_id: str):
    """Delete/abandon a session"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    del sessions[session_id]

    return {"message": "Session deleted successfully"}


@app.get("/api/symptom-checker/history")
async def get_history(patient_id: Optional[str] = None, hospital_id: Optional[str] = None):
    """Get symptom check history"""
    filtered_sessions = []

    for session_id, session_data in sessions.items():
        if session_data.get("status") != SessionStatus.COMPLETED.value:
            continue

        if patient_id:
            patient_info = session_data.get("patientInfo", {})
            if patient_info.get("patientId") != patient_id:
                continue

        if hospital_id:
            if session_data.get("hospitalId") != hospital_id:
                continue

        filtered_sessions.append({
            "sessionId": session_id,
            "createdAt": session_data.get("createdAt"),
            "completedAt": session_data.get("lastUpdatedAt"),
            "symptoms": session_data.get("collectedSymptoms", []),
            "triageLevel": determine_triage_level(
                calculate_urgency_score(session_data),
                session_data.get("redFlags", [])
            ).value,
            "patientId": session_data.get("patientInfo", {}).get("patientId")
        })

    # Sort by date
    filtered_sessions.sort(key=lambda x: x.get("createdAt", ""), reverse=True)

    return {"history": filtered_sessions}


@app.get("/api/symptom-checker/departments")
async def get_departments():
    """Get list of available departments"""
    departments = list(set(SYMPTOM_TO_DEPARTMENT.values()))
    departments.sort()

    return {
        "departments": [
            {"id": dept.lower().replace("/", "-").replace(" ", "-"), "name": dept}
            for dept in departments
        ]
    }


@app.get("/api/symptom-checker/body-parts")
async def get_body_parts():
    """Get list of body parts for the symptom checker"""
    body_parts = []
    for option in QUESTION_BANK["body_location"]["options"]:
        body_parts.append({
            "id": option["value"],
            "name": option["label"].split(" (")[0],
            "examples": option["label"].split("(")[1].rstrip(")") if "(" in option["label"] else ""
        })

    return {"bodyParts": body_parts}


# =============================================================================
# Wrapper Class for Integration
# =============================================================================

class SymptomCheckerAI:
    """Wrapper class for the symptom checker service with GPT-4o integration"""

    @staticmethod
    def is_available() -> bool:
        """Check if OpenAI API is available for AI-powered triage"""
        return openai_manager.is_available()

    @staticmethod
    def get_app():
        return app

    @staticmethod
    async def _ai_analyze_symptoms(
        symptoms: List[str],
        patient_age: Optional[int] = None,
        patient_gender: Optional[str] = None,
        medical_history: Optional[List[str]] = None,
        body_location: Optional[str] = None,
        severity: Optional[int] = None,
        duration: Optional[str] = None,
        associated_symptoms: Optional[List[str]] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Use GPT-4o to perform intelligent symptom analysis and triage.
        Returns structured triage assessment with possible conditions.
        """
        if not openai_manager.is_available():
            return None

        # Build patient context
        patient_context = []
        if patient_age:
            patient_context.append(f"Age: {patient_age} years")
        if patient_gender:
            patient_context.append(f"Gender: {patient_gender}")
        if medical_history and len(medical_history) > 0:
            patient_context.append(f"Medical history: {', '.join(medical_history)}")

        # Build symptom context
        symptom_context = []
        if body_location:
            symptom_context.append(f"Body location: {body_location}")
        if severity:
            symptom_context.append(f"Severity: {severity}/10")
        if duration:
            symptom_context.append(f"Duration: {duration}")
        if associated_symptoms and len(associated_symptoms) > 0:
            symptom_context.append(f"Associated symptoms: {', '.join(associated_symptoms)}")

        system_prompt = """You are an expert medical triage AI assistant. Analyze the patient's symptoms and provide a clinical assessment.

IMPORTANT GUIDELINES:
- This is for triage purposes only, not diagnosis
- Be conservative with urgency assessments - patient safety first
- Always recommend seeking professional medical care
- Consider patient age and medical history in your assessment
- Look for red flag symptoms that require immediate attention

Respond with a JSON object containing:
{
    "triageLevel": "EMERGENCY" | "URGENT" | "ROUTINE" | "SELF_CARE",
    "urgencyScore": <1-10>,
    "recommendedDepartment": "<department name>",
    "possibleConditions": [
        {
            "name": "<condition name>",
            "confidence": <0.0-1.0>,
            "icdCode": "<ICD-10 code if known>",
            "severity": "mild" | "moderate" | "severe",
            "description": "<brief description>"
        }
    ],
    "redFlags": ["<red flag symptom 1>", ...],
    "clinicalReasoning": "<brief explanation of triage decision>",
    "recommendedAction": "<specific action patient should take>",
    "selfCareAdvice": ["<advice 1>", ...],
    "whenToSeekHelp": ["<warning sign 1>", ...],
    "followUpQuestions": ["<question for healthcare provider>", ...]
}"""

        user_content = f"""Analyze these symptoms for triage:

MAIN SYMPTOMS: {', '.join(symptoms)}

PATIENT INFORMATION:
{chr(10).join(patient_context) if patient_context else 'Not provided'}

SYMPTOM DETAILS:
{chr(10).join(symptom_context) if symptom_context else 'Not provided'}

Provide your triage assessment as JSON."""

        try:
            result = openai_manager.chat_completion_json(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content}
                ],
                task_complexity=TaskComplexity.COMPLEX,  # Uses gpt-4o for medical reasoning
                temperature=0.2,  # Lower temperature for consistent medical assessments
                max_tokens=2000
            )

            if result and result.get("success") and result.get("data"):
                logger.info(f"AI triage completed successfully using {result.get('model')}")
                return result["data"]
            else:
                logger.warning(f"AI triage failed: {result.get('error') if result else 'No result'}")
                return None

        except Exception as e:
            logger.error(f"AI symptom analysis error: {e}")
            return None

    @staticmethod
    async def _ai_detect_red_flags(text: str) -> Optional[List[Dict[str, Any]]]:
        """
        Use GPT-4o to detect red flag symptoms that may be missed by keyword matching.
        """
        if not openai_manager.is_available():
            return None

        system_prompt = """You are an emergency medical triage AI. Analyze the text for red flag symptoms that require immediate medical attention.

Red flag symptoms include but are not limited to:
- Cardiac: chest pain with radiation, crushing sensation, shortness of breath with chest pain
- Neurological: sudden severe headache, stroke symptoms (FAST), sudden confusion, seizure
- Respiratory: severe difficulty breathing, choking, cyanosis
- Bleeding: uncontrolled bleeding, vomiting blood, blood in stool
- Allergic: anaphylaxis symptoms, throat swelling, rapid progression
- Mental health: suicidal ideation, self-harm
- Trauma: severe injuries, loss of consciousness

Respond with JSON:
{
    "redFlagsDetected": [
        {
            "symptom": "<detected symptom>",
            "category": "<category>",
            "severity": <1-10>,
            "message": "<urgent message for patient>",
            "recommendedAction": "CALL_911" | "GO_TO_ER" | "URGENT_CARE" | "MONITOR"
        }
    ],
    "overallUrgency": "CRITICAL" | "HIGH" | "MODERATE" | "LOW" | "NONE"
}"""

        try:
            result = openai_manager.chat_completion_json(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Analyze for red flags:\n\n{text}"}
                ],
                task_complexity=TaskComplexity.COMPLEX,
                temperature=0.1,  # Very low for safety-critical decisions
                max_tokens=1000
            )

            if result and result.get("success") and result.get("data"):
                return result["data"].get("redFlagsDetected", [])
            return None

        except Exception as e:
            logger.error(f"AI red flag detection error: {e}")
            return None

    @staticmethod
    async def quick_check(symptoms: List[str], patient_age: Optional[int] = None) -> Dict[str, Any]:
        """Quick symptom check - uses AI when available, falls back to rules"""
        # Always check for red flags with rule-based system first (safety-critical)
        all_symptoms_text = " ".join(symptoms)
        rule_red_flags = check_red_flags(all_symptoms_text)

        # Create minimal session data for rule-based fallback
        session_data = {
            "answers": {"main_symptoms": symptoms, "severity": 5},
            "redFlags": rule_red_flags,
            "collectedSymptoms": symptoms
        }

        # Try AI-powered analysis
        if SymptomCheckerAI.is_available():
            ai_result = await SymptomCheckerAI._ai_analyze_symptoms(
                symptoms=symptoms,
                patient_age=patient_age
            )

            if ai_result:
                # Merge AI red flags with rule-based red flags (safety first)
                ai_red_flags = ai_result.get("redFlags", [])
                all_red_flags = list(set([rf.get("keyword", "") for rf in rule_red_flags] + ai_red_flags))

                # Use AI triage if available, but escalate if rules detect emergency
                triage_level = ai_result.get("triageLevel", "ROUTINE")
                if any(rf.get("triageLevel") == "EMERGENCY" for rf in rule_red_flags):
                    triage_level = "EMERGENCY"

                return {
                    "triageLevel": triage_level,
                    "urgencyScore": ai_result.get("urgencyScore", 5),
                    "recommendedDepartment": ai_result.get("recommendedDepartment", "General Practice"),
                    "redFlagsDetected": len(all_red_flags) > 0,
                    "redFlags": all_red_flags,
                    "recommendedAction": ai_result.get("recommendedAction", ""),
                    "possibleConditions": ai_result.get("possibleConditions", []),
                    "clinicalReasoning": ai_result.get("clinicalReasoning", ""),
                    "selfCareAdvice": ai_result.get("selfCareAdvice", []),
                    "whenToSeekHelp": ai_result.get("whenToSeekHelp", []),
                    "aiPowered": True
                }

        # Fallback to rule-based assessment
        urgency_score = calculate_urgency_score(session_data)
        triage_level = determine_triage_level(urgency_score, rule_red_flags)
        department = get_recommended_department(symptoms, "general", session_data["answers"])

        return {
            "triageLevel": triage_level.value,
            "urgencyScore": urgency_score,
            "recommendedDepartment": department,
            "redFlagsDetected": len(rule_red_flags) > 0,
            "redFlags": [rf.get("keyword") for rf in rule_red_flags],
            "recommendedAction": get_recommended_action(triage_level, department),
            "aiPowered": False
        }


# =============================================================================
# Main Entry Point
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8010)
