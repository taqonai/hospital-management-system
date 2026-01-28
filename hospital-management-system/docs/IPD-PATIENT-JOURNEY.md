# IPD Patient Journey — Step by Step
**Spetaar HMS | From Admission to Discharge**

---

## The Flow

```
Patient Arrives → Admission → Bed Assigned → Daily Care → Discharge
```

---

## Step 1: Patient Registration (or Search Existing)
**Who does it:** Receptionist / Nurse / Doctor
**Where in system:** Directly inside the IPD Admission Modal — no need to leave the page!

The admission modal has a **Smart Patient Selector** with two modes:

### 🔍 Search Existing Patient (default)
- Type patient name or MRN in the search box
- Results appear instantly (debounced search)
- Click to select the patient
- If no results found (3+ characters typed), a prompt appears:
  *"No patient found. Register new?"* → click to switch to registration mode

### ➕ Register New Patient (inline)
- Toggle to "Register New" tab — a compact form appears right inside the modal:

| Row | Fields |
|-----|--------|
| 1 | First Name* | Last Name* |
| 2 | Date of Birth* | Gender* (Male/Female/Other) |
| 3 | Phone* | Email (optional) |
| 4 | Address* | City* |
| 5 | State* | Zip Code* |
| 6 | Blood Group (optional) | Nationality (optional) |

- Click **"Register & Select"** → patient is created instantly
- System auto-generates MRN and shows toast: *"Patient registered — MRN: HMS001-XXXXX"*
- Patient is auto-selected for admission — continue filling the rest of the form

**No page navigation needed.** Everything happens inside the admission modal.

✅ **Implemented** — Inline patient search + registration in one place

---

## Step 2: Check Bed Availability
**Who does it:** Receptionist / Nurse / Admin
**Where in system:** IPD → Beds tab (or directly in the admission modal bed selector)

Before admitting, check which beds are free.
- View all beds across wards (General, ICU, CCU, Private, Pediatric)
- Filter by ward type or bed type (Standard / ICU)
- Bed statuses: Available 🟢 | Occupied 🔴 | Reserved 🟡 | Maintenance ⚫ | Cleaning 🔵

**System shows:**
- 6 Wards (General Ward A, General Ward B, ICU, CCU, Private Ward, Pediatric Ward)
- 25 Beds total with ward assignment and daily rate

✅ **Implemented** — Beds list, available beds filter, ward view all working

---

## Step 3: Create Admission
**Who does it:** Doctor / Nurse / Receptionist / Admin
**Where in system:** IPD → Admissions → "New Admission" button

The admission modal combines patient selection + admission in one screen:

**Part A — Select or Register Patient** *(see Step 1 above)*

**Part B — Fill Admission Details:**

| Field | Required | Example |
|-------|----------|---------|
| Patient | ✅ | Already selected/registered in Part A |
| Bed | ✅ | Select from available beds (grouped by ward) |
| Attending Doctor | ✅ | Select from doctor list (with specialization) |
| Admission Type | ✅ | Elective / Emergency / Transfer (pill-style toggle) |
| Admission Reason | Optional | "Chest pain and shortness of breath" |
| Diagnosis | Optional | "Acute MI, Hypertension" |

**What happens automatically:**
- Bed status changes from AVAILABLE → OCCUPIED
- Patient appears in Admissions list with status "ADMITTED"
- Admission date/time is recorded

✅ **Implemented** — Full admission creation with inline patient registration + auto bed allocation

---

## Step 4: View Admission Detail
**Who does it:** Doctor / Nurse / Admin
**Where in system:** IPD → Admissions → Click "View Details" on any admission

Opens the **Admission Detail Page** with 6 tabs:

| Tab | What It Shows |
|-----|---------------|
| **Overview** | Patient info, bed/ward, diagnosis, admitting doctor, treatment plan |
| **Orders** | Doctor's orders (lab, meds, procedures, etc.) |
| **Vitals** | Vital signs history with NEWS2 scores + trend chart |
| **Notes** | Progress notes from doctors and nurses |
| **Medications** | Prescribed medications list |
| **Discharge** | Discharge form *(only visible to Doctors & Admin)* |

✅ **Implemented** — All 6 tabs functional

---

## Step 5: Doctor Writes Orders
**Who does it:** Doctor / Admin only
**Where in system:** Admission Detail → Orders tab → "New Order" button

Doctor places orders for the patient's care:

| Order Type | Example |
|------------|---------|
| **MEDICATION** | "Start IV Amoxicillin 500mg TDS" |
| **LAB** | "CBC, LFT, Serum Creatinine" |
| **RADIOLOGY** | "Chest X-ray PA view" |
| **NURSING** | "Strict I/O monitoring" |
| **DIET** | "Low sodium diet, clear fluids only" |
| **CONSULT** | "Cardiology consultation" |
| **PROCEDURE** | "Central line insertion" |

Each order has:
- **Priority:** Routine / Urgent / STAT
- **Status:** Ordered → In Progress → Completed (or Cancelled)
- **Description + Details**

**Who can update order status:**
- Nurse — mark as In Progress / Completed (execute orders)
- Lab Technician — complete lab orders
- Doctor — update or cancel orders

✅ **Implemented** — Create, view, update status, cancel orders

---

## Step 6: Record Vitals & NEWS2 Monitoring
**Who does it:** Nurse / Doctor
**Where in system:** Admission Detail → Vitals tab

Record patient vitals (typically every 4-6 hours):

| Vital | Unit | Example |
|-------|------|---------|
| Respiratory Rate | breaths/min | 18 |
| Oxygen Saturation (SpO2) | % | 96 |
| Supplemental Oxygen | Yes/No | No |
| Blood Pressure (Systolic) | mmHg | 120 |
| Blood Pressure (Diastolic) | mmHg | 80 |
| Heart Rate | bpm | 72 |
| Temperature | °C | 36.8 |
| Consciousness | AVPU scale | Alert |

**What happens automatically:**
- **NEWS2 score** is calculated from the vitals
- Risk level assigned: Low (0-4) / Medium (5-6) / High (7+) / Critical
- Clinical response recommendation generated
- Patient appears on **NEWS2 Monitoring Dashboard** if score is elevated
- **Vitals Trend Chart** updates to show history over time

✅ **Implemented** — Vitals recording, auto NEWS2, risk alerts, trend charts

---

## Step 7: Write Progress Notes
**Who does it:** Doctor / Nurse
**Where in system:** Admission Detail → Notes tab → "Add Note" button

Document the patient's progress:

| Field | Description |
|-------|-------------|
| Note Type | SOAP / Narrative / Procedure / Consultation / Discharge |
| Content | Free-text clinical note |
| Author Role | Auto-tagged (DOCTOR / NURSE) |
| Timestamp | Auto-recorded |

- Doctors write clinical progress, treatment changes, procedure notes
- Nurses write shift observations, patient responses, care delivered
- All notes are timestamped and show author name + role

✅ **Implemented** — Create and view progress notes with role tagging

---

## Step 8: Add Nursing Notes
**Who does it:** Nurse only
**Where in system:** IPD → Admission → Nursing Notes

Separate from progress notes — specifically for nursing documentation:

| Field | Description |
|-------|-------------|
| Note Type | Assessment / Intervention / Evaluation / Observation |
| Content | Nursing-specific documentation |
| Vitals | Optional attached vitals data (JSON) |

✅ **Implemented** — Nursing notes with vitals attachment

---

## Step 9: Transfer Bed (if needed)
**Who does it:** Nurse / Admin
**Where in system:** Admission Detail → Transfer option

If patient needs to move (e.g., from General Ward to ICU):
- Select new available bed
- System automatically:
  - Frees the old bed (status → AVAILABLE)
  - Assigns new bed (status → OCCUPIED)
  - Updates admission record

✅ **Implemented** — Bed transfer with auto status update

---

## Step 10: Discharge Patient
**Who does it:** Doctor / Admin only
**Where in system:** Admission Detail → Discharge tab

When patient is ready to go home, doctor fills the discharge form:

| Field | Required | Example |
|-------|----------|---------|
| Discharge Type | ✅ | Normal / Against Medical Advice / Transfer / Expired |
| Final Diagnosis | ✅ | ["Pneumonia - resolved", "Type 2 DM"] |
| Condition at Discharge | ✅ | "Stable, afebrile for 48 hours" |
| Procedures Performed | Optional | ["Chest tube insertion", "Bronchoscopy"] |
| Medications on Discharge | Optional | ["Amoxicillin 500mg TDS x 5 days"] |
| Follow-up Instructions | Optional | "Review in OPD after 1 week" |
| Follow-up Date | Optional | 2026-02-04 |
| Dietary Instructions | Optional | "Low salt diet" |
| Activity Restrictions | Optional | "Avoid heavy lifting for 2 weeks" |
| Warning Signs to Watch | Optional | ["Fever > 38.5°C", "Breathing difficulty"] |

**What happens automatically:**
- Admission status changes to DISCHARGED
- Discharge date/time recorded
- Bed status changes to CLEANING (ready for housekeeping)
- Discharge summary saved

✅ **Implemented** — Full discharge workflow with auto bed release

---

## Monitoring Dashboards

### IPD Dashboard (main page)
**Stats shown:** Total Beds | Occupied | Available | Occupancy Rate % | Current Admissions | Discharges This Week

### NEWS2 Monitoring Dashboard
**Shows:** All admitted patients with their latest NEWS2 scores, risk levels, and clinical recommendations

### High-Risk Patients View
**Shows:** Patients flagged as critical or high-risk based on NEWS2 scores

✅ **All implemented**

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    PATIENT ARRIVES                        │
└────────────────────────┬────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 1-3: Open Admission Modal (all in one screen!)     │
│  👤 Doctor / Nurse / Receptionist                        │
│                                                          │
│  ┌────────────────────────────────────────┐              │
│  │ 🔍 Search Existing  │ ➕ Register New  │              │
│  ├────────────────────────────────────────┤              │
│  │ Search by name/MRN → select patient    │              │
│  │   OR                                   │              │
│  │ Fill inline form → auto-register       │              │
│  │ "No patient found? Register new?"      │              │
│  └────────────────────────────────────────┘              │
│                                                          │
│  📋 Select Bed (grouped by ward) + Doctor + Type         │
│  📋 Admission Reason + Diagnosis                         │
│  ⚡ Submit → Bed auto → OCCUPIED                         │
└────────────────────────┬────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│              DAILY CARE CYCLE (repeats)                   │
│                                                          │
│  ┌──────────────────────────────────────────┐            │
│  │  Doctor Writes Orders                     │            │
│  │  💊 Meds, 🔬 Labs, 📷 Imaging, etc.      │            │
│  └──────────────────┬───────────────────────┘            │
│                     ▼                                    │
│  ┌──────────────────────────────────────────┐            │
│  │  Nurse Executes Orders                    │            │
│  │  ✅ Updates order status                  │            │
│  └──────────────────┬───────────────────────┘            │
│                     ▼                                    │
│  ┌──────────────────────────────────────────┐            │
│  │  Record Vitals (every 4-6 hrs)            │            │
│  │  📊 Auto NEWS2 score + risk alert         │            │
│  └──────────────────┬───────────────────────┘            │
│                     ▼                                    │
│  ┌──────────────────────────────────────────┐            │
│  │  Write Progress Notes                     │            │
│  │  📝 Doctor & Nurse notes                  │            │
│  └──────────────────┬───────────────────────┘            │
│                     ▼                                    │
│  ┌──────────────────────────────────────────┐            │
│  │  Transfer Bed (if needed)                 │            │
│  │  🛏️ e.g., General → ICU                   │            │
│  └──────────────────────────────────────────┘            │
│                                                          │
└────────────────────────┬────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 10: Discharge                                      │
│  👤 Doctor only                                          │
│  📋 Final diagnosis + medications + follow-up            │
│  ⚡ Bed auto → CLEANING                                  │
│  ⚡ Status auto → DISCHARGED                             │
└─────────────────────────────────────────────────────────┘
```

---

## What's Implemented vs What's Not

### ✅ Fully Working (20 features)
1. Patient registration (standalone + inline in admission modal)
2. Smart patient selector (search existing + register new in one place)
3. Ward management (6 wards)
4. Bed availability check
5. Create admission (4 types)
6. Admission detail page (6 tabs)
7. Doctor's orders (7 types, 3 priorities)
8. Order status tracking (Ordered → In Progress → Completed)
9. Vitals recording
10. NEWS2 auto-calculation & risk classification
11. NEWS2 monitoring dashboard
12. High-risk patient alerts
13. Progress notes (Doctor & Nurse)
14. Nursing notes
15. Bed transfer
16. Full discharge with summary
17. Auto bed status management
18. Vitals trend chart
19. IPD statistics dashboard

### ❌ Not Yet Built
1. Bed occupancy calendar/timeline view
2. Ward round scheduling & checklist
3. Medication administration record (MAR) — *exists in Nurse module separately*
4. Patient meal/diet ordering integration
5. Billing integration on discharge
6. Discharge summary PDF export
7. Family/visitor notifications
8. Readmission tracking

---

*Document created: January 28, 2026*
*Source: Codebase analysis of ipdService.ts, ipdRoutes.ts, AdmissionDetail.tsx, rbacService.ts*
