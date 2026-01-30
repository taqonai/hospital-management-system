# Hospital Management System - Project Audit

**Date:** 2026-01-30
**Version:** 1.0
**Scope:** Full codebase audit of the HMS multi-tenant Cloud SaaS platform

---

## Executive Summary

| Metric | Value |
|--------|-------|
| **Total Modules** | 50 |
| **Prisma Models** | 193 |
| **Backend Route Files** | 58 |
| **Backend Service Files** | 78 |
| **Backend TypeScript Lines** | ~87,000 |
| **Frontend Pages** | 113 |
| **Frontend Components** | 103 |
| **Frontend TypeScript Lines** | ~150,000 |
| **Mobile Screens** | 51 |
| **AI Service Modules** | 20 |
| **AI Python Lines** | ~251,000 |
| **API Endpoints** | 1,031+ |
| **E2E Test Files (Playwright)** | 4 |
| **Backend Unit Tests** | 0 |
| **Cron Jobs** | 2 |
| **Overall Status** | 49/50 modules fully implemented |

**Tech Stack:**
- Backend: Node.js + Express + TypeScript + Prisma (PostgreSQL)
- Frontend: React 18 + TypeScript + TailwindCSS + Vite
- Mobile: React Native + Expo SDK 54 + TypeScript
- AI Services: Python + FastAPI + OpenAI (GPT-4o, Whisper)
- Infrastructure: Docker Compose, AWS (Terraform), Nginx

---

## 1. Clinical Modules

| Module | Backend Routes | Backend Services | Frontend Pages | Key Models | Status | Notes |
|--------|---------------|-----------------|----------------|------------|--------|-------|
| **OPD** | `opdRoutes.ts` (16 endpoints) | `opdService.ts` | `OPD/index.tsx`, `Consultation/index.tsx` | Appointment, Consultation, Prescription | Complete | Booking ticket workflow, vitals, queue check-in |
| **IPD** | `ipdRoutes.ts` (27 endpoints) | `ipdService.ts` | `IPD/index.tsx`, `IPD/AdmissionDetail.tsx` | Admission, Bed, Ward, NursingNote, DischargeSummary | Complete | Admission, discharge, bed management, nursing notes |
| **Emergency** | `emergencyRoutes.ts` (25 endpoints) | `emergencyService.ts` | `Emergency/index.tsx` + 4 sub-pages | EmergencyPage, Vital, StageAlert | Complete | Triage, resuscitation dashboard, on-call doctors, ED beds |
| **Surgery** | `surgeryRoutes.ts` (14 endpoints) | `surgeryService.ts` | `Surgery/index.tsx` | Surgery | Complete | Schedule, records, inventory tracking |
| **Appointments** | `appointmentRoutes.ts` (9 endpoints) | `appointmentService.ts` | `Appointments.tsx`, `AppointmentForm.tsx` | Appointment, DoctorSlot, NoShowLog | Complete | CRUD, slot management, no-show tracking |
| **Consultations** | via OPD routes | `consultationService.ts` | `Consultation/index.tsx` | Consultation, Prescription, PrescriptionMedication | Complete | Linked to appointments, prescriptions, lab orders |
| **Nursing** | `nurseRoutes.ts` (28 endpoints) | `nurseService.ts` | `Nursing/index.tsx` | Nurse, NurseAssignment, MedicationAdministration, NursingAssessment, IntakeOutput, ShiftHandoff, NurseTask | Complete | eMAR, vitals, I&O, handoff, assessments |

---

## 2. Diagnostics Modules

| Module | Backend Routes | Backend Services | Frontend Pages | Key Models | Status | Notes |
|--------|---------------|-----------------|----------------|------------|--------|-------|
| **Laboratory** | `laboratoryRoutes.ts` (26 endpoints) | `laboratoryService.ts` | `Laboratory/index.tsx` | LabTest, LabOrder, LabOrderTest, LabSample, SampleCustodyLog | Complete | Orders, results, chain of custody, AI analysis |
| **Radiology** | `radiologyRoutes.ts` (12 endpoints) | `radiologyService.ts` | `Radiology/index.tsx` | ImagingOrder, ImagingStudy | Complete | Orders, studies, AI-assisted reporting |
| **Pharmacy** | `pharmacyRoutes.ts` (17 endpoints) | `pharmacyService.ts` | `Pharmacy/index.tsx` + 3 sub-pages | Drug, DrugInventory, InventoryItem | Complete | Drug management, CSV import, inventory, interactions |

---

## 3. Administrative Modules

| Module | Backend Routes | Backend Services | Frontend Pages | Key Models | Status | Notes |
|--------|---------------|-----------------|----------------|------------|--------|-------|
| **Patients** | `patientRoutes.ts` (14 endpoints) | `patientService.ts` | `Patients.tsx`, `PatientForm.tsx`, `PatientDetail.tsx` | Patient, MedicalHistory, Allergy, PastSurgery, Immunization, PatientInsurance | Complete | Full CRUD, medical history, allergies, vitals |
| **Doctors** | `doctorRoutes.ts` (14 endpoints) | `doctorService.ts` | `Doctors.tsx`, `DoctorForm.tsx`, `DoctorDetail.tsx` | Doctor, DoctorSchedule, DoctorSlot, DoctorAbsence | Complete | Schedule, slots, absence management |
| **Departments** | `departmentRoutes.ts` (10 endpoints) | `departmentService.ts` | `Departments/index.tsx`, `DepartmentForm.tsx` | Department | Complete | CRUD, specializations |
| **HR** | `hrRoutes.ts` (26 endpoints) | `hrService.ts` | `HR/index.tsx`, `EmployeeLeave/index.tsx` | Employee, EmployeeDocument, Shift, ShiftSchedule, Attendance, LeaveType, LeaveBalance, LeaveRequest, Payroll, PayrollComponent, PerformanceReview, EmployeeTraining | Complete | Full HR lifecycle, payroll, attendance, training |
| **Auth/RBAC** | `authRoutes.ts` (10), `rbacRoutes.ts` (18), `patientAuthRoutes.ts` (15) | `authService.ts`, `rbacService.ts`, `patientAuthService.ts`, `permissionCacheService.ts` | `RBAC/index.tsx`, `Login.tsx`, `ForgotPassword.tsx`, `ResetPassword.tsx` | User, Session, CustomRole, RolePermission, UserPermission, UserCustomRole, RBCAuditLog | Complete | JWT + refresh, OTP, hybrid RBAC, Redis-cached permissions |

---

## 4. Support Services Modules

| Module | Backend Routes | Backend Services | Frontend Pages | Key Models | Status | Notes |
|--------|---------------|-----------------|----------------|------------|--------|-------|
| **Billing** | `billingRoutes.ts` (14 endpoints) | `billingService.ts` | `Billing/index.tsx` | Invoice, InvoiceItem, Payment, InsuranceClaim | Complete | Invoices, payments, claims, AI charge capture |
| **Blood Bank** | `bloodBankRoutes.ts` (21 endpoints) | `bloodBankService.ts` | `BloodBank/index.tsx` | BloodDonor, BloodDonation, BloodComponent, BloodRequest, BloodTransfusion | Complete | Donor registry, components, cross-match, transfusion |
| **Dietary** | `dietaryRoutes.ts` (15 endpoints) | `dietaryService.ts` | `Dietary/index.tsx` | DietPlan, PatientDiet, MealOrder | Complete | Diet plans, meal orders, patient dietary management |
| **Ambulance** | `ambulanceRoutes.ts` (16 endpoints) | `ambulanceService.ts` | -- | Ambulance, AmbulanceTrip | Complete | Fleet management, trip tracking, assignments |
| **Assets** | `assetRoutes.ts` (15 endpoints) | `assetService.ts` | `Assets/index.tsx` | Asset, AssetMaintenance | Complete | Asset lifecycle, maintenance scheduling |
| **Housekeeping** | `housekeepingRoutes.ts` (28 endpoints) | `housekeepingService.ts` | `Housekeeping/index.tsx` | HousekeepingZone, HousekeepingTask, CleaningSchedule, TaskChecklistItem, CleaningChecklist, HousekeepingInventory, InventoryUsage, AIShiftRecommendation, AICleaningPriority | Complete | Zones, tasks, checklists, AI-prioritized cleaning |
| **CSSD** | `cssdRoutes.ts` (15 endpoints) | `cssdService.ts` | -- | SterilizationItem, SterilizationCycle, SterilizationCycleItem | Complete | Sterilization tracking, cycle management |
| **Mortuary** | `mortuaryRoutes.ts` (14 endpoints) | `mortuaryService.ts` | -- | MortuaryRecord | Complete | Record management, status tracking |
| **Quality** | `qualityRoutes.ts` (17 endpoints) | `qualityService.ts` | `Quality/index.tsx` + 3 components | QualityIndicator, QIMeasurement, IncidentReport | Partial | Backend and individual components exist; main page uses placeholder tabs instead of wiring in the existing sub-components |
| **Procurement** | `procurementRoutes.ts` (58 endpoints) | 7 services (Supplier, PR, PO, GRN, Invoice, Return, Analytics) | `Procurement/` (7 pages) | Supplier, SupplierContact, SupplierDocument, SupplierContract, ContractItem, PurchaseRequisition, PRItem, PRApproval, RequestForQuotation, RFQItem, RFQSupplier, RFQQuotation, RFQQuotationItem, PurchaseOrder, POItem, POApproval, GoodsReceiptNote, GRNItem, SupplierInvoice, SupplierReturn, SupplierReturnItem, ApprovalWorkflow, ApprovalLevel | Complete | Full P2P cycle with approval workflows |

---

## 5. Digital & Patient Engagement Modules

| Module | Backend Routes | Backend Services | Frontend Pages | Key Models | Status | Notes |
|--------|---------------|-----------------|----------------|------------|--------|-------|
| **Telemedicine** | `telemedicineRoutes.ts` (19 endpoints) | `telemedicineService.ts` | `Telemedicine/index.tsx` | TeleconsultationSession | Complete | Sessions, recordings, reports, recommendations |
| **Patient Portal** | `patientPortalRoutes.ts` (37 endpoints) | `patientPortalService.ts` | `PatientPortal/` (20+ pages) | Patient, PatientNotificationPreference, PatientCommunicationPreference | Complete | Dashboard, records, billing, health sync, wellness |
| **Queue** | `queueRoutes.ts` (23 endpoints) | `queueService.ts` | `Queue/index.tsx`, `Queue/DisplayBoard.tsx`, `Queue/PatientStatus.tsx` | QueueCounter, QueueTicket, QueueConfig, QueueDisplayBoard, QueueAnalytics, QueueAnnouncement | Complete | Counter management, TV display, patient status check |
| **Kiosk** | `kioskRoutes.ts` (8 endpoints) | via queueService | `Kiosk/index.tsx` | via Queue models | Complete | Self check-in for patients |
| **CRM** | `crmRoutes.ts` (48 endpoints) | `crmService.ts` | `CRM/index.tsx` | CRMLead, CRMCommunication, CRMTemplate, CRMActivity, CRMTask, CRMCampaign, CRMSurvey, CRMSurveyResponse, CRMTag, CRMLeadTag, CRMSettings | Complete | Leads, campaigns, surveys, communications, task management |
| **Notifications** | `notificationRoutes.ts` (7), `notificationAdminRoutes.ts` (19) | `notificationService.ts`, `emailService.ts`, `twilioService.ts` | `Notifications/index.tsx`, `Settings/Notifications/` (3 pages) | Notification, NotificationSettings, NotificationTemplate, NotificationDeliveryLog, TeamContact | Complete | Multi-channel (email, SMS, push), templates, delivery logs |
| **WhatsApp Bot** | `whatsappBotRoutes.ts` (6 endpoints) | `whatsappBotService.ts`, `whatsappService.ts`, `whatsappSessionService.ts` | -- | WhatsAppSession | Complete | Conversational booking via WhatsApp, voice transcription |

---

## 6. AI Services Modules

| Module | AI Service Class | Backend Proxy | Frontend Page | AI Model | Status | Notes |
|--------|-----------------|---------------|---------------|----------|--------|-------|
| **Diagnostic AI** | `DiagnosticAI` | `aiRoutes.ts` | `DiagnosticAssistant/index.tsx` | gpt-4o + MiniLM-L6 | Complete | Symptom analysis, differential diagnosis, semantic matching |
| **AI Scribe** | `AIScribeService` | `aiScribeRoutes.ts` | `AIScribe/index.tsx` | whisper-1 + gpt-4o-mini | Complete | Medical dictation, session management, note generation |
| **Symptom Checker** | `SymptomCheckerAI` | `symptomCheckerRoutes.ts` | `SymptomChecker/index.tsx` | gpt-4o + whisper-1 | Complete | Interactive assessment, voice input, triage |
| **Early Warning** | `EarlyWarningAI` | `earlyWarningRoutes.ts` | `EarlyWarning/index.tsx` | gpt-4o-mini (+ algorithmic) | Complete | NEWS2, qSOFA, fall risk, deterioration detection |
| **Med Safety** | `MedicationSafetyAI` | `medSafetyRoutes.ts` | `MedicationSafety/index.tsx` | gpt-4o-mini (+ rule-based) | Complete | 5 Rights, barcode scan, IV compatibility, dose calc |
| **Smart Orders** | `SmartOrdersAI` | `smartOrderRoutes.ts` | `SmartOrders/index.tsx` | gpt-4o (+ rule-based) | Complete | Order recommendations, bundles, interaction checks |
| **Imaging AI** | `ImageAnalysisAI` | `aiRoutes.ts` | `MedicalImaging/index.tsx` | gpt-4o-vision | Complete | X-ray, CT, MRI interpretation |
| **Pharmacy AI** | `PharmacyAI` | `advancedPharmacyAIRoutes.ts` | `DrugInteractions/index.tsx` | gpt-4o-mini (+ knowledge base) | Complete | Drug interactions, dosing, reconciliation |
| **Clinical Notes** | `ClinicalNotesAI` | `aiRoutes.ts` | `ClinicalNotes/index.tsx` | gpt-4o-mini | Complete | SOAP, H&P, progress notes from templates |
| **PDF Analysis** | `PDFAnalysisService` | `pdfRoutes.ts` | `PDFAnalysis/index.tsx` | gpt-4o + gpt-4o-vision | Complete | Medical PDF extraction, lab result parsing |
| **Entity Extraction** | `EntityExtractionAI` | `aiRoutes.ts` | -- | gpt-4o-mini | Complete | Medical entity extraction from text |
| **Health Assistant** | `HealthAssistantAI` | `aiRoutes.ts` | `PatientPortal/HealthAssistant.tsx` | gpt-4o | Complete | Patient-facing health chat |
| **Predictive Analytics** | `PredictiveAnalytics` | `aiRoutes.ts` | `PatientRisk/index.tsx`, `RiskAnalytics/index.tsx` | Rule-based algorithmic | Complete | Readmission risk, clinical risk prediction |
| **Chat AI** | `ChatAI` | `aiRoutes.ts` | `AIAssistant.tsx` | gpt-4o-mini | Complete | Conversational booking assistant |
| **Speech** | `SpeechToTextService` | via symptom checker | via symptom checker/scribe | whisper-1 | Complete | Audio transcription |
| **Queue AI** | `QueuePredictionAI` | `queueRoutes.ts` | via Queue pages | gpt-4o-mini (+ algorithmic) | Complete | Wait time prediction, demand forecasting |
| **Insurance Coding AI** | `InsuranceCodingAI` | `insuranceCodingRoutes.ts` | `InsuranceCoding/` (8 pages) | gpt-4o-mini (+ rule-based) | Complete | ICD-10/CPT suggestions, claim prediction, necessity validation |
| **AI Consultation** | via `aiConsultationService` | `aiConsultationRoutes.ts` | -- | gpt-4o | Complete | Consultation-level AI analysis |

**Shared AI Infrastructure:**
- `shared/openai_client.py` - Centralized OpenAI client with health checks
- `shared/llm_provider.py` - LLM abstraction (OpenAI + Ollama support via `HospitalAIConfig`)
- All services implement graceful degradation to rule-based fallbacks when AI unavailable

---

## 7. A'mad Precision Health Platform

| Module | Backend Routes | Backend Services | Frontend Pages | AI Service | Mobile Screens | Key Models | Status | Notes |
|--------|---------------|-----------------|----------------|------------|---------------|------------|--------|-------|
| **Genomics** | `genomicRoutes.ts` (7 endpoints) | `genomicService.ts` | `Clinician/index.tsx`, `Clinician/PatientSummary.tsx` | `GenomicService` (rule-based) | `GenomicUploadScreen`, `GenomicProfileScreen` | GenomicProfile, GenomicMarker, GenomicRiskScore | Complete | VCF/23andMe/Ancestry parsing, marker extraction, risk scoring |
| **Wellness** | `wellnessRoutes.ts` (32 endpoints) | via wellness routes | `PatientPortal/WellnessHub.tsx` | -- | `WellnessHubScreen`, `WellnessAssessmentScreen`, `WellnessGoalsScreen`, `HealthCoachScreen` | WellnessGoal, WellnessAssessment, DailyHealthScore | Complete | Goals, assessments, health scoring |
| **Health Platform** | `healthPlatformRoutes.ts` (7 endpoints) | `healthPlatformService.ts` | `PatientPortal/HealthSync.tsx` | -- | `HealthSyncScreen`, `HealthPlatformConnectScreen`, `DeviceConnectionScreen`, `ManualMetricLogScreen` | HealthDeviceConnection, HealthMetric, HealthDataPoint | Complete | Google Health Connect, Apple HealthKit, Samsung Health |
| **Nutrition AI** | `nutritionAiRoutes.ts` (6 endpoints) | via AI services | `PatientPortal/NutritionPlan.tsx` | `NutritionAIService` (gpt-4o-vision) | `NutritionScreen`, `LogMealScreen`, `NutritionPlanScreen` | NutritionLog, NutritionPlan, FoodItem | Complete | Meal image analysis, food database, regional foods |
| **Recommendations** | `recommendationRoutes.ts` (12 endpoints) | `recommendationService.ts` | `PatientPortal/HealthInsights.tsx` | `RecommendationService` (rule-based) | `RecommendationsScreen`, `HealthScoreScreen` | Recommendation, RecommendationFeedback | Complete | Multi-source health recommendations, daily health scoring |

---

## 8. Reports & Coding Modules

| Module | Backend Routes | Backend Services | Frontend Pages | Key Models | Status | Notes |
|--------|---------------|-----------------|----------------|------------|--------|-------|
| **Reports** | `reportsRoutes.ts` (14 endpoints) | `reportsService.ts` | `Reports/index.tsx` | via aggregate queries | Complete | Dashboard analytics, department-level reports |
| **Medical Records** | `medicalRecordsRoutes.ts` (11 endpoints) | `medicalRecordsService.ts` | `PatientPortal/MedicalRecords.tsx` | MedicalDocument, ConsentForm | Complete | Document management, consent tracking |
| **Insurance Coding** | `insuranceCodingRoutes.ts` (113 endpoints) | 7 services (icd, cpt, payer, payerRules, consultationCoding, dischargeCoding, codingAnalytics) + `eclaimLinkService.ts` | `InsuranceCoding/` (8 pages) | ICD10Code, CPTCode, CPTModifier, InsurancePayer, ICD10PayerRule, CPTPayerRule, ICD10CPTMapping, ConsultationDiagnosis, ConsultationProcedure, DischargeCoding, DischargeDiagnosis, DischargeProcedure | Complete | Most comprehensive module - ICD-10/CPT management, payer rules, medical necessity, eClaimLink XML, OPD/IPD coding, analytics |

---

## 9. Mobile App Coverage

**Platform:** React Native + Expo SDK 54 | **Total Screens:** 51

| Category | Screens | Key Features |
|----------|---------|-------------|
| **Authentication** | LoginScreen, RegisterScreen, OTPVerificationScreen (3) | Email/password + OTP, phone-based auth |
| **Dashboard** | DashboardScreen (1) | Appointments, prescriptions, health score overview |
| **Appointments** | AppointmentsScreen, BookAppointmentScreen, AppointmentDetailScreen (3) | List, booking wizard, reschedule/cancel |
| **Core Health** | HealthHubScreen, HealthInsightsScreen, SymptomCheckerScreen, HealthAssistantScreen, RecommendationsScreen, HealthScoreScreen (6) | AI symptom checker, health assistant, daily score |
| **Medical Records** | MedicalRecordsScreen, PrescriptionsScreen, PrescriptionDetailScreen, LabResultsScreen, LabResultDetailScreen (5) | Consultations, prescriptions with refill, lab results |
| **Health Sync** | HealthSyncScreen, HealthPlatformConnectScreen, DeviceConnectionScreen, ManualMetricLogScreen (4) | Google Health Connect, Apple HealthKit, Samsung Health |
| **Medical History** | MedicalHistoryScreen, AllergiesScreen (2) | History, allergies management |
| **Fitness** | FitnessTrackerScreen, LogActivityScreen, FitnessGoalsScreen, FitnessStatsScreen (4) | Activity logging, goals, statistics |
| **Nutrition** | NutritionScreen, LogMealScreen, NutritionPlanScreen (3) | AI meal image analysis, meal logging, plans |
| **Wellness** | WellnessHubScreen, WellnessAssessmentScreen, WellnessGoalsScreen, HealthCoachScreen (4) | Assessment, goals, AI health coaching |
| **Messages** | MessagesScreen, MessageThreadScreen, NewMessageScreen (3) | Provider messaging, threads |
| **Genomics** | GenomicUploadScreen, GenomicProfileScreen (2) | VCF upload, genetic profile view |
| **Billing** | BillingScreen, BillDetailScreen (2) | Bill summary, itemized details |
| **Settings** | SettingsScreen, ProfileScreen, NotificationSettingsScreen, CommunicationSettingsScreen, ChangePasswordScreen, AboutScreen (6) | Profile, preferences, password change |

**Mobile Architecture Highlights:**
- Offline-first with TTL-based caching (5min-24hr)
- Action queue for offline mutations, syncs on reconnect
- Biometric authentication (Face ID, Touch ID, Fingerprint)
- 15-minute inactivity auto-logout
- Encrypted token storage (expo-secure-store)
- Push notifications with deep linking (Expo)
- Native module: `@amad/health-platform` for wearable integration

---

## 10. Cross-Cutting Concerns

### Authentication & Authorization
- **JWT**: Access token (15min) + refresh token (7 days)
- **Middleware**: `authenticate`, `authorize(...roles)`, `authorizeHospital`, `optionalAuth`
- **Hybrid RBAC**: `authorizeWithPermission(permission, legacyRoles)` - supports legacy role-based, dynamic permission-based, and hybrid fallback modes
- **Patient Auth**: Separate JWT flow with `type: 'patient'` claim, OTP via SMS/WhatsApp
- **Permission Cache**: Redis-backed for high-performance permission lookups
- **18 User Roles**: SUPER_ADMIN, HOSPITAL_ADMIN, DOCTOR, NURSE, RECEPTIONIST, LAB_TECHNICIAN, PHARMACIST, RADIOLOGIST, ACCOUNTANT, PATIENT, HR_MANAGER, HR_STAFF, HOUSEKEEPING_MANAGER, HOUSEKEEPING_STAFF, MAINTENANCE_STAFF, SECURITY_STAFF, DIETARY_STAFF, MARKETING

### Multi-Tenancy
- All 193 Prisma models include `hospitalId` for tenant isolation
- `authorizeHospital` middleware enforces isolation (SUPER_ADMIN bypasses)
- Per-hospital configuration for notifications (Twilio credentials), inventory thresholds, AI settings

### Notification System
- **Channels**: Email (SendGrid primary, AWS SES fallback, SMTP fallback), SMS (Twilio), WhatsApp (Twilio), Push (Expo), In-App
- **Templates**: Configurable per notification type and hospital
- **Delivery Tracking**: Status pipeline (pending -> sent -> delivered -> failed -> read) with retry
- **User Preferences**: Per-channel opt-in, quiet hours support

### AI Integration
- 20 AI service modules via FastAPI (Python)
- Backend proxies AI calls via `AI_SERVICE_URL`
- Graceful degradation: all services fallback to rule-based when AI unavailable
- Hospital-specific Ollama support as OpenAI alternative
- 60-second timeout for AI operations on backend proxy routes

### Error Handling
- `AppError` hierarchy with Prisma-specific error mapping (P2002, P2025, P2003, P2014)
- `asyncHandler()` wrapper for automatic Promise catch delegation
- Standardized API responses via `response.ts` helpers
- Silent notification failures (don't break business operations)

### Background Jobs
- `noShowCron.ts`: Every 5 minutes (7AM-10PM) - marks missed appointments as NO_SHOW, processes stage alerts
- `autoReorderCron.ts`: Daily at 6:00 AM - checks inventory levels across 3 types (general, housekeeping, pharmacy), auto-creates Purchase Requisitions
- Both jobs have health monitoring with consecutive failure alerts

---

## 11. Technical Debt Summary

### Critical Issues
1. **Payment transaction safety** - `billingService.ts:158-180`: Payment creation and invoice update are not wrapped in a database transaction. If the invoice update fails after payment is created, the system enters an inconsistent state.
2. **Hardcoded 'SYSTEM' user** - `billingService.ts:238`: Auto-payment on insurance claim approval uses `receivedBy: 'SYSTEM'` instead of the actual authenticated user, breaking audit trail.
3. **Missing audit fields** - Invoice, Payment, and InsuranceClaim models lack `createdBy`/`updatedBy` fields for compliance tracking.
4. **No payment amount validation** - Payments can be recorded without checking against invoice balance, risking overpayment.
5. **Insurance claim auto-payment not transactional** - `billingService.ts:225+`: Claim status update and payment creation are separate operations.

### High Priority Issues
6. **Zero backend unit tests** - Only 4 Playwright E2E test files exist. No Jest unit/integration tests for backend services.
7. **Hardcoded charge database** - `billingService.ts:435-485`: All billing codes and prices are hardcoded in service file instead of database-backed ChargeMaster.
8. **No CI/CD pipeline** - No automated testing or deployment pipeline configured.
9. **InsuranceClaim.insuranceProvider is a string** - Not linked to InsurancePayer model via foreign key.
10. **No billing cron jobs** - Missing: overdue payment reminders, claim status checks, revenue recognition scheduling.
11. **eClaimLink API not connected** - XML generation is complete (691 lines), but actual API submission to DHA is deferred.
12. **Quality module wiring** - Individual sub-components (AuditTracker, IncidentReporting, QualityIndicators) exist but main page uses placeholder tabs instead of the implemented components.

### Medium Priority Issues
13. **No frontend test suite** - No Vitest/Jest tests for React components.
14. **Duplicate payment prevention** - No unique constraint on payment reference numbers or idempotency key pattern.
15. **AI charge capture endpoints unprotected** - `/extract-charges`, `/suggest-codes`, `/estimate-cost` lack permission checks.
16. **Missing claim denial tracking** - No denial reason field, appeal history, or resubmission workflow on InsuranceClaim model.
17. **Rate limiting is basic** - Single global rate limiter; no per-endpoint or per-user limits.
18. **No webhook system** - No outbound webhooks for external system integration.

---

## 12. Module Inventory Summary

| Category | Count | Modules |
|----------|-------|---------|
| Clinical | 7 | OPD, IPD, Emergency, Surgery, Appointments, Consultations, Nursing |
| Diagnostics | 3 | Laboratory, Radiology, Pharmacy |
| Administrative | 5 | Patients, Doctors, Departments, HR, Auth/RBAC |
| Support Services | 10 | Billing, Blood Bank, Dietary, Ambulance, Assets, Housekeeping, CSSD, Mortuary, Quality, Procurement |
| Digital & Engagement | 7 | Telemedicine, Patient Portal, Queue, Kiosk, CRM, Notifications, WhatsApp Bot |
| AI Services | 18 | Diagnostic, Scribe, Symptom Checker, Early Warning, Med Safety, Smart Orders, Imaging, Pharmacy AI, Clinical Notes, PDF Analysis, Entity Extraction, Health Assistant, Predictive, Chat, Speech, Queue AI, Insurance Coding AI, AI Consultation |
| A'mad Precision Health | 5 | Genomics, Wellness, Health Platform, Nutrition AI, Recommendations |
| Reports & Coding | 3 | Reports, Medical Records, Insurance Coding |
| **Total** | **50** | **49 Complete, 1 Partial (Quality)** |
