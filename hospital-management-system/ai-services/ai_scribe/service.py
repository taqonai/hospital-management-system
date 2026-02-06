"""
AI Scribe Service - Comprehensive medical conversation transcription and documentation
Combines speech-to-text, speaker diarization, entity extraction, and SOAP note generation

Features:
- Real-time audio transcription with speaker diarization
- Clinical entity extraction (symptoms, diagnoses, medications, vitals, allergies)
- Automatic SOAP note generation
- Multiple note types: Consultation, Follow-up, Procedure, Discharge
- ICD-10 and CPT code suggestions
- Follow-up recommendations and prescription suggestions
"""

import os
import json
import uuid
import tempfile
import re
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
from pathlib import Path

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn

# Import shared OpenAI client
from shared.openai_client import openai_manager, TaskComplexity, OPENAI_AVAILABLE


# ============= Pydantic Models =============

class StartSessionRequest(BaseModel):
    patientId: Optional[str] = None
    patientName: Optional[str] = None
    patientAge: Optional[int] = None
    patientGender: Optional[str] = None
    doctorId: Optional[str] = None
    doctorName: Optional[str] = None
    doctorSpecialty: Optional[str] = None
    appointmentId: Optional[str] = None
    sessionType: str = "consultation"  # consultation, follow_up, procedure, discharge
    existingConditions: Optional[List[str]] = None
    currentMedications: Optional[List[str]] = None
    knownAllergies: Optional[List[str]] = None


class StartSessionResponse(BaseModel):
    sessionId: str
    status: str
    createdAt: str
    patientId: Optional[str]
    patientName: Optional[str]
    sessionType: str


class ProcessRecordingRequest(BaseModel):
    sessionId: str
    generateSoapNote: bool = True
    extractEntities: bool = True
    suggestIcdCodes: bool = True
    suggestCptCodes: bool = True
    generateFollowUp: bool = True
    generatePrescriptions: bool = True


class TranscriptSegment(BaseModel):
    speaker: str
    text: str
    startTime: float
    endTime: float
    confidence: float


class MedicalEntity(BaseModel):
    type: str
    value: str
    confidence: float
    context: Optional[str] = None
    unit: Optional[str] = None


class IcdCodeSuggestion(BaseModel):
    code: str
    description: str
    confidence: str
    supportingText: str
    category: Optional[str] = None


class CptCodeSuggestion(BaseModel):
    code: str
    description: str
    confidence: str
    supportingText: str
    category: Optional[str] = None


class SoapNote(BaseModel):
    subjective: str
    objective: str
    assessment: str
    plan: str


class FollowUpRecommendation(BaseModel):
    timeframe: str
    reason: str
    priority: str
    specialtyReferral: Optional[str] = None
    testsRequired: Optional[List[str]] = None


class PrescriptionSuggestion(BaseModel):
    medication: str
    dosage: str
    frequency: str
    duration: str
    route: str
    instructions: Optional[str] = None
    warnings: Optional[List[str]] = None
    reason: str


class ExtractedEntities(BaseModel):
    symptoms: List[MedicalEntity] = []
    diagnoses: List[MedicalEntity] = []
    medications: List[MedicalEntity] = []
    vitals: List[MedicalEntity] = []
    allergies: List[MedicalEntity] = []
    procedures: List[MedicalEntity] = []
    history: List[MedicalEntity] = []
    labResults: List[MedicalEntity] = []


class ProcessingResult(BaseModel):
    sessionId: str
    status: str
    transcript: List[TranscriptSegment]
    fullTranscript: str
    extractedEntities: Optional[ExtractedEntities] = None
    generatedNote: Optional[SoapNote] = None
    suggestedICD10Codes: Optional[List[IcdCodeSuggestion]] = None
    suggestedCPTCodes: Optional[List[CptCodeSuggestion]] = None
    keyFindings: Optional[List[str]] = None
    followUpRecommendations: Optional[List[FollowUpRecommendation]] = None
    prescriptionSuggestions: Optional[List[PrescriptionSuggestion]] = None
    duration: Optional[float] = None
    processedAt: str
    modelVersion: str
    noteType: str


class SaveNotesRequest(BaseModel):
    sessionId: str
    patientId: str
    soapNote: SoapNote
    icdCodes: Optional[List[str]] = None
    cptCodes: Optional[List[str]] = None
    entities: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None
    prescriptions: Optional[List[PrescriptionSuggestion]] = None
    followUpDate: Optional[str] = None


class ScribeTemplate(BaseModel):
    id: str
    name: str
    description: str
    noteType: str
    sections: List[str]
    prompts: Dict[str, str]
    requiredFields: List[str]


class GenerateNoteFromTextRequest(BaseModel):
    text: str
    noteType: str = "consultation"
    patientInfo: Optional[Dict[str, Any]] = None
    extractEntities: bool = True
    suggestCodes: bool = True


class ExtractEntitiesRequest(BaseModel):
    text: str
    includeVitals: bool = True
    includeMedications: bool = True
    includeSymptoms: bool = True
    includeDiagnoses: bool = True


# ============= AI Scribe Service =============

class AIScribeService:
    """
    AI-powered medical scribe service for real-time transcription
    and clinical documentation

    Features:
    - Audio transcription with speaker diarization (Doctor/Patient)
    - Clinical entity extraction (symptoms, diagnoses, medications, vitals, allergies)
    - Automatic SOAP note generation
    - Multiple note types: Consultation, Follow-up, Procedure, Discharge
    - ICD-10 and CPT code suggestions
    - Follow-up recommendations
    - Prescription suggestions based on diagnoses
    """

    def __init__(self):
        # Uses shared openai_manager
        if openai_manager.is_available():
            print("AI Scribe: OpenAI available via shared client")
        else:
            print("AI Scribe: OpenAI not available")

        # In-memory session storage (replace with database in production)
        self.sessions: Dict[str, Dict[str, Any]] = {}
        self.audio_chunks: Dict[str, List[bytes]] = {}

        self.model_version = "ai-scribe-v2.0"

        # Medical terminology for better transcription
        self.medical_prompt = """
        Medical consultation transcription. Common terms include: patient, doctor,
        symptoms, diagnosis, medication, prescription, dosage, treatment plan,
        chief complaint, history of present illness, past medical history,
        family history, social history, review of systems, physical examination,
        vital signs, blood pressure, heart rate, temperature, respiratory rate,
        oxygen saturation, CBC, BMP, ECG, MRI, CT scan, X-ray, ultrasound,
        diabetes, hypertension, COPD, asthma, heart failure, coronary artery disease,
        stroke, pneumonia, UTI, GERD, anxiety, depression, arthritis, osteoporosis.
        """

        # ICD-10 common codes reference
        self.common_icd_codes = {
            "hypertension": ("I10", "Essential (primary) hypertension", "Cardiovascular"),
            "high blood pressure": ("I10", "Essential (primary) hypertension", "Cardiovascular"),
            "diabetes": ("E11.9", "Type 2 diabetes mellitus without complications", "Endocrine"),
            "type 2 diabetes": ("E11.9", "Type 2 diabetes mellitus without complications", "Endocrine"),
            "type 1 diabetes": ("E10.9", "Type 1 diabetes mellitus without complications", "Endocrine"),
            "copd": ("J44.9", "Chronic obstructive pulmonary disease, unspecified", "Respiratory"),
            "asthma": ("J45.909", "Unspecified asthma, uncomplicated", "Respiratory"),
            "chest pain": ("R07.9", "Chest pain, unspecified", "Symptoms"),
            "headache": ("R51.9", "Headache, unspecified", "Symptoms"),
            "migraine": ("G43.909", "Migraine, unspecified, not intractable, without status migrainosus", "Neurological"),
            "fever": ("R50.9", "Fever, unspecified", "Symptoms"),
            "cough": ("R05.9", "Cough, unspecified", "Symptoms"),
            "shortness of breath": ("R06.02", "Shortness of breath", "Symptoms"),
            "dyspnea": ("R06.00", "Dyspnea, unspecified", "Symptoms"),
            "fatigue": ("R53.83", "Other fatigue", "Symptoms"),
            "back pain": ("M54.5", "Low back pain", "Musculoskeletal"),
            "neck pain": ("M54.2", "Cervicalgia", "Musculoskeletal"),
            "joint pain": ("M25.50", "Pain in unspecified joint", "Musculoskeletal"),
            "anxiety": ("F41.9", "Anxiety disorder, unspecified", "Mental Health"),
            "depression": ("F32.9", "Major depressive disorder, single episode, unspecified", "Mental Health"),
            "urinary tract infection": ("N39.0", "Urinary tract infection, site not specified", "Genitourinary"),
            "uti": ("N39.0", "Urinary tract infection, site not specified", "Genitourinary"),
            "pneumonia": ("J18.9", "Pneumonia, unspecified organism", "Respiratory"),
            "upper respiratory infection": ("J06.9", "Acute upper respiratory infection, unspecified", "Respiratory"),
            "uri": ("J06.9", "Acute upper respiratory infection, unspecified", "Respiratory"),
            "gastroesophageal reflux": ("K21.0", "Gastro-esophageal reflux disease with esophagitis", "Gastrointestinal"),
            "gerd": ("K21.0", "Gastro-esophageal reflux disease with esophagitis", "Gastrointestinal"),
            "heart failure": ("I50.9", "Heart failure, unspecified", "Cardiovascular"),
            "atrial fibrillation": ("I48.91", "Unspecified atrial fibrillation", "Cardiovascular"),
            "coronary artery disease": ("I25.10", "Atherosclerotic heart disease of native coronary artery", "Cardiovascular"),
            "hypothyroidism": ("E03.9", "Hypothyroidism, unspecified", "Endocrine"),
            "hyperlipidemia": ("E78.5", "Hyperlipidemia, unspecified", "Endocrine"),
            "obesity": ("E66.9", "Obesity, unspecified", "Endocrine"),
            "anemia": ("D64.9", "Anemia, unspecified", "Hematologic"),
            "chronic kidney disease": ("N18.9", "Chronic kidney disease, unspecified", "Genitourinary"),
            "osteoarthritis": ("M19.90", "Unspecified osteoarthritis, unspecified site", "Musculoskeletal"),
            "rheumatoid arthritis": ("M06.9", "Rheumatoid arthritis, unspecified", "Musculoskeletal"),
            "stroke": ("I63.9", "Cerebral infarction, unspecified", "Neurological"),
            "seizure": ("R56.9", "Unspecified convulsions", "Neurological"),
            "insomnia": ("G47.00", "Insomnia, unspecified", "Sleep"),
            "allergic rhinitis": ("J30.9", "Allergic rhinitis, unspecified", "Respiratory"),
            "sinusitis": ("J32.9", "Chronic sinusitis, unspecified", "Respiratory"),
            "bronchitis": ("J40", "Bronchitis, not specified as acute or chronic", "Respiratory"),
            "gastritis": ("K29.70", "Gastritis, unspecified, without bleeding", "Gastrointestinal"),
            "constipation": ("K59.00", "Constipation, unspecified", "Gastrointestinal"),
            "diarrhea": ("R19.7", "Diarrhea, unspecified", "Gastrointestinal"),
            "nausea": ("R11.0", "Nausea", "Symptoms"),
            "vomiting": ("R11.10", "Vomiting, unspecified", "Symptoms"),
            "abdominal pain": ("R10.9", "Unspecified abdominal pain", "Symptoms"),
            "dizziness": ("R42", "Dizziness and giddiness", "Symptoms"),
            "vertigo": ("R42", "Dizziness and giddiness", "Symptoms"),
        }

        # CPT common codes reference
        self.common_cpt_codes = {
            "new_patient_office_low": ("99202", "Office visit, new patient, 15-29 min", "E/M"),
            "new_patient_office_mod": ("99203", "Office visit, new patient, 30-44 min", "E/M"),
            "new_patient_office_high": ("99204", "Office visit, new patient, 45-59 min", "E/M"),
            "new_patient_office_comprehensive": ("99205", "Office visit, new patient, 60-74 min", "E/M"),
            "established_patient_office_low": ("99212", "Office visit, established patient, 10-19 min", "E/M"),
            "established_patient_office_mod": ("99213", "Office visit, established patient, 20-29 min", "E/M"),
            "established_patient_office_high": ("99214", "Office visit, established patient, 30-39 min", "E/M"),
            "established_patient_office_comprehensive": ("99215", "Office visit, established patient, 40-54 min", "E/M"),
            "telehealth_established": ("99213", "Telehealth visit, established patient", "E/M"),
            "ecg_interpretation": ("93010", "Electrocardiogram interpretation and report", "Cardiology"),
            "ecg_with_interpretation": ("93000", "Electrocardiogram, complete", "Cardiology"),
            "venipuncture": ("36415", "Venipuncture", "Laboratory"),
            "injection_therapeutic": ("96372", "Therapeutic injection, subcutaneous or intramuscular", "Procedures"),
            "nebulizer_treatment": ("94640", "Nebulizer treatment", "Respiratory"),
            "spirometry": ("94010", "Spirometry", "Respiratory"),
            "pulse_oximetry": ("94760", "Pulse oximetry", "Respiratory"),
            "strep_test": ("87880", "Strep test, rapid", "Laboratory"),
            "flu_test": ("87804", "Influenza test, rapid", "Laboratory"),
            "urinalysis": ("81003", "Urinalysis, automated", "Laboratory"),
            "glucose_test": ("82947", "Glucose quantitative, blood", "Laboratory"),
            "hemoglobin_a1c": ("83036", "Hemoglobin A1c", "Laboratory"),
            "lipid_panel": ("80061", "Lipid panel", "Laboratory"),
            "cbc": ("85025", "Complete blood count with differential", "Laboratory"),
            "bmp": ("80048", "Basic metabolic panel", "Laboratory"),
            "cmp": ("80053", "Comprehensive metabolic panel", "Laboratory"),
            "tsh": ("84443", "Thyroid stimulating hormone", "Laboratory"),
            "wound_care_simple": ("97597", "Wound care, simple", "Procedures"),
            "suture_simple": ("12001", "Simple repair, superficial wounds", "Procedures"),
            "i_and_d": ("10060", "Incision and drainage of abscess", "Procedures"),
        }

        # Common medication suggestions by condition
        self.medication_suggestions = {
            "hypertension": [
                {"medication": "Lisinopril", "dosage": "10mg", "frequency": "Once daily", "duration": "30 days", "route": "Oral"},
                {"medication": "Amlodipine", "dosage": "5mg", "frequency": "Once daily", "duration": "30 days", "route": "Oral"},
                {"medication": "Losartan", "dosage": "50mg", "frequency": "Once daily", "duration": "30 days", "route": "Oral"},
            ],
            "diabetes": [
                {"medication": "Metformin", "dosage": "500mg", "frequency": "Twice daily", "duration": "30 days", "route": "Oral"},
                {"medication": "Glipizide", "dosage": "5mg", "frequency": "Once daily", "duration": "30 days", "route": "Oral"},
            ],
            "infection": [
                {"medication": "Amoxicillin", "dosage": "500mg", "frequency": "Three times daily", "duration": "7 days", "route": "Oral"},
                {"medication": "Azithromycin", "dosage": "250mg", "frequency": "Once daily", "duration": "5 days", "route": "Oral"},
            ],
            "pain": [
                {"medication": "Ibuprofen", "dosage": "400mg", "frequency": "Every 6 hours as needed", "duration": "7 days", "route": "Oral"},
                {"medication": "Acetaminophen", "dosage": "500mg", "frequency": "Every 6 hours as needed", "duration": "7 days", "route": "Oral"},
            ],
            "anxiety": [
                {"medication": "Sertraline", "dosage": "50mg", "frequency": "Once daily", "duration": "30 days", "route": "Oral"},
            ],
            "depression": [
                {"medication": "Sertraline", "dosage": "50mg", "frequency": "Once daily", "duration": "30 days", "route": "Oral"},
                {"medication": "Escitalopram", "dosage": "10mg", "frequency": "Once daily", "duration": "30 days", "route": "Oral"},
            ],
            "gerd": [
                {"medication": "Omeprazole", "dosage": "20mg", "frequency": "Once daily before breakfast", "duration": "14 days", "route": "Oral"},
                {"medication": "Famotidine", "dosage": "20mg", "frequency": "Twice daily", "duration": "14 days", "route": "Oral"},
            ],
            "allergies": [
                {"medication": "Cetirizine", "dosage": "10mg", "frequency": "Once daily", "duration": "30 days", "route": "Oral"},
                {"medication": "Loratadine", "dosage": "10mg", "frequency": "Once daily", "duration": "30 days", "route": "Oral"},
            ],
            "asthma": [
                {"medication": "Albuterol inhaler", "dosage": "90mcg/actuation", "frequency": "2 puffs every 4-6 hours as needed", "duration": "30 days", "route": "Inhalation"},
            ],
        }

    @staticmethod
    def is_available() -> bool:
        """Check if OpenAI services are available"""
        return openai_manager.is_available()

    def start_session(self, request: StartSessionRequest) -> StartSessionResponse:
        """Start a new scribe session"""
        session_id = str(uuid.uuid4())

        session = {
            "id": session_id,
            "status": "active",
            "createdAt": datetime.now().isoformat(),
            "patientId": request.patientId,
            "patientName": request.patientName,
            "patientAge": request.patientAge,
            "patientGender": request.patientGender,
            "doctorId": request.doctorId,
            "doctorName": request.doctorName,
            "doctorSpecialty": request.doctorSpecialty,
            "appointmentId": request.appointmentId,
            "sessionType": request.sessionType,
            "existingConditions": request.existingConditions or [],
            "currentMedications": request.currentMedications or [],
            "knownAllergies": request.knownAllergies or [],
            "audioChunks": [],
            "transcript": None,
            "soapNote": None,
            "entities": None,
            "icdCodes": None,
            "cptCodes": None,
            "followUpRecommendations": None,
            "prescriptionSuggestions": None,
        }

        self.sessions[session_id] = session
        self.audio_chunks[session_id] = []

        return StartSessionResponse(
            sessionId=session_id,
            status="active",
            createdAt=session["createdAt"],
            patientId=request.patientId,
            patientName=request.patientName,
            sessionType=request.sessionType,
        )

    async def upload_audio_chunk(
        self,
        session_id: str,
        audio_data: bytes,
        chunk_number: int,
        is_final: bool = False,
    ) -> Dict[str, Any]:
        """Upload an audio chunk for a session"""
        if session_id not in self.sessions:
            raise ValueError(f"Session {session_id} not found")

        if session_id not in self.audio_chunks:
            self.audio_chunks[session_id] = []

        self.audio_chunks[session_id].append(audio_data)

        return {
            "sessionId": session_id,
            "chunkNumber": chunk_number,
            "received": True,
            "totalChunks": len(self.audio_chunks[session_id]),
            "isFinal": is_final,
        }

    async def process_recording(
        self,
        session_id: str,
        audio_data: Optional[bytes] = None,
        generate_soap: bool = True,
        extract_entities: bool = True,
        suggest_icd: bool = True,
        suggest_cpt: bool = True,
        generate_follow_up: bool = True,
        generate_prescriptions: bool = True,
    ) -> ProcessingResult:
        """Process recording and generate clinical documentation"""

        if session_id not in self.sessions:
            raise ValueError(f"Session {session_id} not found")

        session = self.sessions[session_id]

        # Combine audio chunks if no direct audio provided
        if audio_data is None:
            if session_id in self.audio_chunks and self.audio_chunks[session_id]:
                audio_data = b''.join(self.audio_chunks[session_id])
            else:
                raise ValueError("No audio data available for processing")

        # Step 1: Transcribe audio
        transcript_result = await self._transcribe_audio(audio_data)

        if not transcript_result["success"]:
            raise ValueError(f"Transcription failed: {transcript_result.get('error', 'Unknown error')}")

        full_transcript = transcript_result["transcript"]
        duration = transcript_result.get("duration", 0)

        # Step 2: Perform speaker diarization
        transcript_segments = self._perform_diarization(full_transcript, transcript_result.get("segments", []))

        # Step 3: Extract medical entities
        entities = None
        if extract_entities:
            entities = await self._extract_entities(full_transcript)

        # Step 4: Generate SOAP note based on session type
        soap_note = None
        if generate_soap:
            soap_note = await self._generate_soap_note(
                full_transcript,
                transcript_segments,
                entities,
                session.get("patientName"),
                session.get("sessionType", "consultation"),
            )

        # Step 5: Suggest ICD-10 codes
        icd_codes = None
        if suggest_icd:
            icd_codes = await self._suggest_icd_codes(full_transcript, soap_note)

        # Step 6: Suggest CPT codes
        cpt_codes = None
        if suggest_cpt:
            cpt_codes = await self._suggest_cpt_codes(
                full_transcript,
                soap_note,
                duration,
                session.get("sessionType", "consultation"),
            )

        # Step 7: Extract key findings
        key_findings = self._extract_key_findings(full_transcript, entities)

        # Step 8: Generate follow-up recommendations
        follow_up_recommendations = None
        if generate_follow_up:
            follow_up_recommendations = await self._generate_follow_up_recommendations(
                full_transcript,
                soap_note,
                entities,
                icd_codes,
            )

        # Step 9: Generate prescription suggestions
        prescription_suggestions = None
        if generate_prescriptions:
            prescription_suggestions = await self._generate_prescription_suggestions(
                full_transcript,
                soap_note,
                entities,
                session.get("knownAllergies", []),
                session.get("currentMedications", []),
            )

        # Update session
        session["status"] = "processed"
        session["transcript"] = transcript_segments
        session["fullTranscript"] = full_transcript
        session["soapNote"] = soap_note
        session["entities"] = entities
        session["icdCodes"] = icd_codes
        session["cptCodes"] = cpt_codes
        session["keyFindings"] = key_findings
        session["followUpRecommendations"] = follow_up_recommendations
        session["prescriptionSuggestions"] = prescription_suggestions
        session["processedAt"] = datetime.now().isoformat()

        # Build extracted entities response
        extracted_entities = None
        if entities:
            extracted_entities = ExtractedEntities(
                symptoms=[MedicalEntity(**e) for e in entities.get("symptoms", [])],
                diagnoses=[MedicalEntity(**e) for e in entities.get("diagnoses", [])],
                medications=[MedicalEntity(**e) for e in entities.get("medications", [])],
                vitals=[MedicalEntity(**e) for e in entities.get("vitals", [])],
                allergies=[MedicalEntity(**e) for e in entities.get("allergies", [])],
                procedures=[MedicalEntity(**e) for e in entities.get("procedures", [])],
                history=[MedicalEntity(**e) for e in entities.get("history", [])],
                labResults=[MedicalEntity(**e) for e in entities.get("labResults", [])],
            )

        return ProcessingResult(
            sessionId=session_id,
            status="processed",
            transcript=[TranscriptSegment(**seg) for seg in transcript_segments],
            fullTranscript=full_transcript,
            extractedEntities=extracted_entities,
            generatedNote=SoapNote(**soap_note) if soap_note else None,
            suggestedICD10Codes=[IcdCodeSuggestion(**code) for code in icd_codes] if icd_codes else None,
            suggestedCPTCodes=[CptCodeSuggestion(**code) for code in cpt_codes] if cpt_codes else None,
            keyFindings=key_findings,
            followUpRecommendations=[FollowUpRecommendation(**r) for r in follow_up_recommendations] if follow_up_recommendations else None,
            prescriptionSuggestions=[PrescriptionSuggestion(**p) for p in prescription_suggestions] if prescription_suggestions else None,
            duration=duration,
            processedAt=session["processedAt"],
            modelVersion=self.model_version,
            noteType=session.get("sessionType", "consultation"),
        )

    async def generate_note_from_text(
        self,
        text: str,
        note_type: str = "consultation",
        patient_info: Optional[Dict[str, Any]] = None,
        extract_entities: bool = True,
        suggest_codes: bool = True,
    ) -> Dict[str, Any]:
        """Generate structured note from text input (without audio transcription)"""

        # Create a temporary session
        session_id = str(uuid.uuid4())

        # Extract entities if requested
        entities = None
        if extract_entities:
            entities = await self._extract_entities(text)

        # Create basic segments from text
        segments = self._create_segments_from_text(text)

        # Generate SOAP note
        soap_note = await self._generate_soap_note(
            text,
            segments,
            entities,
            patient_info.get("name") if patient_info else None,
            note_type,
        )

        # Suggest codes
        icd_codes = None
        cpt_codes = None
        if suggest_codes:
            icd_codes = await self._suggest_icd_codes(text, soap_note)
            cpt_codes = await self._suggest_cpt_codes(text, soap_note, None, note_type)

        # Generate follow-up and prescription suggestions
        follow_up = await self._generate_follow_up_recommendations(text, soap_note, entities, icd_codes)
        prescriptions = await self._generate_prescription_suggestions(text, soap_note, entities, [], [])

        # Build extracted entities response
        extracted_entities = None
        if entities:
            extracted_entities = {
                "symptoms": [e for e in entities.get("symptoms", [])],
                "diagnoses": [e for e in entities.get("diagnoses", [])],
                "medications": [e for e in entities.get("medications", [])],
                "vitals": [e for e in entities.get("vitals", [])],
                "allergies": [e for e in entities.get("allergies", [])],
                "procedures": [e for e in entities.get("procedures", [])],
                "history": [e for e in entities.get("history", [])],
                "labResults": [e for e in entities.get("labResults", [])],
            }

        return {
            "success": True,
            "sessionId": session_id,
            "noteType": note_type,
            "extractedEntities": extracted_entities,
            "generatedNote": soap_note,
            "suggestedICD10Codes": icd_codes,
            "suggestedCPTCodes": cpt_codes,
            "keyFindings": self._extract_key_findings(text, entities),
            "followUpRecommendations": follow_up,
            "prescriptionSuggestions": prescriptions,
            "processedAt": datetime.now().isoformat(),
            "modelVersion": self.model_version,
        }

    async def extract_entities_from_text(self, text: str) -> Dict[str, Any]:
        """Extract clinical entities from text"""
        entities = await self._extract_entities(text)

        return {
            "success": True,
            "extractedEntities": entities,
            "keyFindings": self._extract_key_findings(text, entities),
            "processedAt": datetime.now().isoformat(),
            "modelVersion": self.model_version,
        }

    def _create_segments_from_text(self, text: str) -> List[Dict[str, Any]]:
        """Create basic segments from text for processing"""
        sentences = re.split(r'(?<=[.!?])\s+', text)
        segments = []
        current_time = 0.0

        for sentence in sentences:
            if sentence.strip():
                duration = len(sentence.split()) * 0.3
                segments.append({
                    "speaker": "Unknown",
                    "text": sentence.strip(),
                    "startTime": current_time,
                    "endTime": current_time + duration,
                    "confidence": 0.8,
                })
                current_time += duration + 0.2

        return segments

    async def _transcribe_audio(self, audio_data: bytes) -> Dict[str, Any]:
        """Transcribe audio using Whisper"""
        if not self.is_available():
            return {
                "success": False,
                "error": "OpenAI not available",
                "transcript": "",
            }

        if len(audio_data) < 1000:
            return {
                "success": False,
                "error": "Audio recording too short. Please speak for at least a few seconds.",
                "transcript": "",
            }

        try:
            # Save to temporary file
            with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as temp_file:
                temp_file.write(audio_data)
                temp_path = temp_file.name

            try:
                with open(temp_path, "rb") as audio_file:
                    result = openai_manager.transcribe_audio(
                        audio_file=audio_file,
                        language="en",
                        prompt=self.medical_prompt,
                    )

                if not result or not result.get("success"):
                    return {
                        "success": False,
                        "error": result.get("error", "Transcription failed") if result else "No response",
                    }

                segments = []
                raw_segments = result.get("segments", [])
                for seg in raw_segments:
                    if isinstance(seg, dict):
                        segments.append({
                            "start": seg.get("start", 0),
                            "end": seg.get("end", 0),
                            "text": seg.get("text", ""),
                            "confidence": seg.get("avg_logprob", 0.9),
                        })

                return {
                    "success": True,
                    "transcript": result.get("transcript", ""),
                    "duration": result.get("duration"),
                    "segments": segments,
                }
            finally:
                os.unlink(temp_path)

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "transcript": "",
            }

    def _perform_diarization(
        self,
        full_transcript: str,
        segments: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        Perform speaker diarization to identify Doctor vs Patient
        Uses heuristics and AI when available
        """
        if not segments:
            # Create basic segments from full transcript
            sentences = re.split(r'(?<=[.!?])\s+', full_transcript)
            segments = []
            current_time = 0.0
            for sentence in sentences:
                if sentence.strip():
                    duration = len(sentence.split()) * 0.4  # Rough estimate
                    segments.append({
                        "start": current_time,
                        "end": current_time + duration,
                        "text": sentence,
                        "confidence": 0.8,
                    })
                    current_time += duration + 0.5

        # Heuristic patterns for speaker identification
        doctor_patterns = [
            r"^(how|what|when|where|why|do you|are you|have you|can you)",
            r"(i recommend|i suggest|i think|let me|i'll|we should|we can|we need)",
            r"(prescription|medication|treatment|diagnosis|examination|test)",
            r"(take this|follow up|come back|schedule|refer you)",
        ]

        patient_patterns = [
            r"^(i feel|i have|i am|i've been|my \w+ hurts|it hurts)",
            r"(for about|for the past|since|started|began)",
            r"(pain|ache|discomfort|problem|issue|symptom|feeling)",
            r"(doctor|can you|is it|will it|should i)",
        ]

        diarized_segments = []
        last_speaker = "Doctor"  # Doctors typically start

        for seg in segments:
            text = seg.get("text", "").strip().lower()

            doctor_score = sum(1 for p in doctor_patterns if re.search(p, text, re.I))
            patient_score = sum(1 for p in patient_patterns if re.search(p, text, re.I))

            if doctor_score > patient_score:
                speaker = "Doctor"
            elif patient_score > doctor_score:
                speaker = "Patient"
            else:
                # Alternate if unclear
                speaker = "Patient" if last_speaker == "Doctor" else "Doctor"

            diarized_segments.append({
                "speaker": speaker,
                "text": seg.get("text", ""),
                "startTime": seg.get("start", 0),
                "endTime": seg.get("end", 0),
                "confidence": min(0.95, seg.get("confidence", 0.8) + 0.1 if doctor_score + patient_score > 0 else 0.7),
            })

            last_speaker = speaker

        return diarized_segments

    async def _extract_entities(self, transcript: str) -> Dict[str, List[Dict[str, Any]]]:
        """Extract medical entities from transcript"""

        entities = {
            "symptoms": [],
            "medications": [],
            "diagnoses": [],
            "vitals": [],
            "procedures": [],
            "allergies": [],
            "history": [],
        }

        if self.is_available():
            try:
                prompt = f"""Extract medical entities from this doctor-patient conversation.

Conversation:
{transcript}

Return a JSON object with these categories:
- symptoms: list of symptoms mentioned (e.g., "headache", "chest pain")
- medications: list of medications with dosages if mentioned
- diagnoses: list of conditions/diagnoses discussed
- vitals: any vital signs mentioned (BP, HR, temp, etc.)
- procedures: any procedures or tests mentioned
- allergies: any allergies mentioned
- history: relevant medical history mentioned

For each entity, include:
- value: the entity text
- confidence: high/medium/low
- context: brief context from conversation

Return only valid JSON."""

                api_result = openai_manager.chat_completion_json(
                    messages=[
                        {
                            "role": "system",
                            "content": "You are a medical entity extraction assistant. Extract structured medical information from clinical conversations. Return only valid JSON.",
                        },
                        {"role": "user", "content": prompt},
                    ],
                    task_complexity=TaskComplexity.SIMPLE,  # gpt-4o-mini
                    temperature=0.1,
                    max_tokens=1500,
                )

                if not api_result or not api_result.get("success"):
                    raise Exception(api_result.get("error", "Failed") if api_result else "No response")
                result = api_result.get("data", {})

                # Transform to our format
                for category in entities.keys():
                    if category in result and isinstance(result[category], list):
                        for item in result[category]:
                            if isinstance(item, str):
                                entities[category].append({
                                    "type": category,
                                    "value": item,
                                    "confidence": 0.8,
                                    "context": None,
                                })
                            elif isinstance(item, dict):
                                entities[category].append({
                                    "type": category,
                                    "value": item.get("value", str(item)),
                                    "confidence": {"high": 0.9, "medium": 0.7, "low": 0.5}.get(
                                        item.get("confidence", "medium"), 0.7
                                    ),
                                    "context": item.get("context"),
                                })

            except Exception as e:
                print(f"Entity extraction error: {e}")
                # Fall back to regex extraction
                entities = self._regex_entity_extraction(transcript)
        else:
            entities = self._regex_entity_extraction(transcript)

        return entities

    def _regex_entity_extraction(self, transcript: str) -> Dict[str, List[Dict[str, Any]]]:
        """Fallback regex-based entity extraction"""
        entities = {
            "symptoms": [],
            "medications": [],
            "diagnoses": [],
            "vitals": [],
            "procedures": [],
            "allergies": [],
            "history": [],
        }

        # Symptom patterns
        symptom_patterns = [
            r"(headache|fever|cough|pain|fatigue|nausea|dizziness|shortness of breath)",
            r"(chest pain|back pain|abdominal pain|joint pain)",
            r"(swelling|rash|itching|numbness|tingling)",
        ]
        for pattern in symptom_patterns:
            for match in re.finditer(pattern, transcript, re.I):
                entities["symptoms"].append({
                    "type": "symptoms",
                    "value": match.group(1),
                    "confidence": 0.7,
                    "context": None,
                })

        # Vital signs patterns
        bp_pattern = r"blood pressure[:\s]*([\d]+/[\d]+)"
        for match in re.finditer(bp_pattern, transcript, re.I):
            entities["vitals"].append({
                "type": "vitals",
                "value": f"BP: {match.group(1)}",
                "confidence": 0.9,
                "context": None,
            })

        hr_pattern = r"(?:heart rate|pulse|hr)[:\s]*([\d]+)"
        for match in re.finditer(hr_pattern, transcript, re.I):
            entities["vitals"].append({
                "type": "vitals",
                "value": f"HR: {match.group(1)}",
                "confidence": 0.9,
                "context": None,
            })

        # Allergy pattern
        allergy_pattern = r"allerg(?:y|ic)[:\s]+(?:to\s+)?([\w\s,]+)"
        for match in re.finditer(allergy_pattern, transcript, re.I):
            entities["allergies"].append({
                "type": "allergies",
                "value": match.group(1).strip(),
                "confidence": 0.8,
                "context": None,
            })

        return entities

    async def _generate_soap_note(
        self,
        transcript: str,
        segments: List[Dict[str, Any]],
        entities: Optional[Dict[str, List[Dict[str, Any]]]],
        patient_name: Optional[str] = None,
        note_type: str = "consultation",
    ) -> Dict[str, str]:
        """Generate SOAP note from conversation based on note type"""

        if not self.is_available():
            return self._generate_basic_soap(transcript, segments, entities, note_type)

        try:
            # Separate patient and doctor statements
            patient_statements = []
            doctor_statements = []

            for seg in segments:
                if seg.get("speaker") == "Patient":
                    patient_statements.append(seg.get("text", ""))
                else:
                    doctor_statements.append(seg.get("text", ""))

            entity_summary = ""
            if entities:
                entity_parts = []
                for category, items in entities.items():
                    if items:
                        values = [item.get("value", "") for item in items[:5]]
                        entity_parts.append(f"{category}: {', '.join(values)}")
                entity_summary = "\n".join(entity_parts)

            # Customize prompt based on note type
            note_type_instructions = {
                "consultation": "This is an initial consultation. Focus on comprehensive history and initial assessment.",
                "follow_up": "This is a follow-up visit. Focus on interval changes, treatment response, and medication adjustments.",
                "procedure": "This is a procedure note. Include procedure details, technique, findings, and any complications.",
                "discharge": "This is a discharge summary. Include hospital course, discharge medications, and follow-up instructions.",
            }

            type_instruction = note_type_instructions.get(note_type, note_type_instructions["consultation"])

            prompt = f"""Generate a professional SOAP note from this doctor-patient conversation.

Note Type: {note_type.upper()}
{type_instruction}

Patient Name: {patient_name or 'Not specified'}

CONVERSATION TRANSCRIPT:
{transcript}

PATIENT STATEMENTS:
{' '.join(patient_statements[:10])}

DOCTOR STATEMENTS:
{' '.join(doctor_statements[:10])}

{'EXTRACTED ENTITIES:' + chr(10) + entity_summary if entity_summary else ''}

Generate a complete SOAP note with these sections:
- SUBJECTIVE: Chief complaint, history of present illness, symptoms from patient's perspective, relevant history
- OBJECTIVE: Vital signs, physical examination findings, test results mentioned, observations
- ASSESSMENT: Clinical assessment, differential diagnoses, primary diagnosis with supporting rationale
- PLAN: Treatment plan, medications prescribed, procedures ordered, follow-up schedule, patient education provided

Use professional medical documentation style. Be thorough but concise.
If information is not mentioned, write "Not documented in this encounter."

Return as JSON with keys: subjective, objective, assessment, plan"""

            api_result = openai_manager.chat_completion_json(
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert medical scribe generating SOAP notes from doctor-patient conversations. Create professional, accurate clinical documentation following standard medical documentation practices. Return valid JSON only.",
                    },
                    {"role": "user", "content": prompt},
                ],
                task_complexity=TaskComplexity.SIMPLE,  # gpt-4o-mini
                temperature=0.3,
                max_tokens=2000,
            )

            if api_result and api_result.get("success"):
                result = api_result.get("data", {})
                return {
                    "subjective": result.get("subjective", "Not documented"),
                    "objective": result.get("objective", "Not documented"),
                    "assessment": result.get("assessment", "Not documented"),
                    "plan": result.get("plan", "Not documented"),
                }
            else:
                raise Exception(api_result.get("error", "Failed") if api_result else "No response")

        except Exception as e:
            print(f"SOAP generation error: {e}")
            return self._generate_basic_soap(transcript, segments, entities, note_type)

    def _generate_basic_soap(
        self,
        transcript: str,
        segments: List[Dict[str, Any]],
        entities: Optional[Dict[str, List[Dict[str, Any]]]],
        note_type: str = "consultation",
    ) -> Dict[str, str]:
        """Generate basic SOAP structure without AI"""

        patient_text = []
        doctor_text = []

        for seg in segments:
            if seg.get("speaker") == "Patient":
                patient_text.append(seg.get("text", ""))
            else:
                doctor_text.append(seg.get("text", ""))

        # Customize based on note type
        note_headers = {
            "consultation": ("Chief Complaint and HPI", "Initial Consultation"),
            "follow_up": ("Interval History", "Follow-up Visit"),
            "procedure": ("Procedure Indication", "Procedure Note"),
            "discharge": ("Hospital Course Summary", "Discharge Summary"),
        }

        header, title = note_headers.get(note_type, note_headers["consultation"])

        subjective = f"{header}:\n"
        if patient_text:
            subjective += " ".join(patient_text[:5])
        else:
            subjective += "[Patient statements from conversation]"

        if entities and entities.get("symptoms"):
            symptoms = [s.get("value", "") for s in entities["symptoms"][:5]]
            subjective += f"\n\nSymptoms: {', '.join(symptoms)}"

        objective = "Physical Examination:\n"
        if entities and entities.get("vitals"):
            vitals = [v.get("value", "") for v in entities["vitals"]]
            objective += f"Vital Signs: {', '.join(vitals)}\n"
        if entities and entities.get("labResults"):
            labs = [l.get("value", "") for l in entities["labResults"][:5]]
            objective += f"Lab Results: {', '.join(labs)}\n"
        objective += "[Additional examination findings to be documented]"

        assessment = "Assessment:\n"
        if entities and entities.get("diagnoses"):
            diagnoses = [d.get("value", "") for d in entities["diagnoses"]]
            assessment += f"Conditions: {', '.join(diagnoses)}"
        else:
            assessment += "[Clinical assessment to be documented]"

        plan = "Plan:\n"
        if entities and entities.get("medications"):
            meds = [m.get("value", "") for m in entities["medications"]]
            plan += f"Medications: {', '.join(meds)}\n"
        if entities and entities.get("procedures"):
            procs = [p.get("value", "") for p in entities["procedures"]]
            plan += f"Procedures: {', '.join(procs)}\n"
        plan += "[Treatment plan to be documented]"

        return {
            "subjective": subjective,
            "objective": objective,
            "assessment": assessment,
            "plan": plan,
        }

    async def _suggest_icd_codes(
        self,
        transcript: str,
        soap_note: Optional[Dict[str, str]],
    ) -> List[Dict[str, Any]]:
        """Suggest ICD-10 codes based on conversation and SOAP note"""

        codes = []

        # First, check for common conditions using local mapping
        text_to_check = transcript.lower()
        if soap_note:
            text_to_check += " " + soap_note.get("assessment", "").lower()

        found_codes = set()
        for condition, code_info in self.common_icd_codes.items():
            code, description, category = code_info
            if condition in text_to_check and code not in found_codes:
                found_codes.add(code)
                codes.append({
                    "code": code,
                    "description": description,
                    "confidence": "medium",
                    "supportingText": f"Matched condition: {condition}",
                    "category": category,
                })

        # Use AI for more sophisticated code suggestion
        if self.is_available():
            try:
                combined_text = transcript
                if soap_note:
                    combined_text += f"\n\nSOAP Note Assessment: {soap_note.get('assessment', '')}"

                prompt = f"""Based on this medical conversation and assessment, suggest appropriate ICD-10 diagnosis codes.

Text:
{combined_text[:3000]}

For each suggested code, provide:
- code: The ICD-10 code
- description: Code description
- confidence: high/medium/low
- supportingText: Quote from the text supporting this code

Return as JSON with a "codes" array. Only suggest codes clearly supported by the text.
Limit to 5 most relevant codes."""

                api_result = openai_manager.chat_completion_json(
                    messages=[
                        {
                            "role": "system",
                            "content": "You are a medical coding assistant. Suggest accurate ICD-10 codes based on clinical documentation. Only suggest codes clearly supported by the text.",
                        },
                        {"role": "user", "content": prompt},
                    ],
                    task_complexity=TaskComplexity.SIMPLE,  # gpt-4o-mini
                    temperature=0.2,
                    max_tokens=1000,
                )

                if api_result and api_result.get("success"):
                    result = api_result.get("data", {})
                else:
                    result = {}

                if "codes" in result:
                    for code_item in result["codes"]:
                        if code_item.get("code") not in found_codes:
                            codes.append({
                                "code": code_item.get("code", ""),
                                "description": code_item.get("description", ""),
                                "confidence": code_item.get("confidence", "medium"),
                                "supportingText": code_item.get("supportingText", ""),
                            })
                            found_codes.add(code_item.get("code"))

            except Exception as e:
                print(f"ICD code suggestion error: {e}")

        return codes[:8]  # Limit to 8 codes

    def _extract_key_findings(
        self,
        transcript: str,
        entities: Optional[Dict[str, List[Dict[str, Any]]]],
    ) -> List[str]:
        """Extract key clinical findings to highlight"""

        findings = []

        # Critical keywords to flag
        critical_keywords = [
            "severe", "acute", "emergency", "urgent", "critical",
            "chest pain", "shortness of breath", "syncope", "stroke",
            "heart attack", "hemorrhage", "fracture", "infection",
        ]

        transcript_lower = transcript.lower()

        for keyword in critical_keywords:
            if keyword in transcript_lower:
                # Find the sentence containing the keyword
                sentences = re.split(r'[.!?]', transcript)
                for sentence in sentences:
                    if keyword in sentence.lower():
                        findings.append(f"[ALERT] {sentence.strip()}")
                        break

        # Add significant entities
        if entities:
            if entities.get("symptoms"):
                symptoms = [s.get("value", "") for s in entities["symptoms"][:3]]
                if symptoms:
                    findings.append(f"Chief symptoms: {', '.join(symptoms)}")

            if entities.get("diagnoses"):
                diagnoses = [d.get("value", "") for d in entities["diagnoses"][:3]]
                if diagnoses:
                    findings.append(f"Discussed conditions: {', '.join(diagnoses)}")

            if entities.get("medications"):
                meds = [m.get("value", "") for m in entities["medications"][:3]]
                if meds:
                    findings.append(f"Medications mentioned: {', '.join(meds)}")

        return findings[:10]

    async def _suggest_cpt_codes(
        self,
        transcript: str,
        soap_note: Optional[Dict[str, str]],
        duration: Optional[float],
        session_type: str = "consultation",
    ) -> List[Dict[str, Any]]:
        """Suggest CPT codes based on the encounter"""

        codes = []
        found_codes = set()
        text_to_check = transcript.lower()
        if soap_note:
            text_to_check += " " + soap_note.get("plan", "").lower()

        # Determine E/M code based on session type and duration
        if session_type in ["consultation", "follow_up"]:
            # Estimate visit duration if not provided
            visit_duration = duration if duration else 20  # Default 20 minutes

            if session_type == "consultation":
                # New patient codes
                if visit_duration < 20:
                    code_key = "new_patient_office_low"
                elif visit_duration < 35:
                    code_key = "new_patient_office_mod"
                elif visit_duration < 50:
                    code_key = "new_patient_office_high"
                else:
                    code_key = "new_patient_office_comprehensive"
            else:
                # Established patient codes
                if visit_duration < 15:
                    code_key = "established_patient_office_low"
                elif visit_duration < 25:
                    code_key = "established_patient_office_mod"
                elif visit_duration < 35:
                    code_key = "established_patient_office_high"
                else:
                    code_key = "established_patient_office_comprehensive"

            if code_key in self.common_cpt_codes:
                code, description, category = self.common_cpt_codes[code_key]
                if code not in found_codes:
                    found_codes.add(code)
                    codes.append({
                        "code": code,
                        "description": description,
                        "confidence": "high",
                        "supportingText": f"Based on {session_type} visit, estimated duration: {int(visit_duration)} minutes",
                        "category": category,
                    })

        # Check for procedures and tests mentioned
        procedure_keywords = {
            "ecg": "ecg_with_interpretation",
            "ekg": "ecg_with_interpretation",
            "electrocardiogram": "ecg_with_interpretation",
            "blood draw": "venipuncture",
            "blood test": "venipuncture",
            "injection": "injection_therapeutic",
            "nebulizer": "nebulizer_treatment",
            "breathing treatment": "nebulizer_treatment",
            "spirometry": "spirometry",
            "pulse ox": "pulse_oximetry",
            "oxygen saturation": "pulse_oximetry",
            "strep test": "strep_test",
            "rapid strep": "strep_test",
            "flu test": "flu_test",
            "influenza test": "flu_test",
            "urinalysis": "urinalysis",
            "urine test": "urinalysis",
            "glucose": "glucose_test",
            "blood sugar": "glucose_test",
            "a1c": "hemoglobin_a1c",
            "hemoglobin a1c": "hemoglobin_a1c",
            "lipid panel": "lipid_panel",
            "cholesterol": "lipid_panel",
            "cbc": "cbc",
            "complete blood count": "cbc",
            "bmp": "bmp",
            "basic metabolic": "bmp",
            "cmp": "cmp",
            "comprehensive metabolic": "cmp",
            "thyroid": "tsh",
            "tsh": "tsh",
        }

        for keyword, code_key in procedure_keywords.items():
            if keyword in text_to_check and code_key in self.common_cpt_codes:
                code, description, category = self.common_cpt_codes[code_key]
                if code not in found_codes:
                    found_codes.add(code)
                    codes.append({
                        "code": code,
                        "description": description,
                        "confidence": "medium",
                        "supportingText": f"Matched keyword: {keyword}",
                        "category": category,
                    })

        return codes[:10]

    async def _generate_follow_up_recommendations(
        self,
        transcript: str,
        soap_note: Optional[Dict[str, str]],
        entities: Optional[Dict[str, List[Dict[str, Any]]]],
        icd_codes: Optional[List[Dict[str, Any]]],
    ) -> List[Dict[str, Any]]:
        """Generate follow-up recommendations based on the encounter"""

        recommendations = []

        # Check for chronic conditions that need regular follow-up
        chronic_conditions = {
            "diabetes": {"timeframe": "3 months", "reason": "Diabetes management and A1c monitoring", "priority": "routine", "tests": ["HbA1c", "BMP"]},
            "hypertension": {"timeframe": "1 month", "reason": "Blood pressure monitoring and medication adjustment", "priority": "routine", "tests": ["BMP"]},
            "heart failure": {"timeframe": "2 weeks", "reason": "Heart failure monitoring", "priority": "high", "tests": ["BNP", "BMP"]},
            "copd": {"timeframe": "3 months", "reason": "COPD management and lung function assessment", "priority": "routine", "tests": ["Spirometry"]},
            "asthma": {"timeframe": "3 months", "reason": "Asthma control assessment", "priority": "routine", "tests": []},
            "depression": {"timeframe": "4 weeks", "reason": "Mental health follow-up and medication assessment", "priority": "routine", "tests": []},
            "anxiety": {"timeframe": "4 weeks", "reason": "Anxiety management follow-up", "priority": "routine", "tests": []},
        }

        text_to_check = transcript.lower()
        if soap_note:
            text_to_check += " " + soap_note.get("assessment", "").lower()
            text_to_check += " " + soap_note.get("plan", "").lower()

        for condition, config in chronic_conditions.items():
            if condition in text_to_check:
                recommendations.append({
                    "timeframe": config["timeframe"],
                    "reason": config["reason"],
                    "priority": config["priority"],
                    "specialtyReferral": None,
                    "testsRequired": config["tests"] if config["tests"] else None,
                })

        # Check for acute conditions
        acute_conditions = {
            "infection": {"timeframe": "1 week", "reason": "Infection resolution assessment", "priority": "routine"},
            "pneumonia": {"timeframe": "1 week", "reason": "Pneumonia follow-up chest X-ray may be needed", "priority": "high", "specialty": "Pulmonology"},
            "chest pain": {"timeframe": "1 week", "reason": "Cardiac evaluation follow-up", "priority": "high", "specialty": "Cardiology"},
            "new medication": {"timeframe": "2 weeks", "reason": "New medication tolerance and effectiveness", "priority": "routine"},
        }

        for condition, config in acute_conditions.items():
            if condition in text_to_check:
                recommendations.append({
                    "timeframe": config["timeframe"],
                    "reason": config["reason"],
                    "priority": config["priority"],
                    "specialtyReferral": config.get("specialty"),
                    "testsRequired": None,
                })

        # Use AI for more sophisticated recommendations if available
        if self.is_available() and (not recommendations or len(recommendations) < 2):
            try:
                combined_text = transcript[:2000]
                if soap_note:
                    combined_text += f"\n\nAssessment: {soap_note.get('assessment', '')}"
                    combined_text += f"\n\nPlan: {soap_note.get('plan', '')}"

                prompt = f"""Based on this clinical encounter, suggest appropriate follow-up recommendations.

{combined_text}

Provide follow-up recommendations as JSON with a "recommendations" array. Each recommendation should have:
- timeframe: When to follow up (e.g., "1 week", "2 weeks", "1 month")
- reason: Brief reason for follow-up
- priority: "urgent", "high", "routine"
- specialtyReferral: If referral to specialist is needed, which specialty (or null)
- testsRequired: Array of tests needed before/at follow-up (or null)

Limit to 3 most important recommendations."""

                api_result = openai_manager.chat_completion_json(
                    messages=[
                        {
                            "role": "system",
                            "content": "You are a medical assistant helping to generate appropriate follow-up care recommendations. Return valid JSON.",
                        },
                        {"role": "user", "content": prompt},
                    ],
                    task_complexity=TaskComplexity.SIMPLE,  # gpt-4o-mini
                    temperature=0.3,
                    max_tokens=800,
                )

                if api_result and api_result.get("success"):
                    result = api_result.get("data", {})
                else:
                    result = {}

                if "recommendations" in result:
                    for rec in result["recommendations"][:3]:
                        recommendations.append({
                            "timeframe": rec.get("timeframe", "2 weeks"),
                            "reason": rec.get("reason", "Follow-up evaluation"),
                            "priority": rec.get("priority", "routine"),
                            "specialtyReferral": rec.get("specialtyReferral"),
                            "testsRequired": rec.get("testsRequired"),
                        })

            except Exception as e:
                print(f"Follow-up recommendation error: {e}")

        # Default recommendation if none found
        if not recommendations:
            recommendations.append({
                "timeframe": "As needed",
                "reason": "Return if symptoms worsen or new symptoms develop",
                "priority": "routine",
                "specialtyReferral": None,
                "testsRequired": None,
            })

        return recommendations[:5]

    async def _generate_prescription_suggestions(
        self,
        transcript: str,
        soap_note: Optional[Dict[str, str]],
        entities: Optional[Dict[str, List[Dict[str, Any]]]],
        known_allergies: List[str],
        current_medications: List[str],
    ) -> List[Dict[str, Any]]:
        """Generate prescription suggestions based on the encounter"""

        suggestions = []
        text_to_check = transcript.lower()
        if soap_note:
            text_to_check += " " + soap_note.get("assessment", "").lower()
            text_to_check += " " + soap_note.get("plan", "").lower()

        # Convert known allergies to lowercase for comparison
        allergies_lower = [a.lower() for a in known_allergies]

        # Check for conditions and suggest medications
        condition_mappings = [
            ("hypertension", "high blood pressure", "bp elevated", "blood pressure"),
            ("diabetes", "blood sugar", "glucose"),
            ("infection", "infected", "bacterial"),
            ("pain", "hurts", "ache", "sore"),
            ("anxiety", "anxious", "nervous", "panic"),
            ("depression", "depressed", "sad", "hopeless"),
            ("gerd", "reflux", "heartburn", "acid"),
            ("allergies", "allergic rhinitis", "hay fever", "seasonal allergies"),
            ("asthma", "wheezing", "bronchospasm"),
        ]

        conditions_found = set()
        for condition_group in condition_mappings:
            condition = condition_group[0]
            keywords = condition_group[1:] if len(condition_group) > 1 else [condition]
            for keyword in [condition] + list(keywords):
                if keyword in text_to_check:
                    conditions_found.add(condition)
                    break

        # Add medication suggestions based on conditions found
        for condition in conditions_found:
            if condition in self.medication_suggestions:
                for med in self.medication_suggestions[condition][:1]:  # Take first suggestion
                    med_name_lower = med["medication"].lower()

                    # Check for allergy conflicts
                    has_allergy = any(allergy in med_name_lower or med_name_lower in allergy for allergy in allergies_lower)

                    if has_allergy:
                        continue

                    # Check if already on this medication
                    already_taking = any(med_name_lower in curr.lower() for curr in current_medications)

                    warnings = []
                    if has_allergy:
                        warnings.append("ALLERGY ALERT - Check patient allergies")
                    if already_taking:
                        warnings.append("Patient may already be taking this medication")

                    suggestions.append({
                        "medication": med["medication"],
                        "dosage": med["dosage"],
                        "frequency": med["frequency"],
                        "duration": med["duration"],
                        "route": med["route"],
                        "instructions": "Take as directed",
                        "warnings": warnings if warnings else None,
                        "reason": f"For {condition} management",
                    })

        # Use AI for more sophisticated suggestions if available
        if self.is_available() and len(suggestions) < 2:
            try:
                combined_text = transcript[:2000]
                if soap_note:
                    combined_text += f"\n\nAssessment: {soap_note.get('assessment', '')}"
                    combined_text += f"\n\nPlan: {soap_note.get('plan', '')}"

                prompt = f"""Based on this clinical encounter, suggest appropriate prescription medications.

{combined_text}

Known Allergies: {', '.join(known_allergies) if known_allergies else 'None reported'}
Current Medications: {', '.join(current_medications) if current_medications else 'None reported'}

Provide prescription suggestions as JSON with a "prescriptions" array. Each prescription should have:
- medication: Drug name
- dosage: Dosage strength
- frequency: How often to take
- duration: Length of treatment
- route: Route of administration (Oral, Topical, etc.)
- instructions: Special instructions
- warnings: Array of warnings or null
- reason: Reason for prescribing

IMPORTANT: Do NOT suggest any medications that may conflict with patient's allergies.
Limit to 3 most appropriate medications."""

                api_result = openai_manager.chat_completion_json(
                    messages=[
                        {
                            "role": "system",
                            "content": "You are a medical assistant helping to suggest appropriate prescriptions. Always consider allergies and drug interactions. Return valid JSON.",
                        },
                        {"role": "user", "content": prompt},
                    ],
                    task_complexity=TaskComplexity.SIMPLE,  # gpt-4o-mini
                    temperature=0.3,
                    max_tokens=1000,
                )

                if api_result and api_result.get("success"):
                    result = api_result.get("data", {})
                else:
                    result = {}

                if "prescriptions" in result:
                    for rx in result["prescriptions"][:3]:
                        suggestions.append({
                            "medication": rx.get("medication", ""),
                            "dosage": rx.get("dosage", ""),
                            "frequency": rx.get("frequency", ""),
                            "duration": rx.get("duration", ""),
                            "route": rx.get("route", "Oral"),
                            "instructions": rx.get("instructions"),
                            "warnings": rx.get("warnings"),
                            "reason": rx.get("reason", "As clinically indicated"),
                        })

            except Exception as e:
                print(f"Prescription suggestion error: {e}")

        return suggestions[:5]

    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get session details"""
        return self.sessions.get(session_id)

    def get_templates(self) -> List[ScribeTemplate]:
        """Get available scribe templates"""
        return [
            ScribeTemplate(
                id="general-consultation",
                name="General Consultation",
                description="Standard outpatient consultation template for new patient visits",
                noteType="consultation",
                sections=["Chief Complaint", "HPI", "Past Medical History", "Medications", "Allergies", "ROS", "Physical Exam", "Assessment", "Plan"],
                prompts={
                    "chief_complaint": "What brings you in today?",
                    "duration": "How long have you had this problem?",
                    "severity": "On a scale of 1-10, how severe is it?",
                    "medications": "What medications are you currently taking?",
                    "allergies": "Do you have any allergies?",
                },
                requiredFields=["chiefComplaint", "hpi", "assessment", "plan"],
            ),
            ScribeTemplate(
                id="follow-up",
                name="Follow-up Visit",
                description="Template for follow-up appointments with established patients",
                noteType="follow_up",
                sections=["Interval History", "Current Symptoms", "Medication Review", "Vitals", "Physical Exam", "Assessment", "Plan"],
                prompts={
                    "improvement": "How have you been since last visit?",
                    "medication": "Are you taking your medications as prescribed?",
                    "side_effects": "Are you experiencing any side effects?",
                    "new_symptoms": "Any new symptoms or concerns?",
                },
                requiredFields=["intervalHistory", "medicationReview", "assessment", "plan"],
            ),
            ScribeTemplate(
                id="emergency",
                name="Emergency Encounter",
                description="Template for emergency department visits",
                noteType="consultation",
                sections=["Chief Complaint", "Triage", "HPI", "Physical Exam", "Diagnostic Workup", "MDM", "Disposition"],
                prompts={
                    "onset": "When did this start?",
                    "mechanism": "What happened?",
                    "severity": "How bad is the pain?",
                    "prior_treatment": "Have you tried anything for this?",
                },
                requiredFields=["chiefComplaint", "triage", "mdm", "disposition"],
            ),
            ScribeTemplate(
                id="procedure",
                name="Procedure Note",
                description="Template for procedure documentation",
                noteType="procedure",
                sections=["Indication", "Consent", "Anesthesia", "Procedure Details", "Findings", "Specimens", "Complications", "Disposition"],
                prompts={
                    "indication": "Reason for procedure",
                    "technique": "Describe the technique used",
                    "findings": "What were the findings?",
                    "complications": "Were there any complications?",
                },
                requiredFields=["indication", "consent", "procedureDetails", "findings"],
            ),
            ScribeTemplate(
                id="discharge",
                name="Discharge Summary",
                description="Template for hospital discharge documentation",
                noteType="discharge",
                sections=["Admission Diagnosis", "Hospital Course", "Procedures Performed", "Discharge Diagnosis", "Discharge Medications", "Follow-up Instructions", "Activity Restrictions"],
                prompts={
                    "course": "Summarize the hospital course",
                    "medications": "List discharge medications with instructions",
                    "follow_up": "When and with whom should patient follow up?",
                    "precautions": "What warning signs should prompt return?",
                },
                requiredFields=["admissionDiagnosis", "hospitalCourse", "dischargeDiagnosis", "dischargeMedications", "followUpInstructions"],
            ),
            ScribeTemplate(
                id="telehealth",
                name="Telehealth Visit",
                description="Template for telemedicine consultations",
                noteType="consultation",
                sections=["Chief Complaint", "HPI", "Visible Examination", "Assessment", "Plan", "Technology Notes"],
                prompts={
                    "chief_complaint": "What brings you in today?",
                    "visual_exam": "What can you observe on video?",
                    "limitations": "Any limitations to the virtual exam?",
                },
                requiredFields=["chiefComplaint", "hpi", "assessment", "plan"],
            ),
        ]


# ============= FastAPI Application =============

app = FastAPI(
    title="AI Scribe Service",
    description="Real-time medical conversation transcription and SOAP note generation",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize service
scribe_service = AIScribeService()


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "ai-scribe",
        "openai_available": scribe_service.is_available(),
        "version": scribe_service.model_version,
    }


@app.post("/api/scribe/start-session", response_model=StartSessionResponse)
async def start_session(request: StartSessionRequest):
    """Start a new scribe session"""
    try:
        return scribe_service.start_session(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/scribe/upload-audio")
async def upload_audio(
    sessionId: str = Form(...),
    chunkNumber: int = Form(default=0),
    isFinal: bool = Form(default=False),
    audio: UploadFile = File(...),
):
    """Upload audio chunk for processing"""
    try:
        audio_data = await audio.read()
        result = await scribe_service.upload_audio_chunk(
            session_id=sessionId,
            audio_data=audio_data,
            chunk_number=chunkNumber,
            is_final=isFinal,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/scribe/process", response_model=ProcessingResult)
async def process_recording(
    sessionId: str = Form(...),
    generateSoapNote: bool = Form(default=True),
    extractEntities: bool = Form(default=True),
    suggestIcdCodes: bool = Form(default=True),
    suggestCptCodes: bool = Form(default=True),
    generateFollowUp: bool = Form(default=True),
    generatePrescriptions: bool = Form(default=True),
    audio: UploadFile = File(None),
):
    """Process recording and generate documentation"""
    try:
        audio_data = None
        if audio:
            audio_data = await audio.read()

        result = await scribe_service.process_recording(
            session_id=sessionId,
            audio_data=audio_data,
            generate_soap=generateSoapNote,
            extract_entities=extractEntities,
            suggest_icd=suggestIcdCodes,
            suggest_cpt=suggestCptCodes,
            generate_follow_up=generateFollowUp,
            generate_prescriptions=generatePrescriptions,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/scribe/session/{session_id}")
async def get_session(session_id: str):
    """Get session details"""
    session = scribe_service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@app.post("/api/scribe/save-notes")
async def save_notes(request: SaveNotesRequest):
    """Save generated notes (placeholder for database integration)"""
    try:
        # In production, this would save to database
        return {
            "success": True,
            "sessionId": request.sessionId,
            "patientId": request.patientId,
            "savedAt": datetime.now().isoformat(),
            "message": "Notes saved successfully",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/scribe/templates")
async def get_templates():
    """Get available scribe templates"""
    templates = scribe_service.get_templates()
    return {
        "templates": [t.model_dump() for t in templates],
        "modelVersion": scribe_service.model_version,
    }


@app.post("/api/scribe/generate-note")
async def generate_note_from_text(request: GenerateNoteFromTextRequest):
    """Generate structured clinical note from text input"""
    try:
        result = await scribe_service.generate_note_from_text(
            text=request.text,
            note_type=request.noteType,
            patient_info=request.patientInfo,
            extract_entities=request.extractEntities,
            suggest_codes=request.suggestCodes,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/scribe/extract-entities")
async def extract_entities(request: ExtractEntitiesRequest):
    """Extract clinical entities from text"""
    try:
        result = await scribe_service.extract_entities_from_text(request.text)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/scribe/transcribe")
async def transcribe_audio(
    audio: UploadFile = File(...),
    language: str = Form(default="en"),
    sessionId: Optional[str] = Form(default=None),
):
    """Transcribe audio file using Whisper"""
    try:
        audio_data = await audio.read()

        # If session provided, use session context
        session = None
        if sessionId:
            session = scribe_service.get_session(sessionId)

        result = await scribe_service._transcribe_audio(audio_data)

        if not result["success"]:
            raise HTTPException(status_code=500, detail=result.get("error", "Transcription failed"))

        return {
            "success": True,
            "transcript": result["transcript"],
            "duration": result.get("duration"),
            "segments": result.get("segments", []),
            "sessionId": sessionId,
            "modelVersion": scribe_service.model_version,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run("service:app", host="0.0.0.0", port=8011, reload=True)
