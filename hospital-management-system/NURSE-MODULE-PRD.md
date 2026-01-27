# Nurse Module & eMAR — Product Requirements Document (PRD)

**Product:** Spetaar HMS (spetaar.ai)
**Module:** Nursing Station & eMAR
**Version:** 1.0
**Date:** January 27, 2026
**Author:** TeaBot ☕ (Taqon AI)
**Priority:** P0 — Critical for hospital adoption

---

## 1. EXECUTIVE SUMMARY

Build a complete Nursing Station module with integrated eMAR (Electronic Medication Administration Record) for Spetaar HMS. This module is the #1 blocker for hospital adoption — nurses perform 60-70% of all hospital charting, and without dedicated nursing workflows, hospitals cannot use Spetaar for inpatient care.

### Goals
- Give nurses a dedicated portal with all daily workflows in one place
- Implement eMAR for safe, tracked medication administration
- Wire up 7 existing orphaned nursing components
- Build backend API (nurseRoutes + nurseService)
- Create /nursing page with tabbed interface

### Success Metrics
- All nursing workflows accessible from one /nursing page
- eMAR with 5 Rights verification (barcode scanning)
- Patient-to-nurse assignment tracking
- Shift handoff with SBAR format
- NEWS2 Early Warning Score integration
- Full audit trail for medication administration

---

## 2. USER STORIES

### 2.1 Nurse (Primary User)
- **As a nurse**, I want to see my assigned patients in one dashboard so I can prioritize care
- **As a nurse**, I want to record vital signs at bedside and see trends over time
- **As a nurse**, I want to see all medications due for my patients with timing
- **As a nurse**, I want to scan patient wristband + medication barcode before administering to prevent errors
- **As a nurse**, I want to document medication administration with timestamp, dose, and notes
- **As a nurse**, I want to record nursing assessments (pain, fall risk, skin integrity)
- **As a nurse**, I want to hand off my patients at shift change with structured SBAR notes
- **As a nurse**, I want to see early warning alerts for deteriorating patients
- **As a nurse**, I want to track intake & output for my patients
- **As a nurse**, I want a task list showing what needs to be done and when

### 2.2 Head Nurse / Charge Nurse
- **As a charge nurse**, I want to assign patients to nurses for each shift
- **As a charge nurse**, I want to see nurse-to-patient ratios across the unit
- **As a charge nurse**, I want to view all overdue tasks and medications across the unit
- **As a charge nurse**, I want to manage shift schedules

### 2.3 Doctor
- **As a doctor**, I want to see nursing notes and vitals trends on my patient's chart
- **As a doctor**, I want nurses to be notified when I write new orders

---

## 3. ARCHITECTURE

### 3.1 Backend
```
backend/src/
├── routes/nurseRoutes.ts          # All nursing API endpoints
├── services/nurseService.ts       # Business logic
└── (prisma schema additions)      # New models
```

### 3.2 Frontend
```
frontend/src/
├── pages/Nursing/
│   └── index.tsx                  # Main nursing page (tabbed)
├── components/nursing/            # EXISTING (wire up)
│   ├── BarcodeScanner.tsx         ✅ exists (258 lines)
│   ├── MedSchedule.tsx            ✅ exists (280 lines)
│   ├── EWSCalculator.tsx          ✅ exists (486 lines)
│   ├── MedVerification.tsx        ✅ exists (439 lines)
│   ├── MedAdminRecord.tsx         ✅ exists (218 lines)
│   ├── EWSAlertCard.tsx           ✅ exists (316 lines)
│   └── VitalsTrendChart.tsx       ✅ exists (270 lines)
├── components/nursing/            # NEW
│   ├── PatientAssignment.tsx      🆕 Patient-nurse assignment
│   ├── NursingAssessment.tsx      🆕 Head-to-toe assessment
│   ├── ShiftHandoff.tsx           🆕 SBAR handoff
│   ├── NurseTaskList.tsx          🆕 Task management
│   └── IntakeOutput.tsx           🆕 I&O tracking
└── services/api.ts                # Add nursingApi endpoints
```

### 3.3 API Endpoints
```
POST   /api/v1/nursing/assignments              # Assign patient to nurse
GET    /api/v1/nursing/my-patients               # Get nurse's assigned patients
GET    /api/v1/nursing/assignments               # Get all assignments (charge nurse)
DELETE /api/v1/nursing/assignments/:id           # Remove assignment

GET    /api/v1/nursing/emar/:admissionId         # Get eMAR for patient
POST   /api/v1/nursing/emar/administer           # Record medication administration
POST   /api/v1/nursing/emar/verify               # Verify medication (5 Rights scan)
PATCH  /api/v1/nursing/emar/:id/not-given        # Record medication not given (with reason)
GET    /api/v1/nursing/emar/overdue              # Get all overdue medications

POST   /api/v1/nursing/assessments               # Create nursing assessment
GET    /api/v1/nursing/assessments/:admissionId   # Get assessments for patient
GET    /api/v1/nursing/assessments/types          # Get assessment form types

POST   /api/v1/nursing/vitals                    # Record vitals (with auto NEWS2)
GET    /api/v1/nursing/vitals/:admissionId        # Get vitals history
GET    /api/v1/nursing/vitals/trends/:admissionId # Get vitals trends

POST   /api/v1/nursing/io                        # Record intake or output
GET    /api/v1/nursing/io/:admissionId            # Get I&O records
GET    /api/v1/nursing/io/balance/:admissionId    # Get I&O balance (24h)

POST   /api/v1/nursing/handoff                   # Create shift handoff
GET    /api/v1/nursing/handoff/:admissionId       # Get handoff history
GET    /api/v1/nursing/handoff/pending            # Get pending handoffs to accept

POST   /api/v1/nursing/tasks                     # Create task
GET    /api/v1/nursing/tasks                     # Get my tasks
PATCH  /api/v1/nursing/tasks/:id                 # Update task status
GET    /api/v1/nursing/tasks/overdue             # Get overdue tasks

GET    /api/v1/nursing/dashboard                 # Nurse dashboard stats
GET    /api/v1/nursing/unit-overview             # Unit overview (charge nurse)
```

---

## 4. DATABASE SCHEMA (Prisma)

### 4.1 New Models

```prisma
// Patient-Nurse Assignment
model NurseAssignment {
  id           String   @id @default(uuid())
  hospitalId   String
  nurseId      String
  admissionId  String
  shiftDate    DateTime
  shift        NurseShift
  isPrimary    Boolean  @default(true)
  assignedBy   String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  hospital  Hospital  @relation(fields: [hospitalId], references: [id])
  nurse     Nurse     @relation(fields: [nurseId], references: [id])
  admission Admission @relation(fields: [admissionId], references: [id])
  assignedByUser User @relation("AssignedByUser", fields: [assignedBy], references: [id])

  @@unique([nurseId, admissionId, shiftDate, shift])
  @@map("nurse_assignments")
}

// eMAR - Medication Administration Record
model MedicationAdministration {
  id              String   @id @default(uuid())
  hospitalId      String
  admissionId     String
  prescriptionId  String?
  nurseId         String
  
  // Medication Details
  medicationName  String
  dosage          String
  route           String    // ORAL, IV, IM, SC, TOPICAL, etc.
  frequency       String    // BID, TID, QID, PRN, STAT, etc.
  scheduledTime   DateTime
  
  // Administration
  status          MedAdminStatus @default(SCHEDULED)
  administeredAt  DateTime?
  administeredBy  String?
  witnessedBy     String?    // For controlled substances
  
  // Verification
  patientScanned  Boolean  @default(false)
  medScanned      Boolean  @default(false)
  verifiedRights  Json?    // { rightPatient, rightMed, rightDose, rightRoute, rightTime }
  
  // If not given
  notGivenReason  String?
  
  // Notes
  notes           String?
  sideEffects     String?
  vitalsBefore    Json?
  vitalsAfter     Json?
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  hospital   Hospital  @relation(fields: [hospitalId], references: [id])
  admission  Admission @relation(fields: [admissionId], references: [id])
  nurse      Nurse     @relation(fields: [nurseId], references: [id])

  @@map("medication_administrations")
}

enum MedAdminStatus {
  SCHEDULED
  DUE
  OVERDUE
  ADMINISTERED
  NOT_GIVEN
  HELD
  REFUSED
}

// Nursing Assessment
model NursingAssessment {
  id            String   @id @default(uuid())
  hospitalId    String
  admissionId   String
  nurseId       String
  assessmentType NursingAssessmentType
  
  // Assessment Data (flexible JSON per type)
  data          Json
  score         Float?    // For scored assessments (pain, fall risk, Braden, etc.)
  riskLevel     String?   // LOW, MEDIUM, HIGH, CRITICAL
  
  notes         String?
  createdAt     DateTime @default(now())

  hospital   Hospital  @relation(fields: [hospitalId], references: [id])
  admission  Admission @relation(fields: [admissionId], references: [id])
  nurse      Nurse     @relation(fields: [nurseId], references: [id])

  @@map("nursing_assessments")
}

enum NursingAssessmentType {
  ADMISSION        // Initial admission assessment
  HEAD_TO_TOE      // Systems assessment
  PAIN             // Pain scale (0-10)
  FALL_RISK        // Morse Fall Scale
  SKIN_INTEGRITY   // Braden Scale (pressure ulcer risk)
  NEUROLOGICAL     // Glasgow Coma Scale
  RESPIRATORY      // Respiratory assessment
  CARDIOVASCULAR   // Cardiac assessment
  GASTROINTESTINAL // GI assessment
  MUSCULOSKELETAL  // Mobility assessment
  PSYCHOSOCIAL     // Mental health screening
  DISCHARGE_READINESS // Discharge assessment
}

// Intake & Output
model IntakeOutput {
  id           String   @id @default(uuid())
  hospitalId   String
  admissionId  String
  nurseId      String
  recordedAt   DateTime
  
  type         IOType   // INTAKE or OUTPUT
  category     String   // oral, iv, urine, drain, emesis, etc.
  amount       Float    // in mL
  notes        String?
  
  createdAt    DateTime @default(now())

  hospital   Hospital  @relation(fields: [hospitalId], references: [id])
  admission  Admission @relation(fields: [admissionId], references: [id])
  nurse      Nurse     @relation(fields: [nurseId], references: [id])

  @@map("intake_output")
}

enum IOType {
  INTAKE
  OUTPUT
}

// Shift Handoff (SBAR)
model ShiftHandoff {
  id            String   @id @default(uuid())
  hospitalId    String
  admissionId   String
  
  outgoingNurseId String
  incomingNurseId String?
  
  shift         NurseShift
  handoffDate   DateTime
  
  // SBAR Format
  situation     String    // Current condition, why patient is here
  background    String    // Relevant history, recent changes
  assessment    String    // Nurse's clinical assessment
  recommendation String  // What needs to happen next
  
  // Additional
  pendingTasks  Json?     // Tasks not completed
  pendingMeds   Json?     // Medications due soon
  alerts        Json?     // Active alerts/warnings
  
  status        HandoffStatus @default(PENDING)
  acceptedAt    DateTime?
  
  createdAt     DateTime @default(now())

  hospital    Hospital  @relation(fields: [hospitalId], references: [id])
  admission   Admission @relation(fields: [admissionId], references: [id])
  outgoingNurse Nurse   @relation("OutgoingNurse", fields: [outgoingNurseId], references: [id])
  incomingNurse Nurse?  @relation("IncomingNurse", fields: [incomingNurseId], references: [id])

  @@map("shift_handoffs")
}

enum HandoffStatus {
  PENDING
  ACCEPTED
  REVIEWED
}

// Nurse Task
model NurseTask {
  id           String   @id @default(uuid())
  hospitalId   String
  admissionId  String?
  nurseId      String
  
  title        String
  description  String?
  category     TaskCategory
  priority     TaskPriority @default(ROUTINE)
  
  dueAt        DateTime?
  completedAt  DateTime?
  status       NurseTaskStatus @default(PENDING)
  
  // Auto-generated tasks link
  sourceType   String?   // "medication", "vitals", "assessment", "order"
  sourceId     String?
  
  notes        String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  hospital   Hospital   @relation(fields: [hospitalId], references: [id])
  admission  Admission? @relation(fields: [admissionId], references: [id])
  nurse      Nurse      @relation(fields: [nurseId], references: [id])

  @@map("nurse_tasks")
}

enum TaskCategory {
  MEDICATION
  VITALS
  ASSESSMENT
  PROCEDURE
  DOCUMENTATION
  COMMUNICATION
  DISCHARGE
  OTHER
}

enum TaskPriority {
  STAT
  URGENT
  ROUTINE
  LOW
}

enum NurseTaskStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  CANCELLED
  DEFERRED
}
```

### 4.2 Update Existing Nurse Model

```prisma
model Nurse {
  id           String   @id @default(uuid())
  userId       String   @unique
  departmentId String
  qualification String
  shift        NurseShift
  licenseNumber String
  specialization String?      // 🆕
  certifications String[]     // 🆕 BLS, ACLS, PALS, etc.
  isCharge      Boolean @default(false) // 🆕 Charge nurse flag
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  user         User         @relation(fields: [userId], references: [id])
  department   Department   @relation(fields: [departmentId], references: [id])
  nursingNotes NursingNote[]
  assignments  NurseAssignment[]           // 🆕
  medicationAdmins MedicationAdministration[] // 🆕
  assessments  NursingAssessment[]          // 🆕
  intakeOutputs IntakeOutput[]              // 🆕
  outgoingHandoffs ShiftHandoff[] @relation("OutgoingNurse") // 🆕
  incomingHandoffs ShiftHandoff[] @relation("IncomingNurse") // 🆕
  tasks        NurseTask[]                  // 🆕
}
```

---

## 5. FRONTEND — PAGE DESIGN

### 5.1 Main Nursing Page (/nursing)

**Layout:** Tabbed interface (same pattern as Emergency module)

**Header:**
- "Nursing Station" title with nurse name and shift info
- Current shift badge (Morning/Afternoon/Night)
- Quick stats: My Patients count, Tasks Due, Overdue Meds, Alerts

**Tabs:**

#### Tab 1: My Patients (Default)
- Card grid of assigned patients
- Each card shows: Name, Room/Bed, Diagnosis, ESI/Acuity, Last Vitals, NEWS2 Score
- Color-coded by acuity (like Emergency ESI cards)
- Quick actions: Record Vitals, Give Med, View Chart, Add Note
- Click to expand patient detail panel

#### Tab 2: eMAR
- Medication timeline grid (like Cerner eMAR)
- Rows = medications, Columns = time slots
- Color-coded cells: Green=given, Red=overdue, Yellow=due soon, Gray=scheduled
- Click cell to administer (opens MedVerification → BarcodeScanner → MedAdminRecord flow)
- PRN section at bottom
- Filter by patient (dropdown)
- Status counts: Due Now, Overdue, Administered, Not Given

#### Tab 3: Vitals & I/O
- VitalsTrendChart component (existing) for selected patient
- Vital signs entry form (BP, HR, RR, SpO2, Temp, Pain, Consciousness)
- Auto NEWS2 calculation on entry
- I/O tracking table with running 24h balance
- Intake categories: Oral, IV, NG Tube, Blood Products
- Output categories: Urine, Drain, Emesis, Stool, Other

#### Tab 4: Assessments
- Assessment form selector (dropdown of NursingAssessmentType)
- Dynamic form based on type:
  - Pain: 0-10 scale with body map
  - Fall Risk: Morse Fall Scale (scored)
  - Skin: Braden Scale (scored with risk level)
  - Head-to-Toe: Systems checklist
  - Neuro: Glasgow Coma Scale
- Assessment history timeline
- Score trends over time

#### Tab 5: Tasks
- Task list with filters (All, Due Now, Overdue, Completed)
- Auto-generated tasks from: medication schedules, vitals due, assessments due
- Manual task creation
- Priority badges (STAT, Urgent, Routine)
- Bulk complete actions
- Category grouping

#### Tab 6: Handoff
- SBAR handoff form
- Pre-populated with: patient summary, pending tasks, due medications, alerts
- Incoming handoff acceptance queue
- Handoff history log
- Print handoff sheet option

### 5.2 Charge Nurse View (/nursing?view=charge)
- Unit overview with all patient-nurse assignments
- Nurse-to-patient ratio display
- Drag-and-drop patient assignment
- Unit-wide overdue medications/tasks
- Staff schedule overview

---

## 6. eMAR WORKFLOW (DETAILED)

### 6.1 Medication Lifecycle
```
Doctor Orders Medication
    ↓
Pharmacy Verifies & Dispenses
    ↓
Medication appears in eMAR (SCHEDULED)
    ↓
Time window opens (DUE - 30 min before scheduled time)
    ↓
Nurse opens eMAR, sees medication due
    ↓
Nurse scans patient wristband (BarcodeScanner)
    ↓
System verifies: Right Patient ✓
    ↓
Nurse scans medication barcode (BarcodeScanner)
    ↓
System verifies: Right Med, Right Dose, Right Route, Right Time ✓
    ↓
5 Rights Verification Complete (MedVerification)
    ↓
Nurse administers medication
    ↓
Nurse records in MedAdminRecord (timestamp, notes, vitals if needed)
    ↓
eMAR updated → ADMINISTERED ✅
    ↓
If not given → Record reason (HELD, REFUSED, NOT_GIVEN)
```

### 6.2 Time Windows
- **Early:** > 60 min before scheduled → SCHEDULED (gray)
- **Approaching:** 30-60 min before → SCHEDULED (light blue)
- **Due:** Within 30 min → DUE (yellow)
- **Now:** Within 15 min → DUE (orange, highlighted)
- **Late:** 0-30 min after → OVERDUE (red)
- **Critical:** > 30 min after → OVERDUE (dark red, alert)

### 6.3 Special Cases
- **PRN Medications:** Always available, nurse documents indication
- **STAT Medications:** Immediate, bypasses schedule
- **Controlled Substances:** Require witness (second nurse password)
- **IV Medications:** Track start time, rate, end time
- **Insulin:** Show latest blood glucose alongside

---

## 7. BUILD PHASES

### Phase 1: Backend Foundation (nurseRoutes + nurseService)
1. Add Prisma schema models (6 new models, 6 new enums)
2. Run migration
3. Create nurseService.ts with all service methods
4. Create nurseRoutes.ts with all endpoints
5. Register routes in index.ts
6. Add nursingApi to frontend api.ts

### Phase 2: My Patients Tab + Assignments
7. Create /nursing page with tabbed layout
8. Build PatientAssignment component
9. Build My Patients card grid
10. Patient detail expansion panel

### Phase 3: eMAR Tab
11. Build eMAR timeline grid
12. Wire up BarcodeScanner (existing)
13. Wire up MedVerification (existing)
14. Wire up MedAdminRecord (existing)
15. Wire up MedSchedule (existing)
16. Build medication administration flow

### Phase 4: Vitals & I/O Tab
17. Wire up VitalsTrendChart (existing)
18. Build vitals entry form with auto NEWS2
19. Wire up EWSCalculator (existing)
20. Wire up EWSAlertCard (existing)
21. Build I/O tracking form and balance display

### Phase 5: Assessments + Tasks + Handoff
22. Build NursingAssessment forms (Pain, Fall Risk, Braden, Head-to-Toe)
23. Build NurseTaskList
24. Build ShiftHandoff SBAR form
25. Build charge nurse unit overview

### Phase 6: Integration & Polish
26. Add /nursing route to App.tsx
27. Add Nursing to sidebar navigation
28. Add nurse-specific permissions
29. Test all flows end-to-end
30. Deploy to production

---

## 8. PERMISSIONS

### New Permissions to Add
```
nursing:dashboard        # View nursing dashboard
nursing:patients:read    # View assigned patients
nursing:patients:assign  # Assign patients to nurses (charge nurse)
nursing:emar:read        # View eMAR
nursing:emar:administer  # Administer medications
nursing:emar:witness     # Witness controlled substance administration
nursing:vitals:read      # View vitals
nursing:vitals:write     # Record vitals
nursing:assessments:read # View assessments
nursing:assessments:write # Create assessments
nursing:io:read          # View I&O
nursing:io:write         # Record I&O
nursing:handoff:read     # View handoffs
nursing:handoff:write    # Create handoffs
nursing:tasks:read       # View tasks
nursing:tasks:write      # Manage tasks
nursing:unit:overview    # View unit overview (charge nurse)
```

---

## 9. INTEGRATION POINTS

| System | Integration |
|--------|-------------|
| Pharmacy | Medication orders feed into eMAR |
| IPD | Admissions link to nurse assignments |
| Lab | Lab orders created by nurses show in tasks |
| Emergency | ED patients triaged by nurses |
| Early Warning | NEWS2 scores from vitals auto-calculated |
| RBAC | Nurse permissions control access |
| Notifications | Overdue med/task alerts |
| AI | AI-assisted assessment suggestions |

---

## 10. RISK & DEPENDENCIES

| Risk | Mitigation |
|------|------------|
| Pharmacy module must have prescription data for eMAR | Use existing prescription model; fall back to manual entry |
| Barcode scanning requires camera access | BarcodeScanner already supports manual entry fallback |
| NEWS2 calculation must match NHS standards | news2.ts utility already implements NHS-compliant scoring |
| Controlled substance tracking needs audit trail | All MedicationAdministration records are immutable with timestamps |
| Large patient loads may slow eMAR grid | Paginate by patient, cache medication schedules |

---

*PRD v1.0 — Ready for build*
