"""
Entity Extraction AI Service
Extracts structured data from natural language for Patient, Doctor, and Appointment creation

Uses GPT-4o-mini for intelligent extraction with regex fallback.
"""

import re
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict

# Import shared OpenAI client
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from shared.openai_client import openai_manager, TaskComplexity

logger = logging.getLogger(__name__)


@dataclass
class ExtractionResult:
    """Result of entity extraction"""
    entity_type: str  # 'patient', 'doctor', 'appointment'
    data: Dict[str, Any]
    confidence: float
    missing_fields: List[str]
    raw_text: str


class EntityExtractionAI:
    """AI service for extracting entities from natural language text

    Uses GPT-4o-mini for intelligent extraction with regex-based fallback.
    """

    def __init__(self):
        self.model_version = "2.0.0-gpt4"
        # Intent patterns for entity type detection
        self.intent_patterns = {
            'patient': [
                r'\b(register|add|create|new)\s+(a\s+)?(new\s+)?patient\b',
                r'\bpatient\s+(registration|entry|record)\b',
                r'\b(admit|enroll)\s+(a\s+)?(new\s+)?patient\b',
            ],
            'doctor': [
                r'\b(register|add|create|new)\s+(a\s+)?(new\s+)?doctor\b',
                r'\b(add|register)\s+(a\s+)?dr\.?\b',
                r'\bdoctor\s+(registration|entry|record)\b',
                r'\b(hire|onboard)\s+(a\s+)?(new\s+)?doctor\b',
            ],
            'appointment': [
                r'\b(book|schedule|create|make)\s+(an?\s+)?appointment\b',
                r'\bappointment\s+(for|with)\b',
                r'\b(schedule|book)\s+(a\s+)?consultation\b',
                r'\b(schedule|book)\s+(a\s+)?visit\b',
            ],
        }

        # Gender patterns
        self.gender_patterns = {
            'MALE': [r'\bmale\b', r'\bman\b', r'\bboy\b', r'\bhe\b', r'\bhis\b', r'\bgentleman\b', r'\bmr\.?\b'],
            'FEMALE': [r'\bfemale\b', r'\bwoman\b', r'\bgirl\b', r'\bshe\b', r'\bher\b', r'\blady\b', r'\bmrs\.?\b', r'\bms\.?\b', r'\bmiss\b'],
        }

        # Medical specializations
        self.specializations = [
            'cardiology', 'cardiologist',
            'orthopedics', 'orthopedic', 'orthopaedics',
            'pediatrics', 'pediatrician', 'paediatrics',
            'gynecology', 'gynecologist', 'gynaecology', 'obgyn', 'ob-gyn',
            'dermatology', 'dermatologist',
            'ophthalmology', 'ophthalmologist', 'eye specialist',
            'ent', 'otolaryngology', 'ear nose throat',
            'neurology', 'neurologist',
            'psychiatry', 'psychiatrist',
            'urology', 'urologist',
            'oncology', 'oncologist',
            'gastroenterology', 'gastroenterologist',
            'pulmonology', 'pulmonologist',
            'nephrology', 'nephrologist',
            'endocrinology', 'endocrinologist',
            'rheumatology', 'rheumatologist',
            'emergency medicine', 'emergency',
            'anesthesiology', 'anesthesiologist',
            'radiology', 'radiologist',
            'pathology', 'pathologist',
            'general surgery', 'surgeon', 'surgery',
            'general medicine', 'general physician', 'general practice', 'gp',
            'internal medicine', 'internist',
        ]

        # Department mapping
        self.department_map = {
            'cardiology': 'Cardiology', 'cardiologist': 'Cardiology',
            'orthopedics': 'Orthopedics', 'orthopedic': 'Orthopedics', 'orthopaedics': 'Orthopedics',
            'pediatrics': 'Pediatrics', 'pediatrician': 'Pediatrics', 'paediatrics': 'Pediatrics',
            'gynecology': 'Gynecology', 'gynecologist': 'Gynecology', 'gynaecology': 'Gynecology', 'obgyn': 'Gynecology',
            'dermatology': 'Dermatology', 'dermatologist': 'Dermatology',
            'ophthalmology': 'Ophthalmology', 'ophthalmologist': 'Ophthalmology', 'eye specialist': 'Ophthalmology',
            'ent': 'ENT', 'otolaryngology': 'ENT', 'ear nose throat': 'ENT',
            'neurology': 'Neurology', 'neurologist': 'Neurology',
            'psychiatry': 'Psychiatry', 'psychiatrist': 'Psychiatry',
            'emergency': 'Emergency', 'emergency medicine': 'Emergency',
            'surgery': 'Surgery', 'surgeon': 'Surgery', 'general surgery': 'Surgery',
            'radiology': 'Radiology', 'radiologist': 'Radiology',
            'general medicine': 'OPD', 'general physician': 'OPD', 'gp': 'OPD',
            'internal medicine': 'IPD', 'internist': 'IPD',
        }

        # Blood group patterns
        self.blood_groups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-',
                            'A positive', 'A negative', 'B positive', 'B negative',
                            'AB positive', 'AB negative', 'O positive', 'O negative']

        # Month names for date parsing
        self.months = {
            'january': 1, 'jan': 1, 'february': 2, 'feb': 2, 'march': 3, 'mar': 3,
            'april': 4, 'apr': 4, 'may': 5, 'june': 6, 'jun': 6,
            'july': 7, 'jul': 7, 'august': 8, 'aug': 8, 'september': 9, 'sep': 9, 'sept': 9,
            'october': 10, 'oct': 10, 'november': 11, 'nov': 11, 'december': 12, 'dec': 12
        }

    def is_available(self) -> bool:
        """Check if AI-powered extraction is available"""
        return openai_manager.is_available()

    # ==================== AI-POWERED EXTRACTION ====================

    def _ai_extract_patient(self, text: str) -> Optional[Dict[str, Any]]:
        """AI-powered patient data extraction using GPT-4o-mini"""
        prompt = f"""Extract patient registration information from this text and return as JSON.

Text: "{text}"

Return a JSON object with these fields (use null for missing fields):
{{
    "firstName": "string or null",
    "lastName": "string or null",
    "gender": "MALE" or "FEMALE" or "OTHER" or null,
    "dateOfBirth": "YYYY-MM-DD format or null",
    "phone": "digits only, no formatting or null",
    "email": "email or null",
    "bloodGroup": "A_POSITIVE, A_NEGATIVE, B_POSITIVE, B_NEGATIVE, AB_POSITIVE, AB_NEGATIVE, O_POSITIVE, O_NEGATIVE or null",
    "address": "string or null"
}}

Be precise and only extract information explicitly stated in the text."""

        result = openai_manager.chat_completion_json(
            messages=[{"role": "user", "content": prompt}],
            task_complexity=TaskComplexity.SIMPLE,
            max_tokens=500,
            temperature=0.1
        )

        if result and result.get("success"):
            return result.get("data")
        return None

    def _ai_extract_doctor(self, text: str) -> Optional[Dict[str, Any]]:
        """AI-powered doctor data extraction using GPT-4o-mini"""
        prompt = f"""Extract doctor registration information from this text and return as JSON.

Text: "{text}"

Return a JSON object with these fields (use null for missing fields):
{{
    "firstName": "string or null",
    "lastName": "string or null",
    "email": "email or null",
    "phone": "digits only or null",
    "specialization": "medical specialty or null",
    "department": "department name or null",
    "experience": "number of years or null",
    "licenseNumber": "string or null",
    "consultationFee": "number or null"
}}

Be precise and only extract information explicitly stated in the text."""

        result = openai_manager.chat_completion_json(
            messages=[{"role": "user", "content": prompt}],
            task_complexity=TaskComplexity.SIMPLE,
            max_tokens=500,
            temperature=0.1
        )

        if result and result.get("success"):
            return result.get("data")
        return None

    def _ai_extract_appointment(self, text: str) -> Optional[Dict[str, Any]]:
        """AI-powered appointment data extraction using GPT-4o-mini"""
        today = datetime.now().strftime('%Y-%m-%d')
        prompt = f"""Extract appointment booking information from this text and return as JSON.

Text: "{text}"
Today's date: {today}

Return a JSON object with these fields (use null for missing fields):
{{
    "patientName": "full name or null",
    "doctorName": "include Dr. prefix if doctor, or null",
    "appointmentDate": "YYYY-MM-DD format, interpret 'today', 'tomorrow', 'next Monday' etc. relative to today's date, or null",
    "appointmentTime": "HH:MM 24-hour format, or null",
    "department": "department name or null",
    "reason": "appointment reason/symptoms or null"
}}

Be precise and only extract information explicitly stated in the text."""

        result = openai_manager.chat_completion_json(
            messages=[{"role": "user", "content": prompt}],
            task_complexity=TaskComplexity.SIMPLE,
            max_tokens=500,
            temperature=0.1
        )

        if result and result.get("success"):
            return result.get("data")
        return None

    def _ai_detect_intent(self, text: str) -> Tuple[str, float]:
        """AI-powered intent detection using GPT-4o-mini"""
        prompt = f"""Classify this text into one category: patient, doctor, or appointment.

Text: "{text}"

Return JSON: {{"entityType": "patient" or "doctor" or "appointment", "confidence": 0.0-1.0}}

- "patient": registering a new patient, patient details, patient admission
- "doctor": registering a new doctor, doctor details, hiring a physician
- "appointment": booking an appointment, scheduling a visit, consultation booking"""

        result = openai_manager.chat_completion_json(
            messages=[{"role": "user", "content": prompt}],
            task_complexity=TaskComplexity.SIMPLE,
            max_tokens=100,
            temperature=0.1
        )

        if result and result.get("success"):
            data = result.get("data", {})
            entity_type = data.get("entityType", "unknown")
            confidence = float(data.get("confidence", 0.5))
            return entity_type, confidence

        return "unknown", 0.3

    # ==================== REGEX-BASED EXTRACTION (FALLBACK) ====================

    def detect_intent(self, text: str) -> Tuple[str, float]:
        """Detect the entity type from text"""
        text_lower = text.lower()

        for entity_type, patterns in self.intent_patterns.items():
            for pattern in patterns:
                if re.search(pattern, text_lower):
                    return entity_type, 0.95

        # Fallback: check for entity-specific keywords
        if any(word in text_lower for word in ['patient', 'admit', 'registration']):
            return 'patient', 0.7
        elif any(word in text_lower for word in ['doctor', 'dr.', 'physician', 'specialist']):
            return 'doctor', 0.7
        elif any(word in text_lower for word in ['appointment', 'schedule', 'book', 'consultation']):
            return 'appointment', 0.7

        return 'unknown', 0.3

    def extract_name(self, text: str) -> Dict[str, str]:
        """Extract first and last name from text"""
        result = {'firstName': '', 'lastName': ''}
        text_clean = text.strip()

        # Pattern: "first name X, last name Y" or "first name: X last name: Y"
        first_match = re.search(r'first\s*name[:\s]+([A-Za-z]+)', text_clean, re.IGNORECASE)
        last_match = re.search(r'last\s*name[:\s]+([A-Za-z]+)', text_clean, re.IGNORECASE)

        if first_match:
            result['firstName'] = first_match.group(1).capitalize()
        if last_match:
            result['lastName'] = last_match.group(1).capitalize()

        if result['firstName'] and result['lastName']:
            return result

        # Pattern: "patient/doctor [Name Name]" or "named [Name Name]"
        name_patterns = [
            r'(?:patient|doctor|dr\.?|named|name is|name:?)\s+([A-Z][a-z]+)\s+([A-Z][a-z]+)',
            r'(?:register|add|create|book for)\s+(?:new\s+)?(?:patient|doctor)?\s*([A-Z][a-z]+)\s+([A-Z][a-z]+)',
        ]

        for pattern in name_patterns:
            match = re.search(pattern, text_clean, re.IGNORECASE)
            if match:
                result['firstName'] = match.group(1).capitalize()
                result['lastName'] = match.group(2).capitalize()
                return result

        # Fallback: Find capitalized name pairs
        # Look for "Name Name" pattern (two consecutive capitalized words)
        cap_names = re.findall(r'\b([A-Z][a-z]+)\s+([A-Z][a-z]+)\b', text_clean)

        # Filter out common non-name pairs
        skip_words = {'Dr', 'Mr', 'Mrs', 'Ms', 'Miss', 'January', 'February', 'March', 'April',
                      'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December',
                      'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'}

        for first, last in cap_names:
            if first not in skip_words and last not in skip_words:
                result['firstName'] = first
                result['lastName'] = last
                return result

        return result

    def extract_date(self, text: str, is_dob: bool = False) -> Optional[str]:
        """Extract date from natural language text"""
        text_lower = text.lower()
        today = datetime.now()

        # ISO format: YYYY-MM-DD
        iso_match = re.search(r'\b(\d{4})-(\d{2})-(\d{2})\b', text)
        if iso_match:
            return iso_match.group(0)

        # US format: MM/DD/YYYY or MM-DD-YYYY
        us_match = re.search(r'\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b', text)
        if us_match:
            month, day, year = int(us_match.group(1)), int(us_match.group(2)), int(us_match.group(3))
            if 1 <= month <= 12 and 1 <= day <= 31:
                return f"{year:04d}-{month:02d}-{day:02d}"

        # Natural language: "January 15, 1985" or "15 January 1985"
        for month_name, month_num in self.months.items():
            # "Month DD YYYY" or "Month DD, YYYY"
            pattern1 = rf'\b{month_name}\s+(\d{{1,2}}),?\s+(\d{{4}})\b'
            match = re.search(pattern1, text_lower)
            if match:
                day, year = int(match.group(1)), int(match.group(2))
                if 1 <= day <= 31:
                    return f"{year:04d}-{month_num:02d}-{day:02d}"

            # "DD Month YYYY"
            pattern2 = rf'\b(\d{{1,2}})\s+{month_name},?\s+(\d{{4}})\b'
            match = re.search(pattern2, text_lower)
            if match:
                day, year = int(match.group(1)), int(match.group(2))
                if 1 <= day <= 31:
                    return f"{year:04d}-{month_num:02d}-{day:02d}"

        # For appointments: relative dates
        if not is_dob:
            if 'today' in text_lower:
                return today.strftime('%Y-%m-%d')
            elif 'tomorrow' in text_lower:
                return (today + timedelta(days=1)).strftime('%Y-%m-%d')
            elif 'day after tomorrow' in text_lower:
                return (today + timedelta(days=2)).strftime('%Y-%m-%d')

            # "next Monday", "this Friday", etc.
            days_of_week = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
            for i, day_name in enumerate(days_of_week):
                if f'next {day_name}' in text_lower or f'this {day_name}' in text_lower:
                    current_day = today.weekday()
                    days_ahead = i - current_day
                    if days_ahead <= 0:
                        days_ahead += 7
                    if f'next {day_name}' in text_lower:
                        days_ahead += 7
                    return (today + timedelta(days=days_ahead)).strftime('%Y-%m-%d')

        return None

    def extract_time(self, text: str) -> Optional[str]:
        """Extract time from natural language text"""
        text_lower = text.lower()

        # 24-hour format: HH:MM
        match_24 = re.search(r'\b(\d{1,2}):(\d{2})\b', text)
        if match_24:
            hour, minute = int(match_24.group(1)), int(match_24.group(2))
            if 0 <= hour <= 23 and 0 <= minute <= 59:
                return f"{hour:02d}:{minute:02d}"

        # 12-hour format: "9am", "3:30pm", "10 AM"
        match_12 = re.search(r'\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)\b', text_lower)
        if match_12:
            hour = int(match_12.group(1))
            minute = int(match_12.group(2)) if match_12.group(2) else 0
            period = match_12.group(3).replace('.', '')

            if period.startswith('p') and hour != 12:
                hour += 12
            elif period.startswith('a') and hour == 12:
                hour = 0

            if 0 <= hour <= 23 and 0 <= minute <= 59:
                return f"{hour:02d}:{minute:02d}"

        # Time words
        time_words = {
            'morning': '09:00',
            'noon': '12:00',
            'afternoon': '14:00',
            'evening': '17:00',
        }

        for word, time_val in time_words.items():
            if word in text_lower:
                return time_val

        return None

    def extract_phone(self, text: str) -> Optional[str]:
        """Extract and normalize phone number"""
        # Remove common separators and find digits
        patterns = [
            r'\b(?:phone|tel|mobile|cell|contact)?[:\s]*(\+?\d[\d\s\-().]{8,})\b',
            r'\b(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})\b',
            r'\b(\d{10,})\b',
        ]

        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                phone = re.sub(r'[^\d+]', '', match.group(1))
                if len(phone) >= 10:
                    return phone

        return None

    def extract_email(self, text: str) -> Optional[str]:
        """Extract email address"""
        match = re.search(r'\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,})\b', text)
        return match.group(1).lower() if match else None

    def extract_gender(self, text: str) -> Optional[str]:
        """Extract gender from text"""
        text_lower = text.lower()

        for gender, patterns in self.gender_patterns.items():
            for pattern in patterns:
                if re.search(pattern, text_lower):
                    return gender

        return None

    def extract_blood_group(self, text: str) -> Optional[str]:
        """Extract blood group from text"""
        text_upper = text.upper()

        # Direct match
        for bg in self.blood_groups:
            if bg.upper() in text_upper or bg.upper().replace(' ', '') in text_upper:
                # Normalize to format like "A_POSITIVE"
                bg_clean = bg.upper().replace('+', '_POSITIVE').replace('-', '_NEGATIVE')
                bg_clean = bg_clean.replace(' POSITIVE', '_POSITIVE').replace(' NEGATIVE', '_NEGATIVE')
                return bg_clean

        return None

    def extract_specialization(self, text: str) -> Optional[str]:
        """Extract medical specialization"""
        text_lower = text.lower()

        for spec in self.specializations:
            if spec in text_lower:
                # Return normalized specialization name
                return spec.replace('ist', 'y').replace('ian', 'ics').title()

        return None

    def extract_department(self, text: str) -> Optional[str]:
        """Extract department from text"""
        text_lower = text.lower()

        for key, dept in self.department_map.items():
            if key in text_lower:
                return dept

        return None

    def extract_experience(self, text: str) -> Optional[int]:
        """Extract years of experience"""
        patterns = [
            r'(\d+)\s*(?:years?|yrs?)\s*(?:of\s+)?experience',
            r'experience[:\s]+(\d+)\s*(?:years?|yrs?)?',
            r'(\d+)\s*(?:years?|yrs?)\s+practicing',
        ]

        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return int(match.group(1))

        return None

    def extract_license(self, text: str) -> Optional[str]:
        """Extract license number"""
        patterns = [
            r'license\s*(?:number|no\.?|#)?[:\s]*([A-Za-z0-9\-]+)',
            r'(?:MD|DO|MBBS|registration)\s*(?:number|no\.?|#)?[:\s]*([A-Za-z0-9\-]+)',
        ]

        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1).upper()

        return None

    def extract_fee(self, text: str) -> Optional[float]:
        """Extract consultation fee"""
        patterns = [
            r'(?:consultation\s+)?fee[:\s]*\$?(\d+(?:\.\d{2})?)',
            r'\$(\d+(?:\.\d{2})?)\s*(?:per\s+)?(?:consultation|visit)?',
            r'(\d+)\s*(?:dollars?|usd)',
        ]

        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return float(match.group(1))

        return None

    def extract_reason(self, text: str) -> Optional[str]:
        """Extract appointment reason/symptoms"""
        # Look for common symptoms/reasons first (more reliable)
        symptoms = [
            'chest pain', 'back pain', 'knee pain', 'headache', 'migraine',
            'fever', 'cough', 'cold', 'flu', 'sore throat',
            'stomach pain', 'abdominal pain', 'nausea', 'vomiting',
            'checkup', 'follow up', 'follow-up', 'consultation',
            'diabetes', 'hypertension', 'asthma', 'allergy',
            'injury', 'fracture', 'sprain', 'dizziness', 'fatigue'
        ]

        text_lower = text.lower()
        for symptom in symptoms:
            if symptom in text_lower:
                # Extract a bit more context around the symptom
                match = re.search(rf'(?:\w+\s+)?{re.escape(symptom)}(?:\s+\w+)?', text, re.IGNORECASE)
                if match:
                    return match.group(0).strip()

        # Try pattern matching for explicit reason statements
        patterns = [
            r'(?:reason|because of|due to|complaint)[:\s]+([^,\.]{3,30})',
            r'(?:suffering from|has|having|experiencing)\s+([^,\.]{3,30})',
        ]

        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                reason = match.group(1).strip()
                # Filter out name-like patterns
                if not re.match(r'^[A-Z][a-z]+\s+(?:with|and|or)', reason):
                    return reason

        return None

    def extract_patient_data(self, text: str, context: Optional[Dict[str, Any]] = None) -> ExtractionResult:
        """Extract all patient-related data from text"""
        data = {}
        missing = []

        # Extract name
        name = self.extract_name(text)
        if name.get('firstName'):
            data['firstName'] = name['firstName']
        else:
            missing.append('firstName')

        if name.get('lastName'):
            data['lastName'] = name['lastName']
        else:
            missing.append('lastName')

        # Extract other fields
        gender = self.extract_gender(text)
        if gender:
            data['gender'] = gender
        else:
            missing.append('gender')

        dob = self.extract_date(text, is_dob=True)
        if dob:
            data['dateOfBirth'] = dob
        else:
            missing.append('dateOfBirth')

        phone = self.extract_phone(text)
        if phone:
            data['phone'] = phone
        else:
            missing.append('phone')

        email = self.extract_email(text)
        if email:
            data['email'] = email

        blood_group = self.extract_blood_group(text)
        if blood_group:
            data['bloodGroup'] = blood_group

        # Calculate confidence based on extracted fields
        required_fields = ['firstName', 'lastName', 'gender', 'dateOfBirth', 'phone']
        found_required = sum(1 for f in required_fields if f in data)
        confidence = found_required / len(required_fields)

        return ExtractionResult(
            entity_type='patient',
            data=data,
            confidence=confidence,
            missing_fields=missing,
            raw_text=text
        )

    def extract_doctor_data(self, text: str, context: Optional[Dict[str, Any]] = None) -> ExtractionResult:
        """Extract all doctor-related data from text"""
        data = {}
        missing = []

        # Extract name
        name = self.extract_name(text)
        if name.get('firstName'):
            data['firstName'] = name['firstName']
        else:
            missing.append('firstName')

        if name.get('lastName'):
            data['lastName'] = name['lastName']
        else:
            missing.append('lastName')

        # Extract other fields
        email = self.extract_email(text)
        if email:
            data['email'] = email
        else:
            missing.append('email')

        phone = self.extract_phone(text)
        if phone:
            data['phone'] = phone

        specialization = self.extract_specialization(text)
        if specialization:
            data['specialization'] = specialization
        else:
            missing.append('specialization')

        department = self.extract_department(text)
        if department:
            data['department'] = department

        experience = self.extract_experience(text)
        if experience is not None:
            data['experience'] = experience

        license_num = self.extract_license(text)
        if license_num:
            data['licenseNumber'] = license_num
        else:
            missing.append('licenseNumber')

        fee = self.extract_fee(text)
        if fee is not None:
            data['consultationFee'] = fee

        # Calculate confidence
        required_fields = ['firstName', 'lastName', 'email', 'specialization', 'licenseNumber']
        found_required = sum(1 for f in required_fields if f in data)
        confidence = found_required / len(required_fields)

        return ExtractionResult(
            entity_type='doctor',
            data=data,
            confidence=confidence,
            missing_fields=missing,
            raw_text=text
        )

    def extract_appointment_data(self, text: str, context: Optional[Dict[str, Any]] = None) -> ExtractionResult:
        """Extract all appointment-related data from text"""
        data = {}
        missing = []

        # Extract patient name
        # Look for "for [Name]" or "patient [Name]"
        patient_match = re.search(r'(?:for|patient)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)', text)
        if patient_match:
            data['patientName'] = patient_match.group(1)
        else:
            missing.append('patientName')

        # Extract doctor name
        # Look for "with Dr. [Name]" or "doctor [Name]"
        doctor_patterns = [
            r'(?:with\s+)?[Dd]r\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)',  # "with Dr. Wilson" or "Dr. Wilson"
            r'[Dd]octor\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)',  # "Doctor Brown" or "doctor Wilson"
            r'(?:physician|specialist)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)',  # "physician Smith"
        ]
        for pattern in doctor_patterns:
            doctor_match = re.search(pattern, text)
            if doctor_match:
                doctor_name = doctor_match.group(1)
                # Skip if the matched name is a common word
                if doctor_name.lower() not in ['the', 'a', 'an', 'my', 'our', 'your']:
                    data['doctorName'] = 'Dr. ' + doctor_name
                    break

        # Extract date and time
        date = self.extract_date(text, is_dob=False)
        if date:
            data['appointmentDate'] = date
        else:
            missing.append('appointmentDate')

        time = self.extract_time(text)
        if time:
            data['appointmentTime'] = time
        else:
            missing.append('appointmentTime')

        # Extract department
        department = self.extract_department(text)
        if department:
            data['department'] = department

        # Extract reason
        reason = self.extract_reason(text)
        if reason:
            data['reason'] = reason

        # Calculate confidence
        required_fields = ['patientName', 'appointmentDate', 'appointmentTime']
        found_required = sum(1 for f in required_fields if f in data)
        confidence = found_required / len(required_fields)

        return ExtractionResult(
            entity_type='appointment',
            data=data,
            confidence=confidence,
            missing_fields=missing,
            raw_text=text
        )

    def parse_creation_intent(self, text: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Main entry point: Parse text and extract entity data
        Uses GPT-4o-mini for intelligent extraction with regex fallback.

        Returns dict with entity_type, data, confidence, missing_fields
        """
        # Try AI-powered extraction first
        if self.is_available():
            return self._parse_creation_intent_ai(text, context)

        # Fallback to regex-based extraction
        return self._parse_creation_intent_regex(text, context)

    def _parse_creation_intent_ai(self, text: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """AI-powered entity extraction using GPT-4o-mini"""
        try:
            # Detect intent using AI
            entity_type, intent_confidence = self._ai_detect_intent(text)

            # Extract data based on entity type
            ai_data = None
            if entity_type == 'patient':
                ai_data = self._ai_extract_patient(text)
            elif entity_type == 'doctor':
                ai_data = self._ai_extract_doctor(text)
            elif entity_type == 'appointment':
                ai_data = self._ai_extract_appointment(text)

            if ai_data:
                # Clean up null values and calculate missing fields
                extracted_data = {k: v for k, v in ai_data.items() if v is not None}

                # Define required fields per entity type
                required_fields = {
                    'patient': ['firstName', 'lastName', 'gender', 'dateOfBirth', 'phone'],
                    'doctor': ['firstName', 'lastName', 'email', 'specialization', 'licenseNumber'],
                    'appointment': ['patientName', 'appointmentDate', 'appointmentTime']
                }

                missing_fields = [f for f in required_fields.get(entity_type, [])
                                 if f not in extracted_data]

                # Calculate confidence based on extracted fields
                req_fields = required_fields.get(entity_type, [])
                found_required = sum(1 for f in req_fields if f in extracted_data)
                data_confidence = found_required / len(req_fields) if req_fields else 0.5

                overall_confidence = (intent_confidence + data_confidence) / 2

                logger.info(f"AI extraction successful: {entity_type}, confidence: {overall_confidence}")

                return {
                    'intent': 'create',
                    'entityType': entity_type,
                    'extractedData': extracted_data,
                    'confidence': round(overall_confidence, 2),
                    'missingFields': missing_fields,
                    'modelVersion': self.model_version,
                    'aiPowered': True
                }

        except Exception as e:
            logger.warning(f"AI extraction failed, falling back to regex: {e}")

        # Fallback to regex if AI fails
        return self._parse_creation_intent_regex(text, context)

    def _parse_creation_intent_regex(self, text: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Regex-based entity extraction (fallback)"""
        entity_type, intent_confidence = self.detect_intent(text)

        if entity_type == 'patient':
            result = self.extract_patient_data(text)
        elif entity_type == 'doctor':
            result = self.extract_doctor_data(text)
        elif entity_type == 'appointment':
            result = self.extract_appointment_data(text)
        else:
            # Try to extract based on context
            # If text mentions symptoms/DOB, likely patient
            if self.extract_date(text, is_dob=True) or self.extract_blood_group(text):
                result = self.extract_patient_data(text)
            # If text mentions specialization/license, likely doctor
            elif self.extract_specialization(text) or self.extract_license(text):
                result = self.extract_doctor_data(text)
            # Default to appointment
            else:
                result = self.extract_appointment_data(text)

        # Combine confidences
        overall_confidence = (intent_confidence + result.confidence) / 2

        return {
            'intent': 'create',
            'entityType': result.entity_type,
            'extractedData': result.data,
            'confidence': round(overall_confidence, 2),
            'missingFields': result.missing_fields,
            'modelVersion': '1.0.0-regex',
            'aiPowered': False
        }
