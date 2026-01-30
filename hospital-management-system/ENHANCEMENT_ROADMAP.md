# Enhancement Roadmap

**Date:** 2026-01-30
**Version:** 1.0
**Scope:** Priority-ordered enhancement backlog for the Hospital Management System

---

## Summary Dashboard

| Priority Tier | Count | Focus |
|--------------|-------|-------|
| **P0 - Critical** (Production Safety) | 5 | Data integrity and audit compliance fixes |
| **P1 - High** (Enterprise Readiness) | 12 | Finance module, testing, CI/CD, core improvements |
| **P2 - Medium** (Feature Completeness) | 10 | Integrations, auto-billing, reporting, testing |
| **P3 - Low** (Future Enhancements) | 8 | Multi-currency, GL, advanced features |
| **Total** | **35** | |

---

## P0 - Critical (Production Safety)

### P0-001: Fix Payment Transaction Safety

**Description:** Payment recording in `billingService.ts` performs two separate database operations (create payment, update invoice) without a transaction. If the invoice update fails after payment creation, the system enters an inconsistent state where money is recorded but the invoice balance is wrong.

**Affected Files:**
- `backend/src/services/billingService.ts` (lines 143-199)

**Changes Required:**
- Wrap `prisma.payment.create()` and `prisma.invoice.update()` in `prisma.$transaction()`
- Add rollback logging on transaction failure
- Add payment amount validation against remaining invoice balance before transaction

**Dependencies:** None
**Business Impact:** High - Financial data corruption risk

---

### P0-002: Fix 'SYSTEM' User in Auto-Payment

**Description:** When an insurance claim is approved, the system auto-creates a payment with `receivedBy: 'SYSTEM'` (a hardcoded string). This breaks the audit trail because the actual claim processor is not recorded, making it impossible to trace who approved and triggered the payment.

**Affected Files:**
- `backend/src/services/billingService.ts` (line 238)
- `backend/src/routes/billingRoutes.ts` (claim status update endpoint)

**Changes Required:**
- Pass authenticated user ID from the route handler to `updateClaimStatus`
- Replace `'SYSTEM'` with the actual user ID performing the claim status update
- Add `processedBy` field to InsuranceClaim model for additional tracking

**Dependencies:** P0-003 (audit fields)
**Business Impact:** High - Audit compliance failure

---

### P0-003: Add Audit Trail Fields to Financial Models

**Description:** The Invoice, Payment, and InsuranceClaim Prisma models lack `createdBy` and `updatedBy` fields. Financial records cannot be traced to the user who created or modified them, which is a compliance requirement for healthcare billing.

**Affected Files:**
- `backend/prisma/schema.prisma` (Invoice: ~line 1898, Payment: ~line 1950, InsuranceClaim: ~line 1976)
- `backend/src/services/billingService.ts` (all create/update operations)
- `backend/src/routes/billingRoutes.ts` (pass `req.user.userId` to service methods)

**Changes Required:**
- Add `createdBy String @db.Uuid` to Invoice, Payment, InsuranceClaim models
- Add `updatedBy String? @db.Uuid` to Invoice and InsuranceClaim models
- Add `submittedBy String? @db.Uuid` and `processedBy String? @db.Uuid` to InsuranceClaim
- Update all service methods to accept and store user IDs
- Run Prisma migration

**Dependencies:** None
**Business Impact:** High - Healthcare compliance requirement

---

### P0-004: Validate Payment Amount Against Invoice Balance

**Description:** The `addPayment` method does not validate that the payment amount does not exceed the invoice's remaining balance. A payment of $10,000 against a $100 invoice would be accepted, resulting in a negative balance or data inconsistency.

**Affected Files:**
- `backend/src/services/billingService.ts` (lines 143-156)

**Changes Required:**
- Before creating payment, check `data.amount <= Number(invoice.balanceAmount)`
- Return a clear error message: "Payment amount exceeds remaining balance of X"
- Allow configuration for overpayment tolerance (e.g., for rounding)

**Dependencies:** None
**Business Impact:** High - Prevents financial data corruption

---

### P0-005: Wrap Insurance Claim Auto-Payment in Transaction

**Description:** When `updateClaimStatus` processes an approved/paid claim, it updates the claim status and then calls `addPayment` as a separate operation. If the payment creation fails, the claim is marked approved but no payment exists.

**Affected Files:**
- `backend/src/services/billingService.ts` (lines 219-243)

**Changes Required:**
- Wrap claim status update and payment creation in `prisma.$transaction()`
- Ensure claim status is only committed if payment succeeds
- Log any transaction failures for operational alerting

**Dependencies:** P0-001 (transaction pattern)
**Business Impact:** High - Financial data consistency

---

## P1 - High Priority (Enterprise Readiness)

### P1-001: Auto-Billing Engine (ChargeMaster + Fee Schedules)

**Description:** Migrate hardcoded charge database from `billingService.ts` (lines 435-485) to a database-backed ChargeMaster model. Support hospital-specific fee schedules with payer overrides and effective date ranges.

**Affected Files:**
- `backend/prisma/schema.prisma` (new ChargeMaster, FeeSchedule models)
- `backend/src/services/billingService.ts` (replace hardcoded `chargeDatabase`)
- `backend/src/routes/billingRoutes.ts` (new charge master endpoints)
- `frontend/src/pages/Billing/` (new charge master management UI)

**Dependencies:** P0-003 (audit fields)
**Business Impact:** High - Required for multi-hospital deployment

---

### P1-002: Payment Gateway Integration (Stripe)

**Description:** Enable online payment collection via Stripe, supporting patient portal and mobile app payments, webhook-based status updates, receipt generation, and refund initiation.

**Affected Files:**
- `backend/src/services/billingService.ts` (new payment gateway methods)
- `backend/src/routes/billingRoutes.ts` (payment intent, webhook, receipt endpoints)
- `backend/prisma/schema.prisma` (new PaymentTransaction model)
- `frontend/src/pages/PatientPortal/Billing.tsx` (Pay Now button)
- `mobile/src/screens/billing/BillingScreen.tsx` (in-app payment)

**Dependencies:** P0-001 (transaction safety)
**Business Impact:** High - Revenue collection

---

### P1-003: Deposit & Refund Management

**Description:** Implement advance deposit collection, deposit ledger tracking, credit note issuance, and refund approval workflow.

**Affected Files:**
- `backend/prisma/schema.prisma` (new Deposit, DepositLedger, CreditNote, Refund models)
- `backend/src/services/` (new deposit, refund services)
- `backend/src/routes/billingRoutes.ts` (deposit, credit note, refund endpoints)
- `frontend/src/pages/Billing/` (deposit and refund management UI)

**Dependencies:** P1-002 (payment gateway for refund processing)
**Business Impact:** High - Complete patient financial lifecycle

---

### P1-004: Advanced Insurance Workflow

**Description:** Implement pre-authorization requests, coverage verification, copay/deductible enforcement, claim appeals, and eClaimLink API submission.

**Affected Files:**
- `backend/prisma/schema.prisma` (new PreAuthRequest model, InsuranceClaim field additions)
- `backend/src/services/billingService.ts` (pre-auth, coverage verification)
- `backend/src/services/eclaimLinkService.ts` (API submission)
- `backend/src/routes/billingRoutes.ts` (pre-auth, appeal, eClaimLink endpoints)
- `frontend/src/pages/Billing/` (pre-auth forms, appeal workflow)

**Dependencies:** P0-003 (audit fields), Insurance Coding module (exists)
**Business Impact:** High - Reduce claim denials

---

### P1-005: Financial Reporting Suite

**Description:** Comprehensive financial reports: AR aging (30/60/90/120+ days), revenue by department/doctor/payer, collection rate analytics, tax/VAT summaries, write-off tracking with export to CSV/Excel.

**Affected Files:**
- `backend/src/services/billingService.ts` (new report queries)
- `backend/src/routes/billingRoutes.ts` (report endpoints)
- `frontend/src/pages/Billing/` or new `frontend/src/pages/FinancialReports/` (dashboard)

**Dependencies:** P1-001 (charge master for accurate categorization)
**Business Impact:** High - Financial visibility

---

### P1-006: Accounting Foundation (GL / CoA)

**Description:** Establish Chart of Accounts and General Ledger with double-entry accounting for all financial transactions. GL entries are immutable (corrections via reversing entries only).

**Affected Files:**
- `backend/prisma/schema.prisma` (new GLAccount, GLEntry models)
- `backend/src/services/` (new accountingService.ts)
- `backend/src/routes/` (new accountingRoutes.ts)
- `frontend/src/pages/` (new accounting management pages)

**Dependencies:** P1-001, P1-002, P1-003 (all financial transactions should post to GL)
**Business Impact:** Medium - Enterprise accounting compliance

---

### P1-007: Overdue Payment Reminder Cron Job

**Description:** Schedule automated reminders for overdue invoices. The notification service already has `sendOverduePaymentReminders` but no cron job triggers it. Also schedule claim status check reminders and payment due date alerts.

**Affected Files:**
- `backend/src/jobs/` (new `billingCron.ts`)
- `backend/src/jobs/index.ts` (register new cron)
- `backend/src/services/billingService.ts` (query overdue invoices)

**Dependencies:** None
**Business Impact:** High - Collections efficiency

---

### P1-008: Backend Test Coverage

**Description:** The backend has zero unit/integration test files. Establish Jest test infrastructure and write tests for critical paths: authentication, billing, insurance claims, payment processing, and RBAC.

**Affected Files:**
- `backend/jest.config.ts` (create)
- `backend/src/services/__tests__/` (new test files)
- `backend/src/routes/__tests__/` (new integration tests)
- `backend/package.json` (test script configuration)

**Dependencies:** None
**Business Impact:** High - Quality and regression prevention

---

### P1-009: CI/CD Pipeline Setup

**Description:** Establish automated testing and deployment pipeline. Should include lint, type-check, unit tests, and E2E tests on PR, with automated deployment to staging on merge.

**Affected Files:**
- `.github/workflows/` (new CI/CD workflow files)
- `hospital-management-system/` (Dockerfile optimizations)

**Dependencies:** P1-008 (tests to run)
**Business Impact:** High - Development velocity and quality

---

### P1-010: Migrate Hardcoded Charge Database to Prisma

**Description:** The `chargeDatabase` object in `billingService.ts` contains ~50 hardcoded billing codes with fixed prices (consultation $150, MRI $800, etc.). These need to be migrated to the ChargeMaster database model so prices are configurable per hospital.

**Affected Files:**
- `backend/src/services/billingService.ts` (lines 435-485, 550-751)
- `backend/prisma/seed.ts` or new seed script (populate initial ChargeMaster data)

**Dependencies:** P1-001 (ChargeMaster model)
**Business Impact:** High - Multi-hospital pricing

---

### P1-011: Link InsuranceClaim.insuranceProvider to InsurancePayer

**Description:** `InsuranceClaim.insuranceProvider` is currently a free-text string field. It should be a foreign key to the `InsurancePayer` model for data integrity and enabling payer-specific reporting.

**Affected Files:**
- `backend/prisma/schema.prisma` (InsuranceClaim model)
- `backend/src/services/billingService.ts` (claim creation/queries)
- `frontend/src/pages/Billing/` (payer dropdown instead of text input)

**Dependencies:** None
**Business Impact:** Medium - Data integrity and reporting accuracy

---

### P1-012: Add Authorization to AI Charge Capture Endpoints

**Description:** The three AI charge capture endpoints (`/extract-charges`, `/suggest-codes`, `/estimate-cost`) in `billingRoutes.ts` lack permission checks. Any authenticated user can access them.

**Affected Files:**
- `backend/src/routes/billingRoutes.ts` (lines 158-189)

**Dependencies:** None
**Business Impact:** Medium - Security

---

## P2 - Medium Priority (Feature Completeness)

### P2-001: Auto-Billing from Clinical Activities

**Description:** Automatically trigger invoice generation from clinical events: appointment completion, lab order creation, imaging order creation, pharmacy dispensing, and daily IPD charges. Build on the ChargeMaster (P1-001) to look up prices automatically.

**Affected Files:**
- `backend/src/services/billingService.ts` (new auto-billing methods)
- `backend/src/services/appointmentService.ts` (hook on completion)
- `backend/src/services/laboratoryService.ts` (hook on order creation)
- `backend/src/services/radiologyService.ts` (hook on order creation)
- `backend/src/services/pharmacyService.ts` (hook on dispensing)
- `backend/src/services/ipdService.ts` (daily charge calculation)

**Dependencies:** P1-001 (ChargeMaster), P1-010 (migrated charges)
**Business Impact:** High - Revenue capture completeness

---

### P2-002: eClaimLink API Integration

**Description:** Connect the existing XML generation code (691 lines in `eclaimLinkService.ts`) to the DHA eClaimLink API for actual claim submission. The service currently generates XML but has no API submission logic (noted as "deferred to future phase" at line 8).

**Affected Files:**
- `backend/src/services/eclaimLinkService.ts` (add API submission methods)
- `backend/src/routes/insuranceCodingRoutes.ts` (eClaimLink section, lines 1565-1685)
- `backend/.env` (eClaimLink API credentials)

**Dependencies:** P1-004 (advanced insurance workflow)
**Business Impact:** High - UAE regulatory compliance

---

### P2-003: Advanced AR Reporting

**Description:** AR aging report with 30/60/90/120+ day buckets, department-level breakdown, payer analysis, collection rate trends, and write-off tracking. Builds on the basic stats that exist today.

**Affected Files:**
- `backend/src/services/billingService.ts` (new report queries)
- `backend/src/routes/billingRoutes.ts` (new report endpoints)
- `frontend/src/pages/Billing/` or new reports page

**Dependencies:** P1-005 (financial reporting suite)
**Business Impact:** Medium - Financial visibility

---

### P2-004: Mobile Offline Improvements

**Description:** Enhance mobile offline support with better conflict resolution, background sync indicators, and offline action prioritization. Current implementation has TTL-based caching and action queue but no conflict resolution for stale data.

**Affected Files:**
- `mobile/src/services/offline/cacheManager.ts`
- `mobile/src/services/offline/actionQueue.ts`
- `mobile/src/hooks/useOfflineData.ts`

**Dependencies:** None
**Business Impact:** Medium - Patient experience in low-connectivity areas

---

### P2-005: Frontend Test Suite (Vitest)

**Description:** Establish frontend testing with Vitest and React Testing Library. Start with critical components: Billing, PatientPortal, Authentication, and RBAC.

**Affected Files:**
- `frontend/vitest.config.ts` (create)
- `frontend/src/**/__tests__/` (new test files)
- `frontend/package.json` (test dependencies and scripts)

**Dependencies:** None
**Business Impact:** Medium - Frontend quality

---

### P2-006: API Rate Limiting Enhancements

**Description:** Current rate limiting is a single global limiter. Add per-endpoint limits (stricter for auth, lenient for reads), per-user limits, and abuse detection for AI endpoints (which are expensive).

**Affected Files:**
- `backend/src/app.ts` (rate limiter configuration)
- `backend/src/middleware/` (new per-route rate limiter)
- `backend/src/routes/aiRoutes.ts` (AI-specific rate limits)

**Dependencies:** None
**Business Impact:** Medium - Security and cost control

---

### P2-007: Webhook System for External Integrations

**Description:** Implement an outbound webhook system that fires on key events (appointment created, invoice paid, lab results ready, etc.) to enable external system integration.

**Affected Files:**
- `backend/prisma/schema.prisma` (new WebhookEndpoint, WebhookDelivery models)
- `backend/src/services/` (new webhookService.ts)
- `backend/src/routes/` (new webhookRoutes.ts for management)
- `frontend/src/pages/Settings/` (webhook management UI)

**Dependencies:** None
**Business Impact:** Medium - Ecosystem integration

---

### P2-008: Bulk Operations (Invoice Generation, Payment Processing)

**Description:** Support bulk invoice generation (e.g., generate invoices for all completed appointments today) and bulk payment processing (e.g., batch insurance payment posting).

**Affected Files:**
- `backend/src/services/billingService.ts` (new bulk methods)
- `backend/src/routes/billingRoutes.ts` (bulk endpoints)
- `frontend/src/pages/Billing/` (bulk action UI)

**Dependencies:** P1-001 (ChargeMaster), P0-001 (transaction safety)
**Business Impact:** Medium - Operational efficiency

---

### P2-009: Wire Quality Module Sub-Components

**Description:** The Quality module has three implemented sub-components (`AuditTracker.tsx`, `IncidentReporting.tsx`, `QualityIndicators.tsx`) that exist in `frontend/src/pages/Quality/components/` but the main `Quality/index.tsx` page uses placeholder tabs instead of rendering these existing components.

**Affected Files:**
- `frontend/src/pages/Quality/index.tsx`
- `frontend/src/pages/Quality/components/AuditTracker.tsx`
- `frontend/src/pages/Quality/components/IncidentReporting.tsx`
- `frontend/src/pages/Quality/components/QualityIndicators.tsx`

**Dependencies:** None
**Business Impact:** Low - Feature is built but not connected

---

### P2-010: Schedule Notification Reminders

**Description:** Set up cron jobs for all notification reminders: payment due dates, appointment reminders (24h/1h before), claim status updates, lab result availability. The notification service methods exist but are not triggered automatically.

**Affected Files:**
- `backend/src/jobs/` (new notification cron files)
- `backend/src/jobs/index.ts` (register new crons)
- `backend/src/services/notificationService.ts` (existing methods to call)

**Dependencies:** P1-007 (billing cron pattern)
**Business Impact:** Medium - Patient engagement and collections

---

## P3 - Low Priority (Future Enhancements)

### P3-001: Multi-Currency Support

**Description:** Add currency field to all financial models and support currency conversion for international patients. Currently all amounts assume a single currency with no currency field.

**Affected Files:**
- `backend/prisma/schema.prisma` (add `currency` field to Invoice, Payment, ChargeMaster, etc.)
- `backend/src/services/billingService.ts` (currency handling)
- `frontend/src/pages/Billing/` (currency display)

**Dependencies:** P1-001 (ChargeMaster)
**Business Impact:** Low - International patient support

---

### P3-002: General Ledger / Chart of Accounts (Full Implementation)

**Description:** Complete GL implementation with fiscal year periods, cost center tracking, trial balance, income statement, and balance sheet generation. Extends the foundation from P1-006.

**Affected Files:**
- `backend/src/services/accountingService.ts` (enhanced)
- `backend/src/routes/accountingRoutes.ts` (financial statement endpoints)
- `frontend/src/pages/Accounting/` (new section)

**Dependencies:** P1-006 (accounting foundation)
**Business Impact:** Low - Enterprise accounting

---

### P3-003: Bank Reconciliation (MT940 Import)

**Description:** Import bank statement files (MT940/CSV format) and automatically match transactions against recorded payments for reconciliation.

**Affected Files:**
- `backend/src/services/` (new reconciliationService.ts)
- `backend/src/routes/` (new reconciliationRoutes.ts)
- `frontend/src/pages/` (reconciliation matching UI)

**Dependencies:** P1-006 (GL entries), P1-002 (payment gateway)
**Business Impact:** Low - Accounting efficiency

---

### P3-004: Payment Plan / Installment Support

**Description:** Allow patients to set up payment plans for large invoices with scheduled installments and automated reminders.

**Affected Files:**
- `backend/prisma/schema.prisma` (new PaymentPlan, Installment models)
- `backend/src/services/billingService.ts` (plan creation, installment tracking)
- `backend/src/jobs/` (installment due reminder cron)
- `frontend/src/pages/Billing/` (plan setup UI)
- `frontend/src/pages/PatientPortal/Billing.tsx` (view plan, pay installment)

**Dependencies:** P1-002 (payment gateway)
**Business Impact:** Low - Patient financial flexibility

---

### P3-005: Secondary Insurance COB (Coordination of Benefits)

**Description:** Support coordination of benefits when patients have primary and secondary insurance. Primary claim is processed first, remainder is submitted to secondary payer.

**Affected Files:**
- `backend/src/services/billingService.ts` (COB logic)
- `backend/prisma/schema.prisma` (InsuranceClaim: `isPrimary`, `linkedClaimId`)
- `frontend/src/pages/Billing/` (secondary claim UI)

**Dependencies:** P1-004 (advanced insurance)
**Business Impact:** Low - Specialized insurance scenario

---

### P3-006: Bad Debt Management Workflow

**Description:** Formal workflow for managing uncollectable invoices: aging thresholds, write-off approval workflow, collection agency referral tracking, and bad debt reporting.

**Affected Files:**
- `backend/prisma/schema.prisma` (new WriteOff model, CollectionAction model)
- `backend/src/services/` (new writeOffService.ts)
- `backend/src/routes/billingRoutes.ts` (write-off endpoints)
- `frontend/src/pages/Billing/` (write-off management UI)

**Dependencies:** P1-005 (financial reporting)
**Business Impact:** Low - Debt recovery

---

### P3-007: Advanced AI Analytics Dashboard

**Description:** Unified AI analytics dashboard showing: AI service usage across modules, accuracy metrics, cost per AI call (OpenAI usage), and recommendation effectiveness. Consolidate AI metrics from diagnostic, scribe, symptom checker, and other services.

**Affected Files:**
- `frontend/src/pages/AISettings/` (enhanced analytics section)
- `backend/src/routes/aiSettingsRoutes.ts` (new analytics endpoints)
- `ai-services/main.py` (usage tracking)

**Dependencies:** None
**Business Impact:** Low - AI governance and cost management

---

### P3-008: Mobile Telemedicine Video Support

**Description:** Add video consultation capability to the mobile app. The web frontend has telemedicine support, but the mobile app does not include video calling screens.

**Affected Files:**
- `mobile/src/screens/` (new telemedicine screens)
- `mobile/src/navigation/` (add telemedicine to health stack)
- `mobile/src/services/api/` (new telemedicine API service)

**Dependencies:** None
**Business Impact:** Low - Remote care on mobile

---

## Cross-Reference: Roadmap to BRD Modules

| Roadmap Item | BRD Module |
|-------------|-----------|
| P0-001 through P0-005 | Module 7: Technical Debt Fixes |
| P1-001, P1-010 | Module 1: Auto-Billing Engine |
| P1-002 | Module 2: Payment Gateway |
| P1-003 | Module 4: Deposit & Refund Management |
| P1-004, P2-002 | Module 3: Advanced Insurance |
| P1-005, P2-003 | Module 5: Financial Reporting |
| P1-006, P3-002 | Module 6: Accounting Foundation |
| P1-007, P1-011, P1-012 | Module 7: Technical Debt Fixes |
