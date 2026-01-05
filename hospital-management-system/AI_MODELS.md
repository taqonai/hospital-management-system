# AI Models Documentation

This document provides a comprehensive breakdown of all AI models used in the Hospital Management System.

## Models Summary

| Model | Type | Features |
|-------|------|----------|
| `whisper-1` | OpenAI | Voice transcription (Symptom Checker, AI Scribe) |
| `gpt-4o-mini` | OpenAI | Clinical notes generation, SOAP notes, entity extraction, ICD-10/CPT suggestions |
| `gpt-3.5-turbo` | OpenAI | Chat assistant, conversational booking |
| `all-MiniLM-L6-v2` | SentenceTransformers | Symptom-to-diagnosis semantic matching |
| `ResNet50` | PyTorch/ImageNet | Medical image feature extraction |
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

### 5. ResNet50 (PyTorch/ImageNet)

**Purpose:** Medical Image Feature Extraction

**Features:**
- X-ray analysis
- CT scan interpretation
- MRI analysis
- Ultrasound image processing
- Abnormality detection

**How it works:**
- Uses pretrained ResNet50 for feature extraction (2048-dim vectors)
- Applies ImageNet normalization transforms
- Currently operates in simulated mode with rule-based pathology matching

**Note:** The model extracts features but uses rule-based logic for final pathology classification rather than a fine-tuned medical classifier.

**Files:**
- `ai-services/imaging/service.py` - ImageAnalysisAI, ImageFeatureExtractor classes
- `ai-services/imaging/knowledge_base.py` - Pathology database

---

## Rule-Based Systems

These systems use algorithmic scoring and medical knowledge bases without external AI calls.

### 6. Predictive Analytics

**Features:**
- Readmission risk prediction
- Mortality risk assessment
- Patient deterioration prediction
- Length of stay estimation

**How it works:** Logistic regression-style scoring based on patient demographics, vitals, lab results, and medical history.

**Files:**
- `ai-services/predictive/service.py` - PredictiveAnalytics class

---

### 7. Queue Prediction

**Features:**
- Wait time estimation
- Queue position prediction
- Resource allocation suggestions

**How it works:** Historical pattern analysis with time-of-day and day-of-week weighting.

**Files:**
- `ai-services/queue_ai/service.py` - QueuePredictionAI class

---

### 8. Pharmacy AI

**Features:**
- Drug interaction checking
- Dosing validation
- Contraindication alerts
- Allergy cross-referencing

**How it works:** Medical database lookups with severity scoring.

**Files:**
- `ai-services/pharmacy/service.py` - PharmacyAI class

---

### 9. Medication Safety

**Features:**
- Dose range validation
- Route verification
- Frequency checks
- Patient-specific contraindications

**Files:**
- `ai-services/med_safety/service.py` - MedSafetyAI class

---

### 10. Smart Orders

**Features:**
- Clinical order recommendations
- Lab test suggestions based on diagnosis
- Imaging recommendations

**Files:**
- `ai-services/smart_orders/service.py` - SmartOrdersAI class

---

### 11. Symptom Checker

**Features:**
- Interactive symptom assessment
- Decision tree-based questioning
- Triage level suggestions

**Files:**
- `ai-services/symptom_checker/service.py` - SymptomCheckerAI class

---

### 12. Early Warning System

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
| `POST /api/analyze-image` | ResNet50 | Image analysis |
| `POST /api/predict-risk` | Rule-based | Risk prediction |
| `POST /api/pharmacy/*` | Rule-based | Drug interactions |
| `POST /api/queue/*` | Rule-based | Queue prediction |
