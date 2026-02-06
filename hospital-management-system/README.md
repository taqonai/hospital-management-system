# Hospital Management System (HMS)

A multi-tenant Cloud SaaS Hospital Management System with 50 modules, 20 AI services, a mobile patient portal, and the A'mad Precision Health Platform. Built for enterprise healthcare operations with full clinical, administrative, financial, and patient engagement workflows.

---

## Platform Overview

| Metric | Value |
|--------|-------|
| Modules | 50 (49 complete, 1 partial) |
| Prisma Models | 213 |
| API Endpoints | 1,199+ |
| Frontend Pages | 134 |
| Mobile Screens | 54 |
| AI Services | 20 |
| User Roles | 18 |

---

## Recent Major Updates (766 commits since Jan 30, 2025)

### AI Scribe & Clinical Notes
- Full AI Scribe integration into consultation workflow
- Medical dictation with Whisper + GPT-4o-mini
- Transcript and clinical notes persistence to database
- Clinical Notes page displaying stored transcripts and notes
- Support for audio file upload via FormData

### Insurance & Billing Enhancements
- **DHA eClaimLink Integration**: Real-time insurance eligibility verification
- **Pre-Authorization Workflows**: Dual-mode (DHA + Manual) pre-auth with form validation
- **Coordination of Benefits (COB)**: Support for multiple insurance policies (primary/secondary)
- **Emirates ID Validation**: Full Emirates ID integration with format validation
- **Insurance Audit Trail**: Complete audit log for copay check-in decisions and verifications
- **Copay Management**: Collection, refunds, bilingual UAE VAT-compliant receipts
- **Deductible & Cap Tracking**: Automatic tracking of insurance deductibles and annual caps
- **Pharmacy Copay Estimates**: Real-time copay estimates at check-in
- **Insurance Badges**: Visual indicators in OPD queue and patient lists
- **IPD Insurance Monitoring**: Real-time insurance status tracking during admission
- **Lab/Radiology Integration**: Automatic insurance/billing info in diagnostic orders

### Patient Engagement
- **Doctor Reviews & Ratings**: Patient feedback system for doctor consultations
- **AI Health Assistant**: Enhanced with actual patient clinical data integration
- **Push Notifications**: Token management endpoints for patient portal mobile app
- **Mobile Sync**: Unified medical records, insurance management, and billing claims between web and mobile

### User Experience
- CRM enhancements with campaign/survey deletion endpoints
- Receptionist dashboard improvements with accurate KPIs and charts
- Call Next improvements with proper doctor name display
- Queue management fixes for appointment distribution visualization

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| **Frontend** | React 18, TypeScript, TailwindCSS, Vite, Redux Toolkit, TanStack Query |
| **Backend** | Node.js, Express, TypeScript, Prisma ORM |
| **Database** | PostgreSQL 15 |
| **AI Services** | Python, FastAPI, OpenAI (GPT-4o, GPT-4o-mini, Whisper), SentenceTransformers |
| **Mobile** | React Native, Expo SDK 54, TypeScript |
| **Cache** | Redis |
| **Storage** | AWS S3 / MinIO (S3-compatible) |
| **Email** | SendGrid (primary), AWS SES (fallback), SMTP (fallback) |
| **SMS / WhatsApp** | Twilio |
| **Push Notifications** | Expo Push |
| **Infrastructure** | Docker Compose, Terraform, AWS (ALB, EC2, S3), Nginx |
| **Testing** | Playwright (E2E), Jest (backend - planned) |

---

## Modules

### Clinical (7)
- **OPD** - Outpatient queue, check-in, vitals, booking ticket workflow
- **IPD** - Admissions, bed/ward management, nursing notes, discharge summaries
- **Emergency** - Triage, resuscitation dashboard, ED beds, on-call doctors
- **Surgery** - Scheduling, records, inventory tracking
- **Appointments** - CRUD, doctor slot management, no-show tracking
- **Consultations** - Linked to appointments, prescriptions, lab orders, AI Scribe integration for medical dictation, clinical notes persistence with transcript storage
- **Nursing** - eMAR, vitals, I&O charting, assessments, shift handoff, task management

### Diagnostics (3)
- **Laboratory** - Test catalog, orders, results, chain of custody, AI analysis, insurance/billing integration with automatic copay calculation
- **Radiology** - Imaging orders, studies, AI-assisted reporting
- **Pharmacy** - Drug management, inventory, CSV import, interaction checking

### Administrative (5)
- **Patients** - Registration, medical history, allergies, immunizations, insurance with Emirates ID validation, DHA eClaimLink integration, real-time eligibility verification, Coordination of Benefits (COB) for multiple insurance policies
- **Doctors** - Profiles, schedules, slots, absence management
- **Departments** - CRUD, specializations
- **HR** - Employees, shifts, attendance, payroll, leave, training, performance reviews
- **Auth / RBAC** - JWT auth, hybrid role+permission RBAC, Redis-cached permissions, patient OTP login

### Support Services (10)
- **Billing** - Invoices, payments, insurance claims with pre-authorization workflows, copay collection and refunds, bilingual receipts with UAE VAT compliance, insurance audit trail, deductible tracking, pharmacy copay estimates at check-in, AI charge capture
- **Blood Bank** - Donors, donations, components, cross-match, transfusions
- **Dietary** - Diet plans, meal orders, patient dietary management
- **Ambulance** - Fleet management, trip tracking, assignments
- **Assets** - Asset lifecycle, maintenance scheduling
- **Housekeeping** - Zones, tasks, checklists, inventory, AI-prioritized cleaning
- **CSSD** - Sterilization item and cycle tracking
- **Mortuary** - Record management, status tracking
- **Quality** - Indicators, measurements, incident reports, AI analysis
- **Procurement** - Full P2P cycle (PR → PO → GRN → Invoice → Returns), supplier management, analytics

### Digital & Patient Engagement (7)
- **Telemedicine** - Video sessions, recordings, reports
- **Patient Portal** - Dashboard, records, billing with claim tracking, insurance management, health sync, wellness, AI assistant with clinical data integration, doctor reviews and ratings (20+ pages)
- **Queue Management** - Counters, TV display boards, patient status check
- **Kiosk** - Self check-in for patients
- **CRM** - Leads, campaigns, surveys, communications, task management
- **Notifications** - Multi-channel (email, SMS, WhatsApp, push, in-app), templates, delivery tracking
- **WhatsApp Bot** - Conversational booking via WhatsApp with voice transcription

### AI Services (20)

| Service | AI Model | Purpose |
|---------|----------|---------|
| Diagnostic AI | GPT-4o + MiniLM-L6 | Symptom analysis, differential diagnosis |
| AI Scribe | Whisper + GPT-4o-mini | Medical dictation, session management, transcript and clinical notes persistence |
| Symptom Checker | GPT-4o + Whisper | Interactive patient assessment, triage |
| Early Warning | GPT-4o-mini + algorithmic | NEWS2, qSOFA, fall risk, deterioration |
| Med Safety | GPT-4o-mini + rule-based | 5 Rights, barcode scan, IV compatibility |
| Smart Orders | GPT-4o + rule-based | Order recommendations, bundles, interactions |
| Imaging AI | GPT-4o Vision | X-ray, CT, MRI interpretation |
| Pharmacy AI | GPT-4o-mini + knowledge base | Drug interactions, dosing, reconciliation |
| Clinical Notes | GPT-4o-mini | SOAP, H&P, progress notes from templates |
| PDF Analysis | GPT-4o + Vision | Medical PDF extraction, lab result parsing |
| Entity Extraction | GPT-4o-mini | Medical entity extraction from text |
| Health Assistant | GPT-4o | Patient-facing health chat |
| Predictive Analytics | Rule-based | Readmission risk, clinical risk prediction |
| Chat AI | GPT-4o-mini | Conversational booking assistant |
| Speech | Whisper | Audio transcription |
| Queue AI | GPT-4o-mini + algorithmic | Wait time prediction, demand forecasting |
| Insurance Coding AI | GPT-4o-mini + rule-based | ICD-10/CPT suggestions, claim prediction, DHA eClaimLink integration, COB support |
| Genomic | Rule-based | VCF parsing, genetic markers, risk scoring |
| Nutrition AI | GPT-4o Vision | Meal image analysis, food database |
| Recommendation | Rule-based | Multi-source health recommendations |

All AI services implement graceful degradation to rule-based fallbacks when OpenAI is unavailable. Hospital-specific Ollama is supported as an alternative via `HospitalAIConfig`.

### A'mad Precision Health Platform (5)
- **Genomics** - VCF/23andMe/Ancestry DNA parsing, marker extraction, risk scoring
- **Wellness** - Goals, assessments, daily health scoring
- **Health Platform** - Google Health Connect, Apple HealthKit, Samsung Health integration
- **Nutrition AI** - Meal image analysis (GPT-4o Vision), regional food database
- **Recommendations** - Multi-source health data analysis, daily health scoring

### Reports & Coding (3)
- **Reports** - Dashboard analytics, department-level reports
- **Medical Records** - Document management, consent tracking
- **Insurance Coding** - ICD-10/CPT management, payer rules, medical necessity, eClaimLink XML, OPD/IPD coding, analytics (113 endpoints)

---

## Mobile App

**Platform:** React Native + Expo SDK 54 | **54 screens** across 14 categories

| Category | Screens |
|----------|---------|
| Authentication | Login, Register, OTP Verification |
| Dashboard | Patient overview |
| Appointments | List, Book, Detail |
| Core Health | Health Hub, Insights, Symptom Checker, Health Assistant, Recommendations, Health Score |
| Medical Records | Records, Prescriptions, Lab Results (with detail views) |
| Health Sync | Device connection, Health Connect/HealthKit, manual metric logging |
| Medical History | History, Allergies |
| Fitness | Tracker, Activity Log, Goals, Statistics |
| Nutrition | Tracker, Meal Log, AI Plans |
| Wellness | Hub, Assessment, Goals, Health Coach |
| Messages | Inbox, Thread, New Message |
| Genomics | Upload, Profile |
| Billing | Summary, Bill Detail |
| Settings | Profile, Notifications, Communication, Password, About |

**Key Features:** Offline-first (TTL caching + action queue), biometric auth (Face ID / Touch ID), 15-min inactivity auto-logout, encrypted storage, push notifications with deep linking, native health platform module (`@amad/health-platform`).

---

## Getting Started

### Prerequisites
- Node.js 20+
- Python 3.11+
- Docker & Docker Compose
- PostgreSQL 15 (or use Docker)

### Quick Start (Docker)
```bash
cd hospital-management-system
docker-compose up -d

# Frontend:    http://localhost:3000
# Backend API: http://localhost:3001/api/v1
# AI Services: http://localhost:8000
# MinIO:       http://localhost:9001
```

### Manual Setup

#### Backend
```bash
cd hospital-management-system/backend
npm install
cp .env.example .env          # Edit with your config
npx prisma generate           # Generate Prisma client
npx prisma migrate dev        # Run migrations
npm run db:seed               # Seed test data
npm run dev                   # Start dev server (port 3001)
```

#### Frontend
```bash
cd hospital-management-system/frontend
npm install
npm run dev                   # Start dev server (port 3000)
```

#### AI Services
```bash
cd hospital-management-system/ai-services
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

#### Mobile App
```bash
cd hospital-management-system/mobile
npm install
npm start                     # Start Expo dev server
npm run android               # Run on Android
npm run ios                   # Run on iOS
```

### Seed Commands
```bash
cd hospital-management-system/backend
npm run db:seed               # Core test data
npm run db:seed:wellness      # Wellness/fitness data
npm run db:seed:icd10         # ICD-10 diagnosis codes
npm run db:seed:cpt           # CPT procedure codes
npm run db:seed:insurance-coding  # Both ICD-10 and CPT
npm run db:seed:amad          # A'mad precision health data
npm run db:seed:dashboard     # Dashboard analytics data
npm run db:seed:uae-drugs     # UAE pharmaceutical database
```

---

## Project Structure

```
hospital-management-system/
├── backend/                    # Node.js/Express API (87K lines)
│   ├── src/
│   │   ├── config/            # Configuration
│   │   ├── middleware/        # Auth, RBAC, validation, error handling
│   │   ├── routes/            # 67 route files (1,199+ endpoints)
│   │   ├── services/          # 99 service files (business logic)
│   │   ├── jobs/              # Cron jobs (no-show, auto-reorder)
│   │   ├── types/             # TypeScript types
│   │   └── utils/             # Utilities (response helpers)
│   └── prisma/                # Schema (213 models), migrations, seeds
├── frontend/                   # React application (150K lines)
│   └── src/
│       ├── components/        # 117 components across 25 directories
│       ├── pages/             # 134 pages across 50 modules
│       ├── hooks/             # Custom hooks
│       ├── store/             # Redux store
│       ├── services/          # API services
│       └── types/             # TypeScript types
├── ai-services/                # Python FastAPI (251K lines)
│   ├── main.py                # Entry point (3,812 lines, 60+ endpoints)
│   ├── shared/                # OpenAI client, LLM provider abstraction
│   ├── diagnostic/            # Differential diagnosis
│   ├── imaging/               # Medical image analysis
│   ├── clinical_notes/        # Note generation
│   ├── symptom_checker/       # Patient symptom assessment
│   ├── ai_scribe/             # Medical transcription
│   ├── early_warning/         # Deterioration detection
│   ├── med_safety/            # Medication safety
│   ├── smart_orders/          # Order recommendations
│   ├── pharmacy/              # Drug interactions
│   ├── insurance_coding/      # ICD-10/CPT coding
│   ├── genomic/               # Genetic analysis
│   ├── nutrition_ai/          # Meal analysis
│   ├── recommendation/        # Health recommendations
│   ├── health_assistant/      # Patient chat
│   ├── entity_extraction/     # Medical NER
│   ├── pdf_analysis/          # PDF extraction
│   ├── predictive/            # Risk prediction
│   ├── chat/                  # Booking assistant
│   ├── queue_ai/              # Wait time prediction
│   └── speech/                # Audio transcription
├── mobile/                     # React Native/Expo (54 screens)
│   └── src/
│       ├── screens/           # 54 screens across 14 categories
│       ├── navigation/        # Tab + stack navigators
│       ├── services/          # API, offline, biometric, notifications
│       ├── store/             # Redux (auth)
│       ├── hooks/             # 7 custom hooks
│       └── modules/           # Native health platform module
├── infrastructure/             # AWS deployment
│   ├── terraform/             # VPC, EC2, ALB, S3
│   ├── scripts/               # EC2 bootstrap
│   ├── docker/                # Production compose
│   └── nginx/                 # Reverse proxy
├── tests/                      # E2E tests (Playwright)
└── docker-compose.yml
```

---

## Architecture

### Multi-Tenant Data Model
All 213 Prisma models include `hospitalId` for tenant isolation. The `authorizeHospital` middleware enforces isolation at the API layer (SUPER_ADMIN bypasses).

### Authentication & Authorization
- **Staff JWT:** Access token (15 min) + refresh token (7 days)
- **Patient JWT:** Separate flow with `type: 'patient'` claim, OTP via SMS/WhatsApp
- **Hybrid RBAC:** Supports legacy role-based, dynamic permission-based, and hybrid fallback modes
- **Permission Cache:** Redis-backed for high-performance lookups

### User Roles (18)
`SUPER_ADMIN` `HOSPITAL_ADMIN` `DOCTOR` `NURSE` `RECEPTIONIST` `LAB_TECHNICIAN` `PHARMACIST` `RADIOLOGIST` `ACCOUNTANT` `PATIENT` `HR_MANAGER` `HR_STAFF` `HOUSEKEEPING_MANAGER` `HOUSEKEEPING_STAFF` `MAINTENANCE_STAFF` `SECURITY_STAFF` `DIETARY_STAFF` `MARKETING`

### Notification System
Multi-channel delivery with per-user preferences and quiet hours:
- **Email:** SendGrid (primary) → AWS SES (fallback) → SMTP (fallback)
- **SMS:** Twilio
- **WhatsApp:** Twilio (also powers the booking bot)
- **Push:** Expo Push Notifications (mobile)
- **In-App:** Database-backed with delivery tracking

### Background Jobs
| Job | Schedule | Purpose |
|-----|----------|---------|
| No-Show Cron | Every 5 min (7AM-10PM) | Marks missed appointments as NO_SHOW, stage alerts |
| Auto-Reorder | Daily at 6:00 AM | Checks inventory levels, auto-creates Purchase Requisitions |

### AI Integration
- 20 Python services via FastAPI, proxied through backend via `AI_SERVICE_URL`
- 60-second timeout on AI proxy routes
- Graceful degradation: all services fall back to rule-based when AI unavailable
- Hospital-specific Ollama support as OpenAI alternative

---

## Key API Routes

All routes prefixed with `/api/v1/`:

| Route | Module |
|-------|--------|
| `/auth` | Login, register, refresh, profile, password reset |
| `/patients`, `/doctors`, `/departments` | Master data |
| `/appointments`, `/slots` | Scheduling |
| `/opd`, `/ipd`, `/emergency`, `/surgery` | Clinical departments |
| `/laboratory`, `/radiology`, `/pharmacy` | Diagnostics |
| `/nurse`, `/clinician` | Clinical staff |
| `/billing` | Invoices, payments, claims |
| `/insurance-coding`, `/dha-eclaim`, `/pre-auth`, `/insurance-advanced` | ICD-10, CPT, payer rules, eClaimLink, DHA eligibility, pre-authorization, COB (113 endpoints) |
| `/ai`, `/ai-scribe`, `/symptom-checker`, `/clinical-notes` | AI services |
| `/early-warning`, `/med-safety`, `/smart-orders` | Clinical safety AI |
| `/hr` | Employees, shifts, attendance, payroll |
| `/procurement` | Suppliers, PRs, POs, GRNs, invoices, returns (58 endpoints) |
| `/blood-bank` | Donors, donations, components, transfusions |
| `/telemedicine` | Video sessions, recordings |
| `/patient-portal`, `/patient-auth` | Patient-facing portal |
| `/queue`, `/kiosk` | Patient flow |
| `/crm` | Leads, campaigns, surveys (48 endpoints) |
| `/notifications` | User and admin notification management |
| `/whatsapp-bot` | Conversational booking |
| `/housekeeping`, `/dietary`, `/assets`, `/ambulance` | Support services |
| `/cssd`, `/mortuary`, `/quality` | Operations |
| `/reports`, `/medical-records` | Reporting and records |
| `/genomic`, `/health-platform`, `/wellness`, `/nutrition` | A'mad Precision Health |
| `/recommendation` | Health recommendations |
| `/rbac` | Roles, permissions, audit logs |
| `/public` | Unauthenticated endpoints |

---

## Default Dev Credentials

| Role | Email | Password |
|------|-------|----------|
| Hospital Admin | admin@hospital.com | password123 |
| Doctor | dr.johnson@hospital.com | password123 |
| Receptionist | receptionist@hospital.com | password123 |
| Nurse | nurse.miller@hospital.com | password123 |
| Nurse | nurse.moore@hospital.com | password123 |
| Nurse | nurse.clark@hospital.com | password123 |
| Lab Technician | labtech@hospital.com | password123 |
| Patient Portal | kamil@taqon.ai | password123 |

---

## Environment Variables

### Backend (`backend/.env`)
```env
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://postgres:password@localhost:5432/hospital_db
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
REDIS_HOST=localhost
REDIS_PORT=6379
AI_SERVICE_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000

# Email (SendGrid primary)
SENDGRID_API_KEY=your-sendgrid-key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com

# Email (AWS SES fallback)
AWS_SES_REGION=us-east-1
AWS_SES_FROM_EMAIL=noreply@yourdomain.com
AWS_SES_ACCESS_KEY_ID=your-key
AWS_SES_SECRET_ACCESS_KEY=your-secret

# SMS / WhatsApp (Twilio)
TWILIO_ACCOUNT_SID=your-sid
TWILIO_AUTH_TOKEN=your-token
TWILIO_PHONE_NUMBER=+1234567890

# S3 / MinIO Storage
AWS_REGION=us-east-1
AWS_S3_BUCKET=hms-uploads
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
MINIO_ENDPOINT=http://minio:9000
```

### Frontend (`frontend/.env`)
```env
VITE_API_URL=http://localhost:3001/api/v1
```

### AI Services (`ai-services/.env`)
```env
OPENAI_API_KEY=your-openai-key
```

### Mobile
```env
EXPO_PUBLIC_API_URL=http://localhost:3001/api/v1
```

---

## Ports

| Service | Port |
|---------|------|
| Frontend | 3000 |
| Backend | 3001 |
| AI Services | 8000 |
| PostgreSQL | 5433 (Docker) / 5432 (local) |
| Redis | 6379 |
| MinIO API | 9000 |
| MinIO Console | 9001 |

---

## Testing

### E2E Tests (Playwright)
```bash
cd hospital-management-system
npx playwright test                          # Run all tests
npx playwright test tests/ipd-e2e.spec.ts    # Run specific test
npx playwright test --ui                     # UI mode
npx playwright show-report                   # View report
```

Test files: `tests/ipd-e2e.spec.ts`, `tests/ipd-review.spec.ts`, `tests/lab-diagnostics.spec.ts`, `tests/laboratory-e2e.spec.ts`

### Backend Tests
```bash
cd hospital-management-system/backend
npm test                      # Run Jest tests
npm test -- path/to/test.ts   # Run single test file
```

---

## Infrastructure (AWS Deployment)

```bash
cd hospital-management-system/infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply
```

**Architecture:** ALB → EC2 (t3.xlarge) running Docker Compose with all services.

**Maintenance:**
```bash
# View logs
sudo docker-compose logs -f backend

# Restart services
cd /opt/hms/app && sudo docker-compose restart

# Database backup
sudo docker exec hms-postgres pg_dump -U postgres hospital_db > backup.sql
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [PROJECT_AUDIT.md](PROJECT_AUDIT.md) | Module-by-module audit of all 50 modules |
| [FINANCE_MODULE_BRD.md](FINANCE_MODULE_BRD.md) | Finance module business requirements (7 modules) |
| [ENHANCEMENT_ROADMAP.md](ENHANCEMENT_ROADMAP.md) | Prioritized enhancement backlog (35 items, P0-P3) |
| [CLAUDE.md](../CLAUDE.md) | AI coding assistant instructions and patterns |

Subdirectory `AGENT.md` files contain detailed patterns for specific areas:
- `backend/src/routes/AGENT.md`, `backend/src/services/AGENT.md`, `backend/src/middleware/AGENT.md`
- `frontend/src/components/AGENT.md`, `frontend/src/pages/AGENT.md`, `frontend/src/services/AGENT.md`
- `mobile/src/screens/AGENT.md`, `mobile/src/services/AGENT.md`, `mobile/src/hooks/AGENT.md`, `mobile/src/navigation/AGENT.md`
- `ai-services/AGENT.md`

---

## License

This project is proprietary and confidential.

## Support

For support, please contact the engineering team or open an issue in the repository.
