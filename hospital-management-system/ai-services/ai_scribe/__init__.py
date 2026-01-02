"""
AI Scribe Service - Real-time medical conversation transcription and clinical documentation

Features:
- Audio transcription with speaker diarization (Doctor/Patient)
- Clinical entity extraction (symptoms, diagnoses, medications, vitals, allergies)
- Automatic SOAP note generation
- Multiple note types: Consultation, Follow-up, Procedure, Discharge
- ICD-10 and CPT code suggestions
- Follow-up recommendations
- Prescription suggestions based on diagnoses
"""

from .service import (
    AIScribeService,
    app,
    StartSessionRequest,
    StartSessionResponse,
    ProcessRecordingRequest,
    ProcessingResult,
    TranscriptSegment,
    MedicalEntity,
    ExtractedEntities,
    IcdCodeSuggestion,
    CptCodeSuggestion,
    SoapNote,
    FollowUpRecommendation,
    PrescriptionSuggestion,
    SaveNotesRequest,
    ScribeTemplate,
    GenerateNoteFromTextRequest,
    ExtractEntitiesRequest,
)

__all__ = [
    'AIScribeService',
    'app',
    'StartSessionRequest',
    'StartSessionResponse',
    'ProcessRecordingRequest',
    'ProcessingResult',
    'TranscriptSegment',
    'MedicalEntity',
    'ExtractedEntities',
    'IcdCodeSuggestion',
    'CptCodeSuggestion',
    'SoapNote',
    'FollowUpRecommendation',
    'PrescriptionSuggestion',
    'SaveNotesRequest',
    'ScribeTemplate',
    'GenerateNoteFromTextRequest',
    'ExtractEntitiesRequest',
]
