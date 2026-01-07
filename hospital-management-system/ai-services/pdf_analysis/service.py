"""
PDF Analysis Service using GPT-4
Handles both text-based and image-based (scanned) PDF medical reports
"""

import os
import io
import base64
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

try:
    import fitz  # PyMuPDF
    PYMUPDF_AVAILABLE = True
except ImportError:
    PYMUPDF_AVAILABLE = False
    fitz = None

# Import shared OpenAI client
from shared.openai_client import openai_manager, TaskComplexity, OPENAI_AVAILABLE

from PIL import Image

logger = logging.getLogger(__name__)


class PDFAnalysisService:
    """
    AI-powered PDF analysis service for medical reports
    Supports both text extraction and image-based analysis
    """

    def __init__(self):
        self.model_version = "1.0.0-pdf"

    @staticmethod
    def is_available() -> bool:
        """Check if service is available"""
        return openai_manager.is_available() and PYMUPDF_AVAILABLE

    def analyze_pdf(
        self,
        pdf_data: bytes,
        document_type: str = "medical_report",
        extract_entities: bool = True,
        patient_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Analyze a PDF document

        Args:
            pdf_data: PDF file bytes
            document_type: Type of document (medical_report, lab_result, radiology_report, prescription, discharge_summary)
            extract_entities: Whether to extract medical entities
            patient_context: Optional patient context for better analysis

        Returns:
            Analysis results with extracted information
        """
        if not self.is_available():
            return {
                "success": False,
                "error": "PDF analysis service not available",
                "modelVersion": self.model_version
            }

        try:
            # Open PDF
            doc = fitz.open(stream=pdf_data, filetype="pdf")
            page_count = len(doc)
            logger.info(f"Processing PDF with {page_count} pages")

            # Extract text from all pages
            full_text = ""
            for page_num in range(page_count):
                page = doc[page_num]
                text = page.get_text()
                full_text += f"\n--- Page {page_num + 1} ---\n{text}"

            # Check if PDF has meaningful text content
            text_density = len(full_text.strip()) / max(page_count, 1)
            is_text_based = text_density > 100  # More than 100 chars per page average

            logger.info(f"PDF text density: {text_density:.0f} chars/page, text-based: {is_text_based}")

            if is_text_based:
                # Use text-based analysis (faster and cheaper)
                result = self._analyze_text(full_text, document_type, extract_entities, patient_context)
            else:
                # Convert pages to images and use vision analysis
                images = self._pdf_to_images(doc)
                result = self._analyze_images(images, document_type, extract_entities, patient_context)

            doc.close()

            # Add metadata
            result["pageCount"] = page_count
            result["analysisMethod"] = "text" if is_text_based else "vision"
            result["modelVersion"] = self.model_version
            result["documentType"] = document_type
            result["timestamp"] = datetime.now().isoformat()

            return result

        except Exception as e:
            logger.error(f"PDF analysis failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "modelVersion": self.model_version
            }

    def _pdf_to_images(self, doc, max_pages: int = 10, dpi: int = 150) -> List[str]:
        """Convert PDF pages to base64 encoded images"""
        images = []

        for page_num in range(min(len(doc), max_pages)):
            page = doc[page_num]
            # Render page to image
            mat = fitz.Matrix(dpi / 72, dpi / 72)
            pix = page.get_pixmap(matrix=mat)

            # Convert to PIL Image
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)

            # Convert to base64
            buffer = io.BytesIO()
            img.save(buffer, format="PNG")
            img_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
            images.append(img_base64)

            logger.info(f"Converted page {page_num + 1} to image ({pix.width}x{pix.height})")

        return images

    def _analyze_text(
        self,
        text: str,
        document_type: str,
        extract_entities: bool,
        patient_context: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Analyze text-based PDF content"""

        # Build the analysis prompt
        prompt = self._build_text_prompt(document_type, extract_entities, patient_context)

        try:
            result = openai_manager.chat_completion(
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": f"Please analyze this medical document:\n\n{text[:15000]}"}  # Limit text length
                ],
                task_complexity=TaskComplexity.SIMPLE,  # gpt-4o-mini for text
                max_tokens=3000,
                temperature=0.3
            )

            if result and result.get("success"):
                result_text = result.get("content", "")
                return self._parse_analysis_response(result_text, "text")
            else:
                return {"success": False, "error": result.get("error", "Analysis failed") if result else "No response"}

        except Exception as e:
            logger.error(f"Text analysis failed: {e}")
            return {"success": False, "error": str(e)}

    def _analyze_images(
        self,
        images: List[str],
        document_type: str,
        extract_entities: bool,
        patient_context: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Analyze image-based PDF content using GPT-4 Vision"""

        prompt = self._build_vision_prompt(document_type, extract_entities, patient_context)

        try:
            # Build content with all images
            content = [{"type": "text", "text": prompt}]

            for i, img_base64 in enumerate(images[:5]):  # Limit to 5 pages for vision
                content.append({
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/png;base64,{img_base64}",
                        "detail": "high"
                    }
                })

            # Use gpt-4o for vision analysis via shared client
            if not openai_manager.client:
                return {"success": False, "error": "OpenAI client not initialized"}

            response = openai_manager.client.chat.completions.create(
                model="gpt-4o",  # GPT-4 Vision model
                messages=[{"role": "user", "content": content}],
                max_tokens=3000,
                temperature=0.3
            )

            result_text = response.choices[0].message.content
            return self._parse_analysis_response(result_text, "vision")

        except Exception as e:
            logger.error(f"Vision analysis failed: {e}")
            return {"success": False, "error": str(e)}

    def _build_text_prompt(
        self,
        document_type: str,
        extract_entities: bool,
        patient_context: Optional[Dict[str, Any]]
    ) -> str:
        """Build prompt for text-based analysis"""

        doc_type_prompts = {
            "medical_report": "You are analyzing a medical report. Extract key clinical findings, diagnoses, and recommendations.",
            "lab_result": "You are analyzing laboratory test results. Extract test names, values, reference ranges, and flag abnormal results.",
            "radiology_report": "You are analyzing a radiology report. Extract imaging findings, impressions, and recommendations.",
            "prescription": "You are analyzing a prescription. Extract medication names, dosages, frequencies, and duration.",
            "discharge_summary": "You are analyzing a discharge summary. Extract admission diagnosis, procedures performed, discharge diagnosis, medications, and follow-up instructions.",
            "pathology_report": "You are analyzing a pathology report. Extract specimen type, findings, diagnosis, and staging if applicable.",
            "consultation_note": "You are analyzing a consultation note. Extract chief complaint, findings, assessment, and plan."
        }

        base_prompt = doc_type_prompts.get(document_type, doc_type_prompts["medical_report"])

        prompt = f"""{base_prompt}

Please provide your analysis in the following JSON format:
{{
    "summary": "Brief summary of the document (2-3 sentences)",
    "documentDate": "Date from document if found, or null",
    "keyFindings": ["List of key findings"],
    "diagnoses": ["List of diagnoses mentioned"],
    "medications": ["List of medications with dosages"],
    "labResults": [
        {{"test": "test name", "value": "value", "unit": "unit", "referenceRange": "range", "abnormal": true/false}}
    ],
    "recommendations": ["List of recommendations or next steps"],
    "urgentFindings": ["Any critical or urgent findings that need immediate attention"],
    "extractedEntities": {{
        "conditions": ["medical conditions"],
        "procedures": ["procedures mentioned"],
        "anatomicalSites": ["body parts/organs mentioned"],
        "clinicians": ["doctor/clinician names"]
    }},
    "confidence": 0.0-1.0
}}

Only include fields that are relevant to the document type. If a field doesn't apply, omit it or set to null/empty array."""

        if patient_context:
            prompt += f"\n\nPatient context: {patient_context}"

        return prompt

    def _build_vision_prompt(
        self,
        document_type: str,
        extract_entities: bool,
        patient_context: Optional[Dict[str, Any]]
    ) -> str:
        """Build prompt for vision-based analysis"""

        prompt = f"""You are analyzing a scanned medical document ({document_type}).
Please carefully read all text visible in the image(s) and extract the relevant medical information.

Provide your analysis in JSON format:
{{
    "summary": "Brief summary of the document",
    "documentDate": "Date if visible",
    "keyFindings": ["Key findings from the document"],
    "diagnoses": ["Diagnoses mentioned"],
    "medications": ["Medications with dosages"],
    "labResults": [{{"test": "name", "value": "value", "abnormal": true/false}}],
    "recommendations": ["Recommendations"],
    "urgentFindings": ["Critical findings"],
    "ocrConfidence": "high/medium/low based on image quality",
    "confidence": 0.0-1.0
}}

If parts of the document are illegible, note this in your response."""

        if patient_context:
            prompt += f"\n\nPatient context: {patient_context}"

        return prompt

    def _parse_analysis_response(self, response_text: str, method: str) -> Dict[str, Any]:
        """Parse the GPT response into structured data"""
        import json

        # Clean response
        response_text = response_text.strip()
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]

        try:
            analysis = json.loads(response_text.strip())
            analysis["success"] = True
            analysis["source"] = f"gpt-4-{method}"
            return analysis
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse JSON response: {e}")
            # Return raw text as summary
            return {
                "success": True,
                "summary": response_text[:1000],
                "keyFindings": [response_text[:500]],
                "source": f"gpt-4-{method}-text",
                "parseError": True
            }

    def analyze_pdf_url(
        self,
        pdf_url: str,
        document_type: str = "medical_report",
        **kwargs
    ) -> Dict[str, Any]:
        """Analyze PDF from URL"""
        import httpx

        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
            with httpx.Client(timeout=60.0, follow_redirects=True) as client:
                response = client.get(pdf_url, headers=headers)
                if response.status_code == 200:
                    return self.analyze_pdf(response.content, document_type, **kwargs)
                else:
                    return {
                        "success": False,
                        "error": f"Failed to download PDF: HTTP {response.status_code}"
                    }
        except Exception as e:
            return {"success": False, "error": f"Failed to download PDF: {e}"}


# Singleton instance
pdf_analyzer = PDFAnalysisService()
