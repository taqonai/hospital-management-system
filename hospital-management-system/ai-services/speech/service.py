"""
Speech-to-Text Service using OpenAI Whisper
Provides accurate transcription for medical terminology
"""

import os
import tempfile
from typing import Optional, Dict, Any
from pathlib import Path

try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    OpenAI = None


class SpeechToTextService:
    """
    Speech-to-text service using OpenAI Whisper API
    Optimized for medical terminology transcription
    """

    def __init__(self):
        self.openai_client = None
        self.openai_api_key = os.getenv("OPENAI_API_KEY")

        if OPENAI_AVAILABLE and self.openai_api_key:
            try:
                self.openai_client = OpenAI(api_key=self.openai_api_key)
                print("Whisper speech-to-text enabled")
            except Exception as e:
                print(f"Failed to initialize Whisper: {e}")
        else:
            print("Whisper not available - OpenAI API key required")

        # Medical terminology prompt to improve accuracy
        self.medical_prompt = """
        Medical transcription context: hospital management system, patient care,
        clinical terminology. Common terms include: patient, diagnosis, prescription,
        medication, laboratory, radiology, pharmacy, admission, discharge, vital signs,
        blood pressure, heart rate, temperature, CBC, BMP, CT scan, MRI, X-ray,
        ECG, EKG, troponin, hemoglobin, glucose, creatinine, BUN, lipid panel,
        thyroid, TSH, urinalysis, prothrombin, INR, antibiotics, analgesics,
        antipyretics, antihypertensives, diabetes, hypertension, COPD, pneumonia,
        myocardial infarction, stroke, sepsis, triage, emergency, ICU, ward, OPD, IPD.
        """

    def transcribe_audio(
        self,
        audio_data: bytes,
        filename: str = "audio.webm",
        language: str = "en",
        prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Transcribe audio using Whisper API

        Args:
            audio_data: Audio file bytes
            filename: Original filename with extension
            language: Language code (default: en)
            prompt: Optional context prompt for better accuracy

        Returns:
            Dict with transcript, confidence, and metadata
        """
        if not self.openai_client:
            return {
                "success": False,
                "error": "Whisper not available",
                "transcript": "",
                "confidence": 0.0
            }

        try:
            # Determine file extension
            ext = Path(filename).suffix.lower() or ".webm"

            # Create temporary file
            with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as temp_file:
                temp_file.write(audio_data)
                temp_path = temp_file.name

            try:
                # Use medical prompt for context
                context_prompt = prompt or self.medical_prompt

                # Call Whisper API
                with open(temp_path, "rb") as audio_file:
                    response = self.openai_client.audio.transcriptions.create(
                        model="whisper-1",
                        file=audio_file,
                        language=language,
                        prompt=context_prompt,
                        response_format="verbose_json"
                    )

                # Extract transcript and confidence
                transcript = response.text

                # Whisper doesn't provide confidence directly,
                # but verbose_json gives us segments with confidence
                segments = getattr(response, 'segments', []) or []
                if segments:
                    # Handle both dict and object segments
                    def get_confidence(seg):
                        if isinstance(seg, dict):
                            return seg.get('confidence', 0.9)
                        return getattr(seg, 'confidence', 0.9) if hasattr(seg, 'confidence') else 0.9

                    avg_confidence = sum(get_confidence(seg) for seg in segments) / len(segments)
                else:
                    avg_confidence = 0.95  # Default high confidence for Whisper

                # Convert segments to serializable format
                serializable_segments = []
                for seg in segments:
                    if isinstance(seg, dict):
                        serializable_segments.append(seg)
                    else:
                        serializable_segments.append({
                            "text": getattr(seg, 'text', ''),
                            "start": getattr(seg, 'start', 0),
                            "end": getattr(seg, 'end', 0),
                        })

                return {
                    "success": True,
                    "transcript": transcript,
                    "confidence": avg_confidence,
                    "language": language,
                    "duration": getattr(response, 'duration', None),
                    "segments": serializable_segments
                }

            finally:
                # Clean up temp file
                os.unlink(temp_path)

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "transcript": "",
                "confidence": 0.0
            }

    def transcribe_with_medical_context(
        self,
        audio_data: bytes,
        filename: str = "audio.webm",
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Transcribe audio with additional medical context

        Args:
            audio_data: Audio file bytes
            filename: Original filename
            context: Optional context (current module, patient info, etc.)

        Returns:
            Dict with transcript and metadata
        """
        # Build context-aware prompt
        prompt_parts = [self.medical_prompt]

        if context:
            if context.get("currentModule"):
                module = context["currentModule"]
                module_terms = {
                    "laboratory": "lab tests, CBC, BMP, cultures, specimens",
                    "pharmacy": "medications, prescriptions, dosages, drug interactions",
                    "radiology": "imaging, X-ray, CT, MRI, ultrasound, findings",
                    "emergency": "triage, ESI level, trauma, resuscitation",
                    "ipd": "admission, discharge, bed, ward, nursing",
                    "opd": "consultation, appointment, queue, follow-up",
                    "surgery": "operation, anesthesia, pre-op, post-op, OT",
                    "billing": "invoice, payment, insurance, claims",
                }
                if module.lower() in module_terms:
                    prompt_parts.append(f"Current context: {module_terms[module.lower()]}")

            if context.get("currentPatient"):
                prompt_parts.append(f"Patient context: {context['currentPatient']}")

        prompt = " ".join(prompt_parts)

        return self.transcribe_audio(
            audio_data=audio_data,
            filename=filename,
            prompt=prompt
        )

    def is_available(self) -> bool:
        """Check if Whisper service is available"""
        return self.openai_client is not None
