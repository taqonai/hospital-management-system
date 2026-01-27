"""
Hospital Management System - AI Services
FastAPI-based microservices for AI-powered clinical decision support

Uses centralized OpenAI client (shared.openai_client) for standardized API access.
Models: gpt-4o (complex tasks), gpt-4o-mini (simple tasks), whisper-1 (speech)
"""

import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Union
import uvicorn

# Import shared OpenAI client for health checks and LLM provider abstraction
from shared.openai_client import openai_manager, Models
from shared.llm_provider import OllamaClient, HospitalAIConfig

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
from early_warning.service import EarlyWarningAI
from med_safety.service import MedicationSafetyAI
from smart_orders.service import SmartOrdersAI, PatientContext as SmartOrdersPatientContext
from ai_scribe.service import AIScribeService
from health_assistant.service import HealthAssistantAI
from insurance_coding.service import InsuranceCodingAI

# A'mad Precision Health Platform services
from genomic.service import GenomicService, get_genomic_service, GenomicSource, MarkerCategory
from nutrition_ai.service import NutritionAIService, get_nutrition_service, MealType, PortionSize
from recommendation.service import RecommendationService, get_recommendation_service

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
early_warning_ai = EarlyWarningAI()
med_safety_ai = MedicationSafetyAI()
smart_orders_ai = SmartOrdersAI()
ai_scribe = AIScribeService()
health_assistant_ai = HealthAssistantAI()
insurance_coding_ai = InsuranceCodingAI()

# A'mad Precision Health Platform service instances
genomic_service = get_genomic_service()
nutrition_service = get_nutrition_service()
recommendation_service = get_recommendation_service()


# Request/Response Models

class HospitalConfigModel(BaseModel):
    """Hospital-specific AI provider configuration from backend"""
    provider: Optional[str] = "openai"
    ollamaEndpoint: Optional[str] = None
    ollamaModels: Optional[Dict[str, str]] = None


class DiagnosisRequest(BaseModel):
    symptoms: List[str]
    patientAge: int
    gender: str
    medicalHistory: Optional[List[str]] = []
    currentMedications: Optional[List[str]] = []
    allergies: Optional[List[str]] = []
    vitalSigns: Optional[Dict[str, Any]] = None
    hospitalConfig: Optional[HospitalConfigModel] = None


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


class AgeAdjustedWarning(BaseModel):
    symptom: str
    ageGroup: str
    severityMultiplier: float
    warnings: List[str]
    priority: str

class UrgencyAssessment(BaseModel):
    level: Optional[str] = None
    score: Optional[float] = None
    ageMultiplier: Optional[float] = None
    patientAgeCategory: Optional[str] = None
    ageConsiderations: Optional[List[str]] = None
    source: Optional[str] = None
    recommendations: Optional[List[str]] = None

    class Config:
        extra = "allow"

class DiagnosisResponse(BaseModel):
    diagnoses: List[Diagnosis]
    recommendedTests: List[str]
    treatmentSuggestions: List[str]
    drugInteractions: List[DrugInteraction]
    riskFactors: List[RiskFactor]
    confidence: float
    modelVersion: str
    # Additional fields returned by the service
    ageAdjustedWarnings: Optional[List[AgeAdjustedWarning]] = None
    urgencyAssessment: Optional[UrgencyAssessment] = None
    analysisSource: Optional[str] = None
    clinicalReasoning: Optional[str] = None
    redFlags: Optional[List[str]] = None

    class Config:
        extra = "allow"


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


# Enhanced Pharmacy AI Request/Response Models

class AIInteractionAnalysisRequest(BaseModel):
    medications: List[str]
    patientContext: Optional[Dict[str, Any]] = None


class AIInteractionAnalysisResponse(BaseModel):
    interactions: List[Dict[str, Any]]
    foodInteractions: List[Dict[str, Any]]
    conditionContraindications: List[Dict[str, Any]]
    allergyAlerts: List[Dict[str, Any]]
    summary: Dict[str, Any]
    recommendations: List[Dict[str, Any]]
    drugInfo: List[Dict[str, Any]]
    modelVersion: str
    aiEnhanced: bool
    aiAnalysis: Optional[Dict[str, Any]] = None
    analysisMethod: str
    message: Optional[str] = None
    error: Optional[str] = None
    timestamp: Optional[str] = None


class MedicationEntry(BaseModel):
    name: str
    dose: Optional[str] = None
    frequency: Optional[str] = None
    indication: Optional[str] = None


class MedicationReconciliationRequest(BaseModel):
    currentMeds: List[Dict[str, Any]]
    newPrescription: Optional[Dict[str, Any]] = None
    patientData: Optional[Dict[str, Any]] = None


class ReconciliationFinding(BaseModel):
    duplicates: List[Dict[str, Any]]
    therapeuticOverlaps: List[Dict[str, Any]]
    missingChronicMeds: List[Dict[str, Any]]
    doseDiscrepancies: List[Dict[str, Any]]
    newInteractions: List[Dict[str, Any]]
    recommendations: List[Dict[str, Any]]


class MedicationReconciliationResponse(BaseModel):
    status: str
    statusMessage: str
    totalIssues: int
    findings: Dict[str, Any]
    medicationCount: int
    timestamp: str
    modelVersion: str


class AdherenceRiskRequest(BaseModel):
    medications: List[Dict[str, Any]]
    patientDemographics: Optional[Dict[str, Any]] = None


class RiskFactor(BaseModel):
    factor: str
    description: str
    contribution: int


class Intervention(BaseModel):
    type: str
    intervention: str
    priority: str


class AdherenceRiskResponse(BaseModel):
    riskScore: int
    riskLevel: str
    riskDescription: str
    riskFactors: List[Dict[str, Any]]
    interventions: List[Dict[str, Any]]
    medicationCount: int
    timestamp: str
    modelVersion: str


class AntibioticReviewRequest(BaseModel):
    antibiotic: str
    indication: str
    duration: int
    cultures: Optional[Dict[str, Any]] = None
    patientData: Optional[Dict[str, Any]] = None


class AntibioticAlert(BaseModel):
    type: str
    severity: str
    message: str
    recommendation: str


class AntibioticRecommendation(BaseModel):
    type: str
    priority: str
    message: str
    typical_uses: Optional[List[str]] = None
    de_escalation_options: Optional[List[str]] = None
    parameters: Optional[List[str]] = None


class AntibioticReviewResponse(BaseModel):
    antibiotic: str
    normalizedName: str
    indication: str
    prescribedDuration: int
    appropriateness: str
    spectrum: str
    alerts: List[Dict[str, Any]]
    recommendations: List[Dict[str, Any]]
    drugInfo: Dict[str, Any]
    cultureData: Optional[Dict[str, Any]] = None
    timestamp: str
    modelVersion: str


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
    """Health check with centralized OpenAI status"""
    openai_available = openai_manager.is_available()
    openai_status = openai_manager.get_status()

    return {
        "status": "healthy",
        "version": "4.0.0",
        "openai": {
            "available": openai_available,
            "api_key_configured": openai_status.get("api_key_set", False),
            "models": openai_status.get("models", {}),
        },
        "services": {
            "diagnostic": "gpt-4o" if openai_available else "ml-fallback",
            "predictive": "active",
            "imaging": "gpt-4o-vision" if openai_available else "rule-based",
            "chat": "gpt-4o-mini" if openai_available else "pattern-matching",
            "speech": "whisper-1" if openai_available else "unavailable",
            "queue": "gpt-4o-mini" if openai_available else "algorithmic",
            "pharmacy": "gpt-4o-mini" if openai_available else "database",
            "clinical_notes": "gpt-4o-mini" if openai_available else "templates",
            "symptom_checker": "gpt-4o" if openai_available else "rule-based",
            "entity_extraction": "gpt-4o-mini" if openai_available else "regex",
            "early_warning": "gpt-4o-mini" if openai_available else "algorithmic",
            "med_safety": "gpt-4o-mini" if openai_available else "rule-based",
            "smart_orders": "gpt-4o" if openai_available else "bundles",
            "ai_scribe": "whisper+gpt-4o-mini" if openai_available else "unavailable",
            "pdf_analysis": "gpt-4o-vision" if openai_available else "text-only",
        }
    }


# =========================================================================
# Ollama Provider Endpoints (for admin configuration)
# =========================================================================

class OllamaModelsRequest(BaseModel):
    endpoint: str


class OllamaTestRequest(BaseModel):
    endpoint: str
    model: str


@app.get("/api/ollama/models")
async def get_ollama_models(endpoint: str):
    """
    Fetch available models from an Ollama endpoint.

    Args:
        endpoint: Ollama server URL (e.g., http://localhost:11434)

    Returns:
        List of available model names
    """
    try:
        models = OllamaClient.fetch_available_models(endpoint)
        return {
            "success": len(models) > 0,
            "models": models,
            "endpoint": endpoint
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/ollama/health")
async def check_ollama_health(endpoint: str):
    """
    Check if an Ollama endpoint is reachable.

    Args:
        endpoint: Ollama server URL

    Returns:
        Health status of the Ollama endpoint
    """
    result = OllamaClient.check_health(endpoint)
    return {
        "success": result.get("available", False),
        **result
    }


@app.post("/api/ollama/test")
async def test_ollama_completion(request: OllamaTestRequest):
    """
    Test a chat completion with a specific Ollama model.

    Args:
        endpoint: Ollama server URL
        model: Model name to test

    Returns:
        Test completion result
    """
    result = OllamaClient.test_completion(request.endpoint, request.model)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Test failed"))
    return result


@app.get("/api/provider/status")
async def get_provider_status(
    provider: str = "openai",
    ollama_endpoint: Optional[str] = None,
    ollama_model_complex: Optional[str] = None,
    ollama_model_simple: Optional[str] = None
):
    """
    Get status for a specific LLM provider configuration.

    Args:
        provider: Provider type (openai or ollama)
        ollama_endpoint: Ollama server URL (required if provider is ollama)
        ollama_model_complex: Complex task model
        ollama_model_simple: Simple task model

    Returns:
        Provider status information
    """
    config = HospitalAIConfig(
        provider=provider,
        ollama_endpoint=ollama_endpoint,
        ollama_model_complex=ollama_model_complex,
        ollama_model_simple=ollama_model_simple
    )
    return openai_manager.get_provider_status(config)


# Diagnosis endpoint
@app.post("/api/diagnose", response_model=DiagnosisResponse)
async def analyze_symptoms(request: DiagnosisRequest):
    try:
        # Convert hospital config to HospitalAIConfig for provider selection
        hospital_config = None
        if request.hospitalConfig:
            hospital_config = HospitalAIConfig(
                provider=request.hospitalConfig.provider or "openai",
                ollama_endpoint=request.hospitalConfig.ollamaEndpoint,
                ollama_model_complex=request.hospitalConfig.ollamaModels.get("complex") if request.hospitalConfig.ollamaModels else None,
                ollama_model_simple=request.hospitalConfig.ollamaModels.get("simple") if request.hospitalConfig.ollamaModels else None,
            )

        result = diagnostic_ai.analyze(
            symptoms=request.symptoms,
            patient_age=request.patientAge,
            gender=request.gender,
            medical_history=request.medicalHistory,
            current_medications=request.currentMedications,
            allergies=request.allergies,
            vital_signs=request.vitalSigns,
            hospital_config=hospital_config,
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


# =============================================================================
# Patient Health Assistant Endpoints
# =============================================================================

class HealthAssistantRequest(BaseModel):
    message: str
    context: Optional[str] = None
    patient_context: Optional[Dict[str, Any]] = None
    history: Optional[List[Dict[str, str]]] = None
    role: Optional[str] = "patient_health_assistant"


class HealthAssistantResponse(BaseModel):
    response: str
    suggestedActions: Optional[List[Dict[str, str]]] = None
    aiPowered: bool = False
    model: Optional[str] = None
    timestamp: Optional[str] = None
    modelVersion: Optional[str] = None


@app.post("/api/health-assistant", response_model=HealthAssistantResponse)
async def health_assistant_chat(request: HealthAssistantRequest):
    """
    AI Health Assistant for patient health questions.
    Provides dynamic, GPT-powered responses to health queries.
    """
    try:
        # Parse patient context from string if provided
        patient_ctx = request.patient_context
        if request.context and isinstance(request.context, str):
            # Try to extract patient info from context string
            if not patient_ctx:
                patient_ctx = {}
            if "Patient:" in request.context:
                # Context like "Patient: John Smith, Age: 45, Gender: Male"
                patient_ctx["raw_context"] = request.context

        result = await health_assistant_ai.get_response(
            message=request.message,
            patient_context=patient_ctx,
            conversation_history=request.history
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/health-assistant/status")
async def health_assistant_status():
    """Check if health assistant AI is available"""
    return {
        "available": health_assistant_ai.is_available(),
        "model": "gpt-4o" if health_assistant_ai.is_available() else None,
        "modelVersion": health_assistant_ai.model_version
    }


# ===== Comprehensive AI Health Analysis =====

class HealthAnalysisVital(BaseModel):
    """Vital sign data structure"""
    name: str
    value: Optional[Union[str, float, int]] = None
    unit: Optional[str] = None
    status: Optional[str] = None
    trend: Optional[str] = None

class HealthAnalysisLabResult(BaseModel):
    """Lab result data structure"""
    testName: str
    value: Optional[Union[str, float, int]] = None
    unit: Optional[str] = None
    normalRange: Optional[str] = None
    status: Optional[str] = None

class HealthAnalysisRequest(BaseModel):
    """Request model for comprehensive health analysis"""
    patientAge: Optional[int] = None
    patientGender: Optional[str] = None
    bloodGroup: Optional[str] = None
    chronicConditions: Optional[List[str]] = []
    allergies: Optional[List[str]] = []
    currentMedications: Optional[List[str]] = []
    vitals: Optional[List[Dict[str, Any]]] = []
    labResults: Optional[List[Dict[str, Any]]] = []
    recentDiagnoses: Optional[List[str]] = []
    lifestyleFactors: Optional[Dict[str, Any]] = None

class HealthAnalysisInsight(BaseModel):
    """AI-generated health insight"""
    id: str
    type: str  # recommendation, alert, tip, warning
    title: str
    description: str
    priority: str  # high, medium, low
    actionLabel: Optional[str] = None
    actionRoute: Optional[str] = None
    category: Optional[str] = None  # vitals, labs, medications, lifestyle

class HealthAnalysisResponse(BaseModel):
    """Response model for health analysis"""
    overallAssessment: str
    riskLevel: str  # low, moderate, elevated, high
    insights: List[HealthAnalysisInsight]
    recommendations: List[str]
    warningFlags: List[str]
    aiPowered: bool
    model: Optional[str] = None
    modelVersion: str = "1.0.0"


@app.post("/api/health-analysis", response_model=HealthAnalysisResponse)
async def analyze_health_data(request: HealthAnalysisRequest):
    """
    Comprehensive AI-powered health data analysis.
    Uses GPT-4o to analyze patient health data and generate personalized insights.
    """
    try:
        from shared.openai_client import openai_manager, TaskComplexity

        if not openai_manager.is_available():
            # Return rule-based fallback analysis
            return _generate_fallback_health_analysis(request)

        # Build comprehensive health summary for GPT
        health_summary = _build_health_summary(request)

        system_prompt = """You are an expert AI Health Analyst assistant for a patient health portal. Your role is to analyze comprehensive patient health data and provide personalized, actionable insights.

IMPORTANT GUIDELINES:
1. You are NOT diagnosing conditions - you are analyzing existing data to provide health insights
2. Always recommend consulting healthcare providers for specific medical concerns
3. Be empathetic and supportive in your language
4. Prioritize safety - flag any concerning patterns prominently
5. Provide practical, actionable recommendations
6. Consider the whole picture - how different factors interact

RESPONSE FORMAT - You must respond with valid JSON in this exact structure:
{
    "overallAssessment": "A 2-3 sentence summary of the patient's overall health picture",
    "riskLevel": "low|moderate|elevated|high",
    "insights": [
        {
            "id": "unique-id-1",
            "type": "recommendation|alert|tip|warning",
            "title": "Brief title (5-8 words)",
            "description": "Detailed explanation (2-3 sentences)",
            "priority": "high|medium|low",
            "category": "vitals|labs|medications|lifestyle|general"
        }
    ],
    "recommendations": ["Specific actionable recommendation 1", "Recommendation 2"],
    "warningFlags": ["Any urgent concerns that need attention"]
}

INSIGHT TYPES:
- "alert": Immediate attention needed (abnormal values, concerning trends)
- "warning": Caution advised (borderline values, potential risks)
- "recommendation": Suggested actions for improvement
- "tip": General health optimization suggestions

Generate 4-8 relevant insights based on the data provided. Prioritize the most important findings."""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Please analyze this patient's health data and provide insights:\n\n{health_summary}"}
        ]

        result = openai_manager.chat_completion(
            messages=messages,
            task_complexity=TaskComplexity.COMPLEX,  # Use GPT-4o for medical analysis
            max_tokens=1500,
            temperature=0.3,  # Lower temperature for more consistent medical analysis
        )

        if not result or not result.get("success"):
            logger.error(f"GPT health analysis error: {result.get('error') if result else 'No response'}")
            return _generate_fallback_health_analysis(request)

        # Parse GPT response
        try:
            import json
            response_text = result["content"]
            # Clean up potential markdown code blocks
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0]
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0]

            analysis_data = json.loads(response_text.strip())

            # Ensure insights have proper structure
            insights = []
            for i, insight in enumerate(analysis_data.get("insights", [])):
                insights.append(HealthAnalysisInsight(
                    id=insight.get("id", f"insight-{i+1}"),
                    type=insight.get("type", "tip"),
                    title=insight.get("title", "Health Insight"),
                    description=insight.get("description", ""),
                    priority=insight.get("priority", "medium"),
                    category=insight.get("category", "general"),
                    actionLabel=insight.get("actionLabel"),
                    actionRoute=insight.get("actionRoute")
                ))

            return HealthAnalysisResponse(
                overallAssessment=analysis_data.get("overallAssessment", "Health data analysis complete."),
                riskLevel=analysis_data.get("riskLevel", "moderate"),
                insights=insights,
                recommendations=analysis_data.get("recommendations", []),
                warningFlags=analysis_data.get("warningFlags", []),
                aiPowered=True,
                model=result.get("model", "gpt-4o"),
                modelVersion="1.0.0"
            )

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse GPT response: {e}")
            return _generate_fallback_health_analysis(request)

    except Exception as e:
        logger.error(f"Health analysis error: {e}")
        return _generate_fallback_health_analysis(request)


def _build_health_summary(request: HealthAnalysisRequest) -> str:
    """Build a comprehensive text summary of patient health data for GPT analysis"""
    summary_parts = []

    # Demographics
    demographics = []
    if request.patientAge:
        demographics.append(f"Age: {request.patientAge}")
    if request.patientGender:
        demographics.append(f"Gender: {request.patientGender}")
    if request.bloodGroup:
        demographics.append(f"Blood Group: {request.bloodGroup}")
    if demographics:
        summary_parts.append("PATIENT DEMOGRAPHICS:\n" + ", ".join(demographics))

    # Chronic Conditions
    if request.chronicConditions:
        summary_parts.append(f"CHRONIC CONDITIONS:\n{', '.join(request.chronicConditions)}")

    # Allergies
    if request.allergies:
        summary_parts.append(f"ALLERGIES:\n{', '.join(request.allergies)}")

    # Current Medications
    if request.currentMedications:
        summary_parts.append(f"CURRENT MEDICATIONS:\n{', '.join(request.currentMedications)}")

    # Vitals
    if request.vitals:
        vitals_text = []
        for v in request.vitals:
            vital_str = f"- {v.get('name', 'Unknown')}: {v.get('value', 'N/A')} {v.get('unit', '')}"
            if v.get('status'):
                vital_str += f" (Status: {v['status']})"
            if v.get('trend'):
                vital_str += f" [Trend: {v['trend']}]"
            vitals_text.append(vital_str)
        summary_parts.append("VITAL SIGNS:\n" + "\n".join(vitals_text))

    # Lab Results
    if request.labResults:
        labs_text = []
        for lab in request.labResults:
            lab_str = f"- {lab.get('testName', 'Unknown')}: {lab.get('value', 'N/A')} {lab.get('unit', '')}"
            if lab.get('normalRange'):
                lab_str += f" (Normal: {lab['normalRange']})"
            if lab.get('status'):
                lab_str += f" [{lab['status']}]"
            labs_text.append(lab_str)
        summary_parts.append("LABORATORY RESULTS:\n" + "\n".join(labs_text))

    # Recent Diagnoses
    if request.recentDiagnoses:
        summary_parts.append(f"RECENT DIAGNOSES:\n{', '.join(request.recentDiagnoses)}")

    # Lifestyle Factors
    if request.lifestyleFactors:
        lifestyle_text = []
        for key, value in request.lifestyleFactors.items():
            lifestyle_text.append(f"- {key}: {value}")
        summary_parts.append("LIFESTYLE FACTORS:\n" + "\n".join(lifestyle_text))

    return "\n\n".join(summary_parts) if summary_parts else "No health data provided."


def _generate_fallback_health_analysis(request: HealthAnalysisRequest) -> HealthAnalysisResponse:
    """Generate rule-based health analysis when AI is unavailable"""
    insights = []
    recommendations = []
    warning_flags = []
    risk_level = "low"

    # Analyze vitals
    if request.vitals:
        for vital in request.vitals:
            status = vital.get("status", "").lower()
            name = vital.get("name", "")

            if status in ["critical", "high", "attention"]:
                risk_level = "elevated" if risk_level == "low" else risk_level
                insights.append(HealthAnalysisInsight(
                    id=f"vital-{name.lower().replace(' ', '-')}",
                    type="alert",
                    title=f"{name} Needs Attention",
                    description=f"Your {name.lower()} reading shows values that may need medical attention. Please discuss with your healthcare provider.",
                    priority="high",
                    category="vitals"
                ))
                warning_flags.append(f"Abnormal {name} reading detected")

    # Analyze chronic conditions
    if request.chronicConditions:
        for condition in request.chronicConditions:
            condition_lower = condition.lower()
            if "diabetes" in condition_lower:
                insights.append(HealthAnalysisInsight(
                    id="diabetes-management",
                    type="recommendation",
                    title="Diabetes Management",
                    description="Regular monitoring of blood sugar levels is important. Maintain a balanced diet and follow your medication schedule.",
                    priority="high",
                    category="medications"
                ))
                risk_level = "moderate" if risk_level == "low" else risk_level
            elif "hypertension" in condition_lower or "blood pressure" in condition_lower:
                insights.append(HealthAnalysisInsight(
                    id="bp-management",
                    type="recommendation",
                    title="Blood Pressure Management",
                    description="Monitor your blood pressure regularly. Reduce sodium intake and maintain regular physical activity.",
                    priority="high",
                    category="vitals"
                ))
                risk_level = "moderate" if risk_level == "low" else risk_level

    # Check medications
    if request.currentMedications and len(request.currentMedications) > 3:
        insights.append(HealthAnalysisInsight(
            id="medication-review",
            type="tip",
            title="Medication Review Recommended",
            description=f"You are currently on {len(request.currentMedications)} medications. Consider discussing with your doctor to review for potential interactions or optimizations.",
            priority="medium",
            category="medications"
        ))

    # Check allergies
    if request.allergies:
        insights.append(HealthAnalysisInsight(
            id="allergy-awareness",
            type="tip",
            title="Allergy Alert",
            description=f"You have {len(request.allergies)} known allergies. Always inform healthcare providers about these before any treatment.",
            priority="medium",
            category="general"
        ))

    # Add general recommendations
    recommendations.extend([
        "Schedule regular check-ups with your healthcare provider",
        "Maintain a healthy diet and regular exercise routine",
        "Keep track of any new symptoms and report them to your doctor",
        "Ensure you're taking medications as prescribed"
    ])

    # Default insight if none generated
    if not insights:
        insights.append(HealthAnalysisInsight(
            id="general-wellness",
            type="tip",
            title="Stay Proactive About Your Health",
            description="Regular health monitoring and preventive care are key to maintaining good health. Consider scheduling a comprehensive check-up.",
            priority="low",
            category="general"
        ))

    overall = "Your health data has been reviewed. "
    if risk_level == "low":
        overall += "Overall indicators appear within normal ranges. Continue maintaining healthy habits."
    elif risk_level == "moderate":
        overall += "Some areas require ongoing attention. Follow your care plan and stay in touch with your healthcare team."
    else:
        overall += "Some concerning patterns were identified. Please consult with your healthcare provider soon."

    return HealthAnalysisResponse(
        overallAssessment=overall,
        riskLevel=risk_level,
        insights=insights,
        recommendations=recommendations,
        warningFlags=warning_flags,
        aiPowered=False,
        model=None,
        modelVersion="1.0.0"
    )


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


# Enhanced Pharmacy AI Endpoints

@app.post("/api/pharmacy/ai-analyze", response_model=AIInteractionAnalysisResponse)
async def ai_analyze_interactions(request: AIInteractionAnalysisRequest):
    """
    AI-enhanced drug interaction analysis using GPT-4.
    Falls back to rule-based analysis if OpenAI API key is not available.

    Provides more nuanced analysis considering patient-specific factors:
    - Age-related pharmacokinetic changes
    - Renal/hepatic function adjustments
    - Condition-specific risks
    - Alternative medication suggestions
    """
    try:
        result = pharmacy_ai.analyze_interactions_with_ai(
            medications=request.medications,
            patient_context=request.patientContext
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/pharmacy/reconcile", response_model=MedicationReconciliationResponse)
async def reconcile_medications(request: MedicationReconciliationRequest):
    """
    Perform smart medication reconciliation to identify:
    - Duplicate medications
    - Therapeutic overlaps (same class medications)
    - Missing chronic medications based on patient conditions
    - Drug interactions with new prescriptions
    - Medications missing from admission list

    Essential for transitions of care and preventing medication errors.
    """
    try:
        result = pharmacy_ai.reconcile_medications(
            current_meds=request.currentMeds,
            new_prescription=request.newPrescription,
            patient_data=request.patientData
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/pharmacy/adherence-risk", response_model=AdherenceRiskResponse)
async def predict_adherence_risk(request: AdherenceRiskRequest):
    """
    Predict medication adherence risk based on multiple factors:
    - Regimen complexity (dosing frequency, number of medications)
    - Pill burden
    - Side effect profile of medications
    - Patient demographics (age, cognitive status)
    - Cost concerns
    - History of non-adherence

    Returns risk score (0-100), risk factors, and recommended interventions.
    """
    try:
        result = pharmacy_ai.predict_adherence_risk(
            medications=request.medications,
            patient_demographics=request.patientDemographics
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/pharmacy/antibiotic-review", response_model=AntibioticReviewResponse)
async def review_antibiotic(request: AntibioticReviewRequest):
    """
    Antimicrobial stewardship review for antibiotic prescriptions:
    - Duration appropriateness based on indication
    - De-escalation opportunities based on culture results
    - Spectrum assessment (narrow vs broad)
    - Contraindication checks
    - Age and renal function considerations
    - Restricted antibiotic alerts

    Supports antimicrobial stewardship programs to optimize antibiotic use.
    """
    try:
        result = pharmacy_ai.review_antibiotic(
            antibiotic=request.antibiotic,
            indication=request.indication,
            duration=request.duration,
            cultures=request.cultures,
            patient_data=request.patientData
        )
        return result
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
            sessions, check_red_flags, QUESTION_BANK, SessionStatus,
            get_contextual_questions
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

        # Get first questions using contextual question generation
        # This intelligently skips irrelevant questions (e.g., body_location if symptom implies it)
        if request.initialSymptoms and len(request.initialSymptoms) > 0:
            # Patient already provided symptoms - use contextual questions
            session["answers"]["main_symptoms"] = request.initialSymptoms
            session["currentQuestionIndex"] = 1
            first_questions = get_contextual_questions(
                symptoms=request.initialSymptoms,
                answered_questions=session["answers"]
            )
            # If no questions generated, fall back to severity
            if not first_questions:
                first_questions = [QUESTION_BANK["severity"]]
        else:
            # No initial symptoms - ask for symptoms first
            first_questions = [QUESTION_BANK["initial"]]

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
            SessionStatus, calculate_urgency_score, determine_triage_level, TriageLevel,
            get_contextual_questions
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

        # Calculate progress based on minimum required questions
        answers = session.get("answers", {})
        has_minimum = "main_symptoms" in answers and "severity" in answers and "duration" in answers
        progress = min(int((len(answers) / 5) * 100), 100) if has_minimum else min(int((len(answers) / 5) * 100), 80)

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

        # Determine next questions using contextual question generation
        # This intelligently skips irrelevant questions (e.g., body_location if symptom implies it)
        symptoms = session.get("collectedSymptoms", [])
        next_questions = get_contextual_questions(symptoms, session["answers"])

        # Complete when we have minimum data for triage or no more questions
        is_complete = len(next_questions) == 0 or (has_minimum and len(answers) >= 3)

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


# ============= Lab Result Extraction Endpoints =============

class LabResultExtractionResponse(BaseModel):
    """Response model for lab result extraction from files"""
    success: bool
    testName: Optional[str] = None
    resultValue: Optional[str] = None
    unit: Optional[str] = None
    normalRange: Optional[str] = None
    isAbnormal: Optional[bool] = None
    isCritical: Optional[bool] = None
    comments: Optional[str] = None
    confidence: str  # LOW, MEDIUM, HIGH
    rawText: Optional[str] = None
    summary: Optional[str] = None  # AI-generated summary for doctor
    error: Optional[str] = None


@app.post("/api/laboratory/analyze-lab-pdf", response_model=LabResultExtractionResponse)
async def analyze_lab_pdf(
    file: UploadFile = File(...),
    test_name: Optional[str] = Form(None)
):
    """
    Extract lab results from PDF file

    Uses GPT-4 Vision for scanned PDFs and GPT-4o for text-based PDFs.
    Returns structured lab result data with AI confidence scoring.
    """
    try:
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="File must be a PDF")

        # Read PDF content
        pdf_data = await file.read()

        # Use PDF analyzer to extract content
        analysis = pdf_analyzer.analyze_pdf(
            pdf_data=pdf_data,
            document_type="lab_result",
            extract_entities=True,
            patient_context=None
        )

        # Extract lab results from analysis
        if not analysis.get('success') or not analysis.get('labResults'):
            return LabResultExtractionResponse(
                success=False,
                confidence="LOW",
                error="Could not extract lab results from PDF"
            )

        # Get the first lab result (or match by test_name if provided)
        lab_results = analysis.get('labResults', [])
        target_result = None

        if test_name:
            # Try to find matching test
            for result in lab_results:
                if test_name.lower() in result.get('test', '').lower():
                    target_result = result
                    break

        if not target_result and lab_results:
            target_result = lab_results[0]

        if not target_result:
            return LabResultExtractionResponse(
                success=False,
                confidence="LOW",
                error="No matching lab result found in PDF"
            )

        # Determine abnormality
        is_abnormal = target_result.get('abnormal', False)
        is_critical = target_result.get('critical', False)

        # Generate doctor summary
        summary = analysis.get('summary', '')
        if not summary:
            summary = f"Lab result for {target_result.get('test', 'Unknown Test')}: "
            summary += f"{target_result.get('value', 'N/A')} {target_result.get('unit', '')}. "
            if is_critical:
                summary += "⚠️ CRITICAL value detected. "
            elif is_abnormal:
                summary += "Abnormal value detected. "
            else:
                summary += "Within normal range. "

        return LabResultExtractionResponse(
            success=True,
            testName=target_result.get('test'),
            resultValue=str(target_result.get('value', '')),
            unit=target_result.get('unit'),
            normalRange=target_result.get('normalRange'),
            isAbnormal=is_abnormal,
            isCritical=is_critical,
            comments=target_result.get('notes', ''),
            confidence="HIGH" if analysis.get('analysisMethod') == 'text' else "MEDIUM",
            rawText=analysis.get('summary'),
            summary=summary
        )

    except HTTPException:
        raise
    except Exception as e:
        return LabResultExtractionResponse(
            success=False,
            confidence="LOW",
            error=str(e)
        )


@app.post("/api/laboratory/analyze-lab-image", response_model=LabResultExtractionResponse)
async def analyze_lab_image(
    file: UploadFile = File(...),
    test_name: Optional[str] = Form(None)
):
    """
    Extract lab results from image file (JPEG, PNG)

    Uses GPT-4 Vision to perform OCR and extract structured lab data.
    """
    try:
        # Validate file type
        allowed_types = ['image/jpeg', 'image/png', 'image/jpg']
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail=f"File must be an image (JPEG/PNG). Got: {file.content_type}"
            )

        # Read image data
        image_data = await file.read()

        # Use imaging AI service for analysis
        import base64
        image_base64 = base64.b64encode(image_data).decode('utf-8')

        # Call GPT-4 Vision for lab result extraction
        from shared.openai_client import openai_manager

        prompt = """Analyze this lab result image and extract the following information:
1. Test name
2. Result value
3. Unit of measurement
4. Normal/reference range
5. Whether the result is abnormal (outside normal range)
6. Whether the result is critical (dangerously abnormal)
7. Any relevant comments or notes

Provide a structured response in JSON format:
{
    "testName": "...",
    "resultValue": "...",
    "unit": "...",
    "normalRange": "...",
    "isAbnormal": true/false,
    "isCritical": true/false,
    "comments": "...",
    "summary": "Brief summary for doctor"
}

If multiple tests are present, extract the most prominent one or all if clearly visible."""

        if test_name:
            prompt += f"\n\nSpecifically look for: {test_name}"

        response = openai_manager.get_client().chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{file.content_type};base64,{image_base64}"
                            }
                        }
                    ]
                }
            ],
            max_tokens=1000,
            temperature=0.1
        )

        # Parse response
        import json
        result_text = response.choices[0].message.content

        # Try to extract JSON from response
        try:
            # Find JSON block in response
            start_idx = result_text.find('{')
            end_idx = result_text.rfind('}') + 1
            if start_idx >= 0 and end_idx > start_idx:
                json_str = result_text[start_idx:end_idx]
                extracted_data = json.loads(json_str)
            else:
                raise ValueError("No JSON found in response")
        except (json.JSONDecodeError, ValueError):
            # If JSON parsing fails, return raw text
            return LabResultExtractionResponse(
                success=False,
                confidence="LOW",
                rawText=result_text,
                error="Could not parse structured data from image"
            )

        return LabResultExtractionResponse(
            success=True,
            testName=extracted_data.get('testName'),
            resultValue=extracted_data.get('resultValue'),
            unit=extracted_data.get('unit'),
            normalRange=extracted_data.get('normalRange'),
            isAbnormal=extracted_data.get('isAbnormal', False),
            isCritical=extracted_data.get('isCritical', False),
            comments=extracted_data.get('comments'),
            confidence="MEDIUM",  # Vision-based extraction is medium confidence
            rawText=result_text,
            summary=extracted_data.get('summary', '')
        )

    except HTTPException:
        raise
    except Exception as e:
        return LabResultExtractionResponse(
            success=False,
            confidence="LOW",
            error=str(e)
        )


# ============= Early Warning System (EWS) Endpoints =============

class EWSVitalsRequest(BaseModel):
    temperature: Optional[float] = None
    heart_rate: Optional[int] = None
    respiratory_rate: Optional[int] = None
    systolic_bp: Optional[int] = None
    oxygen_saturation: Optional[float] = None
    consciousness: Optional[str] = "alert"
    supplemental_oxygen: Optional[bool] = False


class EWSAssessRequest(BaseModel):
    patient_id: str
    vitals: Dict[str, Any]
    patient_info: Optional[Dict[str, Any]] = None


class EWSMonitorRequest(BaseModel):
    patient_id: str
    vitals: Dict[str, Any]
    vitals_history: Optional[List[Dict[str, Any]]] = []


@app.post("/api/ews/calculate")
async def calculate_news2(request: EWSVitalsRequest):
    """Calculate NEWS2 score from vitals"""
    try:
        result = early_warning_ai.calculate_news2(request.dict())
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ews/qsofa")
async def calculate_qsofa(request: EWSVitalsRequest):
    """Calculate qSOFA score"""
    try:
        result = early_warning_ai.calculate_qsofa(request.dict())
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ews/fall-risk")
async def calculate_fall_risk(request: Dict[str, Any]):
    """Calculate fall risk score"""
    try:
        result = early_warning_ai.calculate_fall_risk(
            patient_info=request.get("patient_info", {}),
            mobility_status=request.get("mobility_status", "independent"),
            medications=request.get("medications", []),
            mental_status=request.get("mental_status", "alert"),
            history=request.get("history", {})
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ews/assess")
async def comprehensive_assessment(request: EWSAssessRequest):
    """Comprehensive patient assessment"""
    try:
        result = early_warning_ai.comprehensive_assessment(
            patient_id=request.patient_id,
            vitals=request.vitals,
            patient_info=request.patient_info
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ews/monitor")
async def monitor_vitals(request: EWSMonitorRequest):
    """Monitor patient vitals"""
    try:
        result = early_warning_ai.monitor_vitals(
            patient_id=request.patient_id,
            vitals=request.vitals,
            vitals_history=request.vitals_history
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============= Medication Safety Endpoints =============

class FiveRightsRequest(BaseModel):
    patient_id: str
    medication_id: str
    dose: str
    route: str
    scheduled_time: str
    patient_name: Optional[str] = None
    patient_dob: Optional[str] = None
    allergies: Optional[List[str]] = []


class BarcodeScanRequest(BaseModel):
    barcode: str
    patient_id: str
    expected_medication: Optional[str] = None


class MedicationScheduleRequest(BaseModel):
    patient_id: str
    medications: List[Dict[str, Any]]
    patient_info: Optional[Dict[str, Any]] = None


class IVCompatibilityRequest(BaseModel):
    drug1: str
    drug2: str
    concentration1: Optional[str] = None
    concentration2: Optional[str] = None


class DoseCalculationRequest(BaseModel):
    medication: str
    patient_weight: float
    patient_age: Optional[int] = None
    indication: Optional[str] = None
    renal_function: Optional[float] = None


@app.post("/api/med-safety/verify-five-rights")
async def verify_five_rights(request: FiveRightsRequest):
    """Verify the 5 rights of medication administration"""
    try:
        result = med_safety_ai.verify_five_rights(request.dict())
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/med-safety/scan-barcode")
async def scan_barcode(request: BarcodeScanRequest):
    """Scan and verify medication barcode"""
    try:
        result = med_safety_ai.process_barcode_scan(
            barcode=request.barcode,
            patient_id=request.patient_id,
            expected_medication=request.expected_medication
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/med-safety/medication-schedule")
async def create_medication_schedule(request: MedicationScheduleRequest):
    """Create optimal medication schedule"""
    try:
        result = med_safety_ai.get_medication_schedule(
            patient_id=request.patient_id,
            medications=request.medications,
            patient_info=request.patient_info
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/med-safety/high-alert-drugs")
async def get_high_alert_drugs():
    """Get list of high-alert medications"""
    try:
        result = med_safety_ai.get_high_alert_drugs()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/med-safety/iv-compatibility")
async def check_iv_compatibility(request: IVCompatibilityRequest):
    """Check IV drug compatibility"""
    try:
        result = med_safety_ai.check_iv_compatibility(
            drug1=request.drug1,
            drug2=request.drug2,
            concentration1=request.concentration1,
            concentration2=request.concentration2
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/med-safety/calculate-dose")
async def calculate_dose(request: DoseCalculationRequest):
    """Calculate medication dose"""
    try:
        result = med_safety_ai.calculate_dose(request.dict())
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============= Smart Orders Endpoints =============

class SmartOrderRecommendRequest(BaseModel):
    diagnosis: str
    patient_context: Optional[Dict[str, Any]] = None
    severity: Optional[str] = "moderate"


class SmartOrderCustomizeRequest(BaseModel):
    bundle_id: str
    patient_id: str
    customizations: Optional[Dict[str, Any]] = None


class SmartOrderPlaceRequest(BaseModel):
    patient_id: str
    orders: List[Dict[str, Any]]
    provider_id: str


@app.post("/api/recommend")
async def get_order_recommendations(request: SmartOrderRecommendRequest):
    """Get AI-powered order recommendations based on diagnosis"""
    try:
        result = smart_orders_ai.get_recommendations(
            diagnosis=request.diagnosis,
            patient_context=request.patient_context,
            severity=request.severity
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/bundles")
async def get_order_bundles():
    """Get all available order bundles"""
    try:
        result = smart_orders_ai.get_bundles()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/bundles/{bundle_id}")
async def get_bundle_details(bundle_id: str):
    """Get details of a specific order bundle"""
    try:
        result = smart_orders_ai.get_bundle_details(bundle_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/customize")
async def customize_order_bundle(request: SmartOrderCustomizeRequest):
    """Customize an order bundle for a specific patient"""
    try:
        result = smart_orders_ai.customize_bundle(
            bundle_id=request.bundle_id,
            patient_id=request.patient_id,
            customizations=request.customizations
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/place")
async def place_orders(request: SmartOrderPlaceRequest):
    """Place orders for a patient (placeholder - orders stored in backend)"""
    try:
        # This is a placeholder - actual order placement is handled by backend
        return {
            "success": True,
            "message": "Orders validated successfully",
            "patient_id": request.patient_id,
            "order_count": len(request.orders),
            "provider_id": request.provider_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/history/{patient_id}")
async def get_order_history(patient_id: str):
    """Get order history for a patient (placeholder - history stored in backend)"""
    try:
        # This is a placeholder - actual history is stored in backend database
        return {
            "patient_id": patient_id,
            "orders": [],
            "message": "Order history is managed by the backend service"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/check-interactions")
async def check_order_interactions(medications: List[str]):
    """Check for drug interactions in proposed orders"""
    try:
        result = smart_orders_ai.check_drug_interactions(medications)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============= Enhanced Smart Orders Endpoints =============

class SmartOrderInteractionCheckRequest(BaseModel):
    medications: List[str]
    patient_context: Optional[Dict[str, Any]] = None


class SmartOrderContraindicationRequest(BaseModel):
    orders: List[Dict[str, Any]]
    patient_context: Dict[str, Any]


class SmartOrderAIRequest(BaseModel):
    diagnosis: str
    patient_context: Optional[Dict[str, Any]] = None


class SmartOrderEnhancedCustomizeRequest(BaseModel):
    bundle_id: str
    patient_context: Dict[str, Any]
    customizations: Optional[Dict[str, Any]] = None


def _dict_to_patient_context(data: Optional[Dict[str, Any]]) -> Optional[SmartOrdersPatientContext]:
    """Convert dictionary to PatientContext model"""
    if not data:
        return None
    return SmartOrdersPatientContext(
        age=data.get("age"),
        weight=data.get("weight"),
        gender=data.get("gender"),
        allergies=data.get("allergies"),
        currentMedications=data.get("currentMedications") or data.get("current_medications"),
        renalFunction=data.get("renalFunction") or data.get("renal_function"),
        hepaticFunction=data.get("hepaticFunction") or data.get("hepatic_function"),
        pregnancyStatus=data.get("pregnancyStatus") or data.get("pregnancy_status"),
        comorbidities=data.get("comorbidities"),
    )


@app.post("/api/check-interactions-detailed")
async def check_interactions_detailed(request: SmartOrderInteractionCheckRequest):
    """
    Enhanced drug interaction checking with severity levels and patient context.
    Returns detailed analysis including severity categorization and recommendations.
    """
    try:
        patient_ctx = _dict_to_patient_context(request.patient_context)
        result = smart_orders_ai.check_medication_interactions_detailed(
            medications=request.medications,
            patient_context=patient_ctx,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/check-contraindications")
async def check_contraindications(request: SmartOrderContraindicationRequest):
    """
    Comprehensive contraindication checking against patient allergies and conditions.
    Returns safe and unsafe orders with detailed warnings.
    """
    try:
        patient_ctx = _dict_to_patient_context(request.patient_context)
        result = smart_orders_ai.check_contraindications(
            orders=request.orders,
            patient_context=patient_ctx,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/recommend-ai")
async def get_ai_recommendations(request: SmartOrderAIRequest):
    """
    AI-enhanced order recommendations using GPT-4.
    Provides personalized analysis with dosing adjustments, warnings, and alternatives.
    Falls back to rule-based if OpenAI unavailable.
    """
    try:
        patient_ctx = _dict_to_patient_context(request.patient_context)
        result = await smart_orders_ai.get_ai_enhanced_recommendations(
            diagnosis=request.diagnosis,
            patient_context=patient_ctx,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/customize-enhanced")
async def customize_bundle_enhanced(request: SmartOrderEnhancedCustomizeRequest):
    """
    Enhanced bundle customization with automatic patient-specific adjustments.
    Features renal/hepatic dosing, weight-based calculations, and contraindication removal.
    """
    try:
        patient_ctx = _dict_to_patient_context(request.patient_context)
        result = smart_orders_ai.customize_bundle_enhanced(
            bundle_id=request.bundle_id,
            patient_context=patient_ctx,
            customizations=request.customizations,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/smart-orders/ai-status")
async def get_smart_orders_ai_status():
    """Check if AI-enhanced features are available for smart orders"""
    from smart_orders.service import DIAGNOSIS_ORDER_DATABASE, ORDER_BUNDLES
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
    }


@app.get("/api/smart-orders/diagnoses")
async def get_supported_diagnoses():
    """Get all supported diagnoses with their ICD codes"""
    from smart_orders.service import DIAGNOSIS_ORDER_DATABASE
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


# ============= AI Scribe Endpoints =============

# Import the request models from the AI Scribe service
from ai_scribe.service import StartSessionRequest as ScribeStartSessionRequest


class ScribeProcessRequest(BaseModel):
    sessionId: str
    generateSoapNote: bool = True
    extractEntities: bool = True
    suggestIcdCodes: bool = True
    suggestCptCodes: bool = True


class ScribeGenerateNoteRequest(BaseModel):
    text: str
    sessionType: str = "consultation"


class ScribeExtractEntitiesRequest(BaseModel):
    text: str


@app.post("/api/scribe/start-session")
async def start_scribe_session(request: ScribeStartSessionRequest):
    """Start a new AI scribe session"""
    try:
        result = ai_scribe.start_session(request)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/scribe/upload-audio")
async def upload_scribe_audio(
    session_id: str = Form(...),
    chunk_number: int = Form(default=0),
    is_final: bool = Form(default=False),
    audio: UploadFile = File(...)
):
    """Upload audio chunk for transcription"""
    try:
        audio_data = await audio.read()
        result = await ai_scribe.upload_audio_chunk(
            session_id=session_id,
            audio_data=audio_data,
            chunk_number=chunk_number,
            is_final=is_final
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/scribe/process")
async def process_scribe_recording(request: ScribeProcessRequest):
    """Process recording and generate clinical documentation"""
    try:
        result = await ai_scribe.process_recording(
            session_id=request.sessionId,
            generate_soap=request.generateSoapNote,
            extract_entities=request.extractEntities,
            suggest_icd=request.suggestIcdCodes,
            suggest_cpt=request.suggestCptCodes
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/scribe/generate-note")
async def generate_note_from_text(request: ScribeGenerateNoteRequest):
    """Generate clinical note from text"""
    try:
        result = await ai_scribe.generate_note_from_text(
            text=request.text,
            session_type=request.sessionType
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/scribe/extract-entities")
async def extract_medical_entities(request: ScribeExtractEntitiesRequest):
    """Extract medical entities from text"""
    try:
        result = await ai_scribe.extract_entities_from_text(request.text)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/scribe/session/{session_id}")
async def get_scribe_session(session_id: str):
    """Get scribe session details"""
    try:
        result = ai_scribe.get_session(session_id)
        if result is None:
            raise HTTPException(status_code=404, detail="Session not found")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/scribe/templates")
async def get_scribe_templates():
    """Get available note templates"""
    try:
        result = ai_scribe.get_templates()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Insurance Coding AI Endpoints
# =============================================================================

class PatientContextModel(BaseModel):
    """Patient context for insurance coding"""
    age: Optional[int] = None
    gender: Optional[str] = None
    conditions: Optional[List[str]] = []
    medications: Optional[List[str]] = []


class CodeSuggestRequest(BaseModel):
    """Request for AI code suggestions"""
    clinicalText: str
    patientContext: Optional[PatientContextModel] = None
    encounterType: Optional[str] = "outpatient"
    payerId: Optional[str] = None


class SuggestedICD10(BaseModel):
    code: str
    description: str
    confidence: float
    specificityLevel: Optional[str] = None
    isPreferred: Optional[bool] = False
    rationale: Optional[str] = None


class SuggestedCPT(BaseModel):
    code: str
    description: str
    confidence: float
    medicalNecessityScore: Optional[float] = None
    requiredModifiers: Optional[List[str]] = []
    rationale: Optional[str] = None


class CodeSuggestResponse(BaseModel):
    icd10Codes: List[SuggestedICD10]
    cptCodes: List[SuggestedCPT]
    extractedDiagnoses: List[str]
    confidence: float
    modelVersion: str


class CodeValidateRequest(BaseModel):
    """Request for code validation"""
    icdCodes: List[str]
    cptCodes: List[str]
    payerId: Optional[str] = None


class ValidationIssue(BaseModel):
    type: str
    severity: str
    icdCode: Optional[str] = None
    cptCode: Optional[str] = None
    message: str
    suggestion: Optional[str] = None


class CodeValidateResponse(BaseModel):
    isValid: bool
    issues: List[ValidationIssue]
    medicalNecessityScore: float
    suggestions: List[str]
    modelVersion: str


class AcceptancePredictRequest(BaseModel):
    """Request for claim acceptance prediction"""
    icdCodes: List[str]
    cptCodes: List[str]
    payerId: str
    documentationScore: Optional[float] = None
    patientContext: Optional[PatientContextModel] = None


class RiskFactor(BaseModel):
    factor: str
    impact: str
    weight: float


class AcceptancePredictResponse(BaseModel):
    acceptanceProbability: float
    riskLevel: str
    riskFactors: List[RiskFactor]
    recommendations: List[str]
    estimatedReimbursement: Optional[float] = None
    modelVersion: str


class DiagnosisExtractRequest(BaseModel):
    """Request for diagnosis extraction from clinical text"""
    clinicalText: str
    extractConditions: Optional[bool] = True
    extractProcedures: Optional[bool] = True


class ExtractedDiagnosis(BaseModel):
    text: str
    icd10Suggestion: Optional[str] = None
    confidence: float
    location: Optional[Dict[str, int]] = None


class ExtractedProcedure(BaseModel):
    text: str
    cptSuggestion: Optional[str] = None
    confidence: float


class DiagnosisExtractResponse(BaseModel):
    diagnoses: List[ExtractedDiagnosis]
    procedures: List[ExtractedProcedure]
    clinicalSummary: Optional[str] = None
    modelVersion: str


class MedicalNecessityCheckRequest(BaseModel):
    """Request for medical necessity check"""
    icdCodes: List[str]
    cptCodes: List[str]


class NecessityPair(BaseModel):
    icdCode: str
    cptCode: str
    isNecessary: bool
    score: float
    rationale: Optional[str] = None


class MedicalNecessityCheckResponse(BaseModel):
    overallScore: float
    pairs: List[NecessityPair]
    invalidPairs: List[Dict[str, str]]
    recommendations: List[str]
    modelVersion: str


@app.post("/api/insurance-coding/suggest", response_model=CodeSuggestResponse)
async def suggest_codes(request: CodeSuggestRequest):
    """Suggest ICD-10 and CPT codes from clinical text"""
    try:
        patient_context = None
        if request.patientContext:
            patient_context = {
                'age': request.patientContext.age,
                'gender': request.patientContext.gender,
                'conditions': request.patientContext.conditions or [],
                'medications': request.patientContext.medications or [],
            }

        result = insurance_coding_ai.suggest_codes(
            clinical_text=request.clinicalText,
            patient_context=patient_context,
            encounter_type=request.encounterType,
            payer_id=request.payerId,
        )

        return CodeSuggestResponse(
            icd10Codes=[SuggestedICD10(**icd) for icd in result.get('icd10_codes', [])],
            cptCodes=[SuggestedCPT(**cpt) for cpt in result.get('cpt_codes', [])],
            extractedDiagnoses=result.get('extracted_diagnoses', []),
            confidence=result.get('confidence', 0.0),
            modelVersion=result.get('model_version', 'rule-based-1.0'),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/insurance-coding/validate", response_model=CodeValidateResponse)
async def validate_codes(request: CodeValidateRequest):
    """Validate ICD-10 and CPT code combinations"""
    try:
        result = insurance_coding_ai.validate_codes(
            icd_codes=request.icdCodes,
            cpt_codes=request.cptCodes,
            payer_id=request.payerId,
        )

        return CodeValidateResponse(
            isValid=result.get('is_valid', False),
            issues=[ValidationIssue(**issue) for issue in result.get('issues', [])],
            medicalNecessityScore=result.get('medical_necessity_score', 0.0),
            suggestions=result.get('suggestions', []),
            modelVersion=result.get('model_version', 'rule-based-1.0'),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/insurance-coding/predict-acceptance", response_model=AcceptancePredictResponse)
async def predict_acceptance(request: AcceptancePredictRequest):
    """Predict claim acceptance probability"""
    try:
        patient_context = None
        if request.patientContext:
            patient_context = {
                'age': request.patientContext.age,
                'gender': request.patientContext.gender,
                'conditions': request.patientContext.conditions or [],
                'medications': request.patientContext.medications or [],
            }

        result = insurance_coding_ai.predict_acceptance(
            icd_codes=request.icdCodes,
            cpt_codes=request.cptCodes,
            payer_id=request.payerId,
            documentation_score=request.documentationScore,
            patient_context=patient_context,
        )

        return AcceptancePredictResponse(
            acceptanceProbability=result.get('acceptance_probability', 0.0),
            riskLevel=result.get('risk_level', 'unknown'),
            riskFactors=[RiskFactor(
                factor=rf.get('factor', ''),
                impact=rf.get('impact', 'neutral'),
                weight=rf.get('weight', 0.0)
            ) for rf in result.get('risk_factors', [])],
            recommendations=result.get('recommendations', []),
            estimatedReimbursement=result.get('estimated_reimbursement'),
            modelVersion=result.get('model_version', 'rule-based-1.0'),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/insurance-coding/extract-diagnoses", response_model=DiagnosisExtractResponse)
async def extract_diagnoses(request: DiagnosisExtractRequest):
    """Extract diagnoses and procedures from clinical text"""
    try:
        result = insurance_coding_ai.extract_diagnoses_from_text(
            clinical_text=request.clinicalText,
        )

        return DiagnosisExtractResponse(
            diagnoses=[ExtractedDiagnosis(
                text=d.get('text', ''),
                icd10Suggestion=d.get('icd10_suggestion'),
                confidence=d.get('confidence', 0.0),
                location=d.get('location'),
            ) for d in result.get('diagnoses', [])],
            procedures=[ExtractedProcedure(
                text=p.get('text', ''),
                cptSuggestion=p.get('cpt_suggestion'),
                confidence=p.get('confidence', 0.0),
            ) for p in result.get('procedures', [])],
            clinicalSummary=result.get('clinical_summary'),
            modelVersion=result.get('model_version', 'gpt-4o-1.0'),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/insurance-coding/check-necessity", response_model=MedicalNecessityCheckResponse)
async def check_medical_necessity(request: MedicalNecessityCheckRequest):
    """Check medical necessity for ICD-CPT code pairs"""
    try:
        result = insurance_coding_ai.check_medical_necessity(
            icd_codes=request.icdCodes,
            cpt_codes=request.cptCodes,
        )

        return MedicalNecessityCheckResponse(
            overallScore=result.get('overall_score', 0.0),
            pairs=[NecessityPair(
                icdCode=p.get('icd_code', ''),
                cptCode=p.get('cpt_code', ''),
                isNecessary=p.get('is_necessary', False),
                score=p.get('score', 0.0),
                rationale=p.get('rationale'),
            ) for p in result.get('pairs', [])],
            invalidPairs=result.get('invalid_pairs', []),
            recommendations=result.get('recommendations', []),
            modelVersion=result.get('model_version', 'rule-based-1.0'),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/insurance-coding/status")
async def insurance_coding_status():
    """Get insurance coding AI service status"""
    try:
        return {
            "service": "insurance_coding",
            "status": "operational",
            "features": {
                "code_suggestion": True,
                "code_validation": True,
                "acceptance_prediction": True,
                "diagnosis_extraction": True,
                "medical_necessity": True,
            },
            "knowledge_base": {
                "icd10_mappings": True,
                "cpt_categories": True,
                "denial_reasons": True,
                "modifier_rules": True,
                "dha_rules": True,
            },
            "model_version": "1.0.0",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# A'mad Precision Health Platform - Genomic Services
# =============================================================================

class GenomicUploadRequest(BaseModel):
    """Request for genomic file upload and processing"""
    file_content: str  # Base64 encoded or raw text
    source: Optional[str] = None  # VCF, TWENTYTHREE_AND_ME, ANCESTRY_DNA

class GenomicMarkerResponse(BaseModel):
    """Response with extracted genomic markers"""
    markers: List[Dict[str, Any]]
    risk_scores: List[Dict[str, Any]]
    file_hash: str
    source: str
    snp_count: int

@app.post("/api/genomic/upload", response_model=GenomicMarkerResponse)
async def upload_genomic_file(request: GenomicUploadRequest):
    """Upload and process a genomic data file"""
    try:
        result = genomic_service.process_file(request.file_content, request.source)
        return GenomicMarkerResponse(
            markers=[m.to_dict() for m in result["markers"]],
            risk_scores=[r.to_dict() for r in result["risk_scores"]],
            file_hash=result["file_hash"],
            source=result["source"],
            snp_count=result["snp_count"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/genomic/interpret")
async def interpret_snps(snp_data: Dict[str, str]):
    """Interpret specific SNPs from raw genotype data"""
    try:
        markers = genomic_service.extract_markers(snp_data)
        return {
            "markers": [m.to_dict() for m in markers],
            "count": len(markers)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/genomic/markers")
async def get_supported_markers():
    """Get list of all supported genomic markers"""
    try:
        markers = genomic_service.get_supported_markers()
        return {
            "markers": markers,
            "count": len(markers),
            "categories": list(set(m["category"] for m in markers))
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/genomic/status")
async def genomic_service_status():
    """Get genomic service status"""
    return {
        "service": "genomic",
        "status": "operational",
        "supported_sources": ["VCF", "TWENTYTHREE_AND_ME", "ANCESTRY_DNA"],
        "marker_count": len(genomic_service.get_supported_markers()),
        "categories": [c.value for c in MarkerCategory],
        "model_version": "1.0.0"
    }


# =============================================================================
# A'mad Precision Health Platform - Nutrition AI Services
# =============================================================================

class MealAnalysisRequest(BaseModel):
    """Request for meal image analysis"""
    image_base64: str
    meal_type: Optional[str] = None  # BREAKFAST, LUNCH, DINNER, SNACK

class MealAnalysisResponse(BaseModel):
    """Response with meal analysis results"""
    foods: List[Dict[str, Any]]
    total_calories: float
    total_protein: float
    total_carbs: float
    total_fat: float
    total_fiber: float
    meal_type: str
    confidence: float
    suggestions: List[str]
    warnings: List[str]

class FoodSearchRequest(BaseModel):
    """Request for food database search"""
    query: str
    include_regional: bool = True
    limit: int = 20

@app.post("/api/nutrition/analyze-image", response_model=MealAnalysisResponse)
async def analyze_meal_image(request: MealAnalysisRequest):
    """Analyze a meal image using GPT-4 Vision"""
    try:
        meal_type = MealType(request.meal_type) if request.meal_type else None
        result = await nutrition_service.analyze_meal_image(
            request.image_base64,
            meal_type
        )
        return MealAnalysisResponse(**result.to_dict())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/nutrition/search")
async def search_foods(request: FoodSearchRequest):
    """Search food database by name"""
    try:
        results = nutrition_service.search_foods(
            request.query,
            request.include_regional,
            request.limit
        )
        return {
            "results": results,
            "count": len(results),
            "query": request.query
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/nutrition/food/{food_id}")
async def get_food_details(food_id: str):
    """Get detailed nutrition info for a food item"""
    try:
        food = nutrition_service.get_food_details(food_id)
        if not food:
            raise HTTPException(status_code=404, detail="Food not found")
        return food
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/nutrition/regional")
async def get_regional_foods(region: Optional[str] = None):
    """Get regional foods, optionally filtered by region"""
    try:
        foods = nutrition_service.get_regional_foods(region)
        return {
            "foods": foods,
            "count": len(foods),
            "regions": nutrition_service.get_supported_regions()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/nutrition/estimate-portion")
async def estimate_portion(food_id: str, portion_size: str):
    """Estimate nutrition for a specific portion size"""
    try:
        result = nutrition_service.estimate_portion(
            food_id,
            PortionSize(portion_size)
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/nutrition/status")
async def nutrition_service_status():
    """Get nutrition AI service status"""
    return {
        "service": "nutrition_ai",
        "status": "operational",
        "features": {
            "image_analysis": nutrition_service.openai_client is not None,
            "food_search": True,
            "regional_database": True,
            "portion_estimation": True
        },
        "regional_foods_count": len(nutrition_service.regional_db),
        "standard_foods_count": len(nutrition_service.standard_db),
        "supported_regions": nutrition_service.get_supported_regions(),
        "model_version": "1.0.0"
    }


# =============================================================================
# A'mad Precision Health Platform - Recommendation Engine
# =============================================================================

class PatientDataRequest(BaseModel):
    """Patient data for recommendation generation"""
    wearable_data: Optional[Dict[str, Any]] = None
    genomic_markers: Optional[List[Dict[str, Any]]] = None
    lab_results: Optional[List[Dict[str, Any]]] = None
    nutrition_logs: Optional[List[Dict[str, Any]]] = None
    fitness_goals: Optional[Dict[str, Any]] = None
    current_recommendations: Optional[List[Dict[str, Any]]] = None

class RecommendationResponse(BaseModel):
    """Response with generated recommendations"""
    recommendations: List[Dict[str, Any]]
    count: int
    categories: List[str]

class HealthScoreResponse(BaseModel):
    """Response with daily health score"""
    overall: int
    sleep: int
    activity: int
    nutrition: int
    recovery: int
    compliance: int
    trend: str
    insights: List[str]
    data_quality: float

@app.post("/api/recommendations/generate", response_model=RecommendationResponse)
async def generate_recommendations(request: PatientDataRequest):
    """Generate personalized health recommendations"""
    try:
        patient_data = {
            "wearable_data": request.wearable_data,
            "genomic_markers": request.genomic_markers,
            "lab_results": request.lab_results,
            "nutrition_logs": request.nutrition_logs,
            "fitness_goals": request.fitness_goals,
            "current_recommendations": request.current_recommendations
        }
        recommendations = recommendation_service.generate_recommendations(patient_data)
        categories = list(set(r["category"] for r in recommendations))
        return RecommendationResponse(
            recommendations=recommendations,
            count=len(recommendations),
            categories=categories
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/recommendations/score", response_model=HealthScoreResponse)
async def calculate_health_score(request: PatientDataRequest):
    """Calculate daily health score"""
    try:
        patient_data = {
            "wearable_data": request.wearable_data,
            "genomic_markers": request.genomic_markers,
            "lab_results": request.lab_results,
            "nutrition_logs": request.nutrition_logs,
            "fitness_goals": request.fitness_goals,
            "current_recommendations": request.current_recommendations
        }
        score = recommendation_service.calculate_daily_score(patient_data)
        return HealthScoreResponse(**score)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/recommendations/rules")
async def get_recommendation_rules():
    """Get available recommendation rules by category"""
    try:
        return {
            "wearable_rules": list(recommendation_service.wearable_rules.keys()),
            "lab_rules": list(recommendation_service.lab_rules.keys()),
            "genomic_rules": list(recommendation_service.genomic_rules.keys()),
            "nutrition_rules": list(recommendation_service.nutrition_rules.keys())
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/recommendations/status")
async def recommendation_service_status():
    """Get recommendation engine status"""
    return {
        "service": "recommendation",
        "status": "operational",
        "features": {
            "recommendation_generation": True,
            "health_score_calculation": True,
            "multi_source_correlation": True,
            "genomic_integration": True
        },
        "rule_counts": {
            "wearable": len(recommendation_service.wearable_rules),
            "lab": len(recommendation_service.lab_rules),
            "genomic": len(recommendation_service.genomic_rules),
            "nutrition": len(recommendation_service.nutrition_rules)
        },
        "model_version": "1.0.0"
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
