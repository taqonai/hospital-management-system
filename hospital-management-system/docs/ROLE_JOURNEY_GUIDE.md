# Spetaar HMS — Role-Wise User Journey
## Insurance, Finance & Billing Flows

**Version:** 1.0  
**Date:** February 5, 2026  
**Purpose:** Simple step-by-step guide for each role

---

# Quick Overview

```
Patient Journey Through the System:

PATIENT → RECEPTIONIST → NURSE → DOCTOR → LAB/PHARMACY → BILLING → ADMIN
   │           │            │        │          │            │         │
   │      Check-in &    Vitals   Diagnosis   Tests &    Invoice &   Reports
   │      Insurance              & Orders    Dispense   Payment
   │
Portal Access
(Book, View, Pay)
```

---

# 👤 ROLE 1: PATIENT

## Portal URL: https://spetaar.ai/patient-portal/login

### What They Can Do:
- View their insurance details
- Book appointments
- See test results
- View & pay bills

---

### Journey 1: View My Insurance

**Login:** fatima.expired@test.com / password123

| Step | Click/Action | What They See |
|------|--------------|---------------|
| 1 | Login to portal | Dashboard with health summary |
| 2 | Click **"My Insurance"** in sidebar | Insurance card details |
| 3 | View policy info | Provider: Orient Insurance |
| | | Policy #: Shown |
| | | ⚠️ **Status: EXPIRED** (red warning) |
| | | Expiry: January 31, 2025 |

**What Happens:** Patient sees their insurance is expired and needs to update it.

---

### Journey 2: Book an Appointment

**Login:** ahmed.cob@test.com / password123

| Step | Click/Action | What They See |
|------|--------------|---------------|
| 1 | Click **"Book Appointment"** | Booking form |
| 2 | Select Department | Dropdown: General Medicine, Cardiology, etc. |
| 3 | Select Doctor | Available doctors listed |
| 4 | Pick Date & Time | Calendar with available slots |
| 5 | Click **"Confirm Booking"** | ✅ "Appointment Booked" message |
| 6 | View **"My Appointments"** | Appointment listed with date/time |

**What Happens:** Appointment created, patient gets confirmation.

---

### Journey 3: View & Pay Bill

| Step | Click/Action | What They See |
|------|--------------|---------------|
| 1 | Click **"Billing"** in sidebar | List of invoices |
| 2 | Click on an invoice | Invoice details: |
| | | - Services received |
| | | - Total amount |
| | | - Insurance covered: AED XX |
| | | - **You Pay: AED XX** |
| 3 | Click **"Pay Now"** | Payment options (Card) |
| 4 | Complete payment | ✅ Receipt generated |

---

# 👩‍💼 ROLE 2: RECEPTIONIST

## Login: receptionist@hospital.com / password123
## URL: https://spetaar.ai/login

### What They Do:
- Check-in patients
- Verify insurance
- Collect copay payments
- Register walk-in patients

---

### Journey 1: Check-In Patient with Active Insurance

**Example Patient:** Ahmed COB-Test (has Daman insurance)

| Step | Click/Action | What They See |
|------|--------------|---------------|
| 1 | Click **"OPD"** in sidebar | OPD Queue Management |
| 2 | Click **"Today's Appointments"** tab | List of scheduled patients |
| 3 | Find "Ahmed COB-Test" | Row shows: Name, Time, Doctor, Status: SCHEDULED |
| 4 | Click **"Check In"** button | 🔄 Insurance Verification Modal opens |
| 5 | System auto-verifies | ✅ **"Insurance Active"** |
| | | Provider: Daman |
| | | Policy: Valid till Dec 2026 |
| 6 | View Copay Calculation | **Copay Breakdown:** |
| | | Consultation Fee: AED 150 |
| | | Insurance Covers: AED 120 (80%) |
| | | **Patient Pays: AED 30** |
| 7 | Select payment method | Cash ○ or Card ○ |
| 8 | Click **"Collect Copay"** | 💳 Payment processed |
| 9 | Receipt prints | Bilingual receipt (Arabic + English) |
| 10 | Status changes | Patient → **CHECKED_IN** |

**What Happens:** Patient is checked in, copay collected, ready for nurse.

---

### Journey 2: Check-In Patient with EXPIRED Insurance

**Example Patient:** Fatima Expired-Test

| Step | Click/Action | What They See |
|------|--------------|---------------|
| 1 | Find "Fatima Expired-Test" | Status: SCHEDULED |
| 2 | Click **"Check In"** | Insurance Verification Modal |
| 3 | System checks insurance | ⚠️ **WARNING: Insurance Expired** |
| | | "Orient Insurance expired on Jan 31, 2025" |
| 4 | See options: | |
| | Option A | **"Convert to Self-Pay"** → Patient pays full amount |
| | Option B | **"Defer Check-in"** → Wait for insurance update |
| | Option C | **"Override"** → Needs supervisor approval |
| 5 | Click **"Convert to Self-Pay"** | Self-pay mode activated |
| 6 | View amount | **Full Fee: AED 150** (no insurance discount) |
| 7 | Collect payment | Patient pays AED 150 |
| 8 | Complete check-in | Patient → CHECKED_IN (Self-Pay) |

**What Happens:** Expired insurance detected, converted to self-pay, full amount collected.

---

### Journey 3: Check-In Patient with Dual Insurance (COB)

**Example Patient:** Ahmed COB-Test (Daman + AXA)

| Step | Click/Action | What They See |
|------|--------------|---------------|
| 1 | Click **"Check In"** | Insurance Verification |
| 2 | System detects | 📋 **"2 Insurance Policies Found"** |
| | | Primary: Daman |
| | | Secondary: AXA Gulf |
| 3 | View COB Calculation | **Coordination of Benefits:** |
| | | Service Cost: AED 500 |
| | | Primary (Daman) pays: AED 400 (80%) |
| | | Remaining: AED 100 |
| | | Secondary (AXA) pays: AED 100 (100%) |
| | | **Patient Pays: AED 0** |
| 4 | Complete check-in | No payment needed |

**What Happens:** Both insurances cover the full amount, patient pays nothing.

---

### Journey 4: Register Walk-In Patient

| Step | Click/Action | What They See |
|------|--------------|---------------|
| 1 | Click **"Patients"** in sidebar | Patient list |
| 2 | Click **"+ Add Patient"** | Registration form |
| 3 | Enter patient details | Name, DOB, Phone, Emirates ID, etc. |
| 4 | Enter Emirates ID | System can lookup insurance from DHA |
| 5 | Click **"Verify Insurance"** | 🔄 Checking national database... |
| 6 | If found | ✅ Insurance auto-populated |
| 7 | If not found | Option to add manually or self-pay |
| 8 | Click **"Save Patient"** | ✅ Patient registered with MRN |

---

# 👩‍⚕️ ROLE 3: NURSE

## Login: nurse.moore@hospital.com / password123

### What They Do:
- Record patient vitals
- Triage patients
- Assist with patient prep

---

### Journey: Record Vitals

| Step | Click/Action | What They See |
|------|--------------|---------------|
| 1 | Click **"OPD"** in sidebar | OPD Queue |
| 2 | Find checked-in patient | Status: CHECKED_IN |
| 3 | Click **"Record Vitals"** | Vitals form opens |
| 4 | Enter measurements: | |
| | Blood Pressure | 120/80 mmHg |
| | Heart Rate | 72 bpm |
| | Temperature | 37.0°C |
| | Weight | 75 kg |
| | Height | 175 cm |
| | SpO2 | 98% |
| 5 | Click **"Save Vitals"** | ✅ Vitals recorded |
| 6 | Patient status changes | → **VITALS_RECORDED** |
| 7 | Patient moves to | Doctor's queue |

**What Happens:** Vitals recorded, patient ready for doctor consultation.

---

# 👨‍⚕️ ROLE 4: DOCTOR

## Login: idiamin@hospital.com / password123

### What They Do:
- See patient queue
- Conduct consultations
- Order tests (Lab, Radiology)
- Prescribe medications
- See cost estimates before ordering

---

### Journey 1: Start Consultation & Order Tests

| Step | Click/Action | What They See |
|------|--------------|---------------|
| 1 | View **"My Queue"** | Patients with vitals recorded |
| 2 | Click patient name | Patient summary card |
| 3 | Click **"Start Consultation"** | Consultation interface opens |
| | | Shows: Patient info, vitals, history |

**Adding Diagnosis:**

| Step | Click/Action | What They See |
|------|--------------|---------------|
| 4 | Click **"Add Diagnosis"** | ICD-10 search box |
| 5 | Type "respiratory" | Autocomplete suggestions |
| 6 | Select "J06.9 - Acute upper respiratory infection" | Diagnosis added |

**Ordering Lab Test:**

| Step | Click/Action | What They See |
|------|--------------|---------------|
| 7 | Click **"Lab Orders"** tab | Lab test selection |
| 8 | Search "CBC" | Test options appear |
| 9 | Select "Complete Blood Count" | Test added |
| 10 | **See cost estimate** | 💰 **"Cost: AED 85"** |
| | | "Patient pays: AED 17" (with insurance) |
| 11 | Click **"Order"** | ✅ Lab order created |

**Ordering Radiology (with Pre-Auth):**

| Step | Click/Action | What They See |
|------|--------------|---------------|
| 12 | Click **"Radiology Orders"** tab | Imaging selection |
| 13 | Search "MRI Brain" | Options appear |
| 14 | Select MRI | ⚠️ **"Pre-Auth Required"** warning |
| | | "This procedure requires pre-authorization from ADNIC" |
| 15 | Click **"Request Pre-Auth"** | Pre-auth form opens |
| 16 | Fill diagnosis & urgency | Submit to insurance |

**Prescribing Medication:**

| Step | Click/Action | What They See |
|------|--------------|---------------|
| 17 | Click **"Medications"** tab | Drug search |
| 18 | Search "Paracetamol" | Drug options |
| 19 | Select "Paracetamol 500mg" | Drug added |
| 20 | **See drug cost** | 💰 **"Cost: AED 15"** |
| | | "Patient pays: AED 3" |
| 21 | Add dosage | "1 tablet 3 times daily" |
| 22 | Add quantity | 20 tablets |
| 23 | Click **"Add to Prescription"** | ✅ Added |

**Completing Consultation:**

| Step | Click/Action | What They See |
|------|--------------|---------------|
| 24 | Review all orders | Summary shown |
| 25 | Click **"End Consultation"** | Consultation completed |
| 26 | System auto-generates | - Lab order sent to Lab |
| | | - Rx sent to Pharmacy |
| | | - Billing charges added |

**What Happens:** All orders created, sent to respective departments, billing updated.

---

# 🔬 ROLE 5: LAB TECHNICIAN

## Login: labtech@hospital.com / password123

### What They Do:
- Receive lab orders
- Collect samples
- Enter results
- Process walk-in patients

---

### Journey 1: Process Doctor's Lab Order

| Step | Click/Action | What They See |
|------|--------------|---------------|
| 1 | Click **"Laboratory"** in sidebar | Lab Dashboard |
| 2 | View **"Pending Orders"** | List of orders waiting |
| 3 | Find patient's CBC order | Order details shown |
| 4 | Click **"Collect Sample"** | Collection form |
| 5 | Enter/Scan Sample ID | Sample ID recorded |
| 6 | Select sample type | Blood, Urine, etc. |
| 7 | Click **"Confirm Collection"** | ✅ Status → COLLECTED |
| 8 | Process in lab | (Lab work happens) |
| 9 | Click **"Enter Results"** | Results entry form |
| 10 | Enter CBC values: | |
| | Hemoglobin | 14.5 g/dL |
| | WBC | 7,500 /μL |
| | Platelets | 250,000 /μL |
| | (etc.) | |
| 11 | Click **"Submit Results"** | ✅ Results saved |
| 12 | **Auto-billing triggers** | 💰 Charge added to patient invoice |

**What Happens:** Results available to doctor, charge added to billing.

---

### Journey 2: Walk-In Lab Patient

| Step | Click/Action | What They See |
|------|--------------|---------------|
| 1 | Click **"Walk-In Patient"** | Walk-in form |
| 2 | Search by Emirates ID | Enter: 784-1990-1234567-1 |
| 3 | Patient found | Details shown |
| 4 | **Insurance captured** | System fetches from patient profile |
| | | or looks up from DHA |
| 5 | Select tests | Lipid Panel, etc. |
| 6 | View **cost breakdown** | Test: AED 120 |
| | | Insurance: -AED 96 |
| | | **Patient Pays: AED 24** |
| 7 | Collect payment | Cash or Card |
| 8 | Click **"Generate Order"** | ✅ Lab order created |
| 9 | Print lab slip | Patient takes slip |
| 10 | Process as normal | Collect sample, enter results |

---

# 💊 ROLE 6: PHARMACIST

## Login: pharmacist@hospital.com / password123

### What They Do:
- View pending prescriptions
- Calculate & collect copay
- Dispense medications
- Manage inventory

---

### Journey: Dispense Prescription with Copay

| Step | Click/Action | What They See |
|------|--------------|---------------|
| 1 | Click **"Pharmacy"** in sidebar | Pharmacy Dashboard |
| 2 | View **"Pending Prescriptions"** | Queue of Rx waiting |
| 3 | Find patient's prescription | Rx details shown |
| 4 | Review prescription: | |
| | Drug | Paracetamol 500mg |
| | Quantity | 20 tablets |
| | Dosage | 1 tab 3x daily |
| | Prescribed by | Dr. Idiamin |
| 5 | Click **"Dispense"** | Dispense modal opens |
| 6 | View **Copay Calculation:** | |
| | Drug Cost | AED 45 |
| | Insurance Covers | AED 36 (80%) |
| | **Patient Copay** | **AED 9** |
| 7 | Check inventory | ✅ "In Stock: 500 units" |
| 8 | Select payment method | Cash ○ Card ○ |
| 9 | Click **"Collect Copay"** | 💳 Payment processed |
| 10 | Receipt generated | Shows copay amount |
| 11 | Click **"Complete Dispense"** | ✅ Rx marked DISPENSED |
| 12 | **Inventory updates** | Stock: 500 → 480 |
| 13 | Print medication label | Label with instructions |
| 14 | Hand to patient | Done! |

**What Happens:** Copay collected, medication dispensed, inventory updated, billing recorded.

---

### Edge Case: Drug Out of Stock

| Step | What Happens |
|------|--------------|
| 1 | Pharmacist tries to dispense |
| 2 | ⚠️ Warning: "Out of Stock" |
| 3 | System suggests: "Generic alternative: Paracetamol Generic (AED 30)" |
| 4 | Pharmacist approves substitution |
| 5 | New copay calculated (usually lower) |
| 6 | Dispense alternative |

---

# 👔 ROLE 7: ADMIN / FINANCE

## Login: admin@hospital.com / password123

### What They Do:
- View all invoices
- Process insurance claims
- Handle refunds
- Approve waivers
- Generate reports

---

### Journey 1: View & Manage Invoices

| Step | Click/Action | What They See |
|------|--------------|---------------|
| 1 | Click **"Billing"** in sidebar | Billing Dashboard |
| 2 | View invoice list | All invoices with status |
| 3 | Click on any invoice | **Invoice Detail:** |
| | | - Patient name & MRN |
| | | - Date of service |
| | | - Line items (with CPT codes) |
| | | - Subtotal |
| | | - **VAT (5%)** |
| | | - Total |
| | | - Insurance portion |
| | | - Patient portion |
| 4 | Click **"Print Bilingual"** | Receipt in Arabic + English |

---

### Journey 2: Submit Insurance Claim

| Step | Click/Action | What They See |
|------|--------------|---------------|
| 1 | Click **"Insurance"** in sidebar | Insurance module |
| 2 | View **"Pending Claims"** | Claims ready to submit |
| 3 | Select a claim | Claim details |
| 4 | Click **"Preview DHA XML"** | XML format preview |
| | | - Patient demographics |
| | | - Diagnosis codes (ICD-10) |
| | | - Procedure codes (CPT) |
| | | - Amounts |
| 5 | Click **"Submit to DHA"** | 🔄 Submitting... |
| 6 | Result | ✅ "Claim Submitted" |
| | | Claim #: CLM-2026-XXXX |
| 7 | Track status | Submitted → Under Review → Approved/Denied |

---

### Journey 3: Handle Copay Refund

| Step | Click/Action | What They See |
|------|--------------|---------------|
| 1 | Click **"Copay Refunds"** | Refund requests |
| 2 | View pending refund | Patient overpaid copay |
| 3 | Review details | Original: AED 50, Should be: AED 30 |
| | | Refund: AED 20 |
| 4 | Click **"Approve Refund"** | Refund processed |
| 5 | Patient notified | Refund credited |

---

### Journey 4: Approve Copay Waiver

| Step | Click/Action | What They See |
|------|--------------|---------------|
| 1 | View waiver requests | Pending approvals |
| 2 | Receptionist requested | "Waive copay for patient X" |
| | | Reason: "Financial hardship" |
| 3 | Review patient history | Payment history shown |
| 4 | Click **"Approve"** or **"Deny"** | Decision recorded |
| 5 | Audit trail | Full history maintained |

---

### Journey 5: Handle Insurance Underpayment

| Step | Click/Action | What They See |
|------|--------------|---------------|
| 1 | View **"Payment Reconciliation"** | Payments received |
| 2 | See underpayment alert | ⚠️ "Shortfall: AED 200" |
| | | Claimed: AED 1000 |
| | | Received: AED 800 |
| 3 | Choose action: | |
| | Option A | **Bill Patient** → Supplemental invoice |
| | Option B | **Write Off** → Requires approval |
| | Option C | **Appeal** → Resubmit to insurer |
| 4 | Select "Bill Patient" | Invoice created for AED 200 |
| 5 | Patient notified | "Additional amount due" |

---

# 📊 Summary: Who Does What

| Role | Insurance | Billing | Payments |
|------|-----------|---------|----------|
| **Patient** | View own policy | View invoices | Pay via portal |
| **Receptionist** | Verify at check-in | N/A | Collect copay |
| **Nurse** | N/A | N/A | N/A |
| **Doctor** | See cost estimates | Auto-generates | N/A |
| **Lab Tech** | Capture for walk-ins | Triggers charges | Collect walk-in payment |
| **Pharmacist** | N/A | N/A | Collect drug copay |
| **Admin** | Submit claims | Manage all | Process refunds |

---

# 🎯 Quick Reference: Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@hospital.com | password123 |
| Receptionist | receptionist@hospital.com | password123 |
| Doctor | idiamin@hospital.com | password123 |
| Nurse | nurse.moore@hospital.com | password123 |
| Lab Tech | labtech@hospital.com | password123 |
| Pharmacist | pharmacist@hospital.com | password123 |

| Patient | Email | Scenario |
|---------|-------|----------|
| Fatima | fatima.expired@test.com | 🔴 Expired Insurance |
| Ahmed | ahmed.cob@test.com | 🔵 Dual Insurance |
| Sara | sara.preauth@test.com | 🔵 Pre-Auth Required |
| Anindya | test@spetaar.ai | 🟡 No Insurance |

---

**Document End**

*Created by TeaBot ☕ for Taqon Team*  
*February 5, 2026*
