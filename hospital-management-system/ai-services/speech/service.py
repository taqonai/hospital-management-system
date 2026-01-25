"""
Speech-to-Text Service using OpenAI Whisper
Provides accurate transcription for medical terminology
"""

import tempfile
import time
import os
import logging
from typing import Optional, Dict, Any, List
from pathlib import Path

import httpx

# Import shared OpenAI client
from shared.openai_client import openai_manager, OPENAI_AVAILABLE

logger = logging.getLogger(__name__)

# Backend API URL for fetching drug names
BACKEND_API_URL = os.getenv("BACKEND_API_URL", "http://hms-backend:3001/api/v1")


class DrugNameCache:
    """
    Simple cache for drug names with TTL.
    Fetches drug names from the pharmacy database via backend API.
    """

    def __init__(self, ttl_seconds: int = 3600):  # 1 hour default TTL
        self._cache: List[str] = []
        self._last_fetch: float = 0
        self._ttl = ttl_seconds
        self._fetching = False

    def _is_expired(self) -> bool:
        return time.time() - self._last_fetch > self._ttl

    def get_drug_names(self) -> List[str]:
        """
        Get cached drug names. Returns empty list if cache is empty/expired.
        Use refresh() to update the cache.
        """
        if self._is_expired():
            return []
        return self._cache

    def refresh(self) -> bool:
        """
        Refresh the cache by fetching drug names from the backend API.
        Returns True if successful, False otherwise.
        """
        if self._fetching:
            return False

        self._fetching = True
        try:
            # Fetch drug names from backend pharmacy API
            response = httpx.get(
                f"{BACKEND_API_URL}/pharmacy/drugs",
                params={"isActive": "true"},
                timeout=10.0
            )

            if response.status_code == 200:
                data = response.json()
                drugs = data.get("data", [])

                # Extract unique drug names and generic names
                drug_names = set()
                for drug in drugs:
                    if drug.get("name"):
                        drug_names.add(drug["name"])
                    if drug.get("genericName"):
                        drug_names.add(drug["genericName"])
                    if drug.get("brandName"):
                        drug_names.add(drug["brandName"])

                self._cache = list(drug_names)
                self._last_fetch = time.time()
                logger.info(f"DrugNameCache: Loaded {len(self._cache)} drug names from database")
                return True
            else:
                logger.warning(f"DrugNameCache: Failed to fetch drugs, status={response.status_code}")
                return False

        except Exception as e:
            logger.error(f"DrugNameCache: Error fetching drug names: {e}")
            return False
        finally:
            self._fetching = False


# Global drug name cache instance
_drug_cache = DrugNameCache(ttl_seconds=3600)  # 1 hour TTL


class SpeechToTextService:
    """
    Speech-to-text service using OpenAI Whisper API
    Optimized for medical terminology transcription
    """

    def __init__(self):
        # Uses shared openai_manager
        if openai_manager.is_available():
            print("Whisper speech-to-text enabled via shared client")
        else:
            print("Whisper not available - OpenAI API key required")

        # Medical terminology prompt to improve accuracy (unchanged - used by other modules)
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

        # Fallback pharmacy prompt with common drug names (used if database fetch fails)
        self._fallback_pharmacy_prompt = """
        Medication and drug names transcription. Common medications include:
        Paracetamol, Panadol, Brufen, Ibuprofen, Aspirin, Amoxicillin, Augmentin,
        Azithromycin, Ciprofloxacin, Metformin, Omeprazole, Pantoprazole, Losartan,
        Amlodipine, Atenolol, Lisinopril, Metoprolol, Atorvastatin, Simvastatin,
        Clopidogrel, Warfarin, Enoxaparin, Insulin, Salbutamol, Ventolin, Symbicort,
        Prednisolone, Hydrocortisone, Dexamethasone, Diclofenac, Voltaren, Tramadol,
        Morphine, Codeine, Gabapentin, Pregabalin, Sertraline, Escitalopram,
        Diazepam, Lorazepam, Alprazolam, Cetirizine, Loratadine, Ranitidine,
        Domperidone, Metoclopramide, Lactulose, Bisacodyl, Multivitamin, Folic acid,
        Vitamin D, Calcium, Iron, Zinc. Dosage forms: tablet, capsule, syrup, injection,
        cream, ointment, drops, inhaler, suppository. Dosages: mg, ml, mcg, IU, units.
        """

    def _get_pharmacy_prompt(self) -> str:
        """
        Get pharmacy-specific prompt for medication transcription.
        Dynamically loads drug names from database, falls back to hardcoded list if unavailable.
        """
        # Try to get drug names from cache
        drug_names = _drug_cache.get_drug_names()

        # If cache is empty or expired, try to refresh
        if not drug_names:
            _drug_cache.refresh()
            drug_names = _drug_cache.get_drug_names()

        # If we have drug names from database, build dynamic prompt
        if drug_names:
            # Limit to 150 drug names to keep prompt reasonable size
            names_list = ", ".join(drug_names[:150])
            return f"""
            Medication and drug names transcription. Common medications include:
            {names_list}.
            Dosage forms: tablet, capsule, syrup, injection, cream, ointment, drops, inhaler, suppository.
            Dosages: mg, ml, mcg, IU, units.
            """

        # Fallback to hardcoded list if database fetch fails
        logger.info("Using fallback pharmacy prompt (database unavailable)")
        return self._fallback_pharmacy_prompt

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
        if not openai_manager.is_available():
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

                # Call Whisper API via shared client
                with open(temp_path, "rb") as audio_file:
                    result = openai_manager.transcribe_audio(
                        audio_file=audio_file,
                        language=language,
                        prompt=context_prompt
                    )

                # Handle result from shared client
                if not result or not result.get("success"):
                    return {
                        "success": False,
                        "error": result.get("error", "Transcription failed") if result else "No response",
                        "transcript": "",
                        "confidence": 0.0
                    }

                # Extract transcript and confidence
                transcript = result.get("transcript", "")
                segments = result.get("segments", [])

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
                    "duration": result.get("duration"),
                    "segments": serializable_segments
                }

            finally:
                # Clean up temp file
                import os
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
        # Use pharmacy-specific prompt for medication transcription (dynamic from database)
        if context and context.get("currentModule", "").lower() == "pharmacy":
            prompt_parts = [self._get_pharmacy_prompt()]
        else:
            prompt_parts = [self.medical_prompt]

        if context:
            if context.get("currentModule"):
                module = context["currentModule"]
                module_terms = {
                    "laboratory": "lab tests, CBC, BMP, cultures, specimens",
                    "pharmacy": "",  # Already using pharmacy_prompt
                    "radiology": "imaging, X-ray, CT, MRI, ultrasound, findings",
                    "emergency": "triage, ESI level, trauma, resuscitation",
                    "ipd": "admission, discharge, bed, ward, nursing",
                    "opd": "consultation, appointment, queue, follow-up",
                    "surgery": "operation, anesthesia, pre-op, post-op, OT",
                    "billing": "invoice, payment, insurance, claims",
                }
                if module.lower() in module_terms and module_terms[module.lower()]:
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
        return openai_manager.is_available()
