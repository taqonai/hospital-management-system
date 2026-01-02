"""Clinical Notes AI Service - AI-powered clinical documentation"""

import os
import re
import json
from typing import Dict, List, Any, Optional
from datetime import datetime
from openai import OpenAI

from .templates import (
    NOTE_TYPES,
    SYSTEM_PROMPTS,
    MEDICAL_ABBREVIATIONS,
    SOAP_NOTE_TEMPLATE,
    DISCHARGE_SUMMARY_TEMPLATE,
    PROGRESS_NOTE_TEMPLATE,
    PROCEDURE_NOTE_TEMPLATE,
    CONSULTATION_NOTE_TEMPLATE,
    ED_NOTE_TEMPLATE,
)


class ClinicalNotesAI:
    """AI-powered clinical documentation service"""

    def __init__(self):
        self.api_key = os.getenv("OPENAI_API_KEY")
        self.client = OpenAI(api_key=self.api_key) if self.api_key else None
        self.model = "gpt-4o-mini"  # Use GPT-4 for better medical understanding
        self.model_version = "clinical-notes-v1.0"

    def is_available(self) -> bool:
        """Check if OpenAI API is available"""
        return self.client is not None

    def generate_note(
        self,
        note_type: str,
        patient_info: Dict[str, Any],
        clinical_data: Dict[str, Any],
        additional_context: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generate a clinical note based on type and provided data

        Args:
            note_type: Type of note (soap, discharge, progress, procedure, consultation, emergency)
            patient_info: Patient demographics and identifiers
            clinical_data: Clinical information for the note
            additional_context: Any additional context or instructions

        Returns:
            Generated note with metadata
        """
        if note_type not in NOTE_TYPES:
            return {
                "success": False,
                "error": f"Unknown note type: {note_type}. Valid types: {list(NOTE_TYPES.keys())}",
                "modelVersion": self.model_version,
            }

        note_config = NOTE_TYPES[note_type]

        # Build the prompt
        prompt = self._build_generation_prompt(
            note_type, note_config, patient_info, clinical_data, additional_context
        )

        # If OpenAI is not available, generate a template-based note
        if not self.is_available():
            return self._generate_template_note(
                note_type, note_config, patient_info, clinical_data
            )

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": note_config["system_prompt"]},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.3,  # Lower temperature for more consistent medical documentation
                max_tokens=2000,
            )

            generated_note = response.choices[0].message.content

            return {
                "success": True,
                "noteType": note_type,
                "noteName": note_config["name"],
                "generatedNote": generated_note,
                "timestamp": datetime.now().isoformat(),
                "patientInfo": {
                    "name": patient_info.get("name", "Unknown"),
                    "mrn": patient_info.get("mrn", "N/A"),
                    "dob": patient_info.get("dob", "N/A"),
                },
                "modelVersion": self.model_version,
                "aiGenerated": True,
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "noteType": note_type,
                "modelVersion": self.model_version,
            }

    def enhance_note(
        self,
        existing_note: str,
        enhancement_type: str = "improve",
        instructions: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Enhance an existing clinical note

        Args:
            existing_note: The original note text
            enhancement_type: Type of enhancement (improve, expand, summarize, correct)
            instructions: Specific instructions for enhancement

        Returns:
            Enhanced note with changes highlighted
        """
        enhancement_prompts = {
            "improve": "Improve the clarity, completeness, and professional language of this note while maintaining factual accuracy:",
            "expand": "Expand this note with more detail where appropriate, adding relevant medical terminology:",
            "summarize": "Create a concise summary of this note, preserving all critical information:",
            "correct": "Review and correct any grammatical, spelling, or formatting issues in this note:",
            "structure": "Reorganize this note into a better structured format with clear sections:",
        }

        if enhancement_type not in enhancement_prompts:
            enhancement_type = "improve"

        base_prompt = enhancement_prompts[enhancement_type]
        full_prompt = f"{base_prompt}\n\n{existing_note}"

        if instructions:
            full_prompt += f"\n\nAdditional instructions: {instructions}"

        if not self.is_available():
            # Basic enhancement without AI
            return {
                "success": True,
                "originalNote": existing_note,
                "enhancedNote": self._basic_enhance(existing_note),
                "enhancementType": enhancement_type,
                "changes": ["Expanded abbreviations", "Improved formatting"],
                "modelVersion": self.model_version,
                "aiGenerated": False,
            }

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPTS["enhance"]},
                    {"role": "user", "content": full_prompt},
                ],
                temperature=0.3,
                max_tokens=2000,
            )

            enhanced_note = response.choices[0].message.content

            return {
                "success": True,
                "originalNote": existing_note,
                "enhancedNote": enhanced_note,
                "enhancementType": enhancement_type,
                "timestamp": datetime.now().isoformat(),
                "modelVersion": self.model_version,
                "aiGenerated": True,
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "modelVersion": self.model_version,
            }

    def summarize_notes(
        self,
        notes: List[str],
        summary_type: str = "comprehensive",
    ) -> Dict[str, Any]:
        """
        Summarize multiple clinical notes

        Args:
            notes: List of note texts to summarize
            summary_type: Type of summary (comprehensive, brief, timeline)

        Returns:
            Summarized content
        """
        summary_instructions = {
            "comprehensive": "Create a comprehensive summary covering all important clinical information:",
            "brief": "Create a brief executive summary with only the most critical points:",
            "timeline": "Create a chronological timeline of clinical events:",
            "problem_list": "Extract and organize all problems/diagnoses mentioned:",
        }

        instruction = summary_instructions.get(summary_type, summary_instructions["comprehensive"])

        combined_notes = "\n\n---\n\n".join([f"Note {i+1}:\n{note}" for i, note in enumerate(notes)])
        prompt = f"{instruction}\n\n{combined_notes}"

        if not self.is_available():
            return {
                "success": True,
                "summary": f"Summary of {len(notes)} clinical notes (AI unavailable - basic summary)",
                "noteCount": len(notes),
                "summaryType": summary_type,
                "modelVersion": self.model_version,
                "aiGenerated": False,
            }

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPTS["summarize"]},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.3,
                max_tokens=1500,
            )

            summary = response.choices[0].message.content

            return {
                "success": True,
                "summary": summary,
                "noteCount": len(notes),
                "summaryType": summary_type,
                "timestamp": datetime.now().isoformat(),
                "modelVersion": self.model_version,
                "aiGenerated": True,
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "modelVersion": self.model_version,
            }

    def extract_entities(self, note_text: str) -> Dict[str, Any]:
        """
        Extract structured medical entities from clinical text

        Args:
            note_text: The clinical note text to analyze

        Returns:
            Extracted entities (diagnoses, medications, procedures, vitals, labs)
        """
        prompt = f"""Extract all medical entities from this clinical note and return them in JSON format:

{note_text}

Return a JSON object with these categories:
- diagnoses: list of diagnoses/conditions mentioned
- medications: list of medications with dosages if mentioned
- procedures: list of procedures performed or planned
- vitals: any vital signs mentioned (BP, HR, RR, Temp, O2)
- labs: any laboratory values mentioned
- allergies: any allergies mentioned
- symptoms: chief complaints and symptoms
- assessments: clinical assessments made
- plans: planned actions or treatments"""

        if not self.is_available():
            # Basic regex extraction without AI
            return {
                "success": True,
                "entities": self._basic_entity_extraction(note_text),
                "modelVersion": self.model_version,
                "aiGenerated": False,
            }

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPTS["extract"]},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.1,
                max_tokens=1500,
                response_format={"type": "json_object"},
            )

            entities_text = response.choices[0].message.content
            entities = json.loads(entities_text)

            return {
                "success": True,
                "entities": entities,
                "timestamp": datetime.now().isoformat(),
                "modelVersion": self.model_version,
                "aiGenerated": True,
            }

        except json.JSONDecodeError:
            return {
                "success": False,
                "error": "Failed to parse extracted entities",
                "modelVersion": self.model_version,
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "modelVersion": self.model_version,
            }

    def transcription_to_note(
        self,
        transcription: str,
        note_type: str = "soap",
        patient_info: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Convert voice transcription to structured clinical note

        Args:
            transcription: Raw voice transcription text
            note_type: Target note format
            patient_info: Optional patient information

        Returns:
            Structured clinical note
        """
        if note_type not in NOTE_TYPES:
            note_type = "soap"

        note_config = NOTE_TYPES[note_type]

        prompt = f"""Convert this voice transcription into a properly structured {note_config['name']}.

Voice Transcription:
{transcription}

{f"Patient: {patient_info.get('name', 'Unknown')}, MRN: {patient_info.get('mrn', 'N/A')}" if patient_info else ""}

Requirements:
- Organize the information into the appropriate sections for a {note_config['name']}
- Use proper medical terminology
- Expand any abbreviations appropriately
- Maintain clinical accuracy
- Format professionally"""

        if not self.is_available():
            return {
                "success": True,
                "originalTranscription": transcription,
                "structuredNote": self._basic_transcription_to_note(transcription, note_type),
                "noteType": note_type,
                "modelVersion": self.model_version,
                "aiGenerated": False,
            }

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": note_config["system_prompt"]},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.3,
                max_tokens=2000,
            )

            structured_note = response.choices[0].message.content

            return {
                "success": True,
                "originalTranscription": transcription,
                "structuredNote": structured_note,
                "noteType": note_type,
                "noteName": note_config["name"],
                "timestamp": datetime.now().isoformat(),
                "modelVersion": self.model_version,
                "aiGenerated": True,
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "modelVersion": self.model_version,
            }

    def suggest_icd_codes(self, note_text: str) -> Dict[str, Any]:
        """
        Suggest ICD-10 codes based on clinical note content

        Args:
            note_text: Clinical note to analyze

        Returns:
            Suggested ICD-10 codes with confidence
        """
        prompt = f"""Analyze this clinical note and suggest appropriate ICD-10 diagnosis codes.

Clinical Note:
{note_text}

For each suggested code, provide:
- ICD-10 code
- Description
- Confidence level (high, medium, low)
- Supporting text from the note

Return as JSON with a "codes" array."""

        if not self.is_available():
            return {
                "success": True,
                "codes": [],
                "message": "AI unavailable - manual coding required",
                "modelVersion": self.model_version,
                "aiGenerated": False,
            }

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a medical coding assistant. Suggest accurate ICD-10 codes based on clinical documentation. Only suggest codes that are clearly supported by the documentation.",
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.2,
                max_tokens=1000,
                response_format={"type": "json_object"},
            )

            codes_text = response.choices[0].message.content
            codes_data = json.loads(codes_text)

            return {
                "success": True,
                "codes": codes_data.get("codes", []),
                "timestamp": datetime.now().isoformat(),
                "modelVersion": self.model_version,
                "aiGenerated": True,
                "disclaimer": "AI-suggested codes require verification by certified medical coder",
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "modelVersion": self.model_version,
            }

    def get_note_templates(self) -> Dict[str, Any]:
        """Get available note templates and their configurations"""
        templates = {}
        for key, config in NOTE_TYPES.items():
            templates[key] = {
                "name": config["name"],
                "description": config["description"],
                "requiredFields": config["required_fields"],
            }
        return {
            "templates": templates,
            "modelVersion": self.model_version,
        }

    def expand_abbreviations(self, text: str) -> Dict[str, Any]:
        """Expand medical abbreviations in text"""
        expanded_text = text
        expansions = []

        for abbrev, full in MEDICAL_ABBREVIATIONS.items():
            # Case-insensitive word boundary matching
            pattern = r'\b' + re.escape(abbrev) + r'\b'
            if re.search(pattern, expanded_text, re.IGNORECASE):
                expanded_text = re.sub(
                    pattern,
                    f"{full} ({abbrev.upper()})",
                    expanded_text,
                    flags=re.IGNORECASE,
                )
                expansions.append({"abbreviation": abbrev.upper(), "expansion": full})

        return {
            "success": True,
            "originalText": text,
            "expandedText": expanded_text,
            "expansions": expansions,
            "expansionCount": len(expansions),
            "modelVersion": self.model_version,
        }

    # Private helper methods

    def _build_generation_prompt(
        self,
        note_type: str,
        note_config: Dict,
        patient_info: Dict,
        clinical_data: Dict,
        additional_context: Optional[str],
    ) -> str:
        """Build the prompt for note generation"""
        prompt_parts = [
            f"Generate a {note_config['name']} based on the following information:",
            "",
            "PATIENT INFORMATION:",
            f"- Name: {patient_info.get('name', 'Unknown')}",
            f"- MRN: {patient_info.get('mrn', 'N/A')}",
            f"- DOB: {patient_info.get('dob', 'N/A')}",
            f"- Age: {patient_info.get('age', 'N/A')}",
            f"- Gender: {patient_info.get('gender', 'N/A')}",
            "",
            "CLINICAL DATA:",
        ]

        for key, value in clinical_data.items():
            if isinstance(value, list):
                prompt_parts.append(f"- {key}: {', '.join(str(v) for v in value)}")
            elif isinstance(value, dict):
                prompt_parts.append(f"- {key}:")
                for k, v in value.items():
                    prompt_parts.append(f"  - {k}: {v}")
            else:
                prompt_parts.append(f"- {key}: {value}")

        if additional_context:
            prompt_parts.extend(["", "ADDITIONAL CONTEXT:", additional_context])

        prompt_parts.extend([
            "",
            f"Generate a complete, professional {note_config['name']} using standard medical documentation format.",
        ])

        return "\n".join(prompt_parts)

    def _generate_template_note(
        self,
        note_type: str,
        note_config: Dict,
        patient_info: Dict,
        clinical_data: Dict,
    ) -> Dict[str, Any]:
        """Generate a basic template-based note without AI"""
        template = note_config["template"]

        # Combine patient info and clinical data
        all_data = {**patient_info, **clinical_data}

        # Fill in available fields, use placeholder for missing
        for field in note_config["required_fields"]:
            if field not in all_data:
                all_data[field] = f"[{field.upper()} - TO BE COMPLETED]"

        # Try to fill template
        try:
            filled_note = template.format(**all_data)
        except KeyError:
            # If template has more fields, use basic format
            filled_note = f"{note_config['name'].upper()}\n\n"
            filled_note += f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n"
            filled_note += f"Patient: {patient_info.get('name', 'Unknown')}\n"
            filled_note += f"MRN: {patient_info.get('mrn', 'N/A')}\n\n"

            for key, value in clinical_data.items():
                filled_note += f"{key.upper()}:\n{value}\n\n"

        return {
            "success": True,
            "noteType": note_type,
            "noteName": note_config["name"],
            "generatedNote": filled_note,
            "timestamp": datetime.now().isoformat(),
            "modelVersion": self.model_version,
            "aiGenerated": False,
            "message": "Template-based note (AI unavailable)",
        }

    def _basic_enhance(self, text: str) -> str:
        """Basic text enhancement without AI"""
        enhanced = text

        # Expand abbreviations
        for abbrev, full in MEDICAL_ABBREVIATIONS.items():
            pattern = r'\b' + re.escape(abbrev) + r'\b'
            enhanced = re.sub(
                pattern,
                full,
                enhanced,
                flags=re.IGNORECASE,
            )

        # Basic formatting improvements
        enhanced = re.sub(r'\n{3,}', '\n\n', enhanced)  # Remove excessive newlines
        enhanced = enhanced.strip()

        return enhanced

    def _basic_entity_extraction(self, text: str) -> Dict[str, List[str]]:
        """Basic entity extraction using regex patterns"""
        entities = {
            "diagnoses": [],
            "medications": [],
            "procedures": [],
            "vitals": [],
            "labs": [],
            "allergies": [],
            "symptoms": [],
        }

        # Look for vital signs patterns
        bp_pattern = r'\b(BP|blood pressure)[:\s]*(\d+/\d+)\b'
        hr_pattern = r'\b(HR|heart rate|pulse)[:\s]*(\d+)\b'
        temp_pattern = r'\b(temp|temperature)[:\s]*([\d.]+)\b'

        for match in re.finditer(bp_pattern, text, re.IGNORECASE):
            entities["vitals"].append(f"BP: {match.group(2)}")
        for match in re.finditer(hr_pattern, text, re.IGNORECASE):
            entities["vitals"].append(f"HR: {match.group(2)}")
        for match in re.finditer(temp_pattern, text, re.IGNORECASE):
            entities["vitals"].append(f"Temp: {match.group(2)}")

        # Look for allergy section
        allergy_pattern = r'allerg(?:y|ies)[:\s]*([^.\n]+)'
        for match in re.finditer(allergy_pattern, text, re.IGNORECASE):
            entities["allergies"].append(match.group(1).strip())

        return entities

    def _basic_transcription_to_note(self, transcription: str, note_type: str) -> str:
        """Convert transcription to basic note structure"""
        note_config = NOTE_TYPES.get(note_type, NOTE_TYPES["soap"])

        note = f"{note_config['name'].upper()}\n"
        note += f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n"
        note += "=" * 50 + "\n\n"
        note += "TRANSCRIBED CONTENT:\n"
        note += transcription + "\n\n"
        note += "[Note: Please review and organize into proper format]\n"

        return note
