# Copay Collection at Check-In: Complete Implementation Walkthrough

> **Last Updated:** 2026-02-04
> **Status:** All 8 GAP features implemented and deployed to production

## Architecture Overview

The copay collection at check-in involves **5 frontend components**, **7 backend services**, **16 API endpoints**, and **8 database models** working together across three scenarios (insured, uninsured, and COB/secondary insurance patients).

### Components Summary

| Layer | Component | Count |
|-------|-----------|-------|
| Frontend Pages | OPD, AuditLog, CopayRefunds | 3 |
| Frontend Modals | CopayCollectionModal, WalkInInsuranceCapture | 2 |
| Backend Services | billingService, insuranceEligibilityService, insuranceAuditService, copayRefundService, deductibleService, preAuthService, dhaEClaimService | 7 |
| Database Models | Appointment, CopayPayment, CopayRefund, PatientInsurance, InsurancePayer, DeductibleLedger, InsuranceVerificationAudit, HospitalSettings | 8 |

---

## 1. COMPLETE CHECK-IN FLOW (HIGH-LEVEL)

```
Receptionist clicks "Check In" on SCHEDULED/CONFIRMED appointment (Today's Appointments tab)
    ↓
CopayCollectionModal opens
    ↓
GET /billing/calculate-copay/:patientId?appointmentId=xxx
    ↓
billingService.calculateCopay() → returns:
  - Fee breakdown (consultation fee, coverage %, copay amount)
  - Pre-auth status (GAP 1)
  - COB/Secondary insurance breakdown (GAP 2)
  - Deductible & annual copay tracking (GAP 4)
  - Data source indicator (GAP 5)
  - Pharmacy copay estimate (GAP 6)
    ↓
Receptionist selects: Collect / Waive / Defer
    ↓
POST /billing/copay-collect (if collecting)
  → Creates CopayPayment record
  → Updates Appointment (copayCollected=true)
  → Posts to General Ledger
  → Updates DeductibleLedger
  → Generates receipt (GAP 3)
    ↓
Receipt screen shown with Print/Email options (GAP 3)
    ↓
POST /insurance-coding/audit/log (fire-and-forget, GAP 7)
    ↓
POST /opd/check-in/:appointmentId → status → CHECKED_IN
    ↓
Patient enters queue (awaiting vitals), Token # assigned
```

---

## 2. SCENARIO A: Patient WITHOUT Pre-Submitted Insurance

### Step 1: Check-In Initiation
**Frontend:** `frontend/src/pages/OPD/index.tsx` (lines 659-678)
- `handleCheckIn()`: Opens `CopayCollectionModal` with appointment details
- Available to: RECEPTIONIST, HOSPITAL_ADMIN, SUPER_ADMIN
- Check-in buttons appear on the **"Today's Appointments"** tab (not the Live Queue tab)

### Step 2: Walk-In Insurance Capture (if needed)
**Frontend:** `frontend/src/components/common/WalkInInsuranceCapture.tsx`

Three-step flow:
1. **EID Lookup** (step: `eid_lookup`): Scan/enter Emirates ID → calls `POST /insurance-coding/eligibility/verify-eid`
   - Two search modes: Emirates ID and Name/MRN
   - Name/MRN mode sets `requiresEidVerification: true` for accuracy warning
2. **Quick Registration** (step: `quick_register`): If patient not found, collect firstName, lastName, DOB, gender, phone, emiratesId → create patient record
3. **Copay Collection** (step: `copay_collect`): Show insurance info or "No Insurance" warning, select payment method, collect or defer

### Step 3: Emirates ID Eligibility Verification
**Backend:** `backend/src/services/insuranceEligibilityService.ts` → `lookupByEmiratesId()`

```
Input: hospitalId, emiratesId (15 digits, normalized)
    ↓
Query Patient by emiratesId + hospitalId (include primary insurance)
    ↓
If DHA enabled → callDHAEligibilityAPI()
    ↓
If DHA returns eligible + no DB insurance record:
    → syncInsuranceFromDHA() creates PatientInsurance record
    → verificationSource: 'DHA_ECLAIM', verificationStatus: 'VERIFIED'
    ↓
If DHA fails/unavailable → getEligibilityFromCache() with warning alert
    ↓
Return: { patient: {...}, eligibility: {...} }
```

### Step 4: Self-Pay Fallback (No Insurance Found)
**Backend:** `backend/src/services/billingService.ts` → `calculateCopay()` (lines 2487-2558)

```typescript
if (!patientInsurance) {
  // Get consultation fee from ChargeMaster (default: AED 200)
  return {
    hasCopay: true,
    consultationFee: fee,
    coveragePercentage: 0,
    copayPercentage: 100,
    copayAmount: fee,
    patientAmount: fee,
    insuranceAmount: 0,
    noInsurance: true,
    dataSource: 'CACHED_DB',
    planType: 'SELF_PAY'
  }
}
```

**Frontend:** `CopayCollectionModal` (lines 350-517) shows:
- "No Insurance on File" warning (orange background)
- UAE mandatory insurance advisory notice
- 100% self-pay fee breakdown
- "Add Insurance" button → opens patient's insurance tab
- Options: Collect Self-Pay (orange), Defer Payment, Cancel
- Note: "Waive" is NOT available for self-pay patients

---

## 3. SCENARIO B: Patient WITH Pre-Submitted Insurance (via Portal)

### Step 1: Check-In Initiation
Same as Scenario A: `handleCheckIn()` in OPD/index.tsx

### Step 2: Copay Calculation with Existing Insurance
**Backend:** `backend/src/services/billingService.ts` → `calculateCopay()` (lines 2459-3091)

Full algorithm (~630 lines):

```
1. Query PatientInsurance (isActive=true, isPrimary=true)
    ↓
2. Determine visit type from Appointment:
   - CONSULTATION → 'NEW' (charge code: initial_consultation)
   - FOLLOW_UP → 'FOLLOW_UP' (charge code: follow_up)
   - EMERGENCY → 'EMERGENCY' (charge code: emergency_consult)
    ↓
3. Look up consultation fee from ChargeMaster
   - Default fallback: AED 200
    ↓
4. Determine network status from PatientInsurance.networkTier:
   - IN_NETWORK: standard copay
   - OUT_OF_NETWORK: copay doubled or capped at 40%
    ↓
5. Look up payer-specific rules:
   - Find InsurancePayer by name/code
   - Query ICD10PayerRule for consultation (Z00 codes)
   - Extract: copayPercentage, copayAmount (per-visit cap)
   - Default: 80% coverage / 20% copay
    ↓
6. [GAP 4] Query DeductibleLedger via deductibleService.getOrCreateLedger():
   - Primary: uses DeductibleLedger (copayAccumulated, maxCopay)
   - Fallback: CopayPayment YTD aggregation if ledger fails
   - Returns: { deductible: { total, used, remaining, metForYear },
                 copay: { limit, used, remaining, metForYear } }
    ↓
7. Apply annual copay cap:
   - If cap reached → patientAmount = 0
   - If partial → charges only the remaining
    ↓
8. Apply per-visit cap:
   - If copayCapPerVisit > 0 && patientAmount > cap → cap it
    ↓
9. [GAP 1] Pre-auth check (skipped for EMERGENCY per UAE regulations):
   - Check payer-level preAuthRequired flag
   - Check CPT-level requiresPreAuth flag
   - Query existing PreAuthRequest records
   - Map status: NOT_REQUIRED / REQUIRED_NOT_SUBMITTED / APPROVED / PENDING / DENIED
    ↓
10. [GAP 5] Determine data source:
    - DHA_LIVE (configured + production mode)
    - DHA_SANDBOX (configured + sandbox mode)
    - MOCK_DATA (not configured, simulated responses)
    - CACHED_DB (fallback to stored data)
    - NOT_CONFIGURED (no DHA setup)
    ↓
11. [GAP 2] COB / Secondary Insurance:
    - Query secondary insurance (isPrimary=false, priority=2)
    - Calculate secondary coverage using same payer-rule pattern
    - Apply OON penalty for secondary
    - Build primaryBreakdown + secondaryBreakdown
    - Adjust patientAmount after both insurances
    ↓
12. [GAP 6] Pharmacy Estimate:
    - Query active prescriptions with drug prices
    - Calculate total medication cost
    - Apply coverage percentage
    - Return as informational only (collected separately at pharmacy)
    ↓
13. Final calculation:
    patientAmount = (consultationFee * copayPercentage) / 100
    insuranceAmount = consultationFee - patientAmount
```

### Step 3: Real-Time DHA Verification (Cross-Verification)
**Backend:** `backend/src/services/insuranceEligibilityService.ts` → `crossVerifyInsurance()`

When patient has insurance in DB AND DHA is enabled, the system performs cross-verification with 4 alert scenarios:

#### Scenario A: MISMATCH_DB_VS_DHA
- **Condition:** DB has insurance, DHA returns NOT_FOUND or INELIGIBLE
- **Severity:** ERROR
- **Actions offered:** USE_DB_DATA, TREAT_AS_SELFPAY, UPDATE_INSURANCE
- **Result:** `eligible: false`, `hasMismatch: true`, `previousCoverage` populated

#### Scenario B: POLICY_RENEWED
- **Condition:** DB shows expired (expiryDate < now), DHA says ACTIVE
- **Severity:** INFO
- **Auto-action:** `syncInsuranceFromDHA()` updates coverage terms automatically
- **Result:** `eligible: true`, `policyWasRenewed: true`

#### Scenario C: EID_VERIFICATION_NEEDED
- **Condition:** Patient selected by Name/MRN (not EID), or no EID on file
- **Severity:** INFO (has EID) / WARNING (no EID)
- **Actions offered:** VERIFY_EID, USE_DB_DATA, UPDATE_INSURANCE
- **Result:** `requiresEidVerification: true`

#### Scenario D: COVERAGE_CHANGED
- **Condition:** DHA response differs from DB in provider, coverage %, or copay
- **Sub-alerts:**
  - PROVIDER_CHANGED: Provider name mismatch
  - COVERAGE_REDUCED: >5% reduction in coverage
  - COPAY_INCREASED: >AED 10 increase in copay
- **Auto-action:** `syncInsuranceFromDHA()` updates DB
- **Result:** `coverageChanged: true`, `previousCoverage` populated

### Step 4: DHA Validation Failure Handling
If DHA API call fails (timeout, network error, service unavailable):
- Error is logged
- Alert added: `DHA_VERIFICATION_UNAVAILABLE`
- System falls back to `getEligibilityFromCache()` using stored DB data
- Response includes warning that verification is from cached data

---

## 4. SCENARIO C: Patient WITH Secondary Insurance (COB)

### How COB Works at Check-In

When a patient has both primary and secondary insurance, the copay calculation automatically layers coverage:

```
1. Calculate primary insurance coverage:
   - consultationFee × primaryCoveragePercentage = primaryInsuranceAmount
   - Remaining = consultationFee - primaryInsuranceAmount
    ↓
2. Check for secondary insurance (isPrimary=false, priority=2):
   - Apply secondary payer rules to the REMAINING amount
   - Apply OON penalty if secondary is out-of-network
   - secondaryInsuranceAmount = remaining × secondaryCoveragePercentage
    ↓
3. Final patient responsibility:
   - finalPatientAmount = consultationFee - primaryInsuranceAmount - secondaryInsuranceAmount
```

### Frontend Display (CopayCollectionModal lines 670-740)
The fee breakdown shows:
- **Primary Insurance Breakdown**: Provider name, policy, coverage %, copay %, insurance amount, patient responsibility
- **Secondary Insurance (COB)** panel: Provider name, policy, network status, applied-to-remaining amount, secondary coverage amount
- **Final Patient Amount**: After both insurances applied

### Database Fields (CopayPayment)
When COB is applied, `CopayPayment` stores:
- `secondaryInsuranceProvider`: Secondary insurer name
- `secondaryPolicyNumber`: Secondary policy number
- `cobApplied`: Boolean flag

---

## 5. GAP FEATURES IN CopayCollectionModal

### GAP 1: Pre-Authorization Warnings
**Frontend:** `CopayCollectionModal.tsx` (lines 581-668)

Color-coded pre-auth alert panel:
- **Green:** APPROVED — shows pre-auth number, proceed normally
- **Yellow:** PENDING — pre-auth submitted, awaiting approval
- **Red:** DENIED or REQUIRED_NOT_SUBMITTED — blocks standard collection

Action buttons on non-approved pre-auths:
- **"Request Pre-Auth Now"** → navigates to `/insurance/pre-auth/new`
- **"Override (Admin)"** → logs `PREAUTH_OVERRIDE` audit entry, proceeds to collect
- **"Convert to Self-Pay"** → logs `CONVERT_TO_SELFPAY` audit entry, defers copay

### GAP 2: Coordination of Benefits (COB)
See Section 4 above.

### GAP 3: Receipt Generation After Payment
**Frontend:** `CopayCollectionModal.tsx` (lines 266-333)

After successful copay collection:
1. Backend `collectCopay()` calls `receiptService.generateCopayReceipt()` and returns `receiptNumber` and `vatAmount`
2. Modal transitions to a receipt success screen showing:
   - Receipt number
   - Amount paid
   - VAT at 5% (if applicable)
   - Payment method
3. Two action buttons:
   - **"Print Receipt"** → opens `/billing/copay-receipt/{receiptNumber}` in new tab
   - **"Email Receipt"** → shows toast confirmation
4. **"Continue to Check-in"** button proceeds with the flow

**Backend:** `billingService.ts` → `collectCopay()` (lines 3544-3790)
- `CopayPayment` stores: `receiptNumber` (unique), `receiptUrl`, `vatAmount`

### GAP 4: Deductible & Annual Copay Tracking
**Frontend:** `CopayCollectionModal.tsx` (lines 742-801)

"Annual Limits" section with:
- **Deductible progress bar**: Shows annual deductible used vs total
  - Green indicator when "Deductible met for this year"
- **Copay cap progress bar**: Shows annual copay used vs cap
  - Special message when cap reached: "Annual copay cap reached - no copay required!"

**Backend:** `deductibleService.ts`
- `getOrCreateLedger()`: Returns ledger with computed `deductible: { annual, used, remaining, metForYear }` and `copay: { limit, used, remaining, metForYear }`
- `recordPayment()`: Atomically increments `accumulatedAmount` and `copayAccumulated` in DeductibleLedger
- `recordCharge()`: Increments only `accumulatedAmount` (deductible portion)
- Negative amounts supported for refund reversals

### GAP 5: Data Source Indicator
**Frontend:** `CopayCollectionModal.tsx` (lines 553-579)

Color-coded banner below insurance details:
| Data Source | Color | Message |
|-------------|-------|---------|
| `DHA_LIVE` | Green | "Verified via DHA eClaimLink" |
| `DHA_SANDBOX` | Blue | "Test environment" |
| `CACHED_DB` | Yellow | "Not real-time verified" |
| `MOCK_DATA` | Red | "SIMULATED" |
| `NOT_CONFIGURED` | Red | "Manual verification required" |

### GAP 6: Pharmacy Estimate
**Frontend:** `CopayCollectionModal.tsx` (lines 813-849)

Collapsible "Estimated Total Visit Cost" section:
- Active prescription count badge
- Consultation copay amount
- Pharmacy copay estimate (based on active prescriptions and coverage %)
- Estimated total patient cost
- Disclaimer: "Pharmacy copay is estimated and collected separately at the pharmacy"

### GAP 7: Insurance Verification Audit
Every action in CopayCollectionModal fires a non-blocking `insuranceCodingApi.logInsuranceAudit()` call with:
- `patientId`, `appointmentId`
- `action`: COPAY_COLLECTED, COPAY_WAIVED, COPAY_DEFERRED, PREAUTH_OVERRIDE, CONVERT_TO_SELFPAY
- `newData` / `previousData`: Structured JSON with amounts, methods, insurance info
- `reason`: User-provided or system-generated

See Section 9 for the full Audit Log system.

---

## 6. COPAY COLLECTION ACTIONS

### Action: Collect Payment
1. Receptionist selects payment method: **Cash, Credit Card, Debit Card, Patient Deposit**
2. For **Patient Deposit**: System checks balance via `depositService.getDepositBalance()`; if insufficient, shows error
3. `POST /billing/copay-collect` creates CopayPayment record
4. Updates Appointment: `copayCollected=true`, `copayAmount=X`
5. Posts to General Ledger via `accountingService.recordCopayGL()`
6. Updates DeductibleLedger via `deductibleService.recordPayment()`
7. Generates receipt via `receiptService.generateCopayReceipt()`
8. Audit log: `COPAY_COLLECTED`
9. Calls `completeCheckIn('collected')`

### Action: Waive
1. No payment recorded
2. Audit log: `COPAY_WAIVED` with reason
3. Calls `completeCheckIn('waived')`

### Action: Defer
1. No payment recorded, copay to be collected later
2. Audit log: `COPAY_DEFERRED`
3. Calls `completeCheckIn('deferred')`

### completeCheckIn(action) — `OPD/index.tsx` (lines 681-702)
1. Calls `opdApi.checkIn(appointmentId)` → sets status to `CHECKED_IN`, assigns `tokenNumber`, sets `checkedInAt`
2. Toast messages:
   - `'collected'` → "Copay collected and patient checked in"
   - `'waived'` → "Copay waived and patient checked in"
   - `'deferred'` → "Copay deferred and patient checked in"
3. Refreshes queue data

---

## 7. INSURANCE VALIDATION RULES (ALL SCENARIOS)

### Validation Checkpoint 1: Emirates ID Format
- **Location:** `dhaEClaimRoutes.ts`
- **Rule:** Remove dashes, must be exactly 15 digits
- **Error:** "Invalid Emirates ID format (must be 15 digits)"

### Validation Checkpoint 2: Patient Lookup
- **Location:** `insuranceEligibilityService.ts` → `lookupByEmiratesId()`
- **Rule:** Query `Patient` by `emiratesId + hospitalId + isActive: true`
- **If not found:** Return `patient: null` (frontend triggers quick registration)

### Validation Checkpoint 3: Insurance Record Existence
- **Location:** `billingService.ts` → `calculateCopay()`
- **Rule:** Query `PatientInsurance` with `isActive: true, isPrimary: true`
- **If not found:** Self-pay fallback (100% patient responsibility)

### Validation Checkpoint 4: DHA Real-Time Eligibility
- **Location:** `insuranceEligibilityService.ts` → `callDHAEligibilityAPI()`
- **SOAP request** to DHA eClaimLink with: FacilityID, LicenseNumber, APIKey, EmiratesID, ServiceDate
- **Timeout:** 30 seconds
- **DHA Status mapping:**
  - `A`/`ACTIVE` → ACTIVE
  - `I`/`INACTIVE` → INACTIVE
  - `E`/`EXPIRED` → EXPIRED
  - `S`/`SUSPENDED` → SUSPENDED
  - Other → NOT_FOUND

### Validation Checkpoint 5: Policy Dates
- **Location:** `preAuthService.ts` → `verifyCoverage()` and `insuranceEligibilityService.ts`
- **Rule:** `expiryDate > now` (if expiryDate exists)
- **If expired:** `policyStatus: EXPIRED`, alert for renewal check

### Validation Checkpoint 6: Network/Provider Validation
- **Location:** `billingService.ts` → `calculateCopay()`
- **Rule:** Check `PatientInsurance.networkTier`
- **IN_NETWORK:** Standard copay percentage
- **OUT_OF_NETWORK:** Copay doubled or capped at 40%

### Validation Checkpoint 7: Payer-Specific Rules
- **Location:** `preAuthService.ts` → `calculateCopayDeductible()`
- **Checks:** Age restrictions, gender restrictions, copay overrides, price overrides
- **Tables:** `ICD10PayerRule`, `CPTPayerRule`
- **If restricted (age/gender):** Patient pays 100%

### Validation Checkpoint 8: Pre-Auth Requirement
- **Location:** `preAuthService.ts` → `checkPreAuthRequirement()`
- **Rule:** Check CPT.requiresPreAuth flag + payer-specific rules
- **Emergency:** Pre-auth waived (UAE regulation)
- **Elective:** Pre-auth required if flagged

### Validation Checkpoint 9: Annual Copay Cap
- **Location:** `billingService.ts` → `calculateCopay()` (lines 2722-2733)
- **Rule:** If `annualCopayMax` reached, `patientAmount = 0`
- **If partial:** Charges only the remaining amount before cap

### Validation Checkpoint 10: Refund Limit
- **Location:** `copayRefundService.ts` → `requestRefund()`
- **Rule:** Refund amount cannot exceed original payment minus already-refunded amounts
- **Formula:** `maxRefundable = paidAmount - alreadyRefunded`

---

## 8. ALL API ENDPOINTS INVOLVED

### Check-In & Copay
| Method | Endpoint | Service | Purpose |
|--------|----------|---------|---------|
| GET | `/billing/calculate-copay/:patientId` | billingService.calculateCopay() | Calculate full copay breakdown with all GAP features |
| POST | `/billing/copay-collect` | billingService.collectCopay() | Record copay payment, generate receipt, update ledger |
| POST | `/opd/check-in/:appointmentId` | opdService.checkInPatient() | Update status to CHECKED_IN, assign token |
| GET | `/billing/patients/:patientId/deposit-balance` | depositService.getDepositBalance() | Check available patient deposits |

### Copay Refunds (GAP 9)
| Method | Endpoint | Service | Purpose |
|--------|----------|---------|---------|
| POST | `/billing/copay-refund` | copayRefundService.requestRefund() | Request a refund (creates PENDING) |
| GET | `/billing/copay-refunds` | copayRefundService.listRefunds() | List refunds with filters |
| GET | `/billing/copay-refund/:id` | copayRefundService.getRefundById() | Get single refund details |
| PATCH | `/billing/copay-refund/:id/approve` | copayRefundService.approveRefund() | Admin approves refund |
| PATCH | `/billing/copay-refund/:id/reject` | copayRefundService.rejectRefund() | Admin rejects refund (requires reason) |
| PATCH | `/billing/copay-refund/:id/process` | copayRefundService.processRefund() | Process approved refund (reverses ledger) |

### Insurance Eligibility
| Method | Endpoint | Service | Purpose |
|--------|----------|---------|---------|
| POST | `/insurance-coding/eligibility/verify-eid` | insuranceEligibilityService.lookupByEmiratesId() | Primary EID lookup |
| POST | `/insurance-coding/eligibility/verify-patient` | insuranceEligibilityService.verifyEligibilityByPatientId() | Verify by patient ID |
| GET | `/insurance-coding/eligibility/:patientId` | insuranceEligibilityService.verifyEligibilityByPatientId() | Cached eligibility |

### Insurance Verification Audit (GAP 7)
| Method | Endpoint | Service | Purpose |
|--------|----------|---------|---------|
| POST | `/insurance-coding/audit/log` | insuranceAuditService.logAudit() | Log an audit entry (fire-and-forget) |
| GET | `/insurance-coding/audit/list` | insuranceAuditService.getAuditList() | Paginated audit entries with filters |
| GET | `/insurance-coding/audit/export` | insuranceAuditService.getAuditExport() | Export as CSV (up to 10,000 rows) |

### DHA eClaimLink
| Method | Endpoint | Service | Purpose |
|--------|----------|---------|---------|
| POST | `/dha-eclaim/eligibility/verify` | dhaEClaimService.verifyEligibility() | Direct DHA verification |
| GET | `/dha-eclaim/eligibility/patient/:patientId` | dhaEClaimService.verifyEligibility() | DHA verify by patient |
| GET | `/dha-eclaim/status` | dhaEClaimService.isConfigured() | Check DHA config |

### Manual Insurance Admin
| Method | Endpoint | Service | Purpose |
|--------|----------|---------|---------|
| POST | `/insurance-coding/insurance/:id/verify` | Direct Prisma update | Manual verify/reject |
| POST | `/insurance-coding/insurance/:id/reset-verification` | Direct Prisma update | Reset to PENDING |

---

## 9. INSURANCE VERIFICATION AUDIT SYSTEM (GAP 7)

### Backend Service
**File:** `backend/src/services/insuranceAuditService.ts`

- `logAudit(entry)`: Fire-and-forget (wrapped in try-catch, never blocks the check-in flow). Creates `InsuranceVerificationAudit` record.
- `getAuditList(hospitalId, filters)`: Paginated list with filters for `patientId`, `appointmentId`, `action`, `performedBy`, `startDate`/`endDate`. Includes patient name and MRN via relation.
- `getAuditExport(hospitalId, filters)`: Generates CSV (up to 10,000 rows) with columns: Date/Time, Action, Patient Name, MRN, Appointment ID, Reason, Performed By, IP Address.

### Audit Actions Logged
| Action | Trigger | Data Captured |
|--------|---------|---------------|
| `COPAY_COLLECTED` | Payment collected | amount, paymentMethod, insuranceProvider, policyNumber |
| `COPAY_WAIVED` | Copay waived | reason, waived amount, insurance details |
| `COPAY_DEFERRED` | Copay deferred | deferred amount, insurance details |
| `PREAUTH_OVERRIDE` | Admin overrides pre-auth requirement | pre-auth status, override reason |
| `CONVERT_TO_SELFPAY` | Pre-auth failed, converted to self-pay | previous insurance, reason |
| `DHA_VERIFIED` | DHA real-time check passed | DHA response data |
| `DHA_MISMATCH_USE_DB` | DHA mismatch, user chose DB data | DB vs DHA comparison |
| `DHA_MISMATCH_SELFPAY` | DHA mismatch, converted to self-pay | DB vs DHA comparison |
| `DHA_MISMATCH_UPDATE` | DHA mismatch, updated from DHA | old vs new data |
| `DHA_UNAVAILABLE_USE_CACHE` | DHA timeout, used cached data | error details |
| `MANUAL_VERIFY` | Admin manually verified insurance | verification details |
| `MANUAL_REJECT` | Admin manually rejected insurance | rejection reason |
| `EID_VERIFIED` | Emirates ID verified | verification source |
| `COVERAGE_CHANGE_ACCEPTED` | Coverage change from DHA accepted | old vs new coverage |
| `COVERAGE_CHANGE_REJECTED` | Coverage change from DHA rejected | old vs new coverage |

### Frontend Page
**File:** `frontend/src/pages/InsuranceCoding/AuditLog.tsx`
**Route:** `/insurance-audit`

Features:
- Gradient header with "Export CSV" button
- Collapsible filter panel: filter by action type, start date, end date
- Table with columns: Date/Time, Action (color-coded badge), Patient (name + MRN), Details (amount, payment method, insurer), Performed By, Reason
- Color-coded action badges:
  - Green: Copay Collected
  - Yellow: Copay Waived
  - Blue: Copay Deferred
  - Orange: Pre-Auth Override
  - Red: Convert to Self-Pay
- Pagination

---

## 10. COPAY REFUND FLOW (GAP 9)

### Refund Lifecycle

```
Staff requests refund (PENDING)
    ↓
Admin reviews:
  ├─ Approve → APPROVED
  │    ↓
  │    Admin processes → PROCESSED
  │    (DeductibleLedger reversed with negative amount)
  │
  └─ Reject → REJECTED (requires reason)
```

### Backend Service
**File:** `backend/src/services/copayRefundService.ts`

| Method | Description |
|--------|-------------|
| `requestRefund()` | Validates reason/method, checks refund doesn't exceed original payment minus existing refunds, creates PENDING record |
| `approveRefund()` | Transitions PENDING → APPROVED |
| `rejectRefund()` | Transitions PENDING → REJECTED (requires rejection reason) |
| `processRefund()` | Transitions APPROVED → PROCESSED, calls `deductibleService.recordPayment()` with **negative amount** to reverse ledger |
| `listRefunds()` | Paginated list with status/patient/payment filters |
| `getRefundById()` | Single refund with copayPayment details |

### Valid Refund Reasons
- `APPOINTMENT_CANCELLED`
- `INSURANCE_UPDATED`
- `OVERCHARGE`
- `DOCTOR_WAIVED`
- `OTHER`

### Valid Refund Methods
- `CASH`
- `CREDIT_CARD`
- `BANK_TRANSFER`
- `DEPOSIT_CREDIT`

### Frontend Page
**File:** `frontend/src/pages/Billing/CopayRefunds.tsx`
**Route:** `/copay-refunds`

Features:
- Header with "Request Refund" button
- Status tabs: All, Pending, Approved, Processed, Rejected
- Refund list cards showing: status badge, amount, date, patient name/MRN, reason + details, original payment info, rejection reason (if applicable)
- Role-based action buttons:
  - HOSPITAL_ADMIN, SUPER_ADMIN, ACCOUNTANT: Approve/Reject for PENDING
  - HOSPITAL_ADMIN, SUPER_ADMIN, ACCOUNTANT: Process for APPROVED
  - SUPER_ADMIN: Delete for PENDING
- "Request Refund" modal: Copay Payment ID, Refund Amount, Reason (dropdown), Additional Details, Refund Method
- Rejection modal requiring a reason
- Pagination

---

## 11. DATABASE TABLES & KEY FIELDS

### PatientInsurance (`patient_insurances`)
| Field | Type | Purpose |
|-------|------|---------|
| providerName | String | Insurance company name |
| policyNumber | String | Policy/certificate number |
| copay | Decimal? | Fixed copay amount |
| deductible | Decimal? | Fixed deductible |
| networkTier | String? | IN_NETWORK / OUT_OF_NETWORK |
| annualDeductible | Decimal? | Annual deductible limit |
| annualCopayMax | Decimal? | Annual copay cap |
| isPrimary | Boolean | Primary insurance flag |
| isActive | Boolean | Active/inactive |
| effectiveDate | DateTime | Coverage start |
| expiryDate | DateTime? | Coverage end |
| verificationStatus | String | PENDING / VERIFIED / REJECTED |
| verificationSource | String? | MANUAL / DHA_ECLAIM / PAYER_API |
| verifiedAt | DateTime? | Last verification timestamp |
| priority | Int? | For COB ordering (1=primary, 2=secondary) |
| coordinationOfBenefits | String? | COB_PRIMARY / COB_SECONDARY |

### Appointment (`appointments`)
| Field | Type | Purpose |
|-------|------|---------|
| status | AppointmentStatus | SCHEDULED → CHECKED_IN → ... |
| copayCollected | Boolean | Whether copay was collected |
| copayAmount | Decimal(10,2) | Amount collected |
| tokenNumber | Int | Queue token assigned at check-in |
| checkedInAt | DateTime | Check-in timestamp |

### CopayPayment (`copay_payments`)
| Field | Type | Purpose |
|-------|------|---------|
| patientId | String | FK to Patient |
| appointmentId | String | FK to Appointment |
| amount | Decimal | Payment amount |
| paymentMethod | String | CASH / CREDIT_CARD / DEBIT_CARD / DEPOSIT |
| insuranceProvider | String? | Primary provider name at time of payment |
| policyNumber | String? | Primary policy number at time of payment |
| secondaryInsuranceProvider | String? | Secondary provider (GAP 2 - COB) |
| secondaryPolicyNumber | String? | Secondary policy (GAP 2 - COB) |
| cobApplied | Boolean? | Whether COB was applied (GAP 2) |
| receiptNumber | String? | Unique receipt number (GAP 3) |
| receiptUrl | String? | Receipt URL (GAP 3) |
| vatAmount | Decimal? | VAT at 5% (GAP 3) |
| collectedBy | String | User who collected |
| paymentDate | DateTime | When collected |
| refunds | CopayRefund[] | Related refunds (GAP 9) |

### CopayRefund (`copay_refunds`) — NEW (GAP 9)
| Field | Type | Purpose |
|-------|------|---------|
| id | String (UUID) | Primary key |
| hospitalId | String | FK to Hospital |
| copayPaymentId | String | FK to CopayPayment |
| patientId | String | FK to Patient |
| appointmentId | String? | FK to Appointment |
| refundAmount | Decimal(10,2) | Refund amount |
| refundMethod | String? | CASH / CREDIT_CARD / BANK_TRANSFER / DEPOSIT_CREDIT |
| refundReason | String | APPOINTMENT_CANCELLED / INSURANCE_UPDATED / OVERCHARGE / DOCTOR_WAIVED / OTHER |
| reasonDetails | String? | Free-text details |
| status | String | PENDING / APPROVED / PROCESSED / REJECTED |
| requestedBy/At | String/DateTime | Who requested and when |
| approvedBy/At | String?/DateTime? | Who approved and when |
| processedBy/At | String?/DateTime? | Who processed and when |
| rejectedBy/At/Reason | String?/DateTime?/String? | Rejection info |

### InsurancePayer (`insurance_payers`)
| Field | Type | Purpose |
|-------|------|---------|
| name | String | Payer name (Daman, ADNIC, etc.) |
| code | String | Short code |
| regulator | String? | DHA / DOH / HAAD |
| preAuthRequired | Boolean | Global pre-auth flag |
| icdRules | ICD10PayerRule[] | Diagnosis-specific rules |
| cptRules | CPTPayerRule[] | Procedure-specific rules |

### DeductibleLedger (`deductible_ledgers`) — UPDATED (GAP 4)
| Field | Type | Purpose |
|-------|------|---------|
| patientId | String | FK to Patient |
| insurancePolicyId | String? | FK to PatientInsurance |
| fiscalYear | Int | Calendar year |
| accumulatedAmount | Decimal(10,2) | Total charges applied to deductible |
| maxDeductible | Decimal(10,2) | Annual deductible limit |
| copayAccumulated | Decimal?(10,2) | Total copay paid YTD (GAP 4) |
| maxCopay | Decimal?(10,2) | Annual copay cap (GAP 4) |
| lastUpdated | DateTime | Last update timestamp |

### InsuranceVerificationAudit (`insurance_verification_audits`) — NEW (GAP 7)
| Field | Type | Purpose |
|-------|------|---------|
| id | String (UUID) | Primary key |
| hospitalId | String | FK to Hospital |
| patientId | String? | FK to Patient |
| appointmentId | String? | FK to Appointment |
| action | String | See audit actions table in Section 9 |
| previousData | Json? | State before action |
| newData | Json? | State after action |
| dhaResponse | Json? | Raw DHA response (if applicable) |
| reason | String? | User-provided reason |
| performedBy | String | User who performed action |
| performedAt | DateTime | Timestamp (default: now) |
| ipAddress | String? | Client IP address |

### HospitalSettings (`hospital_settings`)
| Field | Type | Purpose |
|-------|------|---------|
| dhaSettings | Json | DHA eClaimLink config (facilityId, apiKey, mode, etc.) |
| paymentSettings | Json | Payment gateway config |

---

## 12. SEQUENCE DIAGRAM: FULL CHECK-IN WITH COPAY

```
Receptionist          Frontend (OPD)        Backend APIs           DHA eClaimLink
    │                      │                      │                      │
    ├─ Click "Check In" ──→│                      │                      │
    │  (Today's Appts tab) │                      │                      │
    │                      │                      │                      │
    │                      ├─ Open CopayModal ───→│                      │
    │                      │  GET /billing/        │                      │
    │                      │  calculate-copay/     │                      │
    │                      │  :patientId           │                      │
    │                      │                      ├─ Query PatientIns ──→│
    │                      │                      │  (isPrimary, active) │
    │                      │                      │                      │
    │                      │                      │◄── Insurance data ───┤
    │                      │                      │                      │
    │                      │                      ├─ If DHA enabled: ───→│
    │                      │                      │  SOAP XML request    │
    │                      │                      │  (EmiratesID)        │
    │                      │                      │                      │
    │                      │                      │◄── XML response ─────┤
    │                      │                      │  (status, coverage)  │
    │                      │                      │                      │
    │                      │                      ├─ Cross-verify ───────┤
    │                      │                      │  (Scenarios A-D)     │
    │                      │                      │                      │
    │                      │                      ├─ Check pre-auth      │
    │                      │                      │  (GAP 1)             │
    │                      │                      │                      │
    │                      │                      ├─ Get deductible      │
    │                      │                      │  ledger (GAP 4)      │
    │                      │                      │                      │
    │                      │                      ├─ Check secondary     │
    │                      │                      │  insurance (GAP 2)   │
    │                      │                      │                      │
    │                      │                      ├─ Get pharmacy        │
    │                      │                      │  estimate (GAP 6)    │
    │                      │                      │                      │
    │                      │                      ├─ Determine data      │
    │                      │                      │  source (GAP 5)      │
    │                      │                      │                      │
    │                      │                      ├─ Calculate copay     │
    │                      │                      │  (fee, %, caps)      │
    │                      │                      │                      │
    │                      │◄── Full CopayInfo ───┤                      │
    │                      │  {hasCopay, amount,   │                      │
    │                      │   preAuth, deductible,│                      │
    │                      │   cob, pharmacy,      │                      │
    │                      │   dataSource, alerts} │                      │
    │                      │                      │                      │
    │◄── Display modal ────┤                      │                      │
    │   (fee breakdown,    │                      │                      │
    │    pre-auth warning, │                      │                      │
    │    deductible bars,  │                      │                      │
    │    COB breakdown,    │                      │                      │
    │    data source,      │                      │                      │
    │    pharmacy est.)    │                      │                      │
    │                      │                      │                      │
    ├─ Select "Collect" ──→│                      │                      │
    │   + payment method   │                      │                      │
    │                      ├─ POST /billing/ ────→│                      │
    │                      │  copay-collect        │                      │
    │                      │                      ├─ Create CopayPayment │
    │                      │                      ├─ Update Appointment  │
    │                      │                      │  (copayCollected=T)  │
    │                      │                      ├─ Post to GL          │
    │                      │                      ├─ Update Deductible   │
    │                      │                      │  Ledger (GAP 4)      │
    │                      │                      ├─ Generate Receipt    │
    │                      │                      │  (GAP 3)             │
    │                      │                      │                      │
    │                      │◄── Success + Receipt ─┤                     │
    │                      │  {receiptNumber,      │                      │
    │                      │   vatAmount}           │                      │
    │                      │                      │                      │
    │◄── Receipt screen ───┤                      │                      │
    │   Print / Email      │                      │                      │
    │                      │                      │                      │
    │                      ├─ POST /insurance- ──→│                      │
    │                      │  coding/audit/log     │                      │
    │                      │  (fire-and-forget)    │                      │
    │                      │  (GAP 7)              │                      │
    │                      │                      │                      │
    ├─ Click "Continue" ──→│                      │                      │
    │                      ├─ POST /opd/ ────────→│                      │
    │                      │  check-in/:id         │                      │
    │                      │                      ├─ Generate token#     │
    │                      │                      ├─ Set CHECKED_IN      │
    │                      │                      ├─ Set checkedInAt     │
    │                      │                      │                      │
    │◄── "Checked In" ─────┤◄── Success ──────────┤                      │
    │   Token #XX          │                      │                      │
```

---

## 13. PATIENT PORTAL QUICK BOOK FLOW

### Overview
The Patient Portal allows patients to book appointments via three modes:
- **Standard**: Department → Doctor → Date → Time (step-by-step)
- **Quick Book**: Department → See all doctors with available slots for today
- **Emergency**: Auto-selects Emergency department, shows today's slots immediately

### Quick Book Date Handling
**File:** `frontend/src/pages/PatientPortal/Appointments.tsx`

Key implementation details:
- Uses `getTodayInUAE()` (from `frontend/src/utils/timezone.ts`) for date initialization — ensures correct UAE timezone (UTC+4) regardless of browser timezone
- Date picker `min` attributes also use `getTodayInUAE()` for consistency
- Single combined useEffect (lines 282-298) handles both slot map reset and fetch to avoid race conditions:

```typescript
useEffect(() => {
  if (!showBookModal) return;
  if (bookingMode !== 'emergency' && bookingMode !== 'quick') return;
  if (!doctors || doctors.length === 0) return;

  const dateToUse = bookingMode === 'emergency' ? getTodayInUAE() : selectedDate;
  if (!dateToUse) return;

  // Clear previous slots and fetch fresh for all doctors
  setDoctorSlotsMap({});
  doctors.forEach((doctor: Doctor) => {
    fetchDoctorSlots(doctor.id, dateToUse);
  });
}, [showBookModal, bookingMode, doctors, selectedDate]);
```

### Slot Filtering
Available slots are filtered using `isSlotPastInUAE(slot.time, selectedDate, 15)` which:
- Only filters for today's date (future dates show all slots)
- Uses UAE timezone for current time comparison
- Applies 15-minute buffer (slots within 15 min of current time are hidden)

---

## 14. ROLE-BASED PERMISSIONS

### OPD Check-In Actions
| Action | Roles |
|--------|-------|
| Check In (click button) | RECEPTIONIST, HOSPITAL_ADMIN, SUPER_ADMIN |
| Walk-In Registration | RECEPTIONIST, HOSPITAL_ADMIN, SUPER_ADMIN |
| Record Vitals | NURSE, HOSPITAL_ADMIN, SUPER_ADMIN |
| Start Consultation | DOCTOR, HOSPITAL_ADMIN, SUPER_ADMIN |

### Copay Refund Actions
| Action | Roles |
|--------|-------|
| Request Refund | RECEPTIONIST, HOSPITAL_ADMIN, SUPER_ADMIN |
| Approve/Reject Refund | HOSPITAL_ADMIN, SUPER_ADMIN, ACCOUNTANT |
| Process Refund | HOSPITAL_ADMIN, SUPER_ADMIN, ACCOUNTANT |
| Delete Refund | SUPER_ADMIN |

### Audit Log Access
| Action | Roles |
|--------|-------|
| View Audit Log | HOSPITAL_ADMIN, SUPER_ADMIN, ACCOUNTANT |
| Export CSV | HOSPITAL_ADMIN, SUPER_ADMIN, ACCOUNTANT |

---

## 15. OPD QUEUE WORKFLOW STAGES

```
SCHEDULED / CONFIRMED
    │
    ├─ "Check In" button (orange)
    │   └─ CopayCollectionModal → Collect/Waive/Defer
    │       └─ POST /opd/check-in/:id
    │
    ▼
CHECKED_IN (awaiting vitals)
    │
    ├─ "Record Vitals" button
    │   └─ VitalsModal → BP, HR, Temp, SpO2, etc.
    │
    ▼
CHECKED_IN (vitals recorded — "Ready for Doctor")
    │
    ├─ "Start Consultation" button
    │   └─ Navigate to /consultation/:id
    │
    ▼
IN_PROGRESS / IN_CONSULTATION
    │
    └─ Doctor completes → COMPLETED
```

---

## 16. EDGE CASES & CURRENT STATUS

### Fully Handled (Previously Gaps, Now Implemented)
| # | Feature | Implementation |
|---|---------|---------------|
| GAP 1 | Pre-auth check at OPD check-in | `calculateCopay()` checks payer + CPT pre-auth rules; modal shows color-coded panel with Override/Request/Convert actions |
| GAP 2 | COB / Secondary insurance | `calculateCopay()` queries secondary insurance and computes layered coverage; modal shows dual breakdown |
| GAP 3 | Receipt generation | `collectCopay()` calls `receiptService.generateCopayReceipt()`; modal shows receipt with Print/Email |
| GAP 4 | Deductible ledger tracking | `DeductibleLedger` schema extended with `copayAccumulated`/`maxCopay`; `deductibleService` integrated into copay calculate + collect |
| GAP 5 | Data source indicator | `calculateCopay()` determines DHA_LIVE/SANDBOX/MOCK/CACHED/NOT_CONFIGURED; modal shows color-coded banner |
| GAP 6 | Pharmacy estimate | `calculateCopay()` queries active prescriptions; modal shows estimated total visit cost |
| GAP 7 | Audit trail | `InsuranceVerificationAudit` model + service + REST API + frontend page; all modal actions fire audit logs |
| GAP 9 | Copay refund flow | `CopayRefund` model + service + REST API + frontend page; full lifecycle with ledger reversal |

### Previously Handled (Unchanged)
1. **DHA API timeout/failure** → Falls back to cached DB data with warning alert
2. **Expired policy renewed** → Auto-syncs from DHA (cross-verify Scenario B)
3. **Coverage changes** → Alerts for provider/coverage/copay changes (cross-verify Scenario D)
4. **No insurance** → Self-pay fallback at 100% patient responsibility
5. **Out-of-network** → Copay doubled or capped at 40%
6. **Age/gender restrictions** → Patient pays 100% for restricted procedures
7. **Annual caps** → Tracked via DeductibleLedger (primary) and CopayPayment YTD (fallback)
8. **Deposit payment** → Can apply from patient deposit balance

### Known Limitations
1. **Email Receipt is UI-only** — The "Email Receipt" button shows a toast but does not call a backend API to actually send the email
2. **Pre-Auth Override has no frontend role check** — The "Override (Admin)" button fires an audit log but does not verify the user's role client-side (backend authorization applies separately)
3. **Refund Request requires raw Payment ID** — The "Request Refund" form requires the user to manually enter a Copay Payment ID string; no patient/payment search is integrated into the form
4. **Pharmacy copay is separate** — Pharmacy copay is estimated at check-in but collected separately at the pharmacy via `PharmacyCopayModal`

---

## 17. KEY FILES REFERENCE

| Area | File Path | Key Functions/Components |
|------|-----------|------------------------|
| **Check-in trigger** | `frontend/src/pages/OPD/index.tsx:659-702` | `handleCheckIn()`, `completeCheckIn()` |
| **Copay modal** | `frontend/src/components/billing/CopayCollectionModal.tsx` | Full modal with GAP 1-7 features |
| **Pharmacy copay** | `frontend/src/components/billing/PharmacyCopayModal.tsx` | Pharmacy-specific copay |
| **Walk-in capture** | `frontend/src/components/common/WalkInInsuranceCapture.tsx` | 3-step EID → Register → Collect |
| **EID lookup UI** | `frontend/src/components/insurance/EmiratesIdLookup.tsx` | EID input + verification |
| **IPD verification** | `frontend/src/components/ipd/IPDInsuranceVerification.tsx` | IPD admission insurance check |
| **Audit log page** | `frontend/src/pages/InsuranceCoding/AuditLog.tsx` | Audit table, filters, CSV export (GAP 7) |
| **Copay refunds page** | `frontend/src/pages/Billing/CopayRefunds.tsx` | Refund management UI (GAP 9) |
| **Patient Portal booking** | `frontend/src/pages/PatientPortal/Appointments.tsx` | Quick book with UAE timezone handling |
| **Frontend API** | `frontend/src/services/api.ts` | Copay, audit, refund API calls |
| **Timezone utils** | `frontend/src/utils/timezone.ts` | `getTodayInUAE()`, `isSlotPastInUAE()` |
| **OPD routes** | `backend/src/routes/opdRoutes.ts` | `POST /opd/check-in/:id` |
| **Billing routes** | `backend/src/routes/billingRoutes.ts` | Copay calculate + collect + refunds |
| **Insurance routes** | `backend/src/routes/insuranceCodingRoutes.ts` | EID verify + manual verify + audit |
| **DHA routes** | `backend/src/routes/dhaEClaimRoutes.ts` | DHA eligibility + claims |
| **OPD service** | `backend/src/services/opdService.ts` | `checkInPatient()` |
| **Billing service** | `backend/src/services/billingService.ts` | `calculateCopay()`, `collectCopay()` |
| **Eligibility service** | `backend/src/services/insuranceEligibilityService.ts` | Full eligibility + cross-verify |
| **DHA service** | `backend/src/services/dhaEClaimService.ts` | SOAP API calls to DHA |
| **Pre-auth service** | `backend/src/services/preAuthService.ts` | Coverage verify + copay calc |
| **Deductible service** | `backend/src/services/deductibleService.ts` | Deductible + copay ledger tracking (GAP 4) |
| **Audit service** | `backend/src/services/insuranceAuditService.ts` | Audit log/list/export (GAP 7) |
| **Refund service** | `backend/src/services/copayRefundService.ts` | Full refund lifecycle (GAP 9) |
| **Schema** | `backend/prisma/schema.prisma` | PatientInsurance, Appointment, CopayPayment, CopayRefund, InsurancePayer, DeductibleLedger, InsuranceVerificationAudit |

---

## 18. E2E TEST COVERAGE

### Test Files
| File | Tests | Purpose |
|------|-------|---------|
| `tests/copay-checkin-e2e.spec.ts` | 18 tests | Pages load, role access, filters, CSV export for AuditLog and CopayRefunds |
| `tests/copay-checkin-flow.spec.ts` | 1 flow test | Full check-in: OPD → Today's Appointments → Check In → CopayCollectionModal → Payment → Receipt → CHECKED_IN → Audit verification |

### What the Flow Test Verifies
1. Login as admin
2. Navigate to OPD page
3. Switch to "Today's Appointments" tab
4. Click "Check In" on first available appointment
5. Verify CopayCollectionModal opens with:
   - Patient info (name, MRN)
   - Insurance details (provider, plan)
   - Pre-auth status (GAP 1)
   - Data source indicator (GAP 5)
   - Deductible info (GAP 4)
   - Pharmacy estimate (GAP 6)
   - Fee breakdown with currency (AED)
   - Payment method options (Cash, Card)
   - Action buttons (Collect, Waive, Defer)
6. Select Cash payment and click Collect
7. Verify receipt screen (GAP 3)
8. Verify CHECKED_IN status on OPD page
9. Navigate to Insurance Audit page
10. Verify audit entries exist (GAP 7)
