# AGENT.md - AI Services Directory

## Purpose

This directory contains Python FastAPI-based microservices providing AI-powered clinical decision support. Services include diagnostic analysis, risk prediction, medical imaging interpretation, voice transcription, and more.

## Directory Structure

```
ai-services/
├── main.py                   # FastAPI application entry point
├── requirements.txt          # Python dependencies
├── shared/
│   └── openai_client.py      # Centralized OpenAI client
├── diagnostic/
│   ├── service.py            # DiagnosticAI - symptom analysis
│   └── knowledge_base.py     # ICD-10 codes, symptom mappings
├── predictive/
│   └── service.py            # PredictiveAnalytics - risk scoring
├── imaging/
│   └── service.py            # ImageAnalysisAI - X-ray/CT/MRI
├── chat/
│   └── service.py            # ChatAI - conversational assistant
├── speech/
│   └── service.py            # SpeechToTextService - Whisper
├── queue_ai/
│   └── service.py            # QueuePredictionAI - wait times
├── pharmacy/
│   └── service.py            # PharmacyAI - drug interactions
├── clinical_notes/
│   └── service.py            # ClinicalNotesAI - SOAP generation
├── symptom_checker/
│   └── service.py            # SymptomCheckerAI - triage
├── early_warning/
│   └── service.py            # EarlyWarningAI - NEWS2 scoring
├── med_safety/
│   └── service.py            # MedicationSafetyAI - 5 Rights
├── smart_orders/
│   └── service.py            # SmartOrdersAI - order recommendations
├── ai_scribe/
│   └── service.py            # AIScribeService - transcription + notes
├── entity_extraction/
│   └── service.py            # EntityExtractionAI - medical NER
├── pdf_analysis/
│   └── service.py            # PDFAnalysisService - document extraction
└── health_assistant/
    └── service.py            # HealthAssistantAI - patient assistant
```

## Service Overview

### AI Models Used

| Model | Provider | Purpose |
|-------|----------|---------|
| `gpt-4o` | OpenAI | Complex analysis (imaging, clinical notes) |
| `gpt-4o-mini` | OpenAI | Simple tasks (chat, entity extraction) |
| `whisper-1` | OpenAI | Speech-to-text transcription |
| `all-MiniLM-L6-v2` | SentenceTransformers | Semantic symptom matching |

### Service Classes

| Service | Class | Key Methods |
|---------|-------|-------------|
| Diagnostic | `DiagnosticAI` | `analyze_symptoms()`, `get_differential()` |
| Predictive | `PredictiveAnalytics` | `predict_risk()`, `calculate_score()` |
| Imaging | `ImageAnalysisAI` | `analyze_image()` |
| Chat | `ChatAI` | `chat()`, `process_voice_command()` |
| Speech | `SpeechToTextService` | `transcribe()` |
| Queue | `QueuePredictionAI` | `predict_wait_time()` |
| Pharmacy | `PharmacyAI` | `check_interactions()`, `get_alternatives()` |
| Clinical Notes | `ClinicalNotesAI` | `generate_soap()`, `extract_codes()` |
| Symptom Checker | `SymptomCheckerAI` | `start_session()`, `process_response()` |
| Early Warning | `EarlyWarningAI` | `calculate_news2()`, `get_alerts()` |
| Med Safety | `MedicationSafetyAI` | `verify_5_rights()`, `check_dose()` |
| Smart Orders | `SmartOrdersAI` | `recommend_orders()`, `get_bundles()` |
| AI Scribe | `AIScribeService` | `transcribe_audio()`, `generate_notes()` |
| Entity Extraction | `EntityExtractionAI` | `extract_entities()` |
| PDF Analysis | `PDFAnalysisService` | `analyze_document()`, `extract_text()` |
| Health Assistant | `HealthAssistantAI` | `chat()`, `get_insights()` |

## API Endpoints

### Health & Status
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Service health check |
| GET | `/openai-status` | OpenAI API status |

### Diagnostic
| Method | Path | Description |
|--------|------|-------------|
| POST | `/diagnose` | Analyze symptoms, return differential |

### Risk Prediction
| Method | Path | Description |
|--------|------|-------------|
| POST | `/predict-risk` | Calculate risk scores |

### Medical Imaging
| Method | Path | Description |
|--------|------|-------------|
| POST | `/analyze-image` | Analyze X-ray/CT/MRI |
| POST | `/analyze-image-base64` | Base64 image input |

### Chat & Voice
| Method | Path | Description |
|--------|------|-------------|
| POST | `/chat` | Conversational AI |
| POST | `/voice` | Process voice transcript |
| POST | `/transcribe` | Audio to text (Whisper) |

### Queue
| Method | Path | Description |
|--------|------|-------------|
| POST | `/predict-queue` | Predict wait times |

### Pharmacy
| Method | Path | Description |
|--------|------|-------------|
| POST | `/check-interactions` | Drug interaction check |
| POST | `/pharmacy/alternatives` | Cost-effective alternatives |
| POST | `/pharmacy/reconciliation` | Medication reconciliation |

### Clinical Notes
| Method | Path | Description |
|--------|------|-------------|
| POST | `/generate-clinical-notes` | Generate SOAP notes |
| POST | `/extract-entities` | Medical NER |

### Symptom Checker
| Method | Path | Description |
|--------|------|-------------|
| POST | `/symptom-checker/start` | Start assessment |
| POST | `/symptom-checker/respond` | Process responses |
| POST | `/symptom-checker/complete` | Get triage result |

### Early Warning
| Method | Path | Description |
|--------|------|-------------|
| POST | `/early-warning/calculate` | Calculate NEWS2 |
| POST | `/early-warning/alerts` | Get patient alerts |

### Medication Safety
| Method | Path | Description |
|--------|------|-------------|
| POST | `/med-safety/verify` | 5 Rights verification |
| POST | `/med-safety/dose-check` | Dose validation |

### Smart Orders
| Method | Path | Description |
|--------|------|-------------|
| POST | `/smart-orders/recommend` | Get order recommendations |
| POST | `/smart-orders/bundles` | Get order bundles |

### AI Scribe
| Method | Path | Description |
|--------|------|-------------|
| POST | `/ai-scribe/transcribe` | Transcribe consultation audio |
| POST | `/ai-scribe/generate-notes` | Generate clinical notes from transcript |

### PDF Analysis
| Method | Path | Description |
|--------|------|-------------|
| POST | `/pdf/analyze` | Analyze medical document |

### Health Assistant
| Method | Path | Description |
|--------|------|-------------|
| POST | `/health-assistant/chat` | Patient health chat |

## Shared Components

### OpenAI Client (`shared/openai_client.py`)

Centralized OpenAI client with model selection:

```python
from shared.openai_client import openai_manager, Models

# Use appropriate model
response = openai_manager.chat_completion(
    model=Models.GPT4O_MINI,  # or Models.GPT4O for complex tasks
    messages=[...],
    temperature=0.7,
)

# Transcription
transcript = openai_manager.transcribe(audio_file)
```

**Model Constants:**
```python
class Models:
    GPT4O = "gpt-4o"           # Complex analysis
    GPT4O_MINI = "gpt-4o-mini" # Simple tasks
    WHISPER = "whisper-1"       # Speech-to-text
```

## Service Patterns

### Basic Service Structure
```python
class MyAIService:
    def __init__(self):
        # Initialize any models or resources
        pass

    async def analyze(self, data: dict) -> dict:
        # Main analysis method
        try:
            result = await self._process(data)
            return {
                "success": True,
                "data": result,
                "modelVersion": "1.0.0"
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    async def _process(self, data: dict) -> dict:
        # Internal processing logic
        pass
```

### OpenAI Integration Pattern
```python
from shared.openai_client import openai_manager, Models

class MyService:
    async def generate_response(self, prompt: str) -> str:
        response = openai_manager.chat_completion(
            model=Models.GPT4O_MINI,
            messages=[
                {"role": "system", "content": "You are a medical assistant."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=1000,
        )
        return response.choices[0].message.content
```

### Rule-Based Service Pattern
```python
class EarlyWarningAI:
    """NEWS2 scoring - rule-based, no API calls"""

    def calculate_news2(self, vitals: dict) -> dict:
        score = 0

        # Respiratory rate scoring
        rr = vitals.get("respiratory_rate", 0)
        if rr <= 8:
            score += 3
        elif 9 <= rr <= 11:
            score += 1
        # ... more rules

        return {
            "score": score,
            "level": self._get_risk_level(score),
            "escalation": self._get_escalation(score)
        }
```

## Dependencies

### Python Packages
```
fastapi>=0.104.0
uvicorn>=0.24.0
openai>=1.3.0
python-dotenv>=1.0.0
sentence-transformers>=2.2.0
numpy>=1.24.0
pydantic>=2.0.0
python-multipart>=0.0.6
PyPDF2>=3.0.0
pillow>=10.0.0
```

### Environment Variables
```bash
OPENAI_API_KEY=sk-...          # Required for OpenAI models
PORT=8000                       # Service port (default 8000)
```

## Common Operations

### Adding a New AI Service

1. **Create service directory:**
```bash
mkdir ai-services/my_service
touch ai-services/my_service/__init__.py
touch ai-services/my_service/service.py
```

2. **Implement service class:**
```python
# my_service/service.py
from shared.openai_client import openai_manager, Models

class MyNewService:
    def __init__(self):
        pass

    async def analyze(self, data: dict) -> dict:
        # Implementation
        pass
```

3. **Register in main.py:**
```python
from my_service.service import MyNewService

my_service = MyNewService()

@app.post("/my-endpoint")
async def my_endpoint(request: MyRequest):
    return await my_service.analyze(request.dict())
```

4. **Add backend proxy route** (if needed for frontend access)

### Running Locally
```bash
cd ai-services
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## Related Files

- `/backend/src/services/aiService.ts` - Backend proxy
- `/backend/src/routes/aiRoutes.ts` - Backend routes
- `/frontend/src/hooks/useAI.ts` - Frontend hook
- `/frontend/src/services/api.ts` - aiApi namespace

## Testing

```bash
# Run with pytest
pytest tests/

# Test specific service
pytest tests/test_diagnostic.py
```

## Common Issues

### Issue: OpenAI API errors
- Verify `OPENAI_API_KEY` is set
- Check API quota/billing
- Review rate limits

### Issue: Timeout on image analysis
- GPT-4 Vision can take 30-60 seconds
- Increase timeout in backend proxy
- Consider async processing

### Issue: Model hallucination
- Use lower temperature (0.1-0.3) for clinical tasks
- Validate outputs against known formats
- Add disclaimer for AI-generated content
