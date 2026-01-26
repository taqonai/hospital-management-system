# Laboratory / Diagnostics Flow — Product Requirements Document (PRD)

> **Version:** 1.0  
> **Date:** 2025-07-11  
> **Status:** Draft  
> **Author:** Engineering Team  
> **System:** Spetaar HMS (Hospital Management System)  
> **Codebase:** `/home/taqon/his/hospital-management-system/`

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Root Cause Analysis](#2-root-cause-analysis)
3. [Complete Laboratory Workflow](#3-complete-laboratory-workflow)
4. [Role Definitions](#4-role-definitions)
5. [Data Model Changes](#5-data-model-changes)
6. [API Endpoints](#6-api-endpoints)
7. [Frontend Pages & Components](#7-frontend-pages--components)
8. [Integration Points](#8-integration-points)
9. [Implementation Plan](#9-implementation-plan)
10. [Appendix: File Reference Map](#10-appendix-file-reference-map)

---

## 1. Problem Statement

### What's Broken

The **Laboratory page** (`/laboratory`) appears mostly blank during QA testing — showing only the gradient header and a "2 Critical Values Require Attention" alert, but no orders, results, or meaningful stats. The page is non-functional as a working laboratory information system.

### Business Impact

- **Doctors** cannot order lab tests during consultations and see results
- **Lab technicians** have no dashboard to process work
- **Pathologists** have no role in the system at all — they cannot validate results
- **Patients** see empty lab results in the Patient Portal
- **Billing** cannot auto-charge for laboratory services
- The entire diagnostics pipeline (order → collect → process → result → report) is broken

---

## 2. Root Cause Analysis

After thorough code review, here are the **specific technical issues** causing the lab flow to be broken:

### 2.1. Stats API Response Mismatch (Why stats show zero)

**File:** `backend/src/services/laboratoryService.ts` — `getLabStats()` method (line ~275)

The backend returns:
```typescript
return { totalOrders, pendingOrders, completedToday, criticalResults };
```

The frontend expects (in `frontend/src/pages/Laboratory/index.tsx`, line ~410):
```typescript
interface LabStats {
  pendingOrders: number;
  inProgressOrders: number;  // ← NOT returned by backend
  criticalResults: number;
  completedToday: number;
}
```

**Impact:** `inProgressOrders` is always `0` because the backend returns `totalOrders` instead. The stat card shows misleading data.

### 2.2. `orderedBy` Is a String ID, Not a Relation (Why doctor names are blank)

**File:** `backend/prisma/schema.prisma` — `LabOrder` model (line ~1119)

```prisma
orderedBy      String        // ← Just a userId string, NOT a relation
```

The frontend tries to render:
```tsx
Dr. {order.orderedBy?.firstName} {order.orderedBy?.lastName}
```

This renders nothing because `orderedBy` is a plain string UUID, not an included relation object. Compare with the `patient` field which IS a proper relation and renders correctly.

### 2.3. No `LabSample` Prisma Model — Samples Are In-Memory Only

**File:** `backend/src/services/laboratoryService.ts` (lines ~15-30)

```typescript
// In-memory storage for sample tracking (would be database tables in production)
const sampleStorage: Map<string, SampleData> = new Map();
const sampleHistoryStorage: Map<string, SampleStatusHistory[]> = new Map();
```

**Impact:** All sample data is lost on server restart. The Sample Tracking tab works momentarily but data vanishes. This is literally marked with a TODO comment in the code.

### 2.4. Results Entry Tab Is a Non-Functional Placeholder

**File:** `frontend/src/pages/Laboratory/index.tsx` (line ~730)

The "Results Entry" tab renders just a static card with a "Start Results Entry" button that does absolutely nothing:
```tsx
{activeTab === 'results' && (
  <div className="text-center py-16">
    <h3>Results Entry</h3>
    <button>Start Results Entry</button>  // ← No onClick handler
  </div>
)}
```

There is no form, no workflow, no way to enter results from the frontend.

### 2.5. No PATHOLOGIST Role in the System

**File:** `backend/prisma/schema.prisma` — `UserRole` enum (line ~190)

```prisma
enum UserRole {
  SUPER_ADMIN
  HOSPITAL_ADMIN
  DOCTOR
  NURSE
  RECEPTIONIST
  LAB_TECHNICIAN    // ← Exists
  PHARMACIST
  RADIOLOGIST       // ← Exists
  ACCOUNTANT
  PATIENT
  HR_MANAGER
  ...
  // NO PATHOLOGIST!
  // NO PHLEBOTOMIST!
}
```

Without a `PATHOLOGIST` role, there is no one authorized to **validate and sign off** on lab results. The `verifyTestResult` route only allows `LAB_TECHNICIAN` and `DOCTOR` — pathologists are completely missing from the authorization chain.

### 2.6. No Order-to-Results Workflow Actions in the UI

The order cards in the Lab Orders list show status badges but provide **no action buttons** for:
- Collect Sample
- Start Processing
- Enter Results
- Verify/Validate Results
- Mark Complete

The only status change possible is via direct API calls (which lab techs won't do).

### 2.7. Critical Results Show But Lack Acknowledgment Flow

The "Acknowledge" button on critical results (line ~777) has no `onClick` handler — it does nothing.

### 2.8. No Lab Order Creation From Consultation Page

The Consultation page (`frontend/src/pages/Consultation/index.tsx`) has no UI to order lab tests during a patient encounter. While the schema supports `Consultation → LabOrder[]` relation, there's no frontend to create lab orders from within the consultation flow.

---

## 3. Complete Laboratory Workflow

### 3.1. End-to-End Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        LABORATORY WORKFLOW                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ORDERING              COLLECTION           PROCESSING         REPORTING    │
│  ────────              ──────────           ──────────         ─────────    │
│                                                                             │
│  Doctor/ER             Nurse/Phlebotomist   Lab Technician     Pathologist  │
│  ┌──────────┐          ┌──────────────┐     ┌──────────────┐   ┌─────────┐ │
│  │ Create   │──STAT──→ │ Collect      │────→│ Receive &    │──→│ Review  │ │
│  │ Lab Order│          │ Sample       │     │ Process      │   │ & Sign  │ │
│  │          │          │              │     │ Sample       │   │ Off     │ │
│  │ • Tests  │          │ • Barcode    │     │              │   │         │ │
│  │ • Priority│         │ • Label      │     │ • Run Tests  │   │ • Verify│ │
│  │ • Notes  │          │ • Transport  │     │ • Enter      │   │ • Flag  │ │
│  └──────────┘          │   Chain      │     │   Results    │   │ • Report│ │
│       │                └──────────────┘     │ • Flag       │   └────┬────┘ │
│       │                       │             │   Abnormal   │        │      │
│       │                       │             └──────────────┘        │      │
│       │                       │                                     │      │
│       ▼                       ▼                                     ▼      │
│  ┌──────────┐          ┌──────────────┐                     ┌─────────────┐│
│  │ Billing  │          │ QC Check     │                     │ Deliver     ││
│  │ Auto-    │          │ Accept/Reject│                     │ Results     ││
│  │ Charge   │          │ Sample       │                     │ • Doctor    ││
│  └──────────┘          └──────────────┘                     │ • Patient   ││
│                                                             │ • Portal    ││
│                                                             │ • Critical  ││
│                                                             │   Alert     ││
│                                                             └─────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2. Status Flow

```
ORDERED → SAMPLE_COLLECTED → RECEIVED → IN_PROGRESS → RESULTED → VERIFIED → COMPLETED
                                  ↘                                    ↗
                              REJECTED (recollect needed)
```

### 3.3. Detailed Stage Descriptions

#### Stage 1: Order Creation (Actor: Doctor / ER Physician / Nurse)

**Trigger:** During OPD consultation, IPD stay, or Emergency visit

**Actions:**
1. Doctor selects tests from the Lab Test Catalog (grouped by category)
2. System suggests tests via AI Smart Order based on diagnosis/symptoms
3. Doctor sets priority (ROUTINE / URGENT / STAT)
4. Doctor adds clinical notes and special instructions
5. System generates unique order number (`LAB-XXXXXXXXX`)
6. System auto-generates billing line items
7. Notification sent to Lab department
8. For STAT orders: immediate push notification + audible alert

**Data Created:**
- `LabOrder` record with status `ORDERED`
- `LabOrderTest` records for each test (status `PENDING`)
- `BillingLineItem` (auto-charge)
- Notification to lab queue

#### Stage 2: Sample Collection (Actor: Nurse / Phlebotomist / Lab Technician)

**Trigger:** Order appears in Sample Collection Worklist

**Actions:**
1. Phlebotomist sees pending orders in collection worklist
2. Selects order and views required sample types
3. Collects sample(s) from patient
4. System generates barcode label for each tube/container
5. Records: sample type, volume, condition, collection time, collector ID
6. Special handling flags (cold chain, light-sensitive, timed)
7. Patient signs/acknowledges collection (optional)
8. Order status → `SAMPLE_COLLECTED`
9. Sample enters Chain of Custody tracking

**Data Created:**
- `LabSample` record with barcode, chain of custody log
- Status history entry

#### Stage 3: Sample Receipt & QC (Actor: Lab Technician)

**Trigger:** Sample arrives at laboratory

**Actions:**
1. Lab tech scans barcode to receive sample
2. Verifies sample quality (hemolyzed, lipemic, clotted, insufficient volume)
3. If acceptable → status `RECEIVED`, proceed to processing
4. If rejected → status `REJECTED`, notification to recollect
5. Cold chain temperature logged (if applicable)
6. Sample assigned to appropriate analyzer/workstation

#### Stage 4: Processing & Results Entry (Actor: Lab Technician)

**Trigger:** Sample received and quality-approved

**Actions:**
1. Lab tech starts processing → order status `IN_PROGRESS`
2. For automated analyzers: results auto-populated (future integration)
3. For manual tests: lab tech enters results via Results Entry form
4. System auto-calculates:
   - Whether value is within normal range
   - Whether value is abnormal (flag with ⚠️)
   - Whether value is critical (flag with 🔴, trigger alert)
5. Lab tech adds comments if needed
6. Order test status → `RESULTED`

**Critical Value Protocol:**
- If any result is CRITICAL → immediate notification to:
  - Ordering physician (push + SMS)
  - Patient (push notification)
  - Lab supervisor
- Critical value must be acknowledged within 30 minutes
- Audit trail of notification → acknowledgment time

#### Stage 5: Verification & Sign-Off (Actor: Pathologist)

**Trigger:** All tests in order have results entered

**Actions:**
1. Pathologist reviews results on their Verification Worklist
2. Checks for consistency, plausibility, delta checks (vs previous results)
3. Can request re-run if results seem implausible
4. Adds pathologist's interpretation/comments
5. Digitally signs/verifies the result
6. Order test status → `VERIFIED`
7. When all tests verified → order status → `COMPLETED`

#### Stage 6: Results Delivery (Automatic)

**Trigger:** Order status → `COMPLETED`

**Actions:**
1. Results available to ordering doctor in consultation view
2. Results appear in Patient Portal (`/patient-portal/lab-results`)
3. PDF report generated with letterhead, reference ranges, pathologist signature
4. Push notification to patient: "Your lab results are ready"
5. If abnormal results: highlighted alert in doctor's dashboard
6. AI interpretation available (optional analysis)

---

## 4. Role Definitions

### 4.1. New Roles to Add to `UserRole` Enum

```prisma
enum UserRole {
  // ... existing roles ...
  LAB_TECHNICIAN     // Already exists
  RADIOLOGIST        // Already exists
  PATHOLOGIST        // NEW - validates lab results
  PHLEBOTOMIST       // NEW - collects samples (optional, can be NURSE)
}
```

### 4.2. Lab Technician (Existing — Needs Enhanced Permissions)

**Dashboard:** Lab Technician Dashboard
- Pending samples to receive
- Samples in processing
- My worklist (assigned tests)
- QC status panel
- Cold chain monitor

**Permissions:**
| Permission | Description |
|---|---|
| `lab.orders.view` | View all lab orders |
| `lab.orders.update_status` | Change order status |
| `lab.samples.collect` | Collect samples |
| `lab.samples.receive` | Receive samples at lab |
| `lab.samples.verify_quality` | Accept/reject samples |
| `lab.samples.update_status` | Track sample chain of custody |
| `lab.results.enter` | Enter test results |
| `lab.tests.manage` | CRUD on test catalog |
| `lab.qc.manage` | Quality control operations |

**Workflow:**
1. Login → Lab Technician Dashboard
2. View pending samples → Receive & scan barcode
3. QC check → Accept or Reject with reason
4. Process samples → Enter results
5. Flag abnormal/critical values
6. Submit for pathologist verification

### 4.3. Pathologist (NEW)

**Dashboard:** Pathologist Dashboard
- Pending verifications (results awaiting sign-off)
- Critical values requiring review
- Recently verified results
- Histopathology queue (if applicable)
- Performance metrics (TAT, verification rate)

**Permissions:**
| Permission | Description |
|---|---|
| `lab.orders.view` | View all lab orders |
| `lab.results.view` | View all results |
| `lab.results.verify` | Verify/sign-off results |
| `lab.results.reject` | Request re-run |
| `lab.results.interpret` | Add pathologist interpretation |
| `lab.reports.generate` | Generate final reports |
| `lab.critical.acknowledge` | Acknowledge critical values |
| `lab.qc.review` | Review QC data |

**Workflow:**
1. Login → Pathologist Dashboard
2. Review Verification Worklist (prioritized by: STAT first, then URGENT, then ROUTINE)
3. For each result:
   - Review values against reference ranges
   - Check delta from previous patient results
   - Add interpretation if needed
   - Verify (digital sign-off) or Reject (request re-run with reason)
4. Monitor critical values and acknowledge alerts
5. Generate and sign final reports

### 4.4. Radiologist (Existing — Already Functional)

The Radiology module is already working with:
- Imaging order workflow
- Worklist management
- Study creation and reporting
- AI analysis integration
- Pending reports tracking

**Use as template** for lab module patterns.

### 4.5. Phlebotomist (NEW — Optional)

Can be merged into NURSE role with additional permissions. If separate:

**Dashboard:** Sample Collection Queue
- Ordered tests awaiting collection
- Patient queue (sorted by priority: STAT → URGENT → ROUTINE)
- Collection history

**Permissions:**
| Permission | Description |
|---|---|
| `lab.orders.view` | View orders pending collection |
| `lab.samples.collect` | Collect and label samples |
| `lab.samples.update_status` | Update chain of custody |

---

## 5. Data Model Changes

### 5.1. Schema Changes Required

**File:** `backend/prisma/schema.prisma`

#### A. Add PATHOLOGIST to UserRole Enum

```prisma
enum UserRole {
  SUPER_ADMIN
  HOSPITAL_ADMIN
  DOCTOR
  NURSE
  RECEPTIONIST
  LAB_TECHNICIAN
  PHARMACIST
  RADIOLOGIST
  PATHOLOGIST        // ← ADD
  PHLEBOTOMIST       // ← ADD (optional)
  ACCOUNTANT
  PATIENT
  HR_MANAGER
  HR_STAFF
  HOUSEKEEPING_MANAGER
  HOUSEKEEPING_STAFF
  MAINTENANCE_STAFF
  SECURITY_STAFF
  DIETARY_STAFF
  MARKETING
}
```

#### B. Add `orderedByUser` Relation to LabOrder

```prisma
model LabOrder {
  id                  String         @id @default(uuid())
  hospitalId          String
  patientId           String
  consultationId      String?
  orderNumber         String         @unique
  orderedBy           String
  priority            LabPriority    @default(ROUTINE)
  status              LabOrderStatus @default(ORDERED)
  clinicalNotes       String?
  specialInstructions String?
  orderedAt           DateTime       @default(now())
  collectedAt         DateTime?
  receivedAt          DateTime?      // ← ADD: when lab received samples
  completedAt         DateTime?
  verifiedAt          DateTime?      // ← ADD: when pathologist verified
  verifiedBy          String?        // ← ADD: pathologist userId
  createdAt           DateTime       @default(now())
  updatedAt           DateTime       @updatedAt

  // Relations
  hospital        Hospital       @relation(fields: [hospitalId], references: [id])
  patient         Patient        @relation(fields: [patientId], references: [id])
  consultation    Consultation?  @relation(fields: [consultationId], references: [id])
  orderedByUser   User           @relation("LabOrderOrderedBy", fields: [orderedBy], references: [id])  // ← ADD
  verifiedByUser  User?          @relation("LabOrderVerifiedBy", fields: [verifiedBy], references: [id]) // ← ADD
  tests           LabOrderTest[]
  samples         LabSample[]    // ← ADD

  @@map("lab_orders")
}
```

#### C. Update LabOrderStatus Enum

```prisma
enum LabOrderStatus {
  ORDERED
  SAMPLE_COLLECTED
  RECEIVED            // ← ADD: lab received the sample
  IN_PROGRESS
  RESULTED            // ← ADD: results entered, pending verification
  VERIFIED             // ← ADD: pathologist verified
  COMPLETED
  CANCELLED
  PARTIALLY_COMPLETED  // ← ADD: some tests done, some cancelled/pending
}
```

#### D. Create LabSample Model (Replace In-Memory Storage)

```prisma
model LabSample {
  id                String        @id @default(uuid())
  labOrderId        String
  labOrderTestId    String?       // Link to specific test if one sample per test
  barcode           String        @unique
  sampleType        SampleType
  sampleVolume      Decimal?      @db.Decimal(6, 2) // in mL
  sampleCondition   SampleCondition @default(ADEQUATE)
  specialHandling   String[]      // ["REFRIGERATE", "LIGHT_SENSITIVE", "TIMED"]
  collectedBy       String
  collectionTime    DateTime
  receivedBy        String?
  receivedAt        DateTime?
  status            SampleStatus  @default(COLLECTED)
  isVerified        Boolean       @default(false)
  verifiedBy        String?
  verifiedAt        DateTime?
  rejectionReason   String?
  requiresColdChain Boolean       @default(false)
  notes             String?
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt

  // Relations
  labOrder         LabOrder             @relation(fields: [labOrderId], references: [id])
  collectedByUser  User                 @relation("SampleCollectedBy", fields: [collectedBy], references: [id])
  receivedByUser   User?                @relation("SampleReceivedBy", fields: [receivedBy], references: [id])
  verifiedByUser   User?                @relation("SampleVerifiedBy", fields: [verifiedBy], references: [id])
  custodyLog       SampleCustodyLog[]

  @@map("lab_samples")
}

enum SampleType {
  BLOOD
  SERUM
  PLASMA
  URINE
  STOOL
  SWAB
  TISSUE
  CSF
  SPUTUM
  FLUID
  OTHER
}

enum SampleCondition {
  ADEQUATE
  HEMOLYZED
  LIPEMIC
  CLOTTED
  INSUFFICIENT
  CONTAMINATED
}

enum SampleStatus {
  COLLECTED
  IN_TRANSIT
  RECEIVED
  PROCESSING
  ANALYZED
  STORED
  DISPOSED
  REJECTED
}
```

#### E. Create SampleCustodyLog Model (Chain of Custody)

```prisma
model SampleCustodyLog {
  id            String   @id @default(uuid())
  sampleId      String
  status        String
  location      String
  handledBy     String
  temperature   Decimal? @db.Decimal(4, 1) // for cold chain
  notes         String?
  timestamp     DateTime @default(now())

  // Relations
  sample        LabSample @relation(fields: [sampleId], references: [id])
  handler       User      @relation(fields: [handledBy], references: [id])

  @@map("sample_custody_logs")
}
```

#### F. Update LabOrderTest Model

```prisma
model LabOrderTest {
  id            String          @id @default(uuid())
  labOrderId    String
  labTestId     String
  status        LabTestStatus   @default(PENDING)
  result        String?
  resultValue   Decimal?        @db.Decimal(10, 3)
  resultText    String?         // ← ADD: for non-numeric results (e.g., "Positive", "Reactive")
  unit          String?
  normalRange   String?
  normalMin     Decimal?        @db.Decimal(10, 3) // ← ADD: for programmatic comparison
  normalMax     Decimal?        @db.Decimal(10, 3) // ← ADD
  isAbnormal    Boolean         @default(false)
  isCritical    Boolean         @default(false)
  comments      String?
  interpretation String?        // ← ADD: pathologist interpretation
  performedBy   String?
  verifiedBy    String?
  performedAt   DateTime?
  verifiedAt    DateTime?
  rerunRequested Boolean        @default(false)  // ← ADD
  rerunReason   String?         // ← ADD
  previousValue Decimal?        @db.Decimal(10, 3) // ← ADD: for delta check

  labOrder LabOrder @relation(fields: [labOrderId], references: [id])
  labTest  LabTest  @relation(fields: [labTestId], references: [id])

  @@map("lab_order_tests")
}
```

#### G. Update LabTestStatus Enum

```prisma
enum LabTestStatus {
  PENDING
  IN_PROGRESS
  RESULTED       // ← ADD: result entered, awaiting verification
  VERIFIED       // ← ADD: pathologist verified
  COMPLETED
  CANCELLED
  RERUN_REQUESTED // ← ADD: pathologist requested re-run
}
```

#### H. Update LabTest Model (Add Reference Range Details)

```prisma
model LabTest {
  id                String    @id @default(uuid())
  name              String
  code              String    @unique
  category          String
  subcategory       String?   // ← ADD: e.g., "Liver Enzymes" under "Chemistry"
  description       String?
  sampleType        String
  sampleVolume      Decimal?  @db.Decimal(4, 1)  // ← ADD: required volume in mL
  containerType     String?   // ← ADD: "EDTA", "SST", "Heparin", etc.
  normalRange       String?
  normalMin         Decimal?  @db.Decimal(10, 3)  // ← ADD
  normalMax         Decimal?  @db.Decimal(10, 3)  // ← ADD
  criticalMin       Decimal?  @db.Decimal(10, 3)  // ← ADD
  criticalMax       Decimal?  @db.Decimal(10, 3)  // ← ADD
  unit              String?
  resultType        ResultType @default(NUMERIC)  // ← ADD
  possibleValues    String[]  // ← ADD: for categorical results ["Positive", "Negative"]
  price             Decimal   @db.Decimal(10, 2)
  turnaroundTime    Int       // hours
  instructions      String?
  requiresFasting   Boolean   @default(false)  // ← ADD
  requiresColdChain Boolean   @default(false)  // ← ADD
  isActive          Boolean   @default(true)
  department        String?   // ← ADD: "Hematology", "Biochemistry", "Microbiology", etc.
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  labOrderTests LabOrderTest[]

  @@map("lab_tests")
}

enum ResultType {
  NUMERIC       // e.g., 5.5 mg/dL
  TEXT          // e.g., "Positive"
  RATIO         // e.g., 1:320
  DESCRIPTIVE   // e.g., free text (histopathology)
}
```

#### I. Create LabReport Model

```prisma
model LabReport {
  id              String   @id @default(uuid())
  labOrderId      String   @unique
  reportNumber    String   @unique
  reportDate      DateTime @default(now())
  generatedBy     String   // pathologist userId
  signedBy        String?
  signedAt        DateTime?
  pdfUrl          String?  // S3 path to generated PDF
  interpretation  String?  // overall interpretation
  recommendations String?
  isFinalized     Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  labOrder LabOrder @relation(fields: [labOrderId], references: [id])

  @@map("lab_reports")
}
```

#### J. Create LabQualityControl Model

```prisma
model LabQualityControl {
  id             String   @id @default(uuid())
  hospitalId     String
  testCode       String
  controlLevel   String   // "Level 1", "Level 2", "Level 3"
  expectedValue  Decimal  @db.Decimal(10, 3)
  observedValue  Decimal  @db.Decimal(10, 3)
  unit           String
  sdRange        Decimal  @db.Decimal(6, 3)
  isWithinRange  Boolean
  performedBy    String
  performedAt    DateTime @default(now())
  instrument     String?
  lotNumber      String?
  expiryDate     DateTime?
  notes          String?
  createdAt      DateTime @default(now())

  hospital Hospital @relation(fields: [hospitalId], references: [id])

  @@map("lab_quality_controls")
}
```

### 5.2. Migration Steps

```bash
# 1. Generate migration
npx prisma migrate dev --name add_lab_sample_models_and_pathologist_role

# 2. Migrate in-memory sample data to new tables
# Run a one-time script to seed any existing sample data

# 3. Update seed file with Pathologist user
npx prisma db seed
```

---

## 6. API Endpoints

### 6.1. Existing Endpoints to Fix

| Method | Endpoint | Fix Needed |
|--------|----------|------------|
| `GET` | `/laboratory/stats` | Return `inProgressOrders` instead of `totalOrders` |
| `GET` | `/laboratory/orders` | Include `orderedByUser` relation in response |
| `GET` | `/laboratory/critical` | Add acknowledgment endpoint |
| `POST` | `/laboratory/results/:testId` | Add `PATHOLOGIST` to authorize list |
| `PATCH` | `/laboratory/results/:testId/verify` | Add `PATHOLOGIST` to authorize list |

### 6.2. New Endpoints Required

**File to modify:** `backend/src/routes/laboratoryRoutes.ts`

#### Lab Orders (Enhanced)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| `GET` | `/laboratory/orders/worklist` | Get orders by status for worklist view | LAB_TECHNICIAN, PATHOLOGIST |
| `GET` | `/laboratory/orders/:id/timeline` | Get full order timeline/audit trail | All authenticated |
| `PATCH` | `/laboratory/orders/:id/receive` | Mark order samples as received at lab | LAB_TECHNICIAN |
| `PATCH` | `/laboratory/orders/:id/start-processing` | Start processing order | LAB_TECHNICIAN |

#### Sample Management (Database-Backed)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| `POST` | `/laboratory/samples/collect` | Collect sample (EXISTS — needs DB backend) | NURSE, LAB_TECHNICIAN, PHLEBOTOMIST |
| `GET` | `/laboratory/samples/pending` | Get pending samples (EXISTS — needs DB) | LAB_TECHNICIAN, NURSE |
| `GET` | `/laboratory/samples/cold-chain` | Get cold chain samples (EXISTS — needs DB) | LAB_TECHNICIAN |
| `GET` | `/laboratory/samples/:barcode` | Get sample by barcode (EXISTS — needs DB) | All authenticated |
| `GET` | `/laboratory/samples/:barcode/history` | Get chain of custody (EXISTS — needs DB) | All authenticated |
| `PATCH` | `/laboratory/samples/:barcode/status` | Update sample status (EXISTS — needs DB) | LAB_TECHNICIAN, NURSE |
| `POST` | `/laboratory/samples/:barcode/verify` | QC verify sample (EXISTS — needs DB) | LAB_TECHNICIAN |
| `GET` | `/laboratory/orders/:orderId/samples` | Get samples by order (EXISTS — needs DB) | All authenticated |
| `POST` | `/laboratory/samples/:barcode/reject` | Reject sample with reason | LAB_TECHNICIAN |

#### Results & Verification

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| `POST` | `/laboratory/results/:testId` | Enter test result (EXISTS) | LAB_TECHNICIAN |
| `POST` | `/laboratory/results/batch` | Batch enter results for multiple tests | LAB_TECHNICIAN |
| `PATCH` | `/laboratory/results/:testId/verify` | Verify result (EXISTS — add PATHOLOGIST) | PATHOLOGIST, LAB_TECHNICIAN |
| `PATCH` | `/laboratory/results/:testId/reject` | Request re-run | PATHOLOGIST |
| `GET` | `/laboratory/results/pending-verification` | Get results awaiting pathologist review | PATHOLOGIST |
| `GET` | `/laboratory/results/patient/:patientId/history` | Get patient's historical results | DOCTOR, PATHOLOGIST |

#### Critical Values

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| `GET` | `/laboratory/critical` | Get unacknowledged critical values (EXISTS) | All authenticated |
| `POST` | `/laboratory/critical/:id/acknowledge` | Acknowledge critical value | DOCTOR, PATHOLOGIST, LAB_TECHNICIAN |
| `GET` | `/laboratory/critical/history` | Get critical value history with ack times | HOSPITAL_ADMIN |

#### Reports

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| `POST` | `/laboratory/reports/:orderId/generate` | Generate PDF report | PATHOLOGIST |
| `GET` | `/laboratory/reports/:orderId/pdf` | Download report PDF | All authenticated |
| `PATCH` | `/laboratory/reports/:orderId/finalize` | Finalize and sign report | PATHOLOGIST |

#### Quality Control

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| `POST` | `/laboratory/qc/run` | Record QC run | LAB_TECHNICIAN |
| `GET` | `/laboratory/qc/results` | Get QC results (Levey-Jennings data) | LAB_TECHNICIAN, PATHOLOGIST |
| `GET` | `/laboratory/qc/westgard-rules` | Check Westgard rule violations | LAB_TECHNICIAN |

#### Dashboard Stats (Enhanced)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| `GET` | `/laboratory/stats` | Enhanced stats (FIX existing) | All authenticated |
| `GET` | `/laboratory/stats/tat` | Turnaround time metrics | HOSPITAL_ADMIN |
| `GET` | `/laboratory/stats/technician/:id` | Per-technician workload | HOSPITAL_ADMIN |

### 6.3. Stats API Fix

**File:** `backend/src/services/laboratoryService.ts` — `getLabStats()` method

```typescript
async getLabStats(hospitalId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    totalOrders,
    pendingOrders,
    inProgressOrders,      // ← ADD THIS
    resultedOrders,        // ← ADD THIS (awaiting verification)
    completedToday,
    criticalResults
  ] = await Promise.all([
    prisma.labOrder.count({ where: { hospitalId } }),
    prisma.labOrder.count({
      where: { hospitalId, status: 'ORDERED' },
    }),
    prisma.labOrder.count({
      where: { hospitalId, status: { in: ['SAMPLE_COLLECTED', 'IN_PROGRESS'] } },
    }),
    prisma.labOrder.count({
      where: { hospitalId, status: 'RESULTED' },
    }),
    prisma.labOrder.count({
      where: { hospitalId, completedAt: { gte: today } },
    }),
    prisma.labOrderTest.count({
      where: { isCritical: true, labOrder: { hospitalId }, verifiedAt: null },
    }),
  ]);

  return {
    totalOrders,
    pendingOrders,
    inProgressOrders,      // ← Frontend expects this
    resultedOrders,
    criticalResults,
    completedToday,
  };
}
```

---

## 7. Frontend Pages & Components

### 7.1. Files to Modify

| File | Change |
|------|--------|
| `frontend/src/pages/Laboratory/index.tsx` | Fix stats mapping, add action buttons, fix Results Entry tab, add acknowledgment handler |
| `frontend/src/components/laboratory/SampleTracker.tsx` | Connect to DB-backed API (remove mock data fallback) |
| `frontend/src/services/api.ts` | Add new API endpoints |
| `frontend/src/pages/Consultation/index.tsx` | Add "Order Lab Tests" section |

### 7.2. New Pages to Create

#### A. Lab Technician Dashboard

**File:** `frontend/src/pages/Laboratory/LabTechDashboard.tsx`

```
┌─────────────────────────────────────────────────────────────────┐
│ 🧪 Lab Technician Dashboard                           [Logout] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐  │
│  │ Pending    │ │ In Transit │ │ Processing │ │ Completed  │  │
│  │ Receipt    │ │    Samples │ │            │ │ Today      │  │
│  │    12      │ │      3     │ │     5      │ │    28      │  │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘  │
│                                                                 │
│  [My Worklist] [Sample Receipt] [Results Entry] [QC Panel]     │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ WORKLIST (sorted by priority)                           │   │
│  │                                                         │   │
│  │ 🔴 STAT  LAB-ABC123  John Doe   CBC, BMP   [Process]   │   │
│  │ 🟠 URG   LAB-DEF456  Jane Smith  LFT, TSH  [Process]   │   │
│  │ ⚪ RTN   LAB-GHI789  Bob Wilson  Lipid      [Process]   │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────┐ ┌─────────────────────────────┐   │
│  │ Cold Chain Monitor      │ │ QC Status                   │   │
│  │ 🌡️ 4.2°C Sample A      │ │ ✅ CBC QC passed 09:00      │   │
│  │ 🌡️ 3.8°C Sample B      │ │ ✅ BMP QC passed 09:15      │   │
│  │ ⚠️ 8.5°C Sample C      │ │ ❌ LFT QC failed 09:30     │   │
│  └─────────────────────────┘ └─────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**Components:**
- `LabWorklist` — Prioritized list of orders to process
- `SampleReceiptScanner` — Barcode scanner for receiving samples
- `ResultsEntryForm` — Form to enter test results (per-test or batch)
- `ColdChainMonitor` — Real-time temperature display for cold chain samples
- `QCPanel` — Quality control run results

#### B. Results Entry Form

**File:** `frontend/src/components/laboratory/ResultsEntryForm.tsx`

```
┌─────────────────────────────────────────────────────────────────┐
│ 📝 Enter Results — Order LAB-ABC123                            │
│ Patient: John Doe (MRN: 001234)                                │
│ Ordered by: Dr. Ahmed | Priority: STAT                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Test Name          Result    Unit    Ref Range    Status       │
│  ─────────          ──────    ────    ─────────    ──────       │
│  Hemoglobin         [14.5]   g/dL    13.5-17.5    ✅ Normal    │
│  WBC Count          [15200]  /μL     4500-11000   ⚠️ HIGH     │
│  Platelet Count     [45000]  /μL     150k-400k    🔴 CRITICAL │
│  RBC Count          [4.8]    M/μL    4.5-5.5      ✅ Normal    │
│  Hematocrit         [42]     %       38-50        ✅ Normal    │
│                                                                 │
│  Comments: [________________________________]                   │
│                                                                 │
│  ⚠️ CRITICAL VALUE DETECTED: Platelet Count = 45,000          │
│     Ordering physician will be notified immediately.            │
│                                                                 │
│  [Cancel]                    [Save Draft]  [Submit for Review]  │
└─────────────────────────────────────────────────────────────────┘
```

**Features:**
- Auto-comparison against reference ranges (highlighting abnormal/critical)
- Delta check against patient's previous results
- Batch entry mode for panels
- Auto-saves as draft
- Critical value triggers immediate notification on submit
- Supports numeric, text, and descriptive result types

#### C. Pathologist Verification Dashboard

**File:** `frontend/src/pages/Laboratory/PathologistDashboard.tsx`

```
┌─────────────────────────────────────────────────────────────────┐
│ 🔬 Pathologist Dashboard                              [Logout] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐  │
│  │ Pending    │ │ Critical   │ │ Verified   │ │ Avg TAT    │  │
│  │ Review     │ │ Values     │ │ Today      │ │            │  │
│  │    8       │ │     2      │ │    15      │ │  2.5 hrs   │  │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘  │
│                                                                 │
│  [Verification Queue] [Critical Values] [Reports] [History]    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ VERIFICATION QUEUE                                      │   │
│  │                                                         │   │
│  │ 🔴 LAB-ABC123 John Doe    CBC Panel     [Review]       │   │
│  │    Platelet: 45,000 (CRITICAL)                          │   │
│  │    WBC: 15,200 (HIGH)                                   │   │
│  │                                                         │   │
│  │ ⚪ LAB-DEF456 Jane Smith  Liver Panel   [Review]       │   │
│  │    All within normal range                              │   │
│  │                                                         │   │
│  │ → Clicking [Review] opens detailed verification view    │   │
│  │   with [Verify & Sign] or [Request Re-Run] buttons     │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

#### D. Lab Order Actions on Each Order Card

**File:** Modify `frontend/src/pages/Laboratory/index.tsx`

Add contextual action buttons based on order status:

| Current Status | Available Actions |
|---|---|
| `ORDERED` | "Collect Sample" → opens Sample Collection form |
| `SAMPLE_COLLECTED` | "Receive at Lab" → scans barcode, updates to RECEIVED |
| `RECEIVED` | "Start Processing" → updates to IN_PROGRESS |
| `IN_PROGRESS` | "Enter Results" → opens Results Entry form |
| `RESULTED` | "Verify" (pathologist only) → opens verification view |
| `VERIFIED` | "Generate Report" → creates PDF |
| `COMPLETED` | "View Report" / "AI Interpret" |

#### E. Lab Order from Consultation

**File:** `frontend/src/pages/Consultation/index.tsx`

Add a "Lab Orders" section to the consultation page:

```
┌──────────────────────────────────────────────┐
│ 🧪 Laboratory Orders                         │
│                                               │
│ [+ Order Lab Tests]                           │
│                                               │
│ Active Orders:                                │
│ LAB-ABC123 — CBC, BMP — Status: IN_PROGRESS  │
│ LAB-DEF456 — LFT      — Status: COMPLETED ✅│
│   → View Results                              │
│                                               │
│ AI Suggestion: Based on diagnosis "Diabetes"  │
│   → HbA1c, Fasting Glucose, Lipid Panel      │
│   [Order Suggested Tests]                     │
└──────────────────────────────────────────────┘
```

#### F. Enhanced Patient Portal Lab Results

**File:** `frontend/src/pages/PatientPortal/LabResults.tsx` (already exists — enhance)

Current implementation is actually quite good with:
- Result cards with trends
- Normal/abnormal/critical highlighting
- PDF download

Add:
- Real-time status tracking (show where your sample is)
- Push notification when results are ready
- AI interpretation in plain language

### 7.3. New Components to Create

| Component | File | Description |
|-----------|------|-------------|
| `ResultsEntryForm` | `frontend/src/components/laboratory/ResultsEntryForm.tsx` | Form to enter lab test results |
| `ResultVerificationView` | `frontend/src/components/laboratory/ResultVerificationView.tsx` | Pathologist verification interface |
| `SampleCollectionForm` | `frontend/src/components/laboratory/SampleCollectionForm.tsx` | Form for collecting samples |
| `LabWorklist` | `frontend/src/components/laboratory/LabWorklist.tsx` | Prioritized worklist for lab techs |
| `CriticalValueAlert` | `frontend/src/components/laboratory/CriticalValueAlert.tsx` | Critical value notification + acknowledgment |
| `LabReportViewer` | `frontend/src/components/laboratory/LabReportViewer.tsx` | PDF report preview/download |
| `LabTestCatalogManager` | `frontend/src/components/laboratory/LabTestCatalogManager.tsx` | Admin CRUD for test catalog |
| `QualityControlChart` | `frontend/src/components/laboratory/QualityControlChart.tsx` | Levey-Jennings chart for QC |
| `DeltaCheckPanel` | `frontend/src/components/laboratory/DeltaCheckPanel.tsx` | Compare current vs previous results |
| `LabOrderFromConsultation` | `frontend/src/components/consultation/LabOrderFromConsultation.tsx` | Inline lab ordering during consultation |
| `SampleStatusBadge` | `frontend/src/components/laboratory/SampleStatusBadge.tsx` | Already exists — enhance |

### 7.4. Route Configuration

**File:** `frontend/src/App.tsx` or router config

```tsx
// New routes
<Route path="/laboratory" element={<Laboratory />} />           // Existing
<Route path="/laboratory/worklist" element={<LabWorklist />} />  // NEW
<Route path="/laboratory/results-entry/:orderId" element={<ResultsEntry />} /> // NEW
<Route path="/laboratory/verification" element={<PathologistDashboard />} />   // NEW
<Route path="/laboratory/qc" element={<QualityControl />} />     // NEW
<Route path="/laboratory/reports/:orderId" element={<LabReport />} />          // NEW
```

---

## 8. Integration Points

### 8.1. OPD Consultation → Lab Order

**Current State:** Consultation model has `labOrders LabOrder[]` relation but no frontend UI.

**Required:**
- Add "Order Lab Tests" button to Consultation page
- Modal with test catalog (grouped by category)
- AI test suggestions based on diagnosis
- Auto-link order to consultation via `consultationId`
- Auto-populate `patientId` and `orderedBy` from consultation context

**Files:**
- `frontend/src/pages/Consultation/index.tsx` — Add lab order section
- `backend/src/services/consultationService.ts` — Include lab orders in consultation query

### 8.2. IPD → Lab Order

**Similar to OPD but:**
- Orders linked to `admissionId` (need to add field to LabOrder)
- Standing orders support (recurring daily labs)
- Bedside collection scheduling

### 8.3. Emergency → STAT Lab Order

**Special handling:**
- Default priority: STAT
- Immediate notification to lab
- Audible alert in lab dashboard
- Results expected within 1 hour
- Auto-flag in ER physician dashboard when ready

### 8.4. Lab Results → Patient Portal

**Current State:** `frontend/src/pages/PatientPortal/LabResults.tsx` exists with good UI.

**Fix needed:**
- Ensure backend API returns data in format the Patient Portal expects
- Add real-time polling when results status changes
- Push notification via OneSignal / FCM when results are ready

### 8.5. Lab Results → Billing (Auto-Charge)

**Required:**
- When lab order is created → auto-generate billing line items
- Use `LabTest.price` for each test in the order
- Link to patient's billing account
- Support for insurance pre-authorization

**Implementation:**
```typescript
// In laboratoryService.createLabOrder():
// After creating order, create billing items
for (const test of order.tests) {
  await billingService.addLineItem({
    patientId: order.patientId,
    serviceType: 'LABORATORY',
    description: test.labTest.name,
    amount: test.labTest.price,
    referenceId: order.id,
    referenceType: 'LAB_ORDER',
  });
}
```

### 8.6. Lab Results → AI Analysis

**Current State:** Smart order recommendation and result interpretation exist in `laboratoryService.ts` (in-code, not using external AI).

**Enhancement:**
- Hook into the existing AI service (same pattern as Radiology AI)
- For completed results → offer "AI Interpret" button
- AI generates patient-friendly explanation
- AI suggests follow-up tests based on results pattern

### 8.7. Lab → Notification Service

**Current State:** `notificationService.sendLabResultNotification()` already exists and is called.

**Enhancement:**
- Ensure notifications work for all status changes
- Add configurable notification preferences per user
- Critical value notifications are high-priority (bypass DND)

---

## 9. Implementation Plan

### Phase 1: Core Flow Fix (Week 1-2) — **CRITICAL**

**Goal:** Make the Laboratory page functional with end-to-end order→result flow.

**Tasks:**

1. **Fix Stats API Response** (30 min)
   - File: `backend/src/services/laboratoryService.ts`
   - Return `inProgressOrders` instead of `totalOrders`

2. **Add `orderedByUser` Relation** (1 hr)
   - File: `backend/prisma/schema.prisma`
   - Add relation to User model
   - Update `getLabOrders` to include relation
   - Run migration

3. **Add PATHOLOGIST Role** (1 hr)
   - File: `backend/prisma/schema.prisma` — add to `UserRole` enum
   - File: `backend/prisma/seed.ts` — add pathologist user
   - Run migration + seed

4. **Create LabSample Model** (2 hrs)
   - File: `backend/prisma/schema.prisma` — add LabSample, SampleCustodyLog models
   - File: `backend/src/services/laboratoryService.ts` — migrate from in-memory to Prisma
   - Run migration

5. **Build Results Entry Form** (4 hrs)
   - File: `frontend/src/components/laboratory/ResultsEntryForm.tsx` — new
   - Wire up to existing `POST /laboratory/results/:testId` endpoint
   - Auto-calculate abnormal/critical flags
   - Integrate into Laboratory page "Results Entry" tab

6. **Add Order Action Buttons** (3 hrs)
   - File: `frontend/src/pages/Laboratory/index.tsx`
   - Add "Collect Sample", "Receive", "Process", "Enter Results" buttons per status
   - Wire to existing APIs

7. **Fix Critical Value Acknowledgment** (1 hr)
   - File: `backend/src/routes/laboratoryRoutes.ts` — add acknowledge endpoint
   - File: `frontend/src/pages/Laboratory/index.tsx` — wire acknowledge button

8. **Add Lab Order to Consultation** (3 hrs)
   - File: `frontend/src/pages/Consultation/index.tsx` — add lab order section
   - Use existing `POST /laboratory/orders` API with `consultationId`

**Phase 1 Deliverables:**
- ✅ Lab page shows orders, stats, and critical values correctly
- ✅ Doctor can order lab tests from consultation
- ✅ Lab tech can receive samples and enter results
- ✅ Pathologist role exists (verification via API)
- ✅ Critical values can be acknowledged
- ✅ Sample tracking persisted in database

### Phase 2: Role-Based Dashboards (Week 3-4)

**Goal:** Dedicated dashboards for each lab role.

**Tasks:**

1. **Lab Technician Dashboard** (6 hrs)
   - File: `frontend/src/pages/Laboratory/LabTechDashboard.tsx` — new
   - Worklist, sample receipt, QC panel
   - Barcode scanning integration

2. **Pathologist Verification Dashboard** (6 hrs)
   - File: `frontend/src/pages/Laboratory/PathologistDashboard.tsx` — new
   - Verification queue with sign-off workflow
   - Delta check display
   - Digital signature

3. **Sample Collection Workflow** (4 hrs)
   - File: `frontend/src/components/laboratory/SampleCollectionForm.tsx` — new
   - Barcode generation and printing
   - Collection checklist

4. **Lab Report Generation** (4 hrs)
   - Backend: PDF generation with hospital letterhead
   - Frontend: Report viewer component
   - File: `frontend/src/components/laboratory/LabReportViewer.tsx` — new

5. **Route-based Role Redirects** (2 hrs)
   - Lab Technician → `/laboratory/worklist`
   - Pathologist → `/laboratory/verification`
   - Doctor → `/laboratory` (default view)

6. **Add Verification Route Authorization** (1 hr)
   - `PATCH /laboratory/results/:testId/verify` — add `PATHOLOGIST` role
   - Add `POST /laboratory/results/:testId/reject` — re-run request
   - Update `frontend/src/services/api.ts` with new endpoints

**Phase 2 Deliverables:**
- ✅ Lab techs have their own worklist dashboard
- ✅ Pathologists can verify and sign off results
- ✅ PDF lab reports generated and downloadable
- ✅ Barcode-driven sample tracking

### Phase 3: AI & Advanced Features (Week 5-6)

**Goal:** AI-powered lab features and advanced QC.

**Tasks:**

1. **AI Result Interpretation** (4 hrs)
   - Enhance existing `interpretResult()` method
   - Integrate with external AI for patient-friendly explanations
   - Auto-suggest follow-up tests

2. **Quality Control Module** (6 hrs)
   - File: `frontend/src/pages/Laboratory/QualityControl.tsx` — new
   - Levey-Jennings charts
   - Westgard rules engine
   - QC run recording

3. **Turnaround Time Analytics** (3 hrs)
   - Dashboard for STAT/URGENT/ROUTINE TAT
   - Per-test, per-technician metrics
   - SLA alerts

4. **Standing Orders (IPD)** (4 hrs)
   - Recurring lab orders for inpatients
   - Auto-generate daily at scheduled time
   - Linked to admission

5. **Lab Test Panels/Profiles** (3 hrs)
   - Group tests into panels (e.g., "Liver Panel" = AST + ALT + Bilirubin + ALP)
   - One-click panel ordering
   - Auto-pricing for panels

6. **Reflex Testing** (2 hrs)
   - Auto-order follow-up tests based on results
   - E.g., TSH abnormal → auto-order Free T4

7. **Billing Integration** (3 hrs)
   - Auto-charge on order creation
   - Insurance pre-auth workflow

**Phase 3 Deliverables:**
- ✅ AI interprets results in plain language
- ✅ QC module with Levey-Jennings charts
- ✅ TAT analytics dashboard
- ✅ Standing orders for IPD patients
- ✅ Automatic billing on lab order creation

---

## 10. Appendix: File Reference Map

### Backend Files

| File | Purpose | Changes |
|------|---------|---------|
| `backend/prisma/schema.prisma` | Database schema | Add PATHOLOGIST role, LabSample model, SampleCustodyLog, LabReport, LabQualityControl; update LabOrder, LabOrderTest, LabTest, LabOrderStatus, LabTestStatus |
| `backend/prisma/seed.ts` | Seed data | Add pathologist user, additional lab tests, test panels |
| `backend/src/routes/laboratoryRoutes.ts` | Lab API routes | Add new endpoints for verification, reports, QC, acknowledgment |
| `backend/src/services/laboratoryService.ts` | Lab business logic | Fix stats, migrate samples to DB, add verification flow, report generation |
| `backend/src/routes/index.ts` | Route registration | Already registered at `/laboratory` |
| `backend/src/middleware/auth.ts` | Auth middleware | Add PATHOLOGIST to `UserRole` type (auto from Prisma) |

### Frontend Files

| File | Purpose | Changes |
|------|---------|---------|
| `frontend/src/pages/Laboratory/index.tsx` | Main lab page | Fix stats, add action buttons, wire Results Entry, fix doctor name rendering |
| `frontend/src/components/laboratory/SampleTracker.tsx` | Sample tracking | Connect to DB-backed API, remove mock data |
| `frontend/src/components/laboratory/SampleStatusBadge.tsx` | Status badge | Add new statuses (RECEIVED, RESULTED, VERIFIED) |
| `frontend/src/services/api.ts` | API client | Add new laboratory endpoints |
| `frontend/src/pages/Consultation/index.tsx` | Consultation | Add lab order section |
| `frontend/src/pages/PatientPortal/LabResults.tsx` | Patient lab results | Enhance with real-time status, push notifications |

### New Files to Create

| File | Purpose |
|------|---------|
| `frontend/src/pages/Laboratory/LabTechDashboard.tsx` | Lab technician dashboard |
| `frontend/src/pages/Laboratory/PathologistDashboard.tsx` | Pathologist verification dashboard |
| `frontend/src/pages/Laboratory/QualityControl.tsx` | QC module |
| `frontend/src/components/laboratory/ResultsEntryForm.tsx` | Results entry form |
| `frontend/src/components/laboratory/ResultVerificationView.tsx` | Pathologist verification view |
| `frontend/src/components/laboratory/SampleCollectionForm.tsx` | Sample collection workflow |
| `frontend/src/components/laboratory/LabWorklist.tsx` | Prioritized lab worklist |
| `frontend/src/components/laboratory/CriticalValueAlert.tsx` | Critical value alert with acknowledgment |
| `frontend/src/components/laboratory/LabReportViewer.tsx` | PDF report viewer |
| `frontend/src/components/laboratory/LabTestCatalogManager.tsx` | Test catalog admin |
| `frontend/src/components/laboratory/QualityControlChart.tsx` | Levey-Jennings chart |
| `frontend/src/components/laboratory/DeltaCheckPanel.tsx` | Previous vs current results comparison |
| `frontend/src/components/consultation/LabOrderFromConsultation.tsx` | Inline lab ordering |

### Radiology Module (Reference Template)

The working Radiology module provides patterns to follow:

| Radiology Pattern | Lab Equivalent |
|---|---|
| `radiologyRoutes.ts` → 12 endpoints | `laboratoryRoutes.ts` → expand to ~25 endpoints |
| `radiologyService.ts` → Prisma-backed | `laboratoryService.ts` → migrate from in-memory to Prisma |
| `ImagingOrder` → `ImagingStudy` → `AIImageAnalysis` | `LabOrder` → `LabSample` → `LabOrderTest` → `LabReport` |
| `RADIOLOGIST` role with `authorize()` | `PATHOLOGIST` role with `authorize()` |
| Worklist endpoint | Lab worklist endpoint |
| Pending reports endpoint | Pending verification endpoint |
| AI analysis create/review | AI interpretation (already exists) |

---

## Quick Start for Implementation

### Immediate Fixes (Can be done in < 2 hours):

```bash
# 1. Fix stats API — backend/src/services/laboratoryService.ts
# Change getLabStats() to return inProgressOrders

# 2. Fix orderedBy rendering — add include to getLabOrders()
# In the Prisma query, add: orderedByUser: { select: { firstName: true, lastName: true } }

# 3. Add PATHOLOGIST to UserRole enum
# In schema.prisma, add PATHOLOGIST to UserRole

# 4. Run migration
cd backend && npx prisma migrate dev --name fix_lab_stats_and_add_pathologist

# 5. Seed pathologist user
# Add to seed.ts and run: npx prisma db seed
```

### Validation Checklist:

- [ ] Lab page shows correct stats (pendingOrders, inProgressOrders, criticalResults, completedToday)
- [ ] Lab orders display with doctor's name (not blank)
- [ ] New lab order can be created from Lab page
- [ ] New lab order can be created from Consultation page
- [ ] Sample collection records persist across server restarts
- [ ] Lab tech can enter results for a test
- [ ] Pathologist can verify/reject results
- [ ] Critical values trigger notifications
- [ ] Critical values can be acknowledged
- [ ] Patient Portal shows lab results
- [ ] PDF report can be generated and downloaded

---

*End of PRD*
