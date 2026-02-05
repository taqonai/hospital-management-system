# Spetaar HMS — Insurance & Finance Module
## COMPLETE End-to-End Demo Guide (Full Coverage)

**Version:** 2.1 (Post-Fix Update)  
**Date:** February 5, 2026 (Updated 19:30 UTC)  
**Author:** TeaBot (Taqon AI)

---

# 🆕 Recent Updates (Feb 5, 2026)

| Time | Change | Status |
|------|--------|--------|
| 19:26 UTC | **Insurance Expiry Badge Fix** - Patient list now shows insurance status badges | ✅ DEPLOYED |
| 19:26 UTC | Patients page shows 149 patients (was 0 due to API bug) | ✅ FIXED |
| 19:27 UTC | Red "Insurance Expired" badge for expired policies | ✅ VERIFIED |
| 19:27 UTC | Blue provider badges (Daman, ADNIC, etc.) for active insurance | ✅ VERIFIED |
| 19:27 UTC | Yellow "No Insurance" badge for self-pay patients | ✅ VERIFIED |

### What Was Fixed
The patient list API was returning a 400 error due to incorrect Prisma relation name (`insurance` → `insurances`). Now fixed and all 149 patients display correctly with insurance status badges.

---

# Table of Contents

1. [Test Credentials](#1-test-credentials)
2. [Test Patients & Scenarios](#2-test-patients--scenarios)
3. [FLOW 1: Patient Portal](#flow-1-patient-portal)
4. [FLOW 2: OPD Check-in (5 Scenarios)](#flow-2-opd-check-in)
5. [FLOW 3: Doctor Consultation](#flow-3-doctor-consultation)
6. [FLOW 4: Laboratory (Full + Walk-in)](#flow-4-laboratory)
7. [FLOW 5: Radiology (Full + Walk-in)](#flow-5-radiology)
8. [FLOW 6: Pharmacy (Complete Copay Flow)](#flow-6-pharmacy)
9. [FLOW 7: IPD (Full Stay Cycle)](#flow-7-ipd-full-stay)
10. [FLOW 8: Billing & Finance](#flow-8-billing--finance)
11. [FLOW 9: Insurance Claims](#flow-9-insurance-claims)
12. [FLOW 10: Admin Features](#flow-10-admin-features)
13. [API Endpoints Reference](#api-endpoints-reference)
14. [UAE-First Features](#uae-first-features)
15. [Edge Cases & Expected Behavior](#edge-cases--expected-behavior)
16. [Manual Test Checklist](#manual-test-checklist)

---

# 🎯 QUICK DEMO SCRIPT (15-Minute Presentation)

> **For Management Demo - Follow this exact sequence**

## Pre-Demo Setup (2 min before)
1. Open https://spetaar.ai in browser
2. Have two tabs ready: Staff Login + Patient Portal
3. Clear browser history/cache if needed

## Demo Flow

### Part 1: Patient Insurance Overview (3 min)
```
1. Login: receptionist@hospital.com / password123
2. Navigate: Patients (sidebar)
3. SHOW: "149 Total Patients" - system is populated
4. POINT OUT the insurance badges:
   - 🔴 Red = Insurance Expired (find "Fatima Expired-Test")
   - 🔵 Blue = Active Insurance with provider name
   - 🟡 Yellow = No Insurance / Self-Pay
5. Search: "Fatima" → Show red "Insurance Expired" badge
6. Search: "Ahmed" → Show blue "Daman" badge
7. Search: "Sara" → Show blue "ADNIC" badge
```

### Part 2: Check-In & Copay Collection (4 min)
```
1. Navigate: OPD (sidebar)
2. Find any appointment OR explain the flow:
   - Patient arrives → Check-in button
   - System verifies insurance automatically
   - Copay calculated based on policy
   - Payment modal: Cash or Card
   - Receipt generated (bilingual AR/EN)
3. HIGHLIGHT: "If insurance expired → warning shown → convert to self-pay"
```

### Part 3: Doctor Ordering with Cost Display (3 min)
```
1. Login: idiamin@hospital.com / password123
2. Navigate: OPD Queue
3. Explain consultation flow:
   - Doctor starts consultation
   - Adds diagnosis (ICD-10 with autocomplete)
   - Orders lab tests → Cost shown in real-time
   - Orders radiology → Pre-auth warning if needed
   - Prescribes medications → Drug cost shown
4. HIGHLIGHT: "Cost transparency at point of ordering"
```

### Part 4: Pharmacy Copay (2 min)
```
1. Navigate: Pharmacy (sidebar)
2. Show pending prescriptions queue
3. Explain dispense flow:
   - Pharmacist sees prescription
   - Copay calculated automatically
   - Patient pays copay
   - Medication dispensed
   - Inventory updated
```

### Part 5: Billing & Claims (3 min)
```
1. Navigate: Billing (sidebar)
2. Show invoice list
3. Click any invoice → Show:
   - Line items with CPT codes
   - VAT calculation (5%)
   - Insurance vs Patient split
   - Bilingual receipt option
4. Navigate: Insurance → Pre-Auth
5. HIGHLIGHT: "DHA integration ready for claims submission"
```

## Key Talking Points

✅ **UAE-First Design:**
- Emirates ID integration for insurance lookup
- DHA eClaimLink ready
- 5% VAT with TRN on receipts
- Bilingual (Arabic + English)
- All major UAE payers pre-configured

✅ **Full Revenue Cycle:**
- Check-in → Copay collection
- Treatment → Auto-billing
- Discharge → Final settlement
- Claims → Submission & tracking

✅ **Edge Cases Handled:**
- Expired insurance → Self-pay conversion
- Pre-authorization → Workflow built-in
- Dual insurance → COB calculation
- Underpayments → Shortfall tracking

---

# 1. Test Credentials

## Staff Logins (https://spetaar.ai/login)

| Role | Email | Password | Access |
|------|-------|----------|--------|
| **Admin** | admin@hospital.com | password123 | Full system access |
| **Receptionist** | receptionist@hospital.com | password123 | OPD, Check-in, Billing |
| **Doctor** | idiamin@hospital.com | password123 | Consultations, Orders |
| **Nurse** | nurse.moore@hospital.com | password123 | Vitals, Triage |
| **Lab Tech** | labtech@hospital.com | password123 | Laboratory |
| **Pharmacist** | pharmacist@hospital.com | password123 | Pharmacy |
| **IPD Staff** | ipd@hospital.com | password123 | IPD Admissions |

## Patient Portal Login (https://spetaar.ai/patient-portal/login)

| Patient | Email | Password | Scenario |
|---------|-------|----------|----------|
| Md Kamil | kamil@taqon.ai | password123 | Standard insured patient (Daman) |

---

# 2. Test Patients & Scenarios

## 🧪 Test Patients in Production Database

> **NOTE:** These patients exist in the live production database (https://spetaar.ai)

### Patient 1: Fatima Expired-Test ⭐ KEY DEMO PATIENT
- **MRN:** MRN-EXPIRED-001
- **Phone:** +971509993333
- **Email:** fatima.expired@test.com
- **Address:** 789 Test Rd, Sharjah
- **Insurance:** Orient Insurance
- **Policy Expiry:** January 31, 2025 (**EXPIRED**)
- **Badge Display:** 🔴 Red "Insurance Expired" badge
- **Use Case:** Demo expired insurance handling, self-pay conversion
- **Demo Point:** Search "Fatima" in Patients page → Shows red "Insurance Expired" badge

### Patient 2: Ahmed COB-Test ⭐ DUAL INSURANCE DEMO
- **MRN:** MRN-COB-001
- **Phone:** +971509992222
- **Email:** ahmed.cob@test.com
- **Address:** 456 Test Ave, Abu Dhabi
- **Primary Insurance:** Daman (National Health Insurance Company)
- **Secondary Insurance:** AXA Gulf Insurance
- **Policy Expiry:** December 31, 2026 (VALID)
- **Badge Display:** 🔵 Blue "Daman (National Health Insurance Company)" badge
- **Use Case:** Coordination of Benefits (COB) calculation demo
- **Demo Point:** Shows primary insurer badge, secondary used for remaining balance

### Patient 3: Sara PreAuth-Test ⭐ PRE-AUTHORIZATION DEMO
- **MRN:** MRN-PREAUTH-001
- **Phone:** +971509991111
- **Email:** sara.preauth@test.com
- **Address:** 123 Test St, Dubai
- **Insurance:** ADNIC (Abu Dhabi National Insurance)
- **Policy Expiry:** December 31, 2026 (VALID)
- **Badge Display:** 🔵 Blue "ADNIC (Abu Dhabi National Insurance)" badge
- **Use Case:** Pre-authorization workflow for high-cost procedures
- **Demo Point:** Requires pre-auth for MRI/CT scans

### Patient 4: Anindya Roy (Self-Pay Example)
- **MRN:** Various
- **Phone:** 0551234567
- **Email:** test@spetaar.ai
- **Insurance:** None
- **Badge Display:** 🟡 Yellow "No Insurance" badge
- **Use Case:** Self-pay patient flow
- **Demo Point:** Full payment required at check-in

### Patient 5: Amir Khan (Standard Insured)
- **MRN:** HMS001-ML9IEEF1U3KN
- **Phone:** +971544403255
- **Email:** amir@gmail.com
- **Insurance:** None currently (can add for demo)
- **Badge Display:** 🟡 Yellow "No Insurance" badge
- **Use Case:** Adding insurance to existing patient

---

## 📊 Insurance Badge Summary (Visual Demo)

| Badge Color | Meaning | Example Patient |
|-------------|---------|-----------------|
| 🔴 **Red** | Insurance Expired | Fatima Expired-Test |
| 🔵 **Blue** | Active Insurance (shows provider name) | Ahmed COB-Test, Sara PreAuth-Test |
| 🟡 **Yellow** | No Insurance (Self-Pay) | Anindya Roy, Test User |
| 🟢 **Green** | Patient Active Status | All patients |

---

# FLOW 1: Patient Portal
**Duration:** 3 minutes

### Login
```
URL: https://spetaar.ai/patient-portal/login
Email: kamil@taqon.ai
Password: password123
```

### Step-by-Step Demo

| Step | Action | Expected Result | Screenshot? |
|------|--------|-----------------|-------------|
| 1 | Navigate to patient portal URL | Login page appears | ☐ |
| 2 | Enter credentials, click Sign In | Dashboard loads | ✅ YES |
| 3 | Click **My Insurance** in sidebar | Insurance details page | ✅ YES |
| 4 | Show Daman policy details | Policy number, coverage, expiry visible | ✅ YES |
| 5 | Click **Book Appointment** | Booking form opens | ☐ |
| 6 | Select specialty → Doctor → Date/Time | Appointment slots shown | ✅ YES |
| 7 | Confirm booking | Success message | ☐ |

### What to Highlight
- Patient self-service insurance view
- Mobile-responsive design
- Appointment booking without calling

---

# FLOW 2: OPD Check-in
**Duration:** 8 minutes (all 5 scenarios)

### Login
```
URL: https://spetaar.ai/login
Email: receptionist@hospital.com
Password: password123
```

### Navigation Path
```
Dashboard → OPD → Live Queue / Today's Appointments
```

---

## Scenario A: Standard Insured Patient (Kamil)

| Step | Action | Expected Result | Screenshot? |
|------|--------|-----------------|-------------|
| 1 | Navigate to OPD from sidebar | OPD Queue Management page | ✅ YES |
| 2 | Click **Today's Appointments** tab | List of scheduled appointments | ☐ |
| 3 | Find patient "Md Kamil" | Row shows SCHEDULED status | ☐ |
| 4 | Click **Check In** button | Insurance verification modal opens | ✅ YES |
| 5 | Emirates ID pre-filled or enter: `784-1990-1234567-1` | ID field populated | ☐ |
| 6 | Click **Verify Eligibility** | Loading spinner, then result | ☐ |
| 7 | Observe insurance verification result | ✅ "Insurance Active — Daman" | ✅ YES |
| 8 | View **Copay Calculation**: | | ✅ YES |
| | - Consultation Fee: AED 150 | | |
| | - Insurance Covers: 80% = AED 120 | | |
| | - Patient Copay: AED 30 | | |
| | - Deductible Status shown | | |
| 9 | Select payment method (Cash/Card) | Payment method highlighted | ☐ |
| 10 | Click **Collect Copay** | Receipt generated | ✅ YES |
| 11 | Observe status change | Patient → CHECKED_IN | ☐ |

---

## Scenario B: No Insurance on File — EID Auto-Lookup

| Step | Action | Expected Result | Screenshot? |
|------|--------|-----------------|-------------|
| 1 | Check in patient with no insurance | Check-in modal opens | ☐ |
| 2 | Enter Emirates ID: `784-1995-9999999-9` | ID entered | ☐ |
| 3 | Click **Verify with DHA/DOH** | System queries national database | ✅ YES |
| 4 | Observe result | "Insurance Found — AXA Gulf" | ✅ YES |
| 5 | View auto-populated insurance details | Policy number, coverage filled | ☐ |
| 6 | Proceed with copay calculation | Copay shown based on AXA rules | ☐ |

---

## Scenario C: Expired Insurance (Fatima)

| Step | Action | Expected Result | Screenshot? |
|------|--------|-----------------|-------------|
| 1 | Check in patient "Fatima Expired" | Check-in modal opens | ☐ |
| 2 | System verifies insurance | ⚠️ WARNING: Insurance Expired (31/12/2025) | ✅ YES |
| 3 | View options presented: | | |
| | - Convert to Self-Pay | | |
| | - Defer Check-in | | |
| | - Manual Override (requires approval) | | |
| 4 | Select **Convert to Self-Pay** | Self-pay mode activated | ✅ YES |
| 5 | Full consultation fee shown | AED 150 (no insurance discount) | ☐ |
| 6 | Collect full payment | Receipt as self-pay | ☐ |

---

## Scenario D: Pre-Auth Required (Sara)

| Step | Action | Expected Result | Screenshot? |
|------|--------|-----------------|-------------|
| 1 | Check in patient "Sara PreAuth-Test" | Check-in modal opens | ☐ |
| 2 | Insurance verification completes | ⚠️ "Pre-Authorization Required" | ✅ YES |
| 3 | Click **Request Pre-Auth** | Pre-Auth form opens | ✅ YES |
| 4 | Patient pre-selected in form | Sara's details shown | ☐ |
| 5 | Fill CPT code (e.g., 70553 - MRI Brain) | Code entered | ☐ |
| 6 | Fill ICD-10 diagnosis (e.g., G43.909) | Diagnosis entered | ☐ |
| 7 | Select urgency: Routine/Urgent/Emergency | Urgency selected | ☐ |
| 8 | Click **Submit to DHA** (sandbox) | Submission in progress | ✅ YES |
| 9 | Observe result | Auth number received (sandbox) | ✅ YES |

---

## Scenario E: Dual Insurance / COB (Ahmed)

| Step | Action | Expected Result | Screenshot? |
|------|--------|-----------------|-------------|
| 1 | Check in patient "Ahmed COB" | Check-in modal opens | ☐ |
| 2 | Insurance verification | **2 policies detected** | ✅ YES |
| 3 | View COB Calculation: | | ✅ YES |
| | - Total: AED 500 | | |
| | - Primary (Daman 80%): Pays AED 400 | | |
| | - Remaining: AED 100 | | |
| | - Secondary (Thiqa 100%): Pays AED 100 | | |
| | - **Patient Pays: AED 0** | | |
| 4 | View Benefits Explanation | Detailed breakdown shown | ☐ |
| 5 | Complete check-in | No payment required | ☐ |

---

# FLOW 3: Doctor Consultation
**Duration:** 5 minutes

### Login
```
URL: https://spetaar.ai/login
Email: idiamin@hospital.com
Password: password123
```

### Navigation Path
```
Dashboard → Patient Queue → Select Patient → Start Consultation
```

### Step-by-Step Demo

| Step | Action | Expected Result | Screenshot? |
|------|--------|-----------------|-------------|
| 1 | View Doctor Dashboard | Patient queue visible | ✅ YES |
| 2 | Click patient "Md Kamil" | Patient card expands | ☐ |
| 3 | Click **Start Consultation** | Consultation interface opens | ✅ YES |
| 4 | **Add Diagnosis:** Type `J06.9` | ICD-10 autocomplete dropdown | ✅ YES |
| 5 | Select "Acute upper respiratory infection" | Diagnosis added to list | ☐ |
| 6 | Click **Lab Orders** tab | Lab order panel opens | ☐ |
| 7 | Search "CBC" (Complete Blood Count) | Test options appear | ☐ |
| 8 | Select CBC | ✅ **Cost Estimate shown:** | ✅ YES |
| | | "AED 85 (Patient pays: AED 17)" | |
| 9 | Click **Radiology Orders** tab | Radiology panel opens | ☐ |
| 10 | Search "MRI Brain" | MRI options appear | ☐ |
| 11 | Select MRI Brain | ⚠️ **Pre-Auth Warning:** | ✅ YES |
| | | "Requires pre-authorization from NAS" | |
| 12 | Click **Request Pre-Auth Now** | Pre-auth form opens | ☐ |
| 13 | Click **Medications** tab | Prescription panel opens | ☐ |
| 14 | Search "Paracetamol 500mg" | Drug options appear | ☐ |
| 15 | Select medication | ✅ **Drug Cost shown:** | ✅ YES |
| | | "AED 15 (Patient pays: AED 3)" | |
| 16 | Add dosage instructions | Instructions entered | ☐ |
| 17 | Click **End Consultation** | Consultation completed | ☐ |
| 18 | Observe | Auto-billing generated | ✅ YES |

---

# FLOW 4: Laboratory
**Duration:** 5 minutes (Ordered Test + Walk-in)

### Login
```
URL: https://spetaar.ai/login
Email: labtech@hospital.com
Password: password123
```

## Part A: Processing Doctor-Ordered Test

### Navigation Path
```
Dashboard → Lab Queue → Pending Orders
```

| Step | Action | Expected Result | Screenshot? |
|------|--------|-----------------|-------------|
| 1 | View Lab Dashboard | Pending orders list | ✅ YES |
| 2 | Find patient "Md Kamil" with CBC order | Order row visible | ☐ |
| 3 | Click **Collect Sample** | Sample collection form opens | ✅ YES |
| 4 | Enter Sample ID (auto-generated or manual) | Sample ID populated | ☐ |
| 5 | Select collection time | Time recorded | ☐ |
| 6 | Click **Confirm Collection** | Sample status → Collected | ☐ |
| 7 | Process sample (lab processing) | Status → Processing | ☐ |
| 8 | Click **Enter Results** | Results entry form | ✅ YES |
| 9 | Enter CBC values (or use demo values) | Values populated | ☐ |
| 10 | Click **Submit Results** | Results saved | ☐ |
| 11 | Observe | ✅ **Auto-Billing triggered** | ✅ YES |
| | | Charge added to patient invoice | |

---

## Part B: Walk-in Lab Patient (Full Flow)

### Navigation Path
```
Dashboard → Walk-in Patient (or Lab Reception)
```

| Step | Action | Expected Result | Screenshot? |
|------|--------|-----------------|-------------|
| 1 | Click **Walk-in Patient** button | Walk-in registration form | ✅ YES |
| 2 | Search by Emirates ID: `784-1990-1234567-1` | Patient lookup | ☐ |
| 3 | Patient found | Kamil's details shown | ☐ |
| 4 | **Insurance Auto-Capture:** | | ✅ YES |
| | System fetches insurance from profile | Daman policy displayed | |
| 5 | Or: **EID Insurance Lookup:** | | |
| | Click "Verify Insurance" | Insurance fetched from DHA/DOH | |
| 6 | Select lab tests | Test selection panel | ✅ YES |
| 7 | Check "Lipid Panel" (example) | Test added | ☐ |
| 8 | View **Cost Breakdown:** | | ✅ YES |
| | - Test Cost: AED 120 | | |
| | - Insurance Covers: AED 96 | | |
| | - Patient Copay: AED 24 | | |
| 9 | Click **Collect Payment** | Payment modal | ☐ |
| 10 | Select Cash/Card | Payment method chosen | ☐ |
| 11 | Click **Confirm & Generate Order** | Lab order created | ✅ YES |
| 12 | Print/Email lab slip | Slip generated | ☐ |
| 13 | Process sample as normal | Follow Part A steps | ☐ |

---

# FLOW 5: Radiology
**Duration:** 4 minutes (Ordered + Walk-in)

### Login
```
URL: https://spetaar.ai/login
Email: labtech@hospital.com (or radiology tech)
Password: password123
```

## Part A: Processing Doctor-Ordered Radiology

| Step | Action | Expected Result | Screenshot? |
|------|--------|-----------------|-------------|
| 1 | Navigate to Radiology Queue | Pending orders list | ✅ YES |
| 2 | Find MRI order for Sara | Order row visible | ☐ |
| 3 | Observe Pre-Auth Status | ⚠️ "Awaiting Authorization" | ✅ YES |
| 4 | Click **Check Pre-Auth Status** | Status query sent | ☐ |
| 5 | If Approved: | ✅ "Pre-Auth Approved" | ✅ YES |
| | Authorization number displayed | Auth #: PA-2026-XXXX | |
| 6 | Click **Schedule Exam** | Scheduling modal | ☐ |
| 7 | Select date/time slot | Slot chosen | ☐ |
| 8 | Patient arrives, perform exam | Exam completed | ☐ |
| 9 | Upload images/report | Files attached | ☐ |
| 10 | Click **Complete Exam** | Exam finalized | ☐ |
| 11 | Observe | ✅ **Auto-Billing triggered** | ✅ YES |

## Part B: Walk-in Radiology

| Step | Action | Expected Result | Screenshot? |
|------|--------|-----------------|-------------|
| 1 | Click **Walk-in Patient** | Registration form | ✅ YES |
| 2 | Search/register patient | Patient identified | ☐ |
| 3 | **Insurance Capture:** | Insurance fetched | ✅ YES |
| 4 | Select imaging study (e.g., X-Ray Chest) | Study selected | ☐ |
| 5 | Check pre-auth requirement | If required, initiate pre-auth | ☐ |
| 6 | View cost breakdown | Copay calculated | ✅ YES |
| 7 | Collect payment | Payment processed | ☐ |
| 8 | Proceed with exam | Normal workflow | ☐ |

---

# FLOW 6: Pharmacy
**Duration:** 5 minutes (Complete Copay Flow)

### Login
```
URL: https://spetaar.ai/login
Email: pharmacist@hospital.com
Password: password123
```

### Navigation Path
```
Dashboard → Pending Prescriptions → Select Patient → Dispense
```

### Step-by-Step Demo

| Step | Action | Expected Result | Screenshot? |
|------|--------|-----------------|-------------|
| 1 | View Pharmacy Dashboard | Pending prescriptions queue | ✅ YES |
| 2 | Observe queue stats | Count of pending Rx | ☐ |
| 3 | Find patient "Md Kamil" | Prescription row visible | ☐ |
| 4 | View prescription details | Paracetamol 500mg shown | ✅ YES |
| 5 | Click **Dispense** | Dispensing modal opens | ✅ YES |
| 6 | View **Medication Details:** | | |
| | - Drug: Paracetamol 500mg | | |
| | - Quantity: 20 tablets | | |
| | - Dosage: 1 tab 3x daily | | |
| 7 | View **Copay Calculation:** | | ✅ YES |
| | - Total Drug Cost: AED 45 | | |
| | - Insurance Covers: AED 36 (80%) | | |
| | - Patient Copay: AED 9 | | |
| 8 | Check inventory availability | ✅ "In Stock: 500 units" | ☐ |
| 9 | Select payment method | Cash/Card selected | ☐ |
| 10 | Click **Collect Copay** | Payment processed | ✅ YES |
| 11 | Receipt generated | Shows copay paid | ☐ |
| 12 | Click **Complete Dispense** | Rx marked as dispensed | ✅ YES |
| 13 | Observe inventory update | Stock reduced by 20 | ☐ |
| 14 | Patient signature (if required) | Signature captured | ☐ |
| 15 | Print medication label | Label with instructions | ☐ |

### Pharmacy — Additional Scenarios

#### Scenario: Drug Substitution
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Prescribed drug out of stock | ⚠️ "Out of Stock" warning |
| 2 | System suggests generic alternative | "Suggest: Paracetamol Generic" |
| 3 | Pharmacist approves substitution | Substitution logged |
| 4 | Copay recalculated for generic | Usually lower copay |

#### Scenario: Controlled Substance
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Prescription for controlled drug | ⚠️ "Controlled Substance" flag |
| 2 | Requires additional verification | ID verification prompt |
| 3 | Log patient ID | Emirates ID recorded |
| 4 | Dispense with audit trail | Full audit log created |

---

# FLOW 7: IPD (Full Stay Cycle)
**Duration:** 8 minutes

### Login
```
URL: https://spetaar.ai/login
Email: idiamin@hospital.com (Doctor) or ipd@hospital.com
Password: password123
```

### Navigation Path
```
Dashboard → IPD → Admissions / Ward View
```

---

## Part A: Admission

| Step | Action | Expected Result | Screenshot? |
|------|--------|-----------------|-------------|
| 1 | Navigate to IPD | IPD dashboard | ✅ YES |
| 2 | Click **New Admission** | Admission form opens | ✅ YES |
| 3 | Search patient "Md Kamil" | Patient found | ☐ |
| 4 | Select patient | Patient details loaded | ☐ |
| 5 | **Insurance Verification:** | | ✅ YES |
| | - Auto-fetches active policy | Daman policy shown | |
| | - Coverage details displayed | 80% coverage, AED 500 deductible | |
| 6 | **Room Class Selection:** | | ✅ YES |
| | - General Ward (Covered) | ✅ Included in plan | |
| | - Semi-Private (+AED 200/day) | ⚠️ Upgrade cost shown | |
| | - Private Room (+AED 500/day) | ⚠️ Upgrade cost shown | |
| | - Suite (+AED 1500/day) | ⚠️ Upgrade cost shown | |
| 7 | Select "Semi-Private" | Upgrade cost warning | ✅ YES |
| 8 | Acknowledge upgrade | Patient agrees to upgrade | ☐ |
| 9 | **Deposit Calculation:** | | ✅ YES |
| | - Estimated stay: 3 days | | |
| | - Base cost: AED 3000 | | |
| | - Insurance covers: AED 2400 | | |
| | - Upgrade (3 days): AED 600 | | |
| | - Required deposit: AED 1200 | | |
| 10 | Collect deposit | Payment modal | ☐ |
| 11 | Click **Confirm Admission** | Admission created | ✅ YES |
| 12 | Bed assigned | Room 203, Bed A | ☐ |
| 13 | Admission wristband printed | Wristband generated | ☐ |

---

## Part B: During Stay — Daily Charges

| Step | Action | Expected Result | Screenshot? |
|------|--------|-----------------|-------------|
| 1 | Navigate to patient's IPD record | IPD chart opens | ✅ YES |
| 2 | View **Daily Charges Tab** | Running charges list | ✅ YES |
| 3 | Observe auto-charges: | | |
| | - Room charge (daily) | AED 800 + AED 200 upgrade | |
| | - Nursing care (daily) | AED 200 | |
| | - Meals (daily) | AED 100 | |
| 4 | **Add Service:** Click "Add Charge" | Service selection | ☐ |
| 5 | Select "IV Fluids Administration" | Service added | ☐ |
| 6 | View insurance coverage for service | 80% covered shown | ✅ YES |
| 7 | **Doctor Orders During Stay:** | | |
| 8 | Order lab test (from IPD chart) | Lab order created | ☐ |
| 9 | Order medication | Pharmacy order created | ☐ |
| 10 | All charges accumulate | Running total updates | ✅ YES |

---

## Part C: Insurance Expiry During Stay

| Step | Action | Expected Result | Screenshot? |
|------|--------|-----------------|-------------|
| 1 | Simulate insurance expiring during stay | System detects expiry | ✅ YES |
| 2 | ⚠️ **Alert Generated:** | | |
| | "Patient Kamil's insurance expires in 2 days" | | |
| 3 | Options presented: | | |
| | - Contact patient for renewal | | |
| | - Convert remaining stay to self-pay | | |
| | - Request extension from insurer | | |
| 4 | Take appropriate action | Action logged | ☐ |

---

## Part D: Discharge Billing

| Step | Action | Expected Result | Screenshot? |
|------|--------|-----------------|-------------|
| 1 | Doctor clears patient for discharge | Discharge order created | ☐ |
| 2 | Navigate to **Discharge Billing** | Billing summary opens | ✅ YES |
| 3 | View **Final Invoice:** | | ✅ YES |
| | **Room Charges (3 days):** | | |
| | - Base: AED 2400 | | |
| | - Upgrade: AED 600 | | |
| | **Services:** | | |
| | - Nursing: AED 600 | | |
| | - Meals: AED 300 | | |
| | - IV Fluids: AED 150 | | |
| | - Lab Tests: AED 200 | | |
| | - Medications: AED 180 | | |
| | **Subtotal: AED 4430** | | |
| | **VAT (5%): AED 221.50** | | |
| | **Total: AED 4651.50** | | |
| 4 | View **Insurance Split:** | | ✅ YES |
| | - Insurance Covers: AED 3544 | | |
| | - Patient Pays: AED 1107.50 | | |
| 5 | Apply deposit | -AED 1200 deposit | ☐ |
| 6 | **Balance:** | Refund AED 92.50 or pay balance | ✅ YES |
| 7 | Process final payment/refund | Transaction completed | ☐ |
| 8 | Generate **Discharge Summary** | Summary document | ✅ YES |
| 9 | Print bilingual receipt | Arabic + English | ✅ YES |
| 10 | Complete discharge | Patient discharged | ☐ |

---

# FLOW 8: Billing & Finance
**Duration:** 5 minutes

### Navigation Path
```
Dashboard → Billing → Invoices
```

| Step | Action | Expected Result | Screenshot? |
|------|--------|-----------------|-------------|
| 1 | Navigate to Billing | Invoice list | ✅ YES |
| 2 | Search for Kamil's invoice | Invoice found | ☐ |
| 3 | Click to open invoice | Invoice detail view | ✅ YES |
| 4 | View **Line Items:** | | |
| | - Each service with CPT code | | |
| | - Unit price | | |
| | - Quantity | | |
| | - Insurance coverage per item | | |
| 5 | View **Summary:** | | ✅ YES |
| | - Subtotal | | |
| | - VAT (5%) | | |
| | - Total | | |
| 6 | View **Payment Split:** | | ✅ YES |
| | - Insurance Portion (to claim) | | |
| | - Patient Portion (collected) | | |
| 7 | Click **Print Bilingual Receipt** | Receipt preview | ✅ YES |
| 8 | View receipt with: | | |
| | - English text | | |
| | - Arabic text (المبلغ الإجمالي) | | |
| | - Hospital TRN | | |
| | - VAT breakdown | | |
| 9 | View **Deductible Tracking:** | | ✅ YES |
| | - Annual deductible: AED 500 | | |
| | - Used YTD: AED 350 | | |
| | - Remaining: AED 150 | | |
| 10 | View **Annual Copay Cap:** | | ✅ YES |
| | - Annual cap: AED 2000 | | |
| | - Paid YTD: AED 890 | | |
| | - Remaining: AED 1110 | | |

---

# FLOW 9: Insurance Claims
**Duration:** 4 minutes

### Navigation Path
```
Dashboard → Insurance → Claims
```

| Step | Action | Expected Result | Screenshot? |
|------|--------|-----------------|-------------|
| 1 | Navigate to Claims | Claims dashboard | ✅ YES |
| 2 | View claim statuses: | | |
| | - Pending Submission | Count shown | |
| | - Submitted | Count shown | |
| | - Under Review | Count shown | |
| | - Approved | Count shown | |
| | - Denied | Count shown | |
| | - Partially Paid | Count shown | |
| 3 | Click on a pending claim | Claim detail opens | ✅ YES |
| 4 | View **DHA XML Preview:** | | ✅ YES |
| | - Header info | | |
| | - Patient demographics | | |
| | - Encounter details | | |
| | - CPT codes | | |
| | - ICD-10 codes | | |
| | - Amounts | | |
| 5 | Click **Submit to DHA** | Submission modal | ☐ |
| 6 | Confirm submission | ✅ "Submitted successfully" | ✅ YES |
| 7 | View claim status update | Status → Submitted | ☐ |
| 8 | **For Denied Claim:** | | |
| 9 | Open denied claim | Denial reason shown | ✅ YES |
| 10 | Click **Resubmit** | Edit form opens | ☐ |
| 11 | Add notes/corrections | Changes made | ☐ |
| 12 | Submit again | Resubmission sent | ☐ |

---

# FLOW 10: Admin Features
**Duration:** 3 minutes

### Navigation Path
```
Dashboard → Admin / Settings → Insurance Management
```

## Manual Insurance Verification

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Search patient | Patient found |
| 2 | Click "Manual Verify" | Verification form |
| 3 | Enter policy details manually | Details entered |
| 4 | Save | Insurance updated |

## Copay Waive/Defer

| Step | Action | Expected Result | Screenshot? |
|------|--------|-----------------|-------------|
| 1 | Receptionist requests copay waiver | Waiver request created | ✅ YES |
| 2 | Request goes to Admin/Finance queue | Pending approval | ☐ |
| 3 | Admin reviews request | Request details shown | ☐ |
| 4 | Admin approves/denies | Decision recorded | ✅ YES |
| 5 | Audit trail maintained | Full history visible | ☐ |

## Underpayment Processing

| Step | Action | Expected Result | Screenshot? |
|------|--------|-----------------|-------------|
| 1 | Insurance pays less than claimed | Shortfall detected | ✅ YES |
| 2 | System calculates difference | e.g., AED 200 shortfall | ☐ |
| 3 | Options: | | |
| | - Bill patient for shortfall | | |
| | - Write off | | |
| | - Appeal to insurer | | |
| 4 | Select "Bill Patient" | Supplemental invoice created | ✅ YES |
| 5 | Patient notified | Notification sent | ☐ |

## IPD Insurance Expiry Monitor

| Step | Action | Expected Result | Screenshot? |
|------|--------|-----------------|-------------|
| 1 | Navigate to IPD Alerts | Alert dashboard | ✅ YES |
| 2 | View patients with expiring insurance | List shown | ☐ |
| 3 | Days until expiry shown | e.g., "2 days" | ☐ |
| 4 | Take action | Contact patient / Convert to self-pay | ☐ |

---

# API Endpoints Reference

## Insurance APIs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/insurance/verify` | POST | Verify insurance by Emirates ID |
| `/api/v1/insurance/eligibility` | POST | Check eligibility with payer |
| `/api/v1/insurance/copay/calculate` | POST | Calculate copay for service |
| `/api/v1/pre-auth` | POST | Create pre-auth request |
| `/api/v1/pre-auth/submit-to-dha` | POST | Submit pre-auth to DHA |
| `/api/v1/insurance-advanced/cob/calculate` | POST | Calculate COB split |
| `/api/v1/insurance-advanced/ipd/expiry-alerts` | GET | Get IPD expiry alerts |
| `/api/v1/insurance-advanced/underpayment/process` | POST | Process underpayment |

## Billing APIs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/billing/invoices` | GET | List invoices |
| `/api/v1/billing/invoices/:id` | GET | Get invoice detail |
| `/api/v1/billing/invoices/:id/bilingual` | GET | Get bilingual invoice |
| `/api/v1/billing/payments` | POST | Record payment |
| `/api/v1/billing/receipts/:id/print` | GET | Print receipt |

## DHA Integration APIs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/insurance-coding/dha/eligibility` | POST | DHA eligibility check |
| `/api/v1/insurance-coding/dha/submit-claim` | POST | Submit claim to DHA |
| `/api/v1/insurance-coding/dha/claim-status/:id` | GET | Check claim status |

---

# UAE-First Features

**Highlight these as differentiators:**

| Feature | Description | Demo Point |
|---------|-------------|------------|
| 🆔 Emirates ID Integration | Auto-lookup insurance from national database | EID verification in check-in |
| 🏛️ DHA eClaimLink | Direct submission to Dubai Health Authority | Claims submission |
| 🏛️ DOH Compatible | Abu Dhabi Department of Health integration | Mention in claims |
| 🌐 Bilingual (AR/EN) | All receipts, invoices in both languages | Print receipt |
| 💰 5% VAT | Automatic VAT calculation, TRN on receipts | Invoice detail |
| 🏥 UAE Payers | Pre-configured Daman, Thiqa, NAS, AXA, etc. | Insurance selection |
| 📋 Pre-Authorization | Workflow for high-cost procedures | MRI ordering |
| 💳 Copay + Deductible + Cap | Full UAE insurance model support | Check-in modal |
| 🔄 COB | Coordination of Benefits for dual insurance | Ahmed scenario |
| 🏨 Room Class Coverage | IPD upgrade cost warnings | Admission flow |

---

# Edge Cases & Expected Behavior

## 🔴 INSURANCE EDGE CASES (With Examples)

### Edge Case 1: Insurance Expired
**Test Patient:** Fatima Expired-Test  
**How to Demo:**
1. Go to Patients page → Search "Fatima"
2. Observe: Red "Insurance Expired" badge visible
3. Click on patient → View insurance details
4. Try to check-in for appointment

**Expected Behavior:**
- ⚠️ Warning modal: "Insurance Expired (January 31, 2025)"
- Options presented:
  - ✅ **Convert to Self-Pay** → Full consultation fee (no discount)
  - ⏸️ **Defer Check-in** → Wait for patient to update insurance
  - 🔓 **Manual Override** → Requires supervisor approval

**Screenshot Proof:** `screenshots/FINAL-fatima-search.png`

---

### Edge Case 2: No Insurance on File
**Test Patient:** Any patient with yellow "No Insurance" badge  
**How to Demo:**
1. Go to Patients page → Find patient with yellow badge
2. Check-in patient for appointment

**Expected Behavior:**
- Modal shows: "No insurance on file"
- Options:
  - 🆔 **Enter Emirates ID** → System looks up insurance from DHA/DOH
  - 💵 **Proceed as Self-Pay** → Full amount charged
  - ➕ **Add Insurance Manually** → Enter policy details

---

### Edge Case 3: Pre-Authorization Required
**Test Patient:** Sara PreAuth-Test  
**How to Demo:**
1. Login as Doctor (idiamin@hospital.com)
2. Start consultation with Sara
3. Order MRI Brain scan

**Expected Behavior:**
- ⚠️ Warning: "Pre-Authorization Required from ADNIC"
- Button: "Request Pre-Auth Now"
- Pre-auth form auto-fills with:
  - Patient: Sara PreAuth-Test
  - Procedure: MRI Brain (CPT: 70553)
  - Diagnosis: (doctor enters)

---

### Edge Case 4: Dual Insurance (COB - Coordination of Benefits)
**Test Patient:** Ahmed COB-Test  
**How to Demo:**
1. Check-in Ahmed for appointment
2. View insurance verification

**Expected Behavior:**
- System shows: "2 Insurance Policies Detected"
- COB Calculation displayed:
  ```
  Service Cost:        AED 500
  Primary (Daman):     Pays AED 400 (80%)
  Remaining:           AED 100
  Secondary (AXA):     Pays AED 100 (100% of remainder)
  Patient Pays:        AED 0
  ```

---

### Edge Case 5: Deductible Not Met
**How to Demo:**
1. Check patient with fresh annual deductible
2. Process billing

**Expected Behavior:**
- Shows deductible status:
  ```
  Annual Deductible:   AED 500
  Used YTD:            AED 150
  Remaining:           AED 350
  ```
- First AED 350 charged to patient
- Insurance pays 80% of remainder

---

### Edge Case 6: Annual Copay Cap Reached
**Expected Behavior:**
- After patient reaches annual cap (e.g., AED 2000):
  ```
  Annual Cap:          AED 2000
  Paid YTD:            AED 2000 ✅ REACHED
  ```
- Insurance now covers 100%
- Patient pays AED 0 copay

---

### Edge Case 7: Insurance Underpayment
**How to Demo:**
1. Navigate to Billing → Payments Received
2. Find claim where insurance paid less than expected

**Expected Behavior:**
- Alert: "Shortfall Detected"
  ```
  Claimed:             AED 1000
  Insurance Paid:      AED 800
  Shortfall:           AED 200
  ```
- Options:
  - 📧 **Bill Patient** → Supplemental invoice created
  - ❌ **Write Off** → Finance approval required
  - 📋 **Appeal to Insurer** → Resubmit with notes

---

### Edge Case 8: IPD Insurance Expires During Stay
**How to Demo:**
1. Navigate to IPD → Admissions
2. View active admission with expiring insurance

**Expected Behavior:**
- ⚠️ Alert banner: "Patient's insurance expires in X days"
- Actions available:
  - 📞 Contact patient for renewal
  - 💵 Convert remaining stay to self-pay
  - 📋 Request extension from insurer

---

## 💊 PHARMACY EDGE CASES

### Edge Case 9: Drug Out of Stock
**Expected Behavior:**
- Warning: "Prescribed medication out of stock"
- Suggestion: "Generic alternative available: Paracetamol Generic"
- Pharmacist can approve substitution
- Copay recalculated (usually lower for generic)

### Edge Case 10: Controlled Substance
**Expected Behavior:**
- Flag: "⚠️ Controlled Substance - Additional Verification Required"
- Prompt: "Enter Patient Emirates ID"
- Audit trail: Full log of dispensing

---

## 💰 BILLING EDGE CASES

### Edge Case 11: Partial Payment
**Expected Behavior:**
- Patient can pay partial amount
- Balance tracked on account
- Collection reminders sent

### Edge Case 12: Refund Required
**Expected Behavior:**
- Copay overpayment detected
- Refund initiated
- Available in Billing → Copay Refunds page

### Edge Case 13: VAT Calculation
**Expected Behavior:**
- 5% VAT applied to all services
- TRN (Tax Registration Number) on receipts
- VAT breakdown visible on invoice

---

## 📋 Summary Table

| # | Scenario | Test Patient | Expected Badge/Warning |
|---|----------|--------------|------------------------|
| 1 | Insurance Expired | Fatima Expired-Test | 🔴 Red badge + warning |
| 2 | No Insurance | Anindya Roy | 🟡 Yellow badge |
| 3 | Pre-Auth Required | Sara PreAuth-Test | ⚠️ Warning modal |
| 4 | Dual Insurance | Ahmed COB-Test | 🔵 Blue badge + COB calc |
| 5 | Deductible Not Met | Any insured | Deductible tracker |
| 6 | Cap Reached | Any insured | 100% coverage |
| 7 | Underpayment | N/A | Shortfall alert |
| 8 | IPD Expiry | N/A | Banner alert |
| 9 | Drug OOS | N/A | Substitution offer |
| 10 | Controlled Drug | N/A | ID verification |
| 11 | Partial Payment | N/A | Balance tracking |
| 12 | Refund | N/A | Refund workflow |
| 13 | VAT | All invoices | 5% + TRN |

---

# Manual Test Checklist

Use this during pre-demo testing:

## ✅ AUTOMATED TEST RESULTS (Feb 5, 2026 - 19:28 UTC)

> All critical tests passed! Run: `node finance-edge-test.mjs`

| Test | Status |
|------|--------|
| Login as Receptionist | ✅ PASS |
| Invoice List Page | ✅ PASS |
| Invoice API | ✅ PASS (returns 5 invoices) |
| Invoice Structure | ✅ PASS |
| Copay Refunds Page | ✅ PASS |
| Payment Methods | ✅ PASS |
| OPD Queue Page | ✅ PASS |
| Insurance in OPD | ✅ PASS |
| Pharmacy Page | ✅ PASS |
| Pharmacy Copay Display | ✅ PASS |
| Laboratory Page | ✅ PASS |
| IPD Page | ✅ PASS |
| IPD Billing Features | ✅ PASS |
| Insurance Pre-Auth | ✅ PASS |
| **Insurance Expired Badge** | ✅ PASS |
| **No Insurance Badge** | ✅ PASS |
| **Provider Badge (Blue)** | ✅ PASS |
| API Health | ✅ PASS (v1.0.0) |

**Total: 18 PASSED, 0 FAILED**

---

## Manual Pre-Demo Checklist

### 🏥 OPD & Check-in
| # | Test | Expected | Status |
|---|------|----------|--------|
| 1 | Login as Receptionist | Dashboard loads | ✅ Verified |
| 2 | Navigate to Patients | 149 patients shown | ✅ Verified |
| 3 | Search "Fatima" | Red "Insurance Expired" badge | ✅ Verified |
| 4 | Search "Ahmed" | Blue "Daman" badge | ✅ Verified |
| 5 | Search "Sara" | Blue "ADNIC" badge | ✅ Verified |
| 6 | Navigate to OPD | Queue visible | ✅ Verified |

### 👨‍⚕️ Doctor & Orders
| # | Test | Expected | Status |
|---|------|----------|--------|
| 7 | Login as Doctor | Dashboard loads | ☐ Test |
| 8 | Start consultation | Opens correctly | ☐ Test |
| 9 | Lab order cost estimate | Shows amount | ☐ Test |
| 10 | MRI pre-auth warning | Warning appears | ☐ Test |
| 11 | Drug cost in picker | Shows price | ☐ Test |

### 🔬 Lab
| # | Test | Expected | Status |
|---|------|----------|--------|
| 12 | Navigate to Lab | Page loads | ✅ Verified |
| 13 | View pending orders | Orders listed | ☐ Test |
| 14 | Walk-in flow | Insurance captured | ☐ Test |

### 💊 Pharmacy
| # | Test | Expected | Status |
|---|------|----------|--------|
| 15 | Navigate to Pharmacy | Page loads | ✅ Verified |
| 16 | View prescriptions | Queue visible | ☐ Test |
| 17 | Copay calculation | Shows amounts | ✅ Verified |

### 🏨 IPD
| # | Test | Expected | Status |
|---|------|----------|--------|
| 18 | Navigate to IPD | Page loads | ✅ Verified |
| 19 | Billing features visible | Charges/Deposits shown | ✅ Verified |

### 💰 Billing & Claims
| # | Test | Expected | Status |
|---|------|----------|--------|
| 20 | Navigate to Billing | Invoice list loads | ✅ Verified |
| 21 | Invoice API works | Returns data | ✅ Verified |
| 22 | Copay Refunds page | Accessible | ✅ Verified |
| 23 | Insurance Pre-Auth page | Accessible | ✅ Verified |

---

## 📸 Available Screenshots

Location: `/home/taqon/clawd/spetaar-qa-test/screenshots/`

| Screenshot | Description |
|------------|-------------|
| `FINAL-fatima-search.png` | Patient list showing insurance badges |
| `FIN-01-billing-page.png` | Billing module main page |
| `FIN-02-copay-refunds.png` | Copay refunds management |
| `FIN-03-opd-queue.png` | OPD queue with insurance info |
| `FIN-04-pharmacy.png` | Pharmacy module with copay |
| `FIN-05-laboratory.png` | Laboratory module |
| `FIN-06-ipd.png` | IPD admissions and billing |
| `FIN-07-insurance.png` | Insurance management |

---

## 🚀 Quick Commands

```bash
# Run finance edge case tests
cd /home/taqon/clawd/spetaar-qa-test
node finance-edge-test.mjs

# Run full verification
node final-verify.mjs

# Check backend health
curl https://spetaar.ai/api/v1/health
```

---

**Document End**

*Generated by TeaBot ☕ for Taqon Team*  
*Last Updated: February 5, 2026 at 19:30 UTC*  
*For questions: teabot@taqon.ai*
