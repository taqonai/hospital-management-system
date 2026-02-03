# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hospital Management System (HMS) - A multi-tenant Cloud SaaS platform with AI-integrated modules for clinical decision support, predictive analytics, and medical imaging analysis.

**Repository Structure:** All application code is in the `hospital-management-system/` subdirectory. Commands below assume you're in that directory.

### Prerequisites
- Node.js 20+
- Python 3.11+
- Docker & Docker Compose
- PostgreSQL 15 (or use Docker)

### Quick Start (Docker)
```bash
cd hospital-management-system
docker-compose up -d                # Start all services
# Frontend: http://localhost:3000
# Backend: http://localhost:3001/api/v1
# AI Services: http://localhost:8000
```

## Development Commands

### Backend (Node.js/Express/TypeScript)
```bash
cd hospital-management-system/backend
npm install
npx prisma generate          # Required after schema changes
npx prisma migrate dev       # Run migrations
npm run db:seed              # Seed test data
npm run db:seed:wellness     # Seed wellness/fitness test data
npm run db:seed:icd10        # Seed ICD-10 diagnosis codes
npm run db:seed:cpt          # Seed CPT procedure codes
npm run db:seed:insurance-coding  # Seed both ICD-10 and CPT codes
npm run db:seed:amad         # Seed A'mad precision health data
npm run db:seed:dashboard    # Seed dashboard analytics data
npm run db:seed:uae-drugs    # Seed UAE pharmaceutical database
npm run dev                  # Start dev server (port 3001)
npm run build                # TypeScript compile
npm run build:strict         # TypeScript compile with strict mode
npm test                     # Run Jest tests (note: no test files exist yet)
npm test -- path/to/test.ts  # Run single test file
npm run lint                 # ESLint
npm run fix:lab-orders       # Fix incomplete lab orders (utility script)

# Additional Prisma aliases
npm run db:generate          # Alias for prisma generate
npm run db:migrate           # Alias for prisma migrate dev
npm run db:push              # Direct schema push (skips migrations, useful for prototyping)
```

### Frontend (React/Vite/TypeScript)
```bash
cd hospital-management-system/frontend
npm install
npm run dev                  # Start dev server (port 3000)
npm run build                # TypeScript + Vite build
npm run preview              # Preview production build locally
npm run lint                 # ESLint
# Note: No test suite configured for frontend yet
```

### E2E Testing (Playwright)
```bash
cd hospital-management-system
npx playwright test                    # Run all E2E tests
npx playwright test tests/ipd-e2e.spec.ts  # Run specific test file
npx playwright test --ui               # Run tests in UI mode
npx playwright test --debug            # Run tests in debug mode
npx playwright show-report             # View test report
npx playwright codegen                 # Generate test code
```

Configuration: `playwright.config.ts` (baseURL: https://spetaar.ai, Chromium only, single worker)
Test files: `tests/ipd-e2e.spec.ts`, `tests/ipd-review.spec.ts`, `tests/lab-diagnostics.spec.ts`, `tests/laboratory-e2e.spec.ts`

### Mobile App (React Native/Expo)
```bash
cd hospital-management-system/mobile
npm install
npm start                    # Start Expo dev server
npm run android              # Run on Android emulator/device
npm run ios                  # Run on iOS simulator/device
npm run web                  # Run in browser
npm run lint                 # ESLint
npm run typecheck            # TypeScript type checking
npm run doctor               # Expo diagnostics

# EAS Build Commands
npm run build:dev            # Development build (both platforms)
npm run build:dev:ios        # Development build (iOS only)
npm run build:dev:android    # Development build (Android only)
npm run build:preview        # Preview/testing build
npm run build:prod           # Production build

# OTA Updates
npm run update:preview       # Push update to preview channel
npm run update:prod          # Push update to production channel

# App Store Submission
npm run submit:ios           # Submit latest iOS build to App Store
npm run submit:android       # Submit latest Android build to Play Store
npm run submit:all           # Submit to both stores
```

### AI Services (Python/FastAPI)
```bash
cd hospital-management-system/ai-services
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
pytest tests/                        # Run tests
pytest tests/test_diagnostic.py      # Run single test file
```

### Docker (Full Stack)
```bash
cd hospital-management-system
docker-compose up -d                          # All services
docker-compose --profile production up -d     # With nginx
docker-compose logs -f [service]              # View logs
docker-compose restart [service]              # Restart service
```

## Architecture

**Note:** Subdirectories contain `AGENT.md` files with detailed patterns and guidance specific to that area. Consult these for implementation details when working in a specific module:
- Backend: `backend/src/routes/AGENT.md`, `backend/src/services/AGENT.md`, `backend/src/middleware/AGENT.md`, `backend/src/config/AGENT.md`, `backend/src/types/AGENT.md`
- Frontend: `frontend/src/components/AGENT.md`, `frontend/src/pages/AGENT.md`, `frontend/src/services/AGENT.md`, `frontend/src/hooks/AGENT.md`
- AI Services: `ai-services/AGENT.md`
- Mobile: `mobile/src/screens/AGENT.md`, `mobile/src/services/AGENT.md`, `mobile/src/hooks/AGENT.md`, `mobile/src/navigation/AGENT.md`

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

4. **Mobile App** (React Native + Expo SDK 54 + TypeScript)
   - Patient-facing mobile portal for iOS and Android
   - Entry: `mobile/index.ts`, navigation: `mobile/src/navigation/RootNavigator.tsx`
   - State: Redux Toolkit (`mobile/src/store/`) + TanStack Query for server state
   - API client: `mobile/src/services/api/client.ts`
   - Key features: biometric auth, push notifications, offline support, secure storage
   - Native module: `@amad/health-platform` (`mobile/modules/health-platform/`) for Google Health Connect, Apple HealthKit, and Samsung Health integration

### TypeScript Path Aliases

**Backend** (`@/` resolves to `src/`):
- `@config/*`, `@middleware/*`, `@models/*`, `@routes/*`, `@services/*`, `@utils/*`, `@types/*`

**Frontend** (`@/` resolves to `src/`):
- `@components/*`, `@pages/*`, `@hooks/*`, `@store/*`, `@services/*`, `@types/*`, `@utils/*`

**Mobile**: Uses relative imports (no path aliases configured).

Note: TypeScript strict mode is disabled in backend and frontend (`"strict": false`), but enabled in mobile via Expo's base config.

### AI Services

20 Python services in `ai-services/`, each in its own directory with `service.py` and optional `knowledge_base.py`. All initialized in `ai-services/main.py`. See `ai-services/AGENT.md` for detailed patterns.

**Models:** `gpt-4o` (complex: imaging, diagnosis, triage), `gpt-4o-mini` (simple: chat, SOAP notes, entity extraction), `whisper-1` (voice transcription), `all-MiniLM-L6-v2` (local semantic matching), plus rule-based algorithms. OpenAI requires `OPENAI_API_KEY`; SentenceTransformers and rule-based run locally.

**Ollama Support:** Hospital-specific Ollama as OpenAI alternative via `ai-services/shared/llm_provider.py` (`HospitalAIConfig`).

All services implement graceful degradation to rule-based fallbacks when OpenAI is unavailable. Backend proxies AI calls with a 60-second timeout.

### Platform Scale

| Metric | Value |
|--------|-------|
| Prisma Models | 193 (~7800 lines in `backend/prisma/schema.prisma`) |
| API Endpoints | 1,031+ |
| Frontend Pages | 113 |
| Mobile Screens | 51 |
| AI Services | 20 |
| Backend Route Files | 68+ |

### Multi-Tenant Data Model

All entities include `hospitalId` for tenant isolation. The `authorizeHospital` middleware enforces isolation at the API layer (`SUPER_ADMIN` bypasses).

### User Roles (UserRole enum)
SUPER_ADMIN, HOSPITAL_ADMIN, DOCTOR, NURSE, RECEPTIONIST, LAB_TECHNICIAN, PHARMACIST, RADIOLOGIST, ACCOUNTANT, PATIENT, HR_MANAGER, HR_STAFF, HOUSEKEEPING_MANAGER, HOUSEKEEPING_STAFF, MAINTENANCE_STAFF, SECURITY_STAFF, DIETARY_STAFF, MARKETING

### Backend Route Pattern
Routes in `backend/src/routes/`, services in `backend/src/services/`. Each module follows:
- `{module}Routes.ts` - Express router with endpoints
- `{module}Service.ts` - Business logic with Prisma queries
- Middleware chain: `authenticate` → `authorize(...roles)` → `authorizeHospital` → `asyncHandler(controller)`
- Route handlers use `asyncHandler` wrapper from `backend/src/utils/asyncHandler.ts` to catch async errors

**Standardized API responses** (`backend/src/utils/response.ts`): All endpoints must use the response helpers for consistent JSON format:
- `sendSuccess(res, data, message)` - 200 with `{ success: true, data, message }`
- `sendCreated(res, data, message)` - 201
- `sendPaginated(res, data, pagination, message)` - 200 with pagination info
- `sendError(res, message, statusCode)` / `sendNotFound` / `sendUnauthorized` / `sendForbidden`
- `calculatePagination(page, limit, total)` - Helper for paginated queries

### Background Jobs
Cron jobs in `backend/src/jobs/`, initialized on server start from `app.ts`:
- `noShowCron.ts` - Marks missed appointments as NO_SHOW
- `autoReorderCron.ts` - Pharmacy auto-reorder for low stock items

Key routes (`/api/v1/`):
- `/auth`, `/patient-auth` - Staff JWT login, patient OTP login
- `/patients`, `/doctors`, `/appointments`, `/departments` - Core entities
- `/ai`, `/ai-scribe`, `/symptom-checker`, `/ai-consultation`, `/ai-settings` - AI endpoints
- `/laboratory`, `/radiology`, `/pharmacy`, `/advanced-pharmacy-ai` - Diagnostics
- `/ipd`, `/opd`, `/emergency`, `/surgery` - Clinical departments
- `/nurse`, `/clinician` - Clinical staff workflows
- `/hr`, `/billing`, `/financial-reporting`, `/blood-bank` - Support services
- `/queue`, `/kiosk` - Patient flow
- `/telemedicine`, `/patient-portal` - Remote care
- `/medical-records`, `/dietary`, `/assets`, `/ambulance` - Ancillary services
- `/cssd`, `/mortuary`, `/housekeeping`, `/quality`, `/reports` - Operations
- `/early-warning`, `/med-safety`, `/smart-orders` - Clinical safety AI
- `/procurement` - Purchase orders, vendors, goods receipt
- `/crm` - Marketing campaigns, surveys, leads
- `/genomic`, `/health-platform`, `/wellness`, `/nutrition`, `/recommendation` - A'mad precision health
- `/insurance-coding`, `/pre-auth` - Insurance coding and pre-authorization
- `/referral`, `/no-show` - Referrals and no-show management
- `/notifications`, `/whatsapp-bot` - Notifications and WhatsApp booking bot
- `/rbac` - Role and permission management
- `/public` - Unauthenticated endpoints

### Authentication
- **Staff JWT:** Access token (15m) + refresh token (7d) via `/api/v1/auth`
- **Patient JWT:** Separate flow with `type: 'patient'` claim, OTP via SMS/WhatsApp via `/api/v1/patient-auth`
- `authenticate` middleware validates Bearer token
- `authorize(...roles)` middleware for RBAC
- `authorizeHospital` ensures tenant isolation
- `optionalAuth` for endpoints with optional authentication
- Password reset: Email-based OTP for staff and patients (separate endpoints)

### RBAC (Role-Based Access Control)
- Custom roles with granular permissions stored in database (`CustomRole`, `UserPermission`)
- Permission format: `module:action` (e.g., `patients:read`, `billing:write`)
- RBAC audit logging via `RBACAuditLog` model
- Routes: `/api/v1/rbac/*` - Role and permission management
- Middleware: `rbac.ts` for permission checking

### Notification System
- Multi-channel: Email (SendGrid → SES → SMTP), SMS (Twilio per-hospital + AWS SNS), WhatsApp (Twilio), Push (Expo)
- Email templates for: appointment reminders, password reset, OTP verification, lab results
- Twilio config is per-hospital (stored in DB `HospitalSettings`), not just env vars
- Push notifications for mobile app (managed via `/api/v1/notifications`)
- Service location: `backend/src/services/notificationService.ts`, `backend/src/services/emailService.ts`, `backend/src/services/twilioService.ts`

### Unified Booking Workflow

The **Appointment** entity is the central record linking all clinical data (vitals, consultation, lab orders, notes). Data flows through roles with automatic polling for updates.

**Key Endpoints:**
- `GET /api/v1/opd/booking-ticket/:appointmentId` - Unified booking data
- `GET /api/v1/opd/patient-history/:patientId` - Past appointments for context

**Frontend Components:** `frontend/src/components/booking/` contains BookingTicket, BookingStatusTimeline, VitalsSummaryCard, and LabOrdersCard. Uses `useBookingData.ts` hook for polling (15-30s).

**Data Chain:** Appointment → Consultation → LabOrder (linked via `consultationId` and `appointmentId`)

### Mobile App Architecture

Patient-facing portal (51 screens). Entry: `mobile/index.ts` → `mobile/src/navigation/RootNavigator.tsx`.

**Navigation:** RootNavigator → AuthNavigator (Login/Register/OTP) or MainNavigator (4 bottom tabs: Home, Appointments, Health, Settings). See `mobile/src/navigation/AGENT.md`.

**Key patterns:** Offline-first with TTL caching + action queue, biometric auth, 15min inactivity timeout, auto token refresh on 401, encrypted storage via expo-secure-store.

See `mobile/src/*/AGENT.md` files for detailed implementation patterns.

## Configuration

### Environment Variables
**Backend** (`backend/.env`, see `backend/.env.example` for all options):
- `DATABASE_URL` - PostgreSQL connection
- `JWT_SECRET`, `JWT_REFRESH_SECRET`
- `AI_SERVICE_URL` (default: http://localhost:8000)
- `REDIS_HOST`, `REDIS_PORT`
- `ENCRYPTION_KEY` - Required for data encryption (32+ chars)
- `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX` - API rate limiting
- `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL` - Primary email provider
- `AWS_SES_REGION`, `AWS_SES_FROM_EMAIL`, `AWS_SES_ACCESS_KEY_ID`, `AWS_SES_SECRET_ACCESS_KEY` - Fallback email (SES)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` - Last-resort email (SMTP)
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER` - WhatsApp (per-hospital Twilio config for SMS/WhatsApp stored in DB)
- `AWS_SNS_REGION`, `AWS_SNS_SENDER_ID` - SMS via AWS SNS
- `NOTIFICATIONS_EMAIL_ENABLED`, `NOTIFICATIONS_SMS_ENABLED`, `NOTIFICATIONS_WHATSAPP_ENABLED` - Toggle notification channels
- `FRONTEND_URL` - Frontend URL for email links

**Frontend** (`frontend/.env`):
- `VITE_API_URL` (default: http://localhost:3001/api/v1)

**AI Services** (`ai-services/.env`):
- `OPENAI_API_KEY` - Required for Whisper, GPT models

**Mobile** (`mobile/.env` or Expo config):
- `EXPO_PUBLIC_API_URL` - Backend API URL (default: http://localhost:3001/api/v1)
- Configure EAS project ID in `app.json` → `extra.eas.projectId`

**S3/Storage** (in `backend/.env`):
- `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` - For AWS S3
- `MINIO_ENDPOINT` - For local MinIO (default: http://minio:9000)
- S3 is prioritized over MinIO when AWS credentials are configured

**Email Service** (priority chain in `backend/src/services/emailService.ts`):
1. SendGrid (if `SENDGRID_API_KEY` set)
2. AWS SES (if SES credentials set and SendGrid not configured)
3. SMTP (if `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` set and above not configured)
- Falls through automatically on failure

### Default Dev Credentials
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

### Ports
| Service | Port |
|---------|------|
| Frontend | 3000 |
| Backend | 3001 |
| AI Services | 8000 |
| PostgreSQL | 5433 (Docker) / 5432 (local) |
| Redis | 6379 |
| MinIO | 9000 (API), 9001 (Console) |

## Infrastructure (AWS Deployment)

Located in `infrastructure/`:
```bash
cd hospital-management-system/infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars  # Configure variables
terraform init
terraform plan
terraform apply
```

Architecture: ALB → EC2 (t3.xlarge) running Docker Compose with all services.

Key files:
- `terraform/` - Terraform IaC (VPC, EC2, ALB, S3, Lambda, monitoring)
- `terraform/lambda/` - Lambda functions for automated operations
- `terraform/monitoring.tf` - CloudWatch monitoring and alerting
- `scripts/user-data.sh` - EC2 bootstrap script
- `docker/docker-compose.prod.yml` - Production compose
- `nginx/nginx.conf` - Reverse proxy config

No CI/CD pipeline is configured; deployments are manual via Terraform + Docker Compose on EC2.

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
- Accessing properties on `undefined` (e.g., `user.name` before user loads) - add null checks or loading states
- API response structure mismatch - always validate response shape before destructuring

### Permission Denied Errors
Check route authorization in `backend/src/routes/{module}Routes.ts`. Ensure the user's role is included in the `authorize()` middleware call.

### Prisma Issues
The schema is ~7800 lines with 193 models, so `prisma generate` and `prisma migrate dev` can be slow. After schema changes:
```bash
npx prisma generate          # Regenerate client (required after any schema change)
npx prisma migrate dev       # Create migration + apply (use for committed changes)
npx prisma db push           # Direct push without migration file (faster for prototyping)
```
Use `npm run db:push` for rapid iteration during development; use `npm run db:migrate` for changes that need a migration file.

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

### Mobile App Issues
- **Expo doctor**: Run `npm run doctor` to diagnose common Expo issues
- **Metro bundler cache**: Clear with `npx expo start --clear`
- **iOS simulator**: Requires macOS with Xcode installed
- **Android emulator**: Requires Android Studio with an AVD configured
- **Push notifications**: Requires physical device (simulators don't support push)
- **Biometric auth**: Test on physical device; simulators have limited support

### Type Safety with API Responses
When working with API responses in frontend/mobile code:
```typescript
// Always validate and coerce numeric values from API
const total = Number(response.amount || 0).toFixed(2);  // Safe
// NOT: response.amount.toFixed(2)  // May crash if string

// Always null-check before accessing properties
const name = user?.name ?? 'Unknown';  // Safe
// NOT: user.name  // May crash if undefined
```
