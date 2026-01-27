# IPD Module — Features PRD (Product Requirements Document)

**Product:** Spetaar HMS (spetaar.ai)  
**Module:** Inpatient Department (IPD)  
**Version:** 2.0  
**Date:** January 27, 2026  
**Author:** TeaBot ☕ (Taqon AI)  
**Priority:** P0 — Critical for hospital adoption

---

## 1. EXECUTIVE SUMMARY

Upgrade the IPD module from a basic bed management tool to a complete inpatient clinical workflow system. The current IPD has 11 working features (wards, beds, admissions, vitals, NEWS2 monitoring, discharge). This PRD adds the missing pieces that hospitals require for daily inpatient care.

### Current State (v1.0)
- ✅ Ward & bed management (visual grid)
- ✅ Patient admission (modal with search, doctor, bed, diagnosis)
- ✅ Admission list, IPD stats, high-risk patients
- ✅ Vitals recording with auto NEWS2 calculation
- ✅ NEWS2 deterioration monitoring dashboard
- ✅ Basic discharge (one-click, no summary form)
- ✅ Bed transfer, nursing notes
- ❌ No admission detail page
- ❌ No discharge summary form
- ❌ No doctor's orders
- ❌ No progress notes
- ❌ "View Details" button is dead

### Target State (v2.0)
All of the above PLUS:
- Admission Detail Page (single-patient view)
- Discharge Summary Form (full clinical discharge)
- Doctor's Orders (medications, labs, radiology, nursing)
- Progress Notes (daily SOAP notes by doctors/nurses)
- Treatment Plan management
- Wire all dead buttons
- Fix existing bugs

---

## 2. FEATURES — DETAILED SPECS

### 2.1 Admission Detail Page (P0)

**What:** A dedicated page (`/ipd/admission/:id`) showing everything about an admitted patient in one place.

**User Story:** As a doctor/nurse, I want to see all patient information on one screen — vitals, orders, notes, medications, history — so I can make informed care decisions.

**Layout — Tabbed Interface:**

```
/ipd/admission/:id
┌─────────────────────────────────────────────────────┐
│ Patient Header Bar                                    │
│ [Name] [MRN] [Bed: ICU-3] [Admitted: 3 days ago]    │
│ [Admitting Dr: Dr. Smith] [NEWS2: 5 ⚠️ MEDIUM]     │
├─────────────────────────────────────────────────────┤
│ [Overview] [Orders] [Vitals] [Notes] [Meds] [Discharge] │
├─────────────────────────────────────────────────────┤
│                                                       │
│  Tab Content Area                                     │
│                                                       │
└─────────────────────────────────────────────────────┘
```

**Tab 1: Overview**
- Patient demographics (name, DOB, gender, blood group, allergies)
- Admission details (date, type, chief complaint, diagnosis, ICD codes)
- Treatment plan (editable text)
- Latest vitals summary (mini cards)
- Active orders count
- Nursing assignments

**Tab 2: Orders**
- List of all active/completed orders
- Create new order (medication, lab, radiology, nursing, diet)
- Order status tracking (Ordered → In Progress → Completed)
- Each order: type, description, priority, ordered by, date/time, status

**Tab 3: Vitals**
- Vitals history table (last 48h)
- Vitals trend chart (existing VitalsTrendChart component)
- Record new vitals form
- NEWS2 score history with color coding
- I/O balance (if available from nursing)

**Tab 4: Notes**
- Progress notes timeline (newest first)
- Create new note (SOAP format):
  - Subjective (patient complaints)
  - Objective (examination findings)
  - Assessment (clinical assessment)
  - Plan (action plan)
- Note type: Doctor Note / Nursing Note / Consultation Note
- Each note shows: author, role, date/time, content

**Tab 5: Medications**
- Active prescriptions from Prescription model
- Medication administration history (from eMAR/nursing)
- Allergies and drug interactions warning

**Tab 6: Discharge**
- Discharge Summary Form (see 2.2)
- Only enabled when doctor initiates discharge

**Backend API Needed:**
```
GET  /api/v1/ipd/admissions/:id/detail    → Full admission with all relations
GET  /api/v1/ipd/admissions/:id/orders    → All orders for admission
POST /api/v1/ipd/admissions/:id/orders    → Create new order
GET  /api/v1/ipd/admissions/:id/notes     → Progress notes
POST /api/v1/ipd/admissions/:id/notes     → Add progress note
GET  /api/v1/ipd/admissions/:id/vitals    → Vitals history (already exists)
```

**New DB Models:**
```prisma
model DoctorOrder {
  id            String      @id @default(uuid())
  admissionId   String
  hospitalId    String
  orderType     OrderType   // MEDICATION, LAB, RADIOLOGY, NURSING, DIET, CONSULT
  priority      OrderPriority // ROUTINE, URGENT, STAT
  description   String
  details       Json?       // Type-specific details
  status        OrderStatus @default(ORDERED)
  orderedBy     String      // Doctor userId
  completedBy   String?
  completedAt   DateTime?
  notes         String?
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  admission     Admission   @relation(fields: [admissionId], references: [id])
  hospital      Hospital    @relation(fields: [hospitalId], references: [id])

  @@map("doctor_orders")
}

enum OrderType {
  MEDICATION
  LAB
  RADIOLOGY
  NURSING
  DIET
  CONSULT
  PROCEDURE
}

enum OrderPriority {
  ROUTINE
  URGENT
  STAT
}

enum OrderStatus {
  ORDERED
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

model ProgressNote {
  id           String   @id @default(uuid())
  admissionId  String
  authorId     String   // userId
  authorRole   String   // DOCTOR, NURSE
  noteType     NoteType // SOAP, GENERAL, CONSULTATION, PROCEDURE
  subjective   String?  // S - patient complaints
  objective    String?  // O - examination findings
  assessment   String?  // A - clinical assessment
  plan         String?  // P - action plan
  content      String?  // For non-SOAP notes
  createdAt    DateTime @default(now())

  admission    Admission @relation(fields: [admissionId], references: [id])

  @@map("progress_notes")
}

enum NoteType {
  SOAP
  GENERAL
  CONSULTATION
  PROCEDURE
  HANDOFF
}
```

---

### 2.2 Discharge Summary Form (P0)

**What:** A proper clinical discharge form instead of one-click discharge.

**User Story:** As a doctor, I want to fill out a complete discharge summary with diagnosis, medications, follow-up instructions so the patient has proper documentation.

**Form Fields (matching DischargeSummary DB model):**
- Discharge Date (date picker, default today)
- Discharge Type (dropdown: Regular, Against Medical Advice, Transfer, Death, Abscond)
- Condition at Discharge (dropdown: Improved, Unchanged, Deteriorated, Expired)
- Final Diagnosis (multi-input, tag-style)
- Procedures Performed (multi-input)
- Medications on Discharge (list with name, dose, frequency, duration)
- Follow-up Instructions (textarea)
- Follow-up Date (date picker)
- Dietary Instructions (textarea)
- Activity Restrictions (textarea)
- Warning Signs to Watch (multi-input, tag-style)

**Behavior:**
- Opens as a modal or slide-over panel from the admission detail page OR the discharge tab
- On submit: creates DischargeSummary, updates Admission.status to DISCHARGED, frees the bed
- Print-ready discharge summary view

**Backend:** Already exists (`POST /api/v1/ipd/admissions/:id/discharge`) — but needs the frontend to send all fields instead of just `{ dischargeNotes: 'Discharged by staff' }`.

---

### 2.3 Doctor's Orders (P1)

**What:** Order entry system for inpatient care.

**User Story:** As a doctor, I want to write orders (medications, labs, imaging, diet) for my admitted patients so the care team can execute them.

**UI:** 
- List view of all orders on the admission detail page (Orders tab)
- "New Order" button opens a form:
  - Order Type (dropdown: Medication, Lab, Radiology, Nursing, Diet, Consult)
  - Priority (Routine / Urgent / STAT)
  - Description (text)
  - Details (varies by type — medication: drug+dose+route+freq; lab: test names; etc.)
  - Notes (optional)
- Each order card shows: type icon, description, priority badge, status, ordered by, time
- Status updates: Ordered → In Progress → Completed (nurses/techs update)

**Backend API:**
```
POST   /api/v1/ipd/admissions/:id/orders       → Create order
GET    /api/v1/ipd/admissions/:id/orders        → List orders (filter by type/status)
PATCH  /api/v1/ipd/admissions/:id/orders/:orderId → Update order status
DELETE /api/v1/ipd/admissions/:id/orders/:orderId → Cancel order
```

---

### 2.4 Progress Notes — SOAP (P1)

**What:** Clinical documentation system for daily patient notes.

**User Story:** As a doctor doing ward rounds, I want to document my findings in SOAP format so there's a clear clinical trail.

**UI:**
- Timeline view of all notes (Notes tab on admission detail)
- "Add Note" button opens form:
  - Note Type: SOAP / General / Consultation
  - If SOAP: 4 textareas (Subjective, Objective, Assessment, Plan)
  - If General: single textarea
  - Author auto-filled from logged-in user
- Each note card: author name + role badge, timestamp, formatted content
- Notes are read-only after creation (audit trail)

**Backend API:**
```
POST /api/v1/ipd/admissions/:id/notes    → Create note
GET  /api/v1/ipd/admissions/:id/notes    → List notes (paginated, newest first)
```

---

### 2.5 Treatment Plan Editor (P2)

**What:** Edit the treatment plan text on the admission.

**Current State:** `treatmentPlan` field exists in Admission model but has no UI.

**UI:** Editable textarea on the Overview tab of admission detail page. Auto-saves on blur.

**Backend:** Already exists via `PUT /api/v1/ipd/admissions/:id` — just pass `{ treatmentPlan: "..." }`.

---

### 2.6 Bug Fixes & Wiring

**Fix 1:** Wire "View Details" button on admissions list → navigate to `/ipd/admission/:id`
**Fix 2:** Discharge button should open Discharge Summary Form instead of one-click
**Fix 3:** Test and fix any API errors in existing IPD flows (bed management, admission creation, vitals recording)

---

## 3. IMPLEMENTATION PLAN

### Phase 1: Foundation (This Build)
1. Add new Prisma models (DoctorOrder, ProgressNote)
2. Run migration
3. Build backend routes & services for orders and notes
4. Build Admission Detail Page with all 6 tabs
5. Build Discharge Summary Form
6. Wire "View Details" button
7. Fix existing bugs

### Phase 2: Enhancement (Next Sprint)
- AI-powered order suggestions
- Order sets / templates
- Print discharge summary
- Progress note templates
- Consent forms

---

## 4. ROUTING

```
/ipd                        → IPD Dashboard (existing)
/ipd/admission/:id          → Admission Detail Page (NEW)
```

---

## 5. PERMISSIONS

| Action | Roles |
|--------|-------|
| View admission detail | DOCTOR, NURSE, HOSPITAL_ADMIN |
| Create orders | DOCTOR, HOSPITAL_ADMIN |
| Update order status | NURSE, DOCTOR, LAB_TECHNICIAN |
| Add progress notes | DOCTOR, NURSE |
| Discharge patient | DOCTOR |
| Edit treatment plan | DOCTOR |

---

*End of PRD*
