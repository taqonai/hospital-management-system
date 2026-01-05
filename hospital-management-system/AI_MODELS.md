# AI Models Documentation

This document provides a comprehensive breakdown of all AI models used in the Hospital Management System.

## Models Summary

| Model | Type | Features |
|-------|------|----------|
| `whisper-1` | OpenAI | Voice transcription (Symptom Checker, AI Scribe) |
| `gpt-4o-mini` | OpenAI | Clinical notes generation, SOAP notes, entity extraction, ICD-10/CPT suggestions |
| `gpt-3.5-turbo` | OpenAI | Chat assistant, conversational booking |
| `all-MiniLM-L6-v2` | SentenceTransformers | Symptom-to-diagnosis semantic matching |
| `gpt-4o` | OpenAI (Vision) | Medical imaging analysis, PDF document analysis (scanned) |
| Rule-based | Algorithmic | Risk prediction, queue estimation, drug interactions, medication safety |

---

## OpenAI Models

These models require `OPENAI_API_KEY` environment variable to be set.

### 1. Whisper (`whisper-1`)

**Purpose:** Speech-to-Text Transcription

**Features:**
- Voice input in Symptom Checker page
- AI Scribe medical conversation transcription
- Speaker diarization support
- Optimized for medical terminology

**How it works:**
- Records audio via browser MediaRecorder API
- Sends to backend which proxies to AI services `/api/transcribe` endpoint
- Uses OpenAI Whisper API with medical context prompting for improved accuracy

**Files:**
- `ai-services/speech/service.py` - SpeechToTextService class
- `ai-services/ai_scribe/service.py` - AIScribeService transcription

---

### 2. GPT-4o-mini (`gpt-4o-mini`)

**Purpose:** Clinical Documentation & Entity Extraction

**Features:**
- **Clinical Notes Generation** - SOAP notes, discharge summaries, progress notes, procedure notes, consultation notes, ED notes
- **AI Scribe SOAP Generation** - Converts transcribed conversations into structured clinical documentation
- **Entity Extraction** - Extracts symptoms, diagnoses, medications, vitals, allergies from text
- **ICD-10/CPT Code Suggestions** - Suggests billing codes based on clinical notes
- **Follow-up Recommendations** - Generates follow-up care suggestions
- **Prescription Suggestions** - Recommends medications based on diagnosis

**Configuration:**
- Temperature: 0.3 (lower for consistent medical documentation)
- Max tokens: 2000

**Files:**
- `ai-services/clinical_notes/service.py` - ClinicalNotesAI class
- `ai-services/ai_scribe/service.py` - SOAP note generation, entity extraction

---

### 3. GPT-3.5-turbo (`gpt-3.5-turbo`)

**Purpose:** Conversational AI Assistant

**Features:**
- Chat-based booking assistant for appointments
- Navigation help within the application
- General healthcare queries
- Command parsing with action triggers

**How it works:**
- First attempts pattern matching for common commands
- Falls back to GPT for conversational responses
- Parses response for navigation and action triggers

**Files:**
- `ai-services/chat/service.py` - ChatAI class

---

## Local ML Models

These models run locally and do not require external API keys.

### 4. SentenceTransformers (`all-MiniLM-L6-v2`)

**Purpose:** Semantic Symptom Matching

**Features:**
- Diagnostic AI symptom analysis
- Differential diagnosis generation
- ICD-10 code matching
- Semantic similarity scoring

**How it works:**
- Encodes patient symptoms as 384-dimensional vectors
- Computes cosine similarity against precomputed disease symptom database
- Returns ranked diagnoses with confidence scores

**Files:**
- `ai-services/diagnostic/service.py` - DiagnosticAI, SymptomEncoder classes
- `ai-services/diagnostic/knowledge_base.py` - Disease symptom database

---

### 5. GPT-4 Vision (`gpt-4o`)

**Purpose:** Medical Imaging Analysis

**Features:**
- X-ray interpretation and analysis
- CT scan analysis
- MRI interpretation
- Ultrasound image processing
- Abnormality detection with severity assessment
- Structured radiology reports
- Differential diagnosis suggestions

**How it works:**
- Receives medical image via URL
- GPT-4 Vision analyzes the image as an expert radiologist
- Returns structured JSON with findings, impression, and recommendations
- Falls back to rule-based analysis if GPT-4 Vision unavailable

**Response includes:**
- Detailed findings per anatomical region
- Abnormality detection with confidence scores
- Clinical impression summary
- Urgency level (routine/urgent/emergent/critical)
- Follow-up recommendations
- Differential diagnoses

**Files:**
- `ai-services/imaging/service.py` - ImageAnalysisAI, GPTVisionAnalyzer classes
- `ai-services/imaging/knowledge_base.py` - Pathology database (used for fallback)

---

### 6. PDF Document Analysis

**Purpose:** Medical Document Processing

**Models Used:**
- `gpt-4o-mini` - For text-based PDFs (typed/digital reports) - faster and cheaper
- `gpt-4o` (Vision) - For image-based PDFs (scanned documents)

**Features:**
- Automatic detection of text vs scanned PDFs
- Medical report analysis and summarization
- Lab result extraction with abnormal flagging
- Radiology report interpretation
- Prescription parsing (medications, dosages, frequency)
- Discharge summary analysis
- Pathology report interpretation
- Entity extraction (conditions, procedures, medications)
- Urgent findings identification

**Supported Document Types:**
- `medical_report` - General medical reports
- `lab_result` - Laboratory test results
- `radiology_report` - Imaging/radiology reports
- `prescription` - Medication prescriptions
- `discharge_summary` - Hospital discharge summaries
- `pathology_report` - Pathology/biopsy reports
- `consultation_note` - Specialist consultation notes

**How it works:**
1. PDF is uploaded or fetched from URL
2. System checks text density to determine if text-based or scanned
3. Text-based PDFs: Extract text → GPT-4o-mini analysis
4. Scanned PDFs: Convert pages to images → GPT-4 Vision analysis
5. Returns structured JSON with findings, diagnoses, medications, recommendations

**Files:**
- `ai-services/pdf_analysis/service.py` - PDFAnalysisService class

---

## Rule-Based Systems

These systems use algorithmic scoring and medical knowledge bases without external AI calls.

### 7. Predictive Analytics

**Features:**
- Readmission risk prediction
- Mortality risk assessment
- Patient deterioration prediction
- Length of stay estimation

**How it works:** Logistic regression-style scoring based on patient demographics, vitals, lab results, and medical history.

**Files:**
- `ai-services/predictive/service.py` - PredictiveAnalytics class

---

### 8. Queue Prediction

**Features:**
- Wait time estimation
- Queue position prediction
- Resource allocation suggestions

**How it works:** Historical pattern analysis with time-of-day and day-of-week weighting.

**Files:**
- `ai-services/queue_ai/service.py` - QueuePredictionAI class

---

### 9. Pharmacy AI

**Features:**
- Drug interaction checking
- Dosing validation
- Contraindication alerts
- Allergy cross-referencing

**How it works:** Medical database lookups with severity scoring.

**Files:**
- `ai-services/pharmacy/service.py` - PharmacyAI class

---

### 10. Medication Safety

**Features:**
- Dose range validation
- Route verification
- Frequency checks
- Patient-specific contraindications

**Files:**
- `ai-services/med_safety/service.py` - MedSafetyAI class

---

### 11. Smart Orders

**Features:**
- Clinical order recommendations
- Lab test suggestions based on diagnosis
- Imaging recommendations

**Files:**
- `ai-services/smart_orders/service.py` - SmartOrdersAI class

---

### 12. Symptom Checker

**Features:**
- Interactive symptom assessment
- Decision tree-based questioning
- Triage level suggestions

**Files:**
- `ai-services/symptom_checker/service.py` - SymptomCheckerAI class

---

### 13. Early Warning System

**Features:**
- Patient deterioration alerts
- Vital sign threshold monitoring
- NEWS2 score calculation

**Files:**
- `ai-services/early_warning/service.py` - EarlyWarningAI class

---

## Environment Configuration

### Required for OpenAI Models
```env
# ai-services/.env
OPENAI_API_KEY=sk-your-openai-api-key-here
```

### Optional Model Configuration
```env
# Default model for chat (gpt-3.5-turbo or gpt-4)
OPENAI_MODEL=gpt-3.5-turbo
```

## API Endpoints

| Endpoint | Model Used | Purpose |
|----------|------------|---------|
| `POST /api/transcribe` | Whisper | Audio transcription |
| `POST /api/notes/generate` | GPT-4o-mini | Clinical note generation |
| `POST /api/scribe/*` | Whisper + GPT-4o-mini | AI Scribe workflow |
| `POST /api/chat` | GPT-3.5-turbo | Chat assistant |
| `POST /api/diagnose` | SentenceTransformers | Symptom diagnosis |
| `POST /api/analyze-image` | GPT-4o Vision | Medical image analysis |
| `POST /api/pdf/analyze` | GPT-4o / GPT-4o-mini | PDF document analysis |
| `POST /api/predict-risk` | Rule-based | Risk prediction |
| `POST /api/pharmacy/*` | Rule-based | Drug interactions |
| `POST /api/queue/*` | Rule-based | Queue prediction |
