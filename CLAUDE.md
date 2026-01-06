# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hospital Management System (HMS) - A multi-tenant Cloud SaaS platform with AI-integrated modules for clinical decision support, predictive analytics, and medical imaging analysis.

## Development Commands

### Backend (Node.js/Express/TypeScript)
```bash
cd hospital-management-system/backend
npm install
npx prisma generate          # Required after schema changes
npx prisma migrate dev       # Run migrations
npm run db:seed              # Seed test data
npm run dev                  # Start dev server (port 3001)
npm run build                # TypeScript compile
npm test                     # Run Jest tests
npm run lint                 # ESLint
```

### Frontend (React/Vite/TypeScript)
```bash
cd hospital-management-system/frontend
npm install
npm run dev                  # Start dev server (port 3000)
npm run build                # TypeScript + Vite build
npm run lint                 # ESLint
```

### AI Services (Python/FastAPI)
```bash
cd hospital-management-system/ai-services
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Docker (Full Stack)
```bash
cd hospital-management-system
docker-compose up -d                          # All services
docker-compose --profile production up -d     # With nginx
```

### Running Individual AI Microservices
```bash
cd hospital-management-system/ai-services
uvicorn main:app --reload --port 8011        # AI Scribe on different port
```

## Architecture

### Three-Tier Service Architecture

1. **Frontend** (React 18 + TypeScript + TailwindCSS + Vite)
   - Redux Toolkit for global state, TanStack Query for server state
   - Entry: `frontend/src/main.tsx`, routes: `frontend/src/App.tsx`
   - API client: `frontend/src/services/api.ts`
   - Pages organized by module in `frontend/src/pages/`

2. **Backend** (Node.js + Express + TypeScript + Prisma)
   - RESTful API at `/api/v1/*`
   - Entry: `backend/src/app.ts`, routes: `backend/src/routes/index.ts`
   - Pattern: routes → services → Prisma client
   - Middleware: `auth.ts` (JWT), `validation.ts`, `errorHandler.ts`

3. **AI Services** (Python + FastAPI)
   - Entry: `ai-services/main.py` (initializes all AI service instances)
   - Each service in its own directory with `service.py` and optional `knowledge_base.py`

### AI Service Modules
Located in `ai-services/`:
| Directory | Service Class | Purpose |
|-----------|--------------|---------|
| `diagnostic/` | DiagnosticAI | Symptom analysis, differential diagnosis |
| `predictive/` | PredictiveAnalytics | Risk prediction, readmission risk |
| `imaging/` | ImageAnalysisAI | X-ray, CT, MRI interpretation |
| `chat/` | ChatAI | Conversational booking assistant |
| `speech/` | SpeechToTextService | Whisper-based transcription |
| `queue_ai/` | QueuePredictionAI | Wait time prediction |
| `pharmacy/` | PharmacyAI | Drug interactions, dosing |
| `clinical_notes/` | ClinicalNotesAI | Note generation from templates |
| `symptom_checker/` | SymptomCheckerAI | Interactive symptom assessment |
| `early_warning/` | EarlyWarningAI | Patient deterioration detection |
| `med_safety/` | MedSafetyAI | Medication safety checks |
| `smart_orders/` | SmartOrdersAI | Clinical order recommendations |
| `ai_scribe/` | AIScribeService | Medical transcription |
| `entity_extraction/` | EntityExtractionAI | Medical entity extraction from text |

### AI Services API (FastAPI - port 8000)
Direct AI endpoints (backend proxies these via `/api/v1/ai/*`):
- `POST /api/diagnose` - Symptom analysis with ICD-10 codes
- `POST /api/predict-risk` - Risk prediction (readmission, deterioration)
- `POST /api/analyze-image` - Medical imaging analysis
- `POST /api/chat`, `/api/voice-command` - Chat and voice processing
- `POST /api/transcribe` - Whisper speech-to-text
- `POST /api/queue/*` - Queue prediction endpoints
- `POST /api/pharmacy/check-interactions` - Drug interaction checks
- `POST /api/notes/*` - Clinical note generation/enhancement
- `POST /api/symptom-checker/*` - Interactive symptom assessment
- `POST /api/entity/*` - Entity extraction from natural language

### AI Models in Use

| Model | Type | Features |
|-------|------|----------|
| `whisper-1` | OpenAI | Voice transcription (Symptom Checker, AI Scribe) |
| `gpt-4o-mini` | OpenAI | Clinical notes generation, SOAP notes, entity extraction, ICD-10/CPT suggestions |
| `gpt-3.5-turbo` | OpenAI | Chat assistant, conversational booking |
| `all-MiniLM-L6-v2` | SentenceTransformers | Symptom-to-diagnosis semantic matching |
| `gpt-4o` | OpenAI (Vision) | Medical imaging analysis (X-ray, CT, MRI, Ultrasound) |
| Rule-based | Algorithmic | Risk prediction, queue estimation, drug interactions, medication safety |

**OpenAI Models** (require `OPENAI_API_KEY`):
- **Whisper**: Audio → text transcription optimized for medical terminology
- **GPT-4o-mini**: Generates structured clinical documentation from transcripts
- **GPT-3.5-turbo**: Handles conversational queries and navigation commands
- **GPT-4o Vision**: Analyzes medical images as expert radiologist with structured reports

**Local ML Models** (no API key required):
- **SentenceTransformers**: Encodes symptoms as vectors for similarity matching against disease database

**Rule-Based Systems**: Predictive analytics, queue prediction, pharmacy checks, and safety validations use algorithmic scoring without external AI calls.

### Multi-Tenant Data Model

All entities include `hospitalId` for tenant isolation. Prisma schema (`backend/prisma/schema.prisma`, ~3700 lines) covers 80+ models.

### User Roles (UserRole enum)
SUPER_ADMIN, HOSPITAL_ADMIN, DOCTOR, NURSE, RECEPTIONIST, LAB_TECHNICIAN, PHARMACIST, RADIOLOGIST, ACCOUNTANT, PATIENT, HR_MANAGER, HR_STAFF, HOUSEKEEPING_MANAGER, HOUSEKEEPING_STAFF, MAINTENANCE_STAFF, SECURITY_STAFF, DIETARY_STAFF

### Backend Route Pattern
Routes in `backend/src/routes/`, services in `backend/src/services/`. Each module follows:
- `{module}Routes.ts` - Express router with endpoints
- `{module}Service.ts` - Business logic with Prisma queries

Key routes (`/api/v1/`):
- `/auth` - Login, register, refresh, profile
- `/patients`, `/doctors`, `/appointments`, `/departments` - Core entities
- `/ai`, `/ai-scribe`, `/symptom-checker` - AI endpoints
- `/laboratory`, `/radiology`, `/pharmacy` - Diagnostics
- `/ipd`, `/opd`, `/emergency`, `/surgery` - Clinical departments
- `/hr`, `/billing`, `/blood-bank` - Support services
- `/queue`, `/kiosk` - Patient flow
- `/telemedicine`, `/patient-portal` - Remote care
- `/medical-records`, `/dietary`, `/assets`, `/ambulance` - Ancillary services
- `/cssd`, `/mortuary`, `/housekeeping`, `/quality`, `/reports` - Operations
- `/early-warning`, `/med-safety`, `/smart-orders` - Clinical safety AI
- `/public` - Unauthenticated endpoints

### Authentication
- JWT access token (15m) + refresh token (7d)
- `authenticate` middleware validates Bearer token
- `authorize(...roles)` middleware for RBAC
- `authorizeHospital` ensures tenant isolation
- `optionalAuth` for endpoints with optional authentication

## Configuration

### Environment Variables
**Backend** (`backend/.env`):
- `DATABASE_URL` - PostgreSQL connection
- `JWT_SECRET`, `JWT_REFRESH_SECRET`
- `AI_SERVICE_URL` (default: http://localhost:8000)
- `REDIS_HOST`, `REDIS_PORT`

**Frontend** (`frontend/.env`):
- `VITE_API_URL` (default: http://localhost:3001/api/v1)

**AI Services** (`ai-services/.env`):
- `OPENAI_API_KEY` - For Whisper STT

**S3/Storage** (in `backend/.env`):
- `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` - For AWS S3
- `MINIO_ENDPOINT` - For local MinIO (default: http://minio:9000)
- S3 is prioritized over MinIO when AWS credentials are configured

### Default Dev Credentials
- Email: admin@hospital.com
- Password: password123

### Ports
| Service | Port |
|---------|------|
| Frontend | 3000 |
| Backend | 3001 |
| AI Services | 8000 |
| PostgreSQL | 5433 (Docker) / 5432 (local) |
| Redis | 6379 |
| MinIO | 9000 (API), 9001 (Console) |

## Key Dependencies

### Backend
- Prisma ORM for database access
- express-validator and zod for request validation
- jsonwebtoken for JWT auth
- winston for logging
- ioredis for Redis caching

### Frontend
- @tanstack/react-query for server state
- react-hook-form with zod for form handling
- chart.js for analytics visualizations
- react-speech-recognition for voice input

### AI Services
- FastAPI with Pydantic models
- Service classes instantiated in `main.py` and exposed via REST endpoints

## Infrastructure (AWS Deployment)

Located in `infrastructure/`:
```bash
cd hospital-management-system/infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars  # Configure variables
terraform init
terraform plan
terraform apply
```

Architecture: ALB → EC2 (t3.small) running Docker Compose with all services.

Key files:
- `terraform/` - Terraform IaC (VPC, EC2, ALB, S3)
- `scripts/user-data.sh` - EC2 bootstrap script
- `docker/docker-compose.prod.yml` - Production compose
- `nginx/nginx.conf` - Reverse proxy config

Maintenance commands (on EC2):
```bash
# View logs
sudo docker-compose logs -f backend

# Restart services
cd /opt/hms/app && sudo docker-compose restart

# Database backup
sudo docker exec hms-postgres pg_dump -U postgres hospital_db > backup.sql
```

## Common Issues

### Frontend White Screen
React crashes (white screen) are usually JavaScript runtime errors. Common causes:
- API returns string but code calls number methods (e.g., `price.toFixed()` on a string)
- Always wrap API numeric values with `Number()`: `Number(value || 0).toFixed(2)`

### Permission Denied Errors
Check route authorization in `backend/src/routes/{module}Routes.ts`. Ensure the user's role is included in the `authorize()` middleware call.

### Prisma Issues
After schema changes:
```bash
npx prisma generate
npx prisma migrate dev
```

### AI Service Connection Errors
- Backend proxies AI calls via `AI_SERVICE_URL` env var
- In Docker, use container names: `http://hms-ai-services:8000`
- Locally, use: `http://localhost:8000`

### Adding New Backend Routes
1. Create `{module}Routes.ts` in `backend/src/routes/`
2. Create `{module}Service.ts` in `backend/src/services/`
3. Register in `backend/src/routes/index.ts`
4. Apply appropriate middleware: `authenticate`, `authorize(...roles)`, `authorizeHospital`

### Adding New AI Service
1. Create directory in `ai-services/{service_name}/`
2. Add `service.py` with service class and `knowledge_base.py` if needed
3. Import and instantiate in `ai-services/main.py`
4. Add FastAPI endpoint in `main.py`
5. Create backend proxy route in `backend/src/routes/aiRoutes.ts`
