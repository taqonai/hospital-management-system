"""
Hospital Management System - AI Services
FastAPI-based microservices for AI-powered clinical decision support
"""

import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import uvicorn

from diagnostic.service import DiagnosticAI
from predictive.service import PredictiveAnalytics
from imaging.service import ImageAnalysisAI
from chat.service import ChatAI
from speech.service import SpeechToTextService
from queue_ai.service import QueuePredictionAI
from pharmacy.service import PharmacyAI
from clinical_notes.service import ClinicalNotesAI
from symptom_checker.service import SymptomCheckerAI
from entity_extraction.service import EntityExtractionAI
from pdf_analysis.service import PDFAnalysisService

app = FastAPI(
    title="HMS AI Services",
    description="AI-powered clinical decision support microservices",
    version="1.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize AI services
diagnostic_ai = DiagnosticAI()
predictive_ai = PredictiveAnalytics()
imaging_ai = ImageAnalysisAI()
chat_ai = ChatAI()
speech_ai = SpeechToTextService()
queue_ai = QueuePredictionAI()
pharmacy_ai = PharmacyAI()
clinical_notes_ai = ClinicalNotesAI()
symptom_checker_ai = SymptomCheckerAI()
entity_extraction_ai = EntityExtractionAI()
pdf_analyzer = PDFAnalysisService()


# Request/Response Models
class DiagnosisRequest(BaseModel):
    symptoms: List[str]
    patientAge: int
    gender: str
    medicalHistory: Optional[List[str]] = []
    currentMedications: Optional[List[str]] = []
    allergies: Optional[List[str]] = []
    vitalSigns: Optional[Dict[str, Any]] = None


class DrugInteraction(BaseModel):
    drug1: str
    drug2: str
    severity: str
    warning: str


class RiskFactor(BaseModel):
    factor: str
    relevance: str


class Diagnosis(BaseModel):
    icd10: str
    name: str
    confidence: float
    category: Optional[str] = None
    severity: Optional[str] = None


class DiagnosisResponse(BaseModel):
    diagnoses: List[Diagnosis]
    recommendedTests: List[str]
    treatmentSuggestions: List[str]
    drugInteractions: List[DrugInteraction]
    riskFactors: List[RiskFactor]
    confidence: float
    modelVersion: str


class RiskPredictionRequest(BaseModel):
    patientId: str
    predictionType: str
    timeframe: Optional[str] = "30 days"
    patientData: Dict[str, Any]


class RiskPredictionResponse(BaseModel):
    riskScore: float
    riskLevel: str
    factors: List[str]
    recommendations: List[str]
    modelVersion: str


class ImageAnalysisRequest(BaseModel):
    imageUrl: str
    modalityType: str
    bodyPart: str
    patientAge: int
    patientGender: str
    clinicalHistory: Optional[str] = None


class StudyInfo(BaseModel):
    modality: str
    bodyPart: str
    patientAge: int
    patientGender: str


class ImageAnalysisResponse(BaseModel):
    findings: List[Dict[str, Any]]
    impression: str
    recommendations: List[str]
    heatmapUrl: Optional[str] = None
    abnormalityDetected: bool
    confidence: float
    urgency: str
    studyInfo: StudyInfo
    modelVersion: str


# Chat Request/Response Models
class ChatRequest(BaseModel):
    message: str
    context: Optional[Dict[str, Any]] = None


class PDFAnalyzeUrlRequest(BaseModel):
    url: str
    document_type: str = "medical_report"
    extract_entities: bool = True
    patient_context: Optional[Dict[str, Any]] = None


class ChatAction(BaseModel):
    type: str
    route: Optional[str] = None
    filter: Optional[str] = None
    tests: Optional[List[str]] = None


class ChatResponse(BaseModel):
    response: str
    intent: str
    actions: List[ChatAction]
    suggestions: List[str]


class VoiceCommandRequest(BaseModel):
    transcript: str
    context: Optional[Dict[str, Any]] = None


class VoiceCommandResponse(BaseModel):
    intent: str
    entities: Dict[str, Any]
    action: Optional[ChatAction] = None
    response: str
    confidence: float


class TranscriptionResponse(BaseModel):
    success: bool
    transcript: str
    confidence: float
    error: Optional[str] = None
    language: Optional[str] = None
    duration: Optional[float] = None


# Queue Request/Response Models
class WaitTimePredictionRequest(BaseModel):
    serviceType: str
    currentQueueLength: int = 0
    waitingPatients: int = 0
    activeCounters: int = 1
    priority: str = "NORMAL"
    historicalData: Optional[Dict[str, Any]] = None


class WaitTimePredictionResponse(BaseModel):
    estimatedWaitMinutes: int
    range: Dict[str, int]
    confidence: float
    queuePosition: int
    activeCounters: int
    factors: List[str]
    recommendations: List[str]
    predictedCallTime: str
    modelVersion: str


class QueueOptimizationRequest(BaseModel):
    counters: List[Dict[str, Any]]
    serviceType: str
    patientPriority: str = "NORMAL"


class QueueOptimizationResponse(BaseModel):
    counterId: Optional[str]
    counterNumber: Optional[int]
    counterName: Optional[str]
    score: Optional[float]
    queueLength: Optional[int]
    estimatedServiceTime: Optional[int]
    reason: str
    modelVersion: str


class DemandForecastRequest(BaseModel):
    historicalData: List[Dict[str, Any]] = []
    targetDate: str
    serviceType: str


class DemandForecastResponse(BaseModel):
    date: str
    serviceType: str
    totalExpectedTickets: int
    hourlyForecast: Dict[int, Dict[str, Any]]
    peakHours: List[Dict[str, Any]]
    staffingRecommendation: Dict[str, int]
    confidence: float
    modelVersion: str


class PriorityScoreRequest(BaseModel):
    priority: str
    age: int = 35
    hasAppointment: bool = False
    urgencyLevel: Optional[str] = None


class PriorityScoreResponse(BaseModel):
    score: int
    factors: List[str]
    recommendedPosition: str
    modelVersion: str


class QueueHealthRequest(BaseModel):
    waiting: int = 0
    serving: int = 0
    completed: int = 0
    noShow: int = 0
    avgWaitTime: float = 0
    activeCounters: int = 1


class QueueHealthResponse(BaseModel):
    healthScore: int
    status: str
    metrics: Dict[str, Any]
    issues: List[str]
    recommendations: List[str]
    modelVersion: str


# Pharmacy Request/Response Models
class DrugInteractionCheckRequest(BaseModel):
    medications: List[str]
    patientConditions: Optional[List[str]] = []
    patientAge: Optional[int] = None
    patientWeight: Optional[float] = None
    allergies: Optional[List[str]] = []


class InteractionDetail(BaseModel):
    drug1: str
    drug2: str
    severity: str
    severityLevel: int
    effect: str
    mechanism: str
    management: str
    clinicalEvidence: str
    color: str


class FoodInteraction(BaseModel):
    drug: str
    foodType: str
    foods: List[str]
    effect: str
    management: str


class AllergyAlert(BaseModel):
    drug: str
    allergen: str
    alertType: str
    severity: str
    message: str
    action: str


class DrugInfo(BaseModel):
    name: str
    genericName: str
    drugClass: Optional[str] = None
    subclass: Optional[str] = None
    brandNames: Optional[List[str]] = []
    mechanism: Optional[str] = None
    found: bool


class InteractionSummary(BaseModel):
    totalInteractions: int
    criticalCount: int
    severeCount: int
    moderateCount: int
    minorCount: int
    allergyAlertCount: int
    contraindicationCount: int
    overallRisk: str


class Recommendation(BaseModel):
    priority: str
    type: str
    message: str
    action: str


class DrugInteractionCheckResponse(BaseModel):
    interactions: List[Dict[str, Any]]
    foodInteractions: List[Dict[str, Any]]
    conditionContraindications: List[Dict[str, Any]]
    allergyAlerts: List[Dict[str, Any]]
    summary: Dict[str, Any]
    recommendations: List[Dict[str, Any]]
    drugInfo: List[Dict[str, Any]]
    modelVersion: str


class DrugSearchRequest(BaseModel):
    query: str
    limit: Optional[int] = 10


# Clinical Notes Request/Response Models
class GenerateNoteRequest(BaseModel):
    noteType: str
    patientInfo: Dict[str, Any]
    clinicalData: Dict[str, Any]
    additionalContext: Optional[str] = None


class GenerateNoteResponse(BaseModel):
    success: bool
    noteType: Optional[str] = None
    noteName: Optional[str] = None
    generatedNote: Optional[str] = None
    timestamp: Optional[str] = None
    patientInfo: Optional[Dict[str, Any]] = None
    modelVersion: str
    aiGenerated: Optional[bool] = None
    error: Optional[str] = None
    message: Optional[str] = None


class EnhanceNoteRequest(BaseModel):
    existingNote: str
    enhancementType: str = "improve"
    instructions: Optional[str] = None


class EnhanceNoteResponse(BaseModel):
    success: bool
    originalNote: Optional[str] = None
    enhancedNote: Optional[str] = None
    enhancementType: Optional[str] = None
    changes: Optional[List[str]] = None
    timestamp: Optional[str] = None
    modelVersion: str
    aiGenerated: Optional[bool] = None
    error: Optional[str] = None


class SummarizeNotesRequest(BaseModel):
    notes: List[str]
    summaryType: str = "comprehensive"


class SummarizeNotesResponse(BaseModel):
    success: bool
    summary: Optional[str] = None
    noteCount: Optional[int] = None
    summaryType: Optional[str] = None
    timestamp: Optional[str] = None
    modelVersion: str
    aiGenerated: Optional[bool] = None
    error: Optional[str] = None


class ExtractEntitiesRequest(BaseModel):
    noteText: str


class ExtractEntitiesResponse(BaseModel):
    success: bool
    entities: Optional[Dict[str, Any]] = None
    timestamp: Optional[str] = None
    modelVersion: str
    aiGenerated: Optional[bool] = None
    error: Optional[str] = None


class TranscriptionToNoteRequest(BaseModel):
    transcription: str
    noteType: str = "soap"
    patientInfo: Optional[Dict[str, Any]] = None


class TranscriptionToNoteResponse(BaseModel):
    success: bool
    originalTranscription: Optional[str] = None
    structuredNote: Optional[str] = None
    noteType: Optional[str] = None
    noteName: Optional[str] = None
    timestamp: Optional[str] = None
    modelVersion: str
    aiGenerated: Optional[bool] = None
    error: Optional[str] = None


class SuggestIcdCodesRequest(BaseModel):
    noteText: str


class SuggestIcdCodesResponse(BaseModel):
    success: bool
    codes: Optional[List[Dict[str, Any]]] = None
    timestamp: Optional[str] = None
    modelVersion: str
    aiGenerated: Optional[bool] = None
    disclaimer: Optional[str] = None
    message: Optional[str] = None
    error: Optional[str] = None


class ExpandAbbreviationsRequest(BaseModel):
    text: str


class ExpandAbbreviationsResponse(BaseModel):
    success: bool
    originalText: str
    expandedText: str
    expansions: List[Dict[str, str]]
    expansionCount: int
    modelVersion: str


# Health check
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "services": {
            "diagnostic": "active",
            "predictive": "active",
            "imaging": "active",
            "chat": "active",
            "speech": "active" if speech_ai.is_available() else "unavailable",
            "queue": "active",
            "pharmacy": "active",
            "clinical_notes": "active" if clinical_notes_ai.is_available() else "limited",
            "symptom_checker": "active",
        }
    }


# Diagnosis endpoint
@app.post("/api/diagnose", response_model=DiagnosisResponse)
async def analyze_symptoms(request: DiagnosisRequest):
    try:
        result = diagnostic_ai.analyze(
            symptoms=request.symptoms,
            patient_age=request.patientAge,
            gender=request.gender,
            medical_history=request.medicalHistory,
            current_medications=request.currentMedications,
            allergies=request.allergies,
            vital_signs=request.vitalSigns,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Risk prediction endpoint
@app.post("/api/predict-risk", response_model=RiskPredictionResponse)
async def predict_risk(request: RiskPredictionRequest):
    try:
        result = predictive_ai.predict(
            prediction_type=request.predictionType,
            patient_data=request.patientData,
            timeframe=request.timeframe,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Image analysis endpoint
@app.post("/api/analyze-image", response_model=ImageAnalysisResponse)
async def analyze_image(request: ImageAnalysisRequest):
    try:
        result = imaging_ai.analyze(
            image_url=request.imageUrl,
            modality_type=request.modalityType,
            body_part=request.bodyPart,
            patient_age=request.patientAge,
            patient_gender=request.patientGender,
            clinical_history=request.clinicalHistory,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Chat endpoint
@app.post("/api/chat", response_model=ChatResponse)
async def process_chat(request: ChatRequest):
    try:
        result = chat_ai.process_chat(
            message=request.message,
            context=request.context,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Voice command endpoint
@app.post("/api/voice-command", response_model=VoiceCommandResponse)
async def process_voice_command(request: VoiceCommandRequest):
    try:
        result = chat_ai.process_voice_command(
            transcript=request.transcript,
            context=request.context,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Speech-to-text (Whisper) endpoint
@app.post("/api/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(
    audio: UploadFile = File(...),
    language: str = Form(default="en"),
    context: str = Form(default="{}")
):
    """
    Transcribe audio using OpenAI Whisper API
    Supports webm, mp3, wav, m4a, ogg formats
    """
    try:
        import json

        # Check if speech service is available
        if not speech_ai.is_available():
            raise HTTPException(
                status_code=503,
                detail="Speech-to-text service unavailable. Check OpenAI API key."
            )

        # Read audio data
        audio_data = await audio.read()

        # Parse context
        try:
            ctx = json.loads(context) if context else {}
        except json.JSONDecodeError:
            ctx = {}

        # Transcribe with context
        result = speech_ai.transcribe_with_medical_context(
            audio_data=audio_data,
            filename=audio.filename or "audio.webm",
            context=ctx
        )

        if not result["success"]:
            raise HTTPException(status_code=500, detail=result.get("error", "Transcription failed"))

        return TranscriptionResponse(
            success=True,
            transcript=result["transcript"],
            confidence=result["confidence"],
            language=result.get("language"),
            duration=result.get("duration")
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Check Whisper availability
@app.get("/api/transcribe/status")
async def transcribe_status():
    """Check if Whisper transcription is available"""
    return {
        "available": speech_ai.is_available(),
        "model": "whisper-1" if speech_ai.is_available() else None
    }


# Queue AI Endpoints

# Predict wait time
@app.post("/api/queue/predict-wait", response_model=WaitTimePredictionResponse)
async def predict_wait_time(request: WaitTimePredictionRequest):
    """Predict wait time for a patient joining the queue"""
    try:
        queue_data = {
            "serviceType": request.serviceType,
            "currentQueueLength": request.currentQueueLength,
            "waitingPatients": request.waitingPatients,
            "activeCounters": request.activeCounters,
            "historicalData": request.historicalData or {},
        }
        result = queue_ai.predict_wait_time(queue_data, request.priority)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Optimize queue / find optimal counter
@app.post("/api/queue/optimize", response_model=QueueOptimizationResponse)
async def optimize_queue(request: QueueOptimizationRequest):
    """Find optimal counter for patient assignment"""
    try:
        result = queue_ai.optimize_queue(
            counters=request.counters,
            service_type=request.serviceType,
            patient_priority=request.patientPriority
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Forecast demand
@app.post("/api/queue/forecast", response_model=DemandForecastResponse)
async def forecast_demand(request: DemandForecastRequest):
    """Forecast queue demand for a specific date"""
    try:
        result = queue_ai.forecast_demand(
            historical_data=request.historicalData,
            target_date=request.targetDate,
            service_type=request.serviceType
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Calculate priority score
@app.post("/api/queue/priority-score", response_model=PriorityScoreResponse)
async def calculate_priority_score(request: PriorityScoreRequest):
    """Calculate AI-based priority score for queue ordering"""
    try:
        result = queue_ai.calculate_priority_score(
            priority=request.priority,
            age=request.age,
            has_appointment=request.hasAppointment,
            urgency_level=request.urgencyLevel
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Analyze queue health
@app.post("/api/queue/health", response_model=QueueHealthResponse)
async def analyze_queue_health(request: QueueHealthRequest):
    """Analyze overall queue health and provide insights"""
    try:
        queue_status = {
            "waiting": request.waiting,
            "serving": request.serving,
            "completed": request.completed,
            "noShow": request.noShow,
            "avgWaitTime": request.avgWaitTime,
            "activeCounters": request.activeCounters,
        }
        result = queue_ai.analyze_queue_health(queue_status)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Pharmacy AI Endpoints

# Check drug interactions
@app.post("/api/pharmacy/check-interactions", response_model=DrugInteractionCheckResponse)
async def check_drug_interactions(request: DrugInteractionCheckRequest):
    """
    Check for drug-drug interactions, food interactions, and safety alerts
    """
    try:
        result = pharmacy_ai.check_interactions(
            medications=request.medications,
            patient_conditions=request.patientConditions,
            patient_age=request.patientAge,
            patient_weight=request.patientWeight,
            allergies=request.allergies,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Get drug information
@app.get("/api/pharmacy/drug/{drug_name}")
async def get_drug_info(drug_name: str):
    """Get detailed information about a specific drug"""
    try:
        result = pharmacy_ai.get_drug_info(drug_name)
        if not result:
            raise HTTPException(status_code=404, detail=f"Drug '{drug_name}' not found in database")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Search drugs
@app.post("/api/pharmacy/search")
async def search_drugs(request: DrugSearchRequest):
    """Search for drugs by name, brand name, or class"""
    try:
        results = pharmacy_ai.search_drugs(
            query=request.query,
            limit=request.limit or 10
        )
        return {"results": results, "count": len(results)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Clinical Notes AI Endpoints

# Generate clinical note
@app.post("/api/notes/generate", response_model=GenerateNoteResponse)
async def generate_clinical_note(request: GenerateNoteRequest):
    """Generate a clinical note based on type and provided data"""
    try:
        result = clinical_notes_ai.generate_note(
            note_type=request.noteType,
            patient_info=request.patientInfo,
            clinical_data=request.clinicalData,
            additional_context=request.additionalContext,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Enhance existing note
@app.post("/api/notes/enhance", response_model=EnhanceNoteResponse)
async def enhance_clinical_note(request: EnhanceNoteRequest):
    """Enhance an existing clinical note"""
    try:
        result = clinical_notes_ai.enhance_note(
            existing_note=request.existingNote,
            enhancement_type=request.enhancementType,
            instructions=request.instructions,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Summarize multiple notes
@app.post("/api/notes/summarize", response_model=SummarizeNotesResponse)
async def summarize_clinical_notes(request: SummarizeNotesRequest):
    """Summarize multiple clinical notes"""
    try:
        result = clinical_notes_ai.summarize_notes(
            notes=request.notes,
            summary_type=request.summaryType,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Extract entities from note
@app.post("/api/notes/extract-entities", response_model=ExtractEntitiesResponse)
async def extract_medical_entities(request: ExtractEntitiesRequest):
    """Extract structured medical entities from clinical text"""
    try:
        result = clinical_notes_ai.extract_entities(
            note_text=request.noteText,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Convert transcription to structured note
@app.post("/api/notes/from-transcription", response_model=TranscriptionToNoteResponse)
async def transcription_to_structured_note(request: TranscriptionToNoteRequest):
    """Convert voice transcription to structured clinical note"""
    try:
        result = clinical_notes_ai.transcription_to_note(
            transcription=request.transcription,
            note_type=request.noteType,
            patient_info=request.patientInfo,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Suggest ICD codes
@app.post("/api/notes/suggest-icd", response_model=SuggestIcdCodesResponse)
async def suggest_icd_codes(request: SuggestIcdCodesRequest):
    """Suggest ICD-10 codes based on clinical note content"""
    try:
        result = clinical_notes_ai.suggest_icd_codes(
            note_text=request.noteText,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Expand abbreviations
@app.post("/api/notes/expand-abbreviations", response_model=ExpandAbbreviationsResponse)
async def expand_medical_abbreviations(request: ExpandAbbreviationsRequest):
    """Expand medical abbreviations in text"""
    try:
        result = clinical_notes_ai.expand_abbreviations(
            text=request.text,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Get available note templates
@app.get("/api/notes/templates")
async def get_note_templates():
    """Get available note templates and their configurations"""
    try:
        return clinical_notes_ai.get_note_templates()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Symptom Checker AI Endpoints
# =============================================================================

class SymptomCheckerPatientInfo(BaseModel):
    patientId: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    medicalHistory: Optional[List[str]] = []
    currentMedications: Optional[List[str]] = []
    allergies: Optional[List[str]] = []


class SymptomCheckerStartRequest(BaseModel):
    patientInfo: Optional[SymptomCheckerPatientInfo] = None
    initialSymptoms: Optional[List[str]] = []
    hospitalId: Optional[str] = None


class SymptomCheckerRespondRequest(BaseModel):
    sessionId: str
    responses: List[Dict[str, Any]]


class SymptomCheckerCompleteRequest(BaseModel):
    sessionId: str


class SymptomCheckerQuickCheckRequest(BaseModel):
    symptoms: List[str]
    patientAge: Optional[int] = None


@app.post("/api/symptom-checker/start")
async def symptom_checker_start(request: SymptomCheckerStartRequest):
    """Start a new symptom checking session"""
    try:
        from symptom_checker.service import (
            sessions, check_red_flags, QUESTION_BANK, SessionStatus
        )
        import uuid
        from datetime import datetime

        session_id = str(uuid.uuid4())

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

        # Check for emergency red flags
        emergency_flags = [rf for rf in session["redFlags"] if rf.get("triageLevel") == "EMERGENCY"]
        if emergency_flags:
            session["status"] = SessionStatus.RED_FLAG_DETECTED.value
            return {
                "sessionId": session_id,
                "status": session["status"],
                "message": emergency_flags[0]["message"],
                "nextQuestions": [],
                "progress": 100,
                "redFlagDetected": True,
                "redFlagMessage": emergency_flags[0]["message"]
            }

        # Get first questions
        first_questions = [QUESTION_BANK["initial"]]
        if request.initialSymptoms and len(request.initialSymptoms) > 0:
            session["answers"]["main_symptoms"] = request.initialSymptoms
            session["currentQuestionIndex"] = 1
            first_questions = [QUESTION_BANK["body_location"], QUESTION_BANK["severity"]]

        return {
            "sessionId": session_id,
            "status": session["status"],
            "message": "Welcome to the Symptom Checker. I'll ask you a few questions to better understand your symptoms and provide guidance.",
            "nextQuestions": first_questions,
            "progress": 0,
            "redFlagDetected": len(session["redFlags"]) > 0,
            "redFlagMessage": session["redFlags"][0]["message"] if session["redFlags"] else None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/symptom-checker/respond")
async def symptom_checker_respond(request: SymptomCheckerRespondRequest):
    """Submit responses and get next questions"""
    try:
        from symptom_checker.service import (
            sessions, check_red_flags, QUESTION_BANK, QUESTION_FLOW,
            SessionStatus, calculate_urgency_score, determine_triage_level, TriageLevel
        )
        from datetime import datetime

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

                if isinstance(answer, str):
                    flags = check_red_flags(answer)
                    for flag in flags:
                        if flag not in session["redFlags"]:
                            session["redFlags"].append(flag)

                if question_id == "main_symptoms":
                    if isinstance(answer, list):
                        session["collectedSymptoms"].extend(answer)
                    elif isinstance(answer, str):
                        session["collectedSymptoms"].append(answer)

        session["lastUpdatedAt"] = datetime.now().isoformat()

        # Calculate progress
        answered_count = len([q for q in QUESTION_FLOW if q in session["answers"]])
        progress = min(int((answered_count / len(QUESTION_FLOW)) * 100), 100)

        # Check for emergency red flags
        emergency_flags = [rf for rf in session["redFlags"] if rf.get("triageLevel") == "EMERGENCY"]
        if emergency_flags:
            session["status"] = SessionStatus.RED_FLAG_DETECTED.value
            return {
                "sessionId": request.sessionId,
                "status": session["status"],
                "message": None,
                "nextQuestions": None,
                "progress": 100,
                "isComplete": True,
                "redFlagDetected": True,
                "redFlagMessage": emergency_flags[0]["message"],
                "triageLevel": TriageLevel.EMERGENCY.value
            }

        # Determine next questions
        next_questions = []
        current_index = session.get("currentQuestionIndex", 0)

        for i, question_key in enumerate(QUESTION_FLOW):
            if question_key not in session["answers"]:
                if question_key in QUESTION_BANK:
                    next_questions.append(QUESTION_BANK[question_key])
                if len(next_questions) >= 2:
                    break
                current_index = i

        session["currentQuestionIndex"] = current_index

        is_complete = len(next_questions) == 0 or progress >= 100

        if is_complete:
            session["status"] = SessionStatus.COMPLETED.value
            urgency_score = calculate_urgency_score(session)
            triage_level = determine_triage_level(urgency_score, session["redFlags"])

            return {
                "sessionId": request.sessionId,
                "status": session["status"],
                "message": "Thank you for answering all the questions. Your assessment is ready.",
                "nextQuestions": None,
                "progress": 100,
                "isComplete": True,
                "redFlagDetected": len(session["redFlags"]) > 0,
                "redFlagMessage": session["redFlags"][0]["message"] if session["redFlags"] else None,
                "triageLevel": triage_level.value
            }

        return {
            "sessionId": request.sessionId,
            "status": session["status"],
            "message": None,
            "nextQuestions": next_questions,
            "progress": progress,
            "isComplete": False,
            "redFlagDetected": len(session["redFlags"]) > 0
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/symptom-checker/complete")
async def symptom_checker_complete(request: SymptomCheckerCompleteRequest):
    """Complete the assessment and get full triage result"""
    try:
        from symptom_checker.service import (
            sessions, calculate_urgency_score, determine_triage_level,
            get_recommended_department, get_possible_conditions,
            get_self_care_advice, get_when_to_seek_help,
            get_estimated_wait_time, get_follow_up_questions_for_provider,
            get_recommended_action, SessionStatus
        )
        from datetime import datetime

        if request.sessionId not in sessions:
            raise HTTPException(status_code=404, detail="Session not found")

        session = sessions[request.sessionId]
        answers = session.get("answers", {})
        red_flags = session.get("redFlags", [])
        symptoms = session.get("collectedSymptoms", [])

        main_symptoms = answers.get("main_symptoms", [])
        if isinstance(main_symptoms, str):
            symptoms.append(main_symptoms)
        elif isinstance(main_symptoms, list):
            symptoms.extend(main_symptoms)

        symptoms = list(set(symptoms))

        urgency_score = calculate_urgency_score(session)
        triage_level = determine_triage_level(urgency_score, red_flags)
        body_location = answers.get("body_location", "general")
        department = get_recommended_department(symptoms, body_location, answers)

        if red_flags:
            department = red_flags[0].get("department", department)

        possible_conditions = get_possible_conditions(symptoms, answers)
        self_care = get_self_care_advice(symptoms, triage_level)
        when_to_seek = get_when_to_seek_help(triage_level, body_location)
        wait_time = get_estimated_wait_time(department, triage_level)
        follow_up = get_follow_up_questions_for_provider(symptoms, answers)
        recommended_action = get_recommended_action(triage_level, department)
        red_flag_symptoms = [rf.get("keyword", "") for rf in red_flags]

        session["status"] = SessionStatus.COMPLETED.value
        session["lastUpdatedAt"] = datetime.now().isoformat()

        return {
            "sessionId": request.sessionId,
            "triageLevel": triage_level.value,
            "recommendedDepartment": department,
            "urgencyScore": urgency_score,
            "redFlags": red_flag_symptoms,
            "nextQuestions": follow_up,
            "possibleConditions": possible_conditions,
            "recommendedAction": recommended_action,
            "estimatedWaitTime": wait_time,
            "selfCareAdvice": self_care,
            "whenToSeekHelp": when_to_seek,
            "symptomsSummary": symptoms,
            "disclaimer": "IMPORTANT: This symptom checker is for informational purposes only and is not a substitute for professional medical advice."
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/symptom-checker/session/{session_id}")
async def symptom_checker_get_session(session_id: str):
    """Get session details"""
    try:
        from symptom_checker.service import sessions, QUESTION_FLOW

        if session_id not in sessions:
            raise HTTPException(status_code=404, detail="Session not found")

        session = sessions[session_id]

        return {
            "sessionId": session["id"],
            "status": session["status"],
            "patientInfo": session.get("patientInfo"),
            "collectedSymptoms": session.get("collectedSymptoms", []),
            "answers": session.get("answers", {}),
            "progress": min(int((len([q for q in QUESTION_FLOW if q in session.get("answers", {})]) / len(QUESTION_FLOW)) * 100), 100),
            "redFlags": session.get("redFlags", []),
            "createdAt": session.get("createdAt"),
            "lastUpdatedAt": session.get("lastUpdatedAt")
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/symptom-checker/quick-check")
async def symptom_checker_quick_check(request: SymptomCheckerQuickCheckRequest):
    """Quick symptom check without full conversation"""
    try:
        result = await symptom_checker_ai.quick_check(
            symptoms=request.symptoms,
            patient_age=request.patientAge
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/symptom-checker/departments")
async def symptom_checker_get_departments():
    """Get list of available departments"""
    from symptom_checker.service import SYMPTOM_TO_DEPARTMENT

    departments = list(set(SYMPTOM_TO_DEPARTMENT.values()))
    departments.sort()

    return {
        "departments": [
            {"id": dept.lower().replace("/", "-").replace(" ", "-"), "name": dept}
            for dept in departments
        ]
    }


# =============================================================================
# Entity Extraction AI Endpoints (for AI-powered creation of Patient/Doctor/Appointment)
# =============================================================================

class EntityExtractionRequest(BaseModel):
    text: str
    context: Optional[Dict[str, Any]] = None


class ParseCreationIntentResponse(BaseModel):
    intent: str
    entityType: Optional[str] = None
    extractedData: Optional[Dict[str, Any]] = None
    confidence: float
    modelVersion: str


class ExtractPatientDataResponse(BaseModel):
    success: bool
    data: Optional[Dict[str, Any]] = None
    confidence: float
    missingFields: List[str]
    modelVersion: str


class ExtractDoctorDataResponse(BaseModel):
    success: bool
    data: Optional[Dict[str, Any]] = None
    confidence: float
    missingFields: List[str]
    modelVersion: str


class ExtractAppointmentDataResponse(BaseModel):
    success: bool
    data: Optional[Dict[str, Any]] = None
    confidence: float
    missingFields: List[str]
    modelVersion: str


@app.post("/api/entity/parse-creation-intent", response_model=ParseCreationIntentResponse)
async def parse_creation_intent(request: EntityExtractionRequest):
    """
    Parse user text to detect creation intent and extract entity type
    Examples:
    - "Add new patient John Smith" -> {intent: "create", entityType: "patient"}
    - "Book appointment for tomorrow" -> {intent: "create", entityType: "appointment"}
    """
    try:
        result = entity_extraction_ai.parse_creation_intent(
            text=request.text,
            context=request.context
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/entity/extract-patient", response_model=ExtractPatientDataResponse)
async def extract_patient_data(request: EntityExtractionRequest):
    """
    Extract patient information from natural language text
    Example: "Register John Smith, male, born January 15 1985, phone 555-1234"
    """
    try:
        result = entity_extraction_ai.extract_patient_data(
            text=request.text,
            context=request.context
        )
        return {
            'success': True,
            'data': result.data,
            'confidence': result.confidence,
            'missingFields': result.missing_fields,
            'modelVersion': '1.0.0'
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/entity/extract-doctor", response_model=ExtractDoctorDataResponse)
async def extract_doctor_data(request: EntityExtractionRequest):
    """
    Extract doctor information from natural language text
    Example: "Add Dr. Emily Wilson, cardiologist, license MD12345, 10 years experience"
    """
    try:
        result = entity_extraction_ai.extract_doctor_data(
            text=request.text,
            context=request.context
        )
        return {
            'success': True,
            'data': result.data,
            'confidence': result.confidence,
            'missingFields': result.missing_fields,
            'modelVersion': '1.0.0'
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/entity/extract-appointment", response_model=ExtractAppointmentDataResponse)
async def extract_appointment_data(request: EntityExtractionRequest):
    """
    Extract appointment information from natural language text
    Example: "Book appointment for John Smith with Dr. Wilson tomorrow at 2pm for chest pain"
    """
    try:
        result = entity_extraction_ai.extract_appointment_data(
            text=request.text,
            context=request.context
        )
        return {
            'success': True,
            'data': result.data,
            'confidence': result.confidence,
            'missingFields': result.missing_fields,
            'modelVersion': '1.0.0'
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============= PDF Analysis Endpoints =============

class PDFAnalysisResponse(BaseModel):
    success: bool
    summary: Optional[str] = None
    keyFindings: Optional[List[str]] = None
    diagnoses: Optional[List[str]] = None
    medications: Optional[List[str]] = None
    labResults: Optional[List[Dict[str, Any]]] = None
    recommendations: Optional[List[str]] = None
    urgentFindings: Optional[List[str]] = None
    pageCount: Optional[int] = None
    analysisMethod: Optional[str] = None
    documentType: Optional[str] = None
    modelVersion: Optional[str] = None
    error: Optional[str] = None


@app.post("/api/pdf/analyze", response_model=PDFAnalysisResponse)
async def analyze_pdf(
    file: UploadFile = File(...),
    document_type: str = Form("medical_report"),
    extract_entities: bool = Form(True),
    patient_name: Optional[str] = Form(None),
    patient_age: Optional[int] = Form(None)
):
    """
    Analyze a PDF medical document

    Supports:
    - Text-based PDFs (typed reports) - uses GPT-4 text analysis
    - Image-based PDFs (scanned documents) - uses GPT-4 Vision

    Document types: medical_report, lab_result, radiology_report, prescription,
                   discharge_summary, pathology_report, consultation_note
    """
    try:
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="File must be a PDF")

        # Read PDF content
        pdf_data = await file.read()

        # Build patient context if provided
        patient_context = None
        if patient_name or patient_age:
            patient_context = {}
            if patient_name:
                patient_context["name"] = patient_name
            if patient_age:
                patient_context["age"] = patient_age

        # Analyze PDF
        result = pdf_analyzer.analyze_pdf(
            pdf_data=pdf_data,
            document_type=document_type,
            extract_entities=extract_entities,
            patient_context=patient_context
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/pdf/analyze-url")
async def analyze_pdf_url(request: PDFAnalyzeUrlRequest):
    """
    Analyze a PDF from URL

    Note: URL must be publicly accessible without authentication
    """
    try:
        result = pdf_analyzer.analyze_pdf_url(
            pdf_url=request.url,
            document_type=request.document_type,
            extract_entities=request.extract_entities,
            patient_context=request.patient_context
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/pdf/status")
async def pdf_analyzer_status():
    """Check if PDF analysis service is available"""
    return {
        "available": pdf_analyzer.is_available(),
        "models": {
            "text": "gpt-4o-mini",
            "vision": "gpt-4o"
        } if pdf_analyzer.is_available() else None,
        "supportedTypes": [
            "medical_report",
            "lab_result",
            "radiology_report",
            "prescription",
            "discharge_summary",
            "pathology_report",
            "consultation_note"
        ]
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
