# Finance Module - Business Requirements Document

**Date:** 2026-01-30
**Version:** 1.0
**Status:** Draft
**Author:** Engineering Team

---

## 1. Current State Assessment

### 1.1 What Exists Today

The HMS billing module provides foundational invoicing, payment recording, and insurance claim management. Below is a feature-by-feature assessment with file references.

#### Invoice Management
- **Files:** `backend/src/services/billingService.ts` (lines 19-141), `backend/src/routes/billingRoutes.ts` (lines 10-61)
- CRUD operations for invoices with line items
- Flat percentage discount and tax calculation
- Status lifecycle: PENDING -> PARTIALLY_PAID -> PAID -> CANCELLED -> REFUNDED
- Invoice number auto-generation
- Patient billing statement generation

#### Payment Recording
- **Files:** `backend/src/services/billingService.ts` (lines 143-199)
- 7 payment methods: CASH, CREDIT_CARD, DEBIT_CARD, UPI, NET_BANKING, INSURANCE, CHEQUE
- Manual payment recording by staff (no online payments)
- Automatic invoice status updates on payment
- Payment confirmation notifications via email/SMS

#### Insurance Claims
- **Files:** `backend/src/services/billingService.ts` (lines 201-300)
- Claim submission against invoices
- Status tracking: DRAFT -> SUBMITTED -> UNDER_REVIEW -> APPROVED -> PARTIALLY_APPROVED -> REJECTED -> PAID
- Auto-payment creation on claim approval
- Claim amount and approved amount tracking

#### Insurance Coding (ICD-10 / CPT)
- **Files:** `backend/src/routes/insuranceCodingRoutes.ts` (1,687 lines), 7 backend services
- Comprehensive ICD-10 and CPT code management with CSV import
- Payer-specific rules (coverage, pre-auth requirements, age/gender restrictions)
- Medical necessity validation (ICD-CPT mappings)
- OPD consultation coding and IPD discharge coding workflows
- AI-assisted code suggestion, claim acceptance prediction
- eClaimLink XML generation for DHA submission (691 lines in `eclaimLinkService.ts`)
- Analytics: usage distribution, revenue by category, AI adoption metrics

#### AI Billing Features
- **Files:** `backend/src/services/billingService.ts` (lines 488-751)
- Charge extraction from clinical notes (NLP keyword matching)
- Billing code suggestion based on diagnosis/procedures
- Procedure cost estimation with insurance coverage
- All prices from hardcoded in-memory database

#### Patient Portal Billing View
- **Files:** `frontend/src/pages/PatientPortal/Billing.tsx`, `frontend/src/pages/PatientPortal/components/BillingOverview.tsx`
- Read-only view of invoices and payment history
- No online payment capability

#### Supplier Invoices / Accounts Payable
- **Files:** `backend/src/services/procurementInvoiceService.ts`
- Supplier invoice recording against Purchase Orders
- Three-way matching (PO -> GRN -> Invoice)
- Payment tracking for supplier invoices

#### Billing Statistics
- **Files:** `backend/src/services/billingService.ts` (lines 301-430)
- Today's revenue, pending payments count, claims submitted, denied claims count
- Outstanding payments report with aging

### 1.2 Maturity Scorecard

| Capability | Score (1-10) | Notes |
|-----------|-------------|-------|
| Invoice Management | 7 | Solid CRUD, missing charge master |
| Payment Processing | 4 | Manual only, no gateway, no transactions |
| Insurance Claims | 5 | Basic workflow, no pre-auth, no appeals |
| Insurance Coding | 9 | Most complete module in system |
| Financial Reporting | 3 | Basic stats, no AR aging, no GL |
| Audit Trail | 2 | No createdBy/updatedBy fields |
| **Overall** | **6/10** | Foundation exists, needs enterprise features |

---

## 2. Gap Analysis

### Critical Gaps (Production Blockers)
| Gap | Impact | Current State |
|-----|--------|---------------|
| Non-atomic payment processing | Data corruption risk | Payment + invoice update are separate DB calls |
| Missing audit trail | Compliance failure | No createdBy/updatedBy on financial records |
| Hardcoded 'SYSTEM' user | Audit gap | Insurance auto-payments untraceable |
| No payment validation | Overpayment risk | Amount not checked against balance |

### High Gaps (Enterprise Readiness)
| Gap | Impact | Current State |
|-----|--------|---------------|
| No online payments | Revenue loss | Staff-only manual recording |
| Hardcoded prices | Multi-hospital impossible | Prices embedded in TypeScript code |
| No deposit management | Patient deposits untracked | No advance payment system |
| No refund workflow | Manual process | REFUNDED status exists but no logic |
| No AR aging reports | Cash flow blind spots | Only basic outstanding list |

### Medium Gaps (Feature Completeness)
| Gap | Impact | Current State |
|-----|--------|---------------|
| No pre-authorization | Claim denials | CPT rules track pre-auth but not enforced |
| No payment reminders | Collections inefficiency | notificationService has method but no cron |
| No credit notes | Cannot offset invoices | Not implemented |
| eClaimLink API disconnected | Manual claim submission | XML generation exists, API submission deferred |
| No auto-billing | Manual invoice creation | Staff must create invoices manually from services |

---

## 3. Requirements

### Module 1: Auto-Billing Engine

**Description:** Automatically generate invoices from clinical activities (appointments, lab orders, imaging, pharmacy dispensing, IPD stays) using a database-backed charge master with hospital-specific fee schedules.

#### Functional Requirements

| ID | Requirement | Priority |
|----|------------|----------|
| FR-1.1 | System shall maintain a ChargeMaster table with standardized charges for all billable services | Must |
| FR-1.2 | System shall support hospital-specific FeeSchedule overrides linked to ChargeMaster | Must |
| FR-1.3 | System shall auto-generate invoice when appointment is completed (status = COMPLETED) | Must |
| FR-1.4 | System shall auto-add lab order charges to invoice when LabOrder is created | Must |
| FR-1.5 | System shall auto-add imaging charges when ImagingOrder is created | Must |
| FR-1.6 | System shall auto-add pharmacy dispensing charges on prescription fulfillment | Should |
| FR-1.7 | System shall auto-calculate IPD charges daily (room, nursing, consumables) | Should |
| FR-1.8 | System shall support charge category classification (consultation, procedure, lab, imaging, pharmacy, room, supply) | Must |
| FR-1.9 | System shall allow manual charge additions/overrides on auto-generated invoices | Must |
| FR-1.10 | System shall log all charge master price changes with effective dates | Must |

#### Data Model Changes

| Model | Fields | Notes |
|-------|--------|-------|
| `ChargeMaster` | id, hospitalId, code, description, category, defaultPrice, currency, unit, isActive, effectiveFrom, effectiveTo, createdAt, updatedAt, createdBy | Standardized charge catalog |
| `FeeSchedule` | id, hospitalId, chargeId, payerId?, price, discount?, effectiveFrom, effectiveTo, createdAt, updatedAt, createdBy | Hospital/payer-specific pricing |

#### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/billing/charge-master` | List charges with filters |
| POST | `/api/v1/billing/charge-master` | Create charge |
| PUT | `/api/v1/billing/charge-master/:id` | Update charge |
| GET | `/api/v1/billing/fee-schedules` | List fee schedules |
| POST | `/api/v1/billing/fee-schedules` | Create fee schedule |
| PUT | `/api/v1/billing/fee-schedules/:id` | Update fee schedule |
| POST | `/api/v1/billing/auto-generate/:appointmentId` | Trigger auto-billing for appointment |

#### Frontend Changes
- New "Charge Master" management page under Billing
- Fee schedule editor with payer-specific pricing
- Auto-billing configuration settings

#### Acceptance Criteria
- [ ] Completing an appointment auto-generates an invoice with charges from ChargeMaster
- [ ] Hospital-specific fee schedules override default ChargeMaster prices
- [ ] All price changes are logged with effective dates
- [ ] Manual overrides are possible on auto-generated invoices
- [ ] IPD daily charges accumulate correctly

---

### Module 2: Payment Gateway Integration

**Description:** Enable online payment collection via Stripe (or similar gateway), supporting patient portal payments, payment status lifecycle, receipt generation, and reconciliation.

#### Functional Requirements

| ID | Requirement | Priority |
|----|------------|----------|
| FR-2.1 | System shall integrate with Stripe for online payment processing | Must |
| FR-2.2 | System shall support payment intents with client-side confirmation | Must |
| FR-2.3 | System shall handle webhook callbacks for payment status updates | Must |
| FR-2.4 | System shall generate PDF payment receipts | Should |
| FR-2.5 | Patient portal shall display "Pay Now" button on outstanding invoices | Must |
| FR-2.6 | System shall support partial payments via gateway | Must |
| FR-2.7 | System shall store payment gateway references (not card details) | Must |
| FR-2.8 | System shall support refund initiation via gateway | Should |
| FR-2.9 | Mobile app shall support in-app payment (Stripe SDK) | Should |
| FR-2.10 | All payment + invoice updates shall be wrapped in database transactions | Must |

#### Data Model Changes

| Model | Fields | Notes |
|-------|--------|-------|
| `PaymentTransaction` | id, hospitalId, invoiceId, paymentId, gatewayProvider, gatewayTransactionId, gatewayStatus, amount, currency, paymentMethodType, last4, receiptUrl, metadata, createdAt, updatedAt | Gateway transaction log |

#### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/billing/payments/create-intent` | Create Stripe payment intent |
| POST | `/api/v1/billing/payments/confirm` | Confirm payment |
| POST | `/api/v1/billing/payments/webhook` | Stripe webhook handler |
| GET | `/api/v1/billing/payments/:id/receipt` | Download receipt PDF |
| POST | `/api/v1/billing/payments/:id/refund` | Initiate refund via gateway |

#### Frontend Changes
- "Pay Now" button on Patient Portal billing page
- Payment confirmation flow with Stripe Elements
- Receipt download link on payment history
- Refund initiation UI for admin/accountant

#### Acceptance Criteria
- [ ] Patient can pay outstanding invoice from portal using credit/debit card
- [ ] Payment status updates are received via webhook and invoice is updated atomically
- [ ] Payment + invoice update is a single database transaction
- [ ] Receipt PDF is generated and accessible
- [ ] Failed payments are logged with gateway error details

---

### Module 3: Advanced Insurance Workflow

**Description:** Implement pre-authorization workflow, real-time coverage verification, copay/deductible enforcement, coordination of benefits (COB), appeals tracking, and eClaimLink API submission.

#### Functional Requirements

| ID | Requirement | Priority |
|----|------------|----------|
| FR-3.1 | System shall support pre-authorization requests before procedures requiring it | Must |
| FR-3.2 | System shall verify patient insurance coverage at check-in | Must |
| FR-3.3 | System shall calculate and enforce copay amounts at point of service | Must |
| FR-3.4 | System shall track deductible balances per patient per plan year | Should |
| FR-3.5 | System shall support claim appeals with reason codes and documentation | Must |
| FR-3.6 | System shall connect eClaimLink XML generation to DHA API for submission | Should |
| FR-3.7 | System shall support coordination of benefits for secondary insurance | Could |
| FR-3.8 | System shall track pre-auth approval/denial with reference numbers | Must |
| FR-3.9 | System shall auto-flag procedures requiring pre-auth based on CPT payer rules | Must |
| FR-3.10 | System shall support claim resubmission with correction codes | Should |

#### Data Model Changes

| Model | Fields | Notes |
|-------|--------|-------|
| `PreAuthRequest` | id, hospitalId, patientId, insurancePolicyId, payerId, procedureCPTCode, diagnosisICDCode, requestedDate, urgency, clinicalJustification, status (PENDING/APPROVED/DENIED/EXPIRED), authorizationNumber, approvedUnits, approvedFrom, approvedTo, denialReason, createdAt, updatedAt, createdBy | Pre-authorization tracking |

Add to `InsuranceClaim`: `denialReasonCode`, `appealNotes`, `appealDate`, `appealStatus`, `resubmissionCode`, `originalClaimId`, `submittedBy`, `processedBy`

#### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/billing/pre-auth` | Create pre-authorization request |
| GET | `/api/v1/billing/pre-auth` | List pre-auth requests |
| PATCH | `/api/v1/billing/pre-auth/:id/status` | Update pre-auth status |
| POST | `/api/v1/billing/claims/:id/appeal` | File claim appeal |
| POST | `/api/v1/billing/claims/:id/resubmit` | Resubmit corrected claim |
| GET | `/api/v1/billing/patients/:id/coverage` | Verify coverage |
| POST | `/api/v1/billing/eclaim/submit` | Submit claim to eClaimLink API |
| POST | `/api/v1/billing/eclaim/submit-batch` | Batch submit claims |

#### Frontend Changes
- Pre-authorization request form in consultation flow
- Coverage verification widget at check-in
- Appeal workflow on rejected claims
- eClaimLink submission dashboard with status tracking

#### Acceptance Criteria
- [ ] Procedures with CPT rules requiring pre-auth are flagged before scheduling
- [ ] Pre-auth approval number can be attached to insurance claims
- [ ] Rejected claims can be appealed with documentation
- [ ] eClaimLink XML submission to DHA completes via API (not just generation)

---

### Module 4: Deposit & Refund Management

**Description:** Manage advance patient deposits (e.g., IPD admissions), maintain a deposit ledger, issue credit notes, and process refund approvals.

#### Functional Requirements

| ID | Requirement | Priority |
|----|------------|----------|
| FR-4.1 | System shall record advance deposits against a patient account | Must |
| FR-4.2 | System shall maintain a deposit ledger showing all deposits and utilizations | Must |
| FR-4.3 | System shall auto-apply deposit balance to invoices during billing | Must |
| FR-4.4 | System shall generate credit notes for overpayments or cancelled services | Must |
| FR-4.5 | System shall support refund approval workflow (request -> approve -> process) | Must |
| FR-4.6 | System shall track refund method (original payment method, cash, cheque) | Must |
| FR-4.7 | System shall prevent negative deposit balances | Must |
| FR-4.8 | System shall display deposit balance on patient billing summary | Must |

#### Data Model Changes

| Model | Fields | Notes |
|-------|--------|-------|
| `Deposit` | id, hospitalId, patientId, amount, currency, paymentMethod, referenceNumber, reason, status (ACTIVE/UTILIZED/REFUNDED), remainingBalance, createdAt, updatedAt, createdBy | Advance deposit |
| `DepositLedger` | id, depositId, type (DEPOSIT/UTILIZATION/REFUND), amount, invoiceId?, description, createdAt, createdBy | Deposit movement log |
| `CreditNote` | id, hospitalId, invoiceId, patientId, amount, reason, status (DRAFT/ISSUED/APPLIED/CANCELLED), appliedToInvoiceId?, createdAt, updatedAt, createdBy | Credit notes |
| `Refund` | id, hospitalId, patientId, depositId?, creditNoteId?, paymentId?, amount, refundMethod, status (REQUESTED/APPROVED/PROCESSED/REJECTED), approvedBy, processedAt, bankDetails?, createdAt, updatedAt, createdBy | Refund tracking |

#### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/billing/deposits` | Record deposit |
| GET | `/api/v1/billing/deposits` | List deposits |
| GET | `/api/v1/billing/patients/:id/deposit-balance` | Get patient deposit balance |
| GET | `/api/v1/billing/deposits/:id/ledger` | Get deposit ledger |
| POST | `/api/v1/billing/credit-notes` | Create credit note |
| POST | `/api/v1/billing/credit-notes/:id/apply` | Apply credit note to invoice |
| POST | `/api/v1/billing/refunds` | Request refund |
| PATCH | `/api/v1/billing/refunds/:id/approve` | Approve refund |
| PATCH | `/api/v1/billing/refunds/:id/process` | Mark refund processed |

#### Frontend Changes
- Deposit recording form in billing
- Deposit ledger view per patient
- Credit note creation and application
- Refund request and approval queue

#### Acceptance Criteria
- [ ] IPD admission can collect advance deposit tracked on patient account
- [ ] Deposit balance is automatically applied to invoices at checkout
- [ ] Credit notes offset future or past invoices
- [ ] Refund workflow requires approval before processing
- [ ] Deposit balance is visible on patient billing summary

---

### Module 5: Financial Reporting

**Description:** Comprehensive financial reports including AR aging, revenue by department/doctor/payer, collection analytics, tax/VAT summaries, and write-off tracking.

#### Functional Requirements

| ID | Requirement | Priority |
|----|------------|----------|
| FR-5.1 | System shall generate AR aging report with 30/60/90/120+ day buckets | Must |
| FR-5.2 | System shall report revenue breakdown by department | Must |
| FR-5.3 | System shall report revenue breakdown by doctor | Must |
| FR-5.4 | System shall report revenue breakdown by payer (insurance vs self-pay) | Must |
| FR-5.5 | System shall report collection rate (collected / billed) over time | Must |
| FR-5.6 | System shall generate tax/VAT summary report | Should |
| FR-5.7 | System shall track and report write-offs with approval | Should |
| FR-5.8 | System shall export financial reports to CSV/Excel | Must |
| FR-5.9 | System shall display financial dashboards with date range filtering | Must |
| FR-5.10 | System shall track daily/weekly/monthly revenue trends | Must |

#### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/billing/reports/ar-aging` | AR aging report |
| GET | `/api/v1/billing/reports/revenue-by-department` | Department revenue breakdown |
| GET | `/api/v1/billing/reports/revenue-by-doctor` | Doctor revenue breakdown |
| GET | `/api/v1/billing/reports/revenue-by-payer` | Payer revenue breakdown |
| GET | `/api/v1/billing/reports/collection-rate` | Collection analytics |
| GET | `/api/v1/billing/reports/tax-summary` | Tax/VAT summary |
| GET | `/api/v1/billing/reports/write-offs` | Write-off report |
| POST | `/api/v1/billing/write-offs` | Record write-off |
| GET | `/api/v1/billing/reports/revenue-trends` | Revenue trends over time |

#### Frontend Changes
- Financial reporting dashboard with date range picker
- AR aging chart (stacked bar: 30/60/90/120+ days)
- Revenue breakdown pie/bar charts by department, doctor, payer
- Collection rate trend line
- Export buttons (CSV/Excel) on all reports
- Write-off recording and approval interface

#### Acceptance Criteria
- [ ] AR aging report correctly buckets invoices by days overdue
- [ ] Revenue reports are filterable by date range
- [ ] Export to CSV produces valid spreadsheet data
- [ ] Dashboard loads within 3 seconds for typical data volumes

---

### Module 6: Accounting Foundation

**Description:** Establish basic accounting infrastructure: Chart of Accounts (CoA), General Ledger (GL) entries for financial transactions, revenue recognition rules, and cost center tracking.

#### Functional Requirements

| ID | Requirement | Priority |
|----|------------|----------|
| FR-6.1 | System shall maintain a Chart of Accounts (CoA) with account types (Asset, Liability, Revenue, Expense, Equity) | Must |
| FR-6.2 | System shall create GL entries for all financial transactions (invoice, payment, refund, write-off) | Must |
| FR-6.3 | System shall enforce double-entry accounting (debit = credit) | Must |
| FR-6.4 | System shall support cost center tracking per department | Should |
| FR-6.5 | System shall generate trial balance from GL | Should |
| FR-6.6 | System shall support fiscal year periods | Should |
| FR-6.7 | System shall allow revenue recognition rules (recognize on service vs. on payment) | Could |
| FR-6.8 | GL entries shall be immutable (corrections via reversing entries only) | Must |

#### Data Model Changes

| Model | Fields | Notes |
|-------|--------|-------|
| `GLAccount` | id, hospitalId, accountCode, accountName, accountType (ASSET/LIABILITY/REVENUE/EXPENSE/EQUITY), parentId?, isActive, description, createdAt, updatedAt | Chart of Accounts |
| `GLEntry` | id, hospitalId, transactionDate, glAccountId, debitAmount, creditAmount, description, referenceType (INVOICE/PAYMENT/REFUND/WRITE_OFF/DEPOSIT), referenceId, costCenter?, fiscalPeriod, createdAt, createdBy | General Ledger entry (immutable) |

#### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/accounting/chart-of-accounts` | List CoA |
| POST | `/api/v1/accounting/chart-of-accounts` | Create account |
| PUT | `/api/v1/accounting/chart-of-accounts/:id` | Update account |
| GET | `/api/v1/accounting/gl-entries` | Query GL entries |
| GET | `/api/v1/accounting/trial-balance` | Generate trial balance |
| GET | `/api/v1/accounting/journal/:referenceId` | Get journal entries for a transaction |

#### Acceptance Criteria
- [ ] Every invoice creation generates balanced GL entries (debit AR, credit Revenue)
- [ ] Every payment generates balanced GL entries (debit Cash, credit AR)
- [ ] Trial balance shows debit total equals credit total
- [ ] GL entries cannot be modified (only reversed)

---

### Module 7: Technical Debt Fixes

**Description:** Fix critical issues in existing billing code that affect data integrity, audit compliance, and operational safety.

#### Functional Requirements

| ID | Requirement | Priority |
|----|------------|----------|
| FR-7.1 | Wrap payment creation + invoice update in Prisma `$transaction` | Critical |
| FR-7.2 | Replace `receivedBy: 'SYSTEM'` with actual authenticated user ID | Critical |
| FR-7.3 | Add `createdBy` and `updatedBy` fields to Invoice, Payment, InsuranceClaim models | Critical |
| FR-7.4 | Validate payment amount does not exceed invoice balance before recording | Critical |
| FR-7.5 | Wrap insurance claim status update + auto-payment in single transaction | Critical |
| FR-7.6 | Add authorization checks to AI charge capture endpoints | High |
| FR-7.7 | Add unique constraint on Payment.referenceNumber (when not null) | High |
| FR-7.8 | Schedule overdue payment reminder cron job using existing `sendOverduePaymentReminders` | High |
| FR-7.9 | Migrate hardcoded charge database to ChargeMaster Prisma model | High |
| FR-7.10 | Link InsuranceClaim.insuranceProvider to InsurancePayer via foreign key | High |
| FR-7.11 | Add `denialReasonCode`, `submittedBy`, `processedBy` to InsuranceClaim model | High |
| FR-7.12 | Wire Quality module sub-components into main page tabs | Medium |

#### Affected Files

| File | Changes |
|------|---------|
| `backend/src/services/billingService.ts` | FR-7.1, FR-7.2, FR-7.4, FR-7.5, FR-7.6, FR-7.9 |
| `backend/prisma/schema.prisma` | FR-7.3, FR-7.7, FR-7.10, FR-7.11 |
| `backend/src/routes/billingRoutes.ts` | FR-7.6 |
| `backend/src/jobs/` | FR-7.8 (new cron file) |
| `frontend/src/pages/Quality/index.tsx` | FR-7.12 |

#### Acceptance Criteria
- [ ] Payment recording is atomic (all-or-nothing with invoice update)
- [ ] All financial records track which user created/modified them
- [ ] Overpayment is rejected with clear error message
- [ ] Insurance auto-payment traces to claim processor, not 'SYSTEM'
- [ ] Overdue invoices trigger email/SMS reminders on schedule

---

## 4. Proposed New Prisma Models

| Model | Module | Purpose |
|-------|--------|---------|
| `ChargeMaster` | Auto-Billing | Standardized charge catalog per hospital |
| `FeeSchedule` | Auto-Billing | Payer/hospital-specific pricing overrides |
| `PaymentTransaction` | Payment Gateway | Gateway transaction log (Stripe references) |
| `PreAuthRequest` | Advanced Insurance | Pre-authorization request tracking |
| `Deposit` | Deposit/Refund | Advance patient deposits |
| `DepositLedger` | Deposit/Refund | Deposit movement log (deposit/utilize/refund) |
| `CreditNote` | Deposit/Refund | Invoice credit notes |
| `Refund` | Deposit/Refund | Refund request and approval tracking |
| `GLAccount` | Accounting | Chart of Accounts |
| `GLEntry` | Accounting | General Ledger entries (immutable) |

**Existing Model Modifications:**
- `Invoice`: Add `createdBy`, `updatedBy`
- `Payment`: Add `createdBy` (rename/replace `receivedBy` string to User FK)
- `InsuranceClaim`: Add `denialReasonCode`, `appealNotes`, `appealDate`, `appealStatus`, `submittedBy`, `processedBy`, `insurancePayerId` (FK to InsurancePayer)

---

## 5. Implementation Priority

| Phase | Module | Rationale |
|-------|--------|-----------|
| **Phase 1** | Module 7: Technical Debt Fixes | Fix data integrity issues before adding features |
| **Phase 2** | Module 1: Auto-Billing Engine | Foundation for all revenue tracking |
| **Phase 3** | Module 2: Payment Gateway | Enable online revenue collection |
| **Phase 4** | Module 4: Deposit & Refund Management | Complete money-in/money-out lifecycle |
| **Phase 5** | Module 3: Advanced Insurance | Reduce claim denials, improve collections |
| **Phase 6** | Module 5: Financial Reporting | Visibility into financial performance |
| **Phase 7** | Module 6: Accounting Foundation | GL/CoA for enterprise accounting compliance |

---

## 6. Dependencies & Integration Points

| Module | Depends On | Integrates With |
|--------|-----------|-----------------|
| Auto-Billing | -- | Appointments, Lab, Radiology, Pharmacy, IPD |
| Payment Gateway | -- | Patient Portal, Mobile App, Stripe API |
| Advanced Insurance | Insurance Coding (exists) | eClaimLink, CPT Payer Rules |
| Deposit/Refund | Payment Gateway | IPD Admissions, Patient Portal |
| Financial Reporting | Auto-Billing, Payment Gateway | Reports module, Dashboard |
| Accounting Foundation | Auto-Billing, Payment Gateway, Deposit/Refund | All financial transactions |
| Technical Debt Fixes | -- | billingService.ts, schema.prisma |

---

## 7. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Payment processing latency | < 3 seconds (gateway round-trip) |
| Report generation | < 5 seconds for 1 year of data |
| Transaction atomicity | 100% (all financial operations in DB transactions) |
| Audit trail completeness | 100% (every financial action tracked with user + timestamp) |
| Gateway uptime | 99.9% (Stripe SLA) |
| Data precision | Decimal(10,2) for all monetary amounts |
| Currency support | Single currency initially, multi-currency architecture ready |
| Export formats | CSV, Excel (XLSX) |
