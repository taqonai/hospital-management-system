# Copay Collection at Check-In: Complete Implementation Walkthrough

## Architecture Overview

The copay collection at check-in involves 3 frontend components, 4 backend services, 6 API endpoints, and 5 database models working together across two scenarios (insured vs uninsured patients).

---

## 1. COMPLETE CHECK-IN FLOW (HIGH-LEVEL)

```
Receptionist clicks "Check In" on SCHEDULED/CONFIRMED appointment
    ↓
CopayCollectionModal opens
    ↓
GET /billing/calculate-copay/:patientId?appointmentId=xxx
    ↓
billingService.calculateCopay() → returns fee breakdown
    ↓
Receptionist selects: Collect / Waive / Defer
    ↓
POST /billing/copay-collect (if collecting)
    ↓
POST /opd/check-in/:appointmentId → status → CHECKED_IN
    ↓
Patient enters queue (awaiting vitals)
```

---

## 2. SCENARIO A: Patient WITHOUT Pre-Submitted Insurance

### Step 1: Check-In Initiation
**Frontend:** `frontend/src/pages/OPD/index.tsx` (lines 658-702)
- `handleCheckIn()` (line 659): Opens `CopayCollectionModal` with appointment details
- Available to: RECEPTIONIST, HOSPITAL_ADMIN, SUPER_ADMIN

### Step 2: Walk-In Insurance Capture (if needed)
**Frontend:** `frontend/src/components/common/WalkInInsuranceCapture.tsx` (lines 1-522)

Three-step flow:
1. **EID Lookup** (step: `eid_lookup`): Scan/enter Emirates ID → calls `POST /insurance-coding/eligibility/verify-eid`
2. **Quick Registration** (step: `quick_register`): If patient not found, collect firstName, lastName, DOB, gender, phone, emiratesId → create patient record
3. **Copay Collection** (step: `copay_collect`): Show insurance info or "No Insurance" warning, select payment method, collect or defer

### Step 3: Emirates ID Eligibility Verification
**Backend:** `backend/src/services/insuranceEligibilityService.ts` → `lookupByEmiratesId()` (lines 764-805)

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
**Backend:** `backend/src/services/billingService.ts` → `calculateCopay()` (lines 2486-2543)

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
    noInsurance: true
  }
}
```

**Frontend:** `CopayCollectionModal` (lines 194-361) shows:
- "No Insurance on File" warning (orange background)
- UAE insurance requirement notice
- 100% self-pay fee breakdown
- Options: Collect Self-Pay, Defer Payment, Cancel

---

## 3. SCENARIO B: Patient WITH Pre-Submitted Insurance (via Portal)

### Step 1: Check-In Initiation
Same as Scenario A: `handleCheckIn()` in OPD/index.tsx

### Step 2: Copay Calculation with Existing Insurance
**Backend:** `backend/src/services/billingService.ts` → `calculateCopay()` (lines 2459-2750)

Full algorithm:

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
6. Calculate deductible (from CopayPayment records YTD):
   - Sum payments in current calendar year
   - Track: { total, used, remaining }
    ↓
7. Track annual copay cap:
   - PatientInsurance.annualCopayMax
   - Track: { total, used, remaining }
    ↓
8. Apply per-visit cap:
   - If copayCapPerVisit > 0 && patientAmount > cap → cap it
    ↓
9. Final calculation:
   patientAmount = (consultationFee * copayPercentage) / 100
   insuranceAmount = consultationFee - patientAmount
```

### Step 3: Real-Time DHA Verification (Cross-Verification)
**Backend:** `backend/src/services/insuranceEligibilityService.ts` → `crossVerifyInsurance()` (lines 238-394)

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

## 4. INSURANCE VALIDATION RULES (BOTH SCENARIOS)

### Validation Checkpoint 1: Emirates ID Format
- **Location:** `dhaEClaimRoutes.ts` (line 67)
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
- **Emergency:** Pre-auth waived
- **Elective:** Pre-auth required if flagged

---

## 5. ALL API ENDPOINTS INVOLVED

### Check-In & Copay
| Method | Endpoint | Service | Purpose |
|--------|----------|---------|---------|
| GET | `/billing/calculate-copay/:patientId` | billingService.calculateCopay() | Calculate copay breakdown |
| POST | `/billing/copay-collect` | billingService.collectCopay() | Record copay payment |
| POST | `/opd/check-in/:appointmentId` | opdService.checkInPatient() | Update status to CHECKED_IN |
| GET | `/billing/patients/:patientId/deposit-balance` | depositService.getDepositBalance() | Check available deposits |

### Insurance Eligibility
| Method | Endpoint | Service | Purpose |
|--------|----------|---------|---------|
| POST | `/insurance-coding/eligibility/verify-eid` | insuranceEligibilityService.lookupByEmiratesId() | Primary EID lookup |
| POST | `/insurance-coding/eligibility/verify-patient` | insuranceEligibilityService.verifyEligibilityByPatientId() | Verify by patient ID |
| GET | `/insurance-coding/eligibility/:patientId` | insuranceEligibilityService.verifyEligibilityByPatientId() | Cached eligibility |

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

## 6. DATABASE TABLES & KEY FIELDS

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
| paymentMethod | String | CASH / CREDIT_CARD / DEBIT_CARD |
| insuranceProvider | String? | Provider name at time of payment |
| policyNumber | String? | Policy number at time of payment |
| collectedBy | String | User who collected |
| paymentDate | DateTime | When collected |

### InsurancePayer (`insurance_payers`)
| Field | Type | Purpose |
|-------|------|---------|
| name | String | Payer name (Daman, ADNIC, etc.) |
| code | String | Short code |
| regulator | String? | DHA / DOH / HAAD |
| preAuthRequired | Boolean | Global pre-auth flag |
| icdRules | ICD10PayerRule[] | Diagnosis-specific rules |
| cptRules | CPTPayerRule[] | Procedure-specific rules |

### HospitalSettings (`hospital_settings`)
| Field | Type | Purpose |
|-------|------|---------|
| dhaSettings | Json | DHA eClaimLink config (facilityId, apiKey, mode, etc.) |
| paymentSettings | Json | Payment gateway config |

### DeductibleLedger (`deductible_ledgers`)
| Field | Type | Purpose |
|-------|------|---------|
| patientId | String | FK to Patient |
| insuranceId | String | FK to PatientInsurance |
| fiscalYear | Int | Calendar year |
| chargesApplied | Decimal | Total charges applied to deductible |
| paymentsApplied | Decimal | Total payments applied |

---

## 7. SEQUENCE DIAGRAM: FULL CHECK-IN WITH COPAY

```
Receptionist          Frontend (OPD)        Backend APIs           DHA eClaimLink
    │                      │                      │                      │
    ├─ Click "Check In" ──→│                      │                      │
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
    │                      │                      ├─ Cross-verify ──────→│
    │                      │                      │  (Scenarios A-D)     │
    │                      │                      │                      │
    │                      │                      ├─ Calculate copay     │
    │                      │                      │  (fee, %, caps)      │
    │                      │                      │                      │
    │                      │◄── CopayInfo ────────┤                      │
    │                      │  {hasCopay, amount,   │                      │
    │                      │   breakdown, alerts}  │                      │
    │                      │                      │                      │
    │◄── Display modal ────┤                      │                      │
    │   (fee, coverage,    │                      │                      │
    │    payment methods)  │                      │                      │
    │                      │                      │                      │
    ├─ Select "Collect" ──→│                      │                      │
    │   + payment method   │                      │                      │
    │                      ├─ POST /billing/ ────→│                      │
    │                      │  copay-collect        │                      │
    │                      │                      ├─ Create CopayPayment │
    │                      │                      ├─ Update Appointment  │
    │                      │                      │  (copayCollected=T)  │
    │                      │                      ├─ Post to GL          │
    │                      │                      │                      │
    │                      │◄── Success ──────────┤                      │
    │                      │                      │                      │
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

## 8. EDGE CASES & GAPS IDENTIFIED

### Currently Handled
1. **DHA API timeout/failure** → Falls back to cached DB data with warning alert
2. **Expired policy renewed** → Auto-syncs from DHA (Scenario B)
3. **Coverage changes** → Alerts for provider/coverage/copay changes (Scenario D)
4. **No insurance** → Self-pay fallback at 100% patient responsibility
5. **Out-of-network** → Copay doubled or capped at 40%
6. **Age/gender restrictions** → Patient pays 100% for restricted procedures
7. **Annual caps** → Tracked via CopayPayment YTD aggregation
8. **Deposit payment** → Can apply from patient deposit balance

### Potential Gaps
1. **No pre-auth check at OPD check-in** — `checkPreAuthRequirement()` exists but is not called during the OPD check-in flow; only available as a standalone API
2. **Mock DHA responses in sandbox** — When DHA is not configured, mock responses are returned; no clear indicator to the user that data is simulated
3. **COB (Coordination of Benefits)** — Secondary insurance copay calculation is not integrated into the check-in flow; `coordinationOfBenefitsService` exists but is separate
4. **Pharmacy copay at check-in** — Pharmacy copay is a separate flow (`PharmacyCopayModal`), not combined with consultation copay at check-in
5. **No receipt generation** — CopayPayment record is created but no receipt PDF is generated at collection time
6. **Deductible ledger sync** — `DeductibleLedger` model exists but the check-in copay flow uses `CopayPayment` aggregation rather than the ledger for YTD tracking

---

## 9. KEY FILES REFERENCE

| Area | File Path | Key Functions/Components |
|------|-----------|------------------------|
| **Check-in trigger** | `frontend/src/pages/OPD/index.tsx:658-702` | `handleCheckIn()`, `completeCheckIn()` |
| **Copay modal** | `frontend/src/components/billing/CopayCollectionModal.tsx` | Full modal with fee breakdown |
| **Pharmacy copay** | `frontend/src/components/billing/PharmacyCopayModal.tsx` | Pharmacy-specific copay |
| **Walk-in capture** | `frontend/src/components/common/WalkInInsuranceCapture.tsx` | 3-step EID→Register→Collect |
| **EID lookup UI** | `frontend/src/components/insurance/EmiratesIdLookup.tsx` | EID input + verification |
| **IPD verification** | `frontend/src/components/ipd/IPDInsuranceVerification.tsx` | IPD admission insurance check |
| **Frontend API** | `frontend/src/services/api.ts:1038-1056` | Copay API calls |
| **OPD routes** | `backend/src/routes/opdRoutes.ts:67-75` | `POST /opd/check-in/:id` |
| **Billing routes** | `backend/src/routes/billingRoutes.ts:82-124` | Copay calculate + collect |
| **DHA routes** | `backend/src/routes/dhaEClaimRoutes.ts` | DHA eligibility + claims |
| **Insurance routes** | `backend/src/routes/insuranceCodingRoutes.ts:1828-1985` | EID verify + manual verify |
| **OPD service** | `backend/src/services/opdService.ts:178-216` | `checkInPatient()` |
| **Billing service** | `backend/src/services/billingService.ts:2459-2750` | `calculateCopay()` |
| **Billing service** | `backend/src/services/billingService.ts:3177-3308` | `collectCopay()` |
| **Eligibility service** | `backend/src/services/insuranceEligibilityService.ts` | Full eligibility + cross-verify |
| **DHA service** | `backend/src/services/dhaEClaimService.ts` | SOAP API calls to DHA |
| **Pre-auth service** | `backend/src/services/preAuthService.ts` | Coverage verify + copay calc |
| **Deductible service** | `backend/src/services/deductibleService.ts` | Deductible tracking |
| **Schema** | `backend/prisma/schema.prisma` | PatientInsurance (1045-1084), Appointment, CopayPayment (2097-2113), InsurancePayer (6032-6065), DeductibleLedger (8381-8395) |
