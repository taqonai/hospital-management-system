# Spetaar HMS — Insurance & Finance Module
## Complete Demo Guide & Documentation

**Version:** 1.0  
**Date:** February 5, 2026  
**Author:** TeaBot (Taqon AI)

---

# Table of Contents

1. [Test Credentials](#1-test-credentials)
2. [Test Patients & Scenarios](#2-test-patients--scenarios)
3. [Demo Flow Scripts](#3-demo-flow-scripts)
4. [API Endpoints Reference](#4-api-endpoints-reference)
5. [UAE-First Features](#5-uae-first-features)
6. [Edge Cases & Expected Behavior](#6-edge-cases--expected-behavior)
7. [Demo Tips & Recommendations](#7-demo-tips--recommendations)
8. [Troubleshooting](#8-troubleshooting)

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
| Md Kamil | kamil@taqon.ai | password123 | **Standard insured patient** (Daman) |

---

# 2. Test Patients & Scenarios

## Patient: Md Kamil (Primary Test Patient)
- **MRN:** Auto-assigned
- **Emirates ID:** 784-1990-1234567-1
- **Insurance:** Daman (National Health Insurance)
- **Policy:** TEST-POL-001
- **Coverage:** Enhanced
- **Copay:** AED 20 fixed + 20% coinsurance
- **Deductible:** AED 500 annual
- **Use Case:** Standard OPD flow, copay collection, lab orders

## Patient: Sara PreAuth-Test
- **Emirates ID:** 784-1995-9876543-2
- **Insurance:** NAS
- **Pre-Auth Required:** YES for radiology
- **Use Case:** Pre-authorization workflow demo

## Patient: Fatima Expired
- **Emirates ID:** 784-1988-5555555-3
- **Insurance:** Expired on 2025-12-31
- **Use Case:** Expired insurance handling, convert to self-pay

## Patient: Ahmed COB
- **Emirates ID:** 784-1992-1111111-4
- **Primary Insurance:** Daman (80% coverage)
- **Secondary Insurance:** Thiqa (100% coverage)
- **Use Case:** Dual insurance / COB calculation

## Patient: Walk-in Self-Pay
- **No insurance on file**
- **Use Case:** Cash patient, no EID lookup

---

# 3. Demo Flow Scripts

## FLOW 1: Patient Portal (3 minutes)

### Login Path
```
https://spetaar.ai/patient-portal/login
Email: kamil@taqon.ai
Password: password123
```

### Demo Steps
1. **Login** → Patient Portal dashboard appears
2. **My Insurance** (sidebar) → View current insurance on file
   - Show Daman policy details
   - Show coverage summary
3. **Book Appointment** → Select specialty, doctor, date/time
4. **[SCREENSHOT PLACEHOLDER: Patient Portal Dashboard]**
5. **[SCREENSHOT PLACEHOLDER: Insurance Details View]**

### What to Highlight
- Patient can see their insurance status before visiting
- Self-service appointment booking
- Mobile-responsive design

---

## FLOW 2: OPD Check-in — Receptionist (8 minutes)

### Login Path
```
https://spetaar.ai/login
Email: receptionist@hospital.com
Password: password123
```

### Scenario A: Insured Patient (Kamil) — Standard Flow

**Click Path:**
```
Dashboard → OPD / Reception → Live Queue → Today's Appointments → 
Find Kamil → Click "Check In" → Copay Modal appears
```

**Demo Steps:**
1. Navigate to **OPD** or **Reception** from sidebar
2. Click **Today's Appointments** or **Live Queue**
3. Find patient "Md Kamil" with **SCHEDULED** status
4. Click **Check In** button
5. **Insurance Verification Modal** appears automatically:
   - Emirates ID: Pre-filled or enter `784-1990-1234567-1`
   - Click **Verify Eligibility**
   - ✅ Shows: "Insurance Active — Daman"
6. **Copay Calculation** shown:
   - Consultation Fee: AED 150
   - Insurance Covers: 80% = AED 120
   - Patient Copay: 20% = AED 30
   - Deductible Status: AED 200/500 used
7. **Payment Collection:**
   - Select payment method (Cash/Card)
   - Click **Collect Copay**
8. Patient moves to **CHECKED_IN** status

**[SCREENSHOT PLACEHOLDER: Copay Collection Modal]**

### Scenario B: No Insurance on File — EID Lookup

**Demo Steps:**
1. Check in patient with no insurance
2. Enter Emirates ID: `784-1995-9999999-9`
3. Click **Verify with DHA/DOH**
4. System returns: "Insurance Found — AXA Gulf"
5. **Auto-populate** insurance details
6. Proceed with copay calculation

### Scenario C: Expired Insurance (Fatima)

**Demo Steps:**
1. Check in patient "Fatima Expired"
2. System shows ⚠️ **WARNING: Insurance Expired**
3. Options presented:
   - Convert to Self-Pay
   - Defer Check-in
   - Manual Override (requires approval)
4. Select **Convert to Self-Pay**
5. Full consultation fee shown: AED 150

### Scenario D: Pre-Auth Required (Sara)

**Demo Steps:**
1. Check in patient "Sara PreAuth-Test"
2. After insurance verification:
   - ⚠️ "Pre-Authorization Required for this visit"
3. Click **Request Pre-Auth**
4. Pre-Auth form opens with patient pre-selected
5. Fill: CPT code, ICD-10 diagnosis, urgency
6. Submit to DHA (sandbox) or Save for manual follow-up

### Scenario E: Dual Insurance / COB (Ahmed)

**Demo Steps:**
1. Check in patient "Ahmed COB"
2. System detects **2 insurance policies**
3. COB Calculation shown:
   - Total: AED 500
   - Primary (Daman 80%): Pays AED 400
   - Remaining: AED 100
   - Secondary (Thiqa 100%): Pays AED 100
   - Patient Pays: AED 0
4. Shows **Benefits Explanation** breakdown

---

## FLOW 3: Doctor Consultation (5 minutes)

### Login Path
```
https://spetaar.ai/login
Email: idiamin@hospital.com
Password: password123
```

**Click Path:**
```
Dashboard → Patient Queue → Select Patient → Start Consultation
```

### Demo Steps

1. **Dashboard** shows patient queue
2. Click patient "Md Kamil" → Open consultation
3. **Add Diagnosis:**
   - Type `J06.9` (Acute upper respiratory infection)
   - ICD-10 autocomplete appears
4. **Order Lab Test:**
   - Click **Lab Orders** tab
   - Select "Complete Blood Count (CBC)"
   - ✅ **Cost Estimate appears:** "AED 85 (Patient pays: AED 17)"
5. **Order MRI (Pre-Auth Demo):**
   - Click **Radiology Orders** tab
   - Search "MRI Brain"
   - ⚠️ **Pre-Auth Warning appears:** "This procedure requires pre-authorization from NAS"
   - Option to: Request Pre-Auth Now / Proceed Anyway / Cancel
6. **Prescribe Medication:**
   - Click **Medications** tab
   - Search "Paracetamol 500mg"
   - ✅ **Drug Cost shown:** "AED 15 (Patient pays: AED 3)"
7. **End Consultation** → Auto-generates billing

**[SCREENSHOT PLACEHOLDER: Lab Order with Cost Estimate]**
**[SCREENSHOT PLACEHOLDER: Pre-Auth Warning for MRI]**

---

## FLOW 4: Laboratory (3 minutes)

### Login Path
```
Email: labtech@hospital.com
Password: password123
```

**Click Path:**
```
Dashboard → Lab Queue → Pending Orders → Process Sample
```

### Demo Steps

1. **Lab Dashboard** shows pending orders
2. Find patient "Md Kamil" with CBC order
3. Click **Collect Sample**
4. Enter sample ID, collection time
5. Click **Submit Results** (or auto-generate)
6. ✅ **Auto-Billing triggered** — charge added to invoice

### Walk-in Lab Demo

1. Click **Walk-in Patient**
2. Search by Emirates ID
3. **Insurance Capture:** System fetches insurance
4. Select tests → Shows cost breakdown
5. Collect payment / Bill to insurance

---

## FLOW 5: Radiology (3 minutes)

### Login Path
```
Email: labtech@hospital.com (or radiology tech)
Password: password123
```

### Demo Steps

1. **Radiology Queue** shows pending orders
2. Find MRI order for Sara
3. ⚠️ **Pre-Auth Check:** "Awaiting Authorization"
4. Click **Check Pre-Auth Status**
5. If approved: Proceed with exam
6. After exam: **Auto-billing** triggers

---

## FLOW 6: Pharmacy (3 minutes)

### Login Path
```
Email: pharmacist@hospital.com
Password: password123
```

**Click Path:**
```
Dashboard → Pending Prescriptions → Dispense
```

### Demo Steps

1. **Pharmacy Queue** shows pending prescriptions
2. Find patient "Md Kamil"
3. Click **Dispense**
4. **Copay Modal appears:**
   - Total Drug Cost: AED 45
   - Insurance Covers: AED 36
   - Patient Copay: AED 9
5. Collect payment
6. Click **Complete Dispense**
7. ✅ Inventory updated, prescription marked complete

---

## FLOW 7: IPD Admission (5 minutes)

### Login Path
```
Email: idiamin@hospital.com (Doctor) or ipd@hospital.com
Password: password123
```

**Click Path:**
```
Dashboard → IPD → New Admission
```

### Demo Steps

1. **Search Patient** → Select Kamil
2. **Insurance Verification:**
   - Auto-fetches active policy
   - Shows coverage details
3. **Room Class Selection:**
   - General Ward (Covered)
   - Private Room (+AED 500/day upgrade)
   - Suite (+AED 1500/day upgrade)
4. ⚠️ If upgrade selected: **Cost Warning** shown
5. **Deposit Collection:**
   - Estimated stay: 3 days
   - Required deposit: AED 5000
6. Click **Confirm Admission**
7. Daily charges auto-accrue

### During Stay
- Services added (meals, nursing, procedures)
- Each service shows insurance coverage

### Discharge Billing
- **Final Invoice** consolidates all charges
- Shows insurance vs patient split
- Deposit applied
- Balance due or refund calculated

---

## FLOW 8: Billing & Finance (5 minutes)

**Click Path:**
```
Dashboard → Billing → Invoices
```

### Demo Steps

1. **Find Invoice** for Kamil
2. **Invoice Details:**
   - Line items with CPT codes
   - Insurance breakdown per item
   - Subtotal / VAT (5%) / Total
3. **Payment Split:**
   - Insurance Portion: AED X (to be claimed)
   - Patient Portion: AED Y (collected)
4. **Print Bilingual Receipt:**
   - English + Arabic
   - Hospital TRN shown
   - VAT breakdown
5. **Deductible Tracking:**
   - Annual deductible: AED 500
   - Used YTD: AED 350
   - Remaining: AED 150

**[SCREENSHOT PLACEHOLDER: Invoice with VAT]**
**[SCREENSHOT PLACEHOLDER: Bilingual Receipt]**

---

## FLOW 9: Insurance Claims (4 minutes)

**Click Path:**
```
Dashboard → Insurance → Claims
```

### Demo Steps

1. **Claims Dashboard** shows:
   - Pending Submission
   - Submitted
   - Under Review
   - Approved / Denied / Partially Paid
2. **View Claim Detail:**
   - DHA XML format preview
   - CPT codes, ICD-10 codes
   - Amounts claimed
3. **Submit to DHA:**
   - Click **Submit Batch**
   - Sandbox mode: Instant response
4. **Resubmission Workflow:**
   - For denied claims
   - Edit, add notes, resubmit

**[SCREENSHOT PLACEHOLDER: Claims Dashboard]**

---

## FLOW 10: Admin Features (3 minutes)

### Manual Insurance Verification
- Admin can manually verify/override insurance status
- Useful for system sync issues

### Copay Waive/Defer
- Receptionist requests waiver
- Admin/Finance approves
- Audit trail maintained

### Underpayment Processing
- When insurance pays less than expected
- Generate patient supplemental bill
- Track collection

### IPD Expiry Monitor
- Dashboard shows patients whose insurance expires during stay
- Auto-alerts for renewal needed

---

# 4. API Endpoints Reference

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

# 5. UAE-First Features

**Highlight these as differentiators:**

1. ✅ **Emirates ID Integration** — Auto-lookup insurance from national database
2. ✅ **DHA eClaimLink Ready** — Direct submission to Dubai Health Authority
3. ✅ **DOH Integration Ready** — Abu Dhabi Department of Health compatible
4. ✅ **Arabic + English Bilingual** — All receipts, invoices support both
5. ✅ **5% VAT Compliance** — Automatic VAT calculation, TRN on receipts
6. ✅ **UAE Insurance Payers** — Pre-configured Daman, Thiqa, NAS, AXA, etc.
7. ✅ **Pre-Authorization Workflow** — For high-cost procedures (MRI, CT, surgeries)
8. ✅ **Copay + Deductible + Annual Cap** — Full UAE insurance model support
9. ✅ **COB (Coordination of Benefits)** — Dual insurance handling
10. ✅ **Room Class Coverage** — IPD upgrade cost warnings

---

# 6. Edge Cases & Expected Behavior

| Scenario | Expected Behavior |
|----------|-------------------|
| **Insurance expired** | ⚠️ Warning shown, options: Self-pay / Override |
| **No insurance on file** | Prompt for Emirates ID lookup or self-pay |
| **Pre-auth required** | ⚠️ Warning with "Request Pre-Auth" button |
| **Pre-auth denied** | Block procedure or allow with patient consent |
| **Deductible not met** | Full amount charged until deductible reached |
| **Annual cap reached** | Insurance stops paying, patient pays remainder |
| **Dual insurance** | COB calculation, primary billed first |
| **Insurance underpays** | Shortfall billed to patient separately |
| **IPD insurance expires** | Alert generated, renewal workflow triggered |

---

# 7. Demo Tips & Recommendations

## What to Highlight
- Real-time eligibility verification
- Transparent cost estimates before ordering
- Arabic/English bilingual support
- VAT compliance built-in
- Pre-auth workflow (UAE differentiator)

## Recommended Demo Order for Impact
1. **Patient Portal** (quick, impressive self-service)
2. **OPD Check-in** (core flow, show EID lookup)
3. **Doctor Consultation** (cost estimates, pre-auth warning)
4. **Billing Invoice** (bilingual, VAT)
5. **Claims Dashboard** (DHA integration)

## What to Skip if Short on Time
- Lab walk-in flow (similar to OPD)
- IPD full stay (just show admission)
- Pharmacy (similar copay flow to OPD)

## Features to Avoid Showing (Known Issues)
- ⚠️ Pre-Auth form cancel button may have issues (under investigation)
- ⚠️ Some Playwright tests fail on localhost (production is stable)

---

# 8. Troubleshooting

## Common Issues

**Q: Insurance verification returns "Not Found"**
A: Check Emirates ID format (784-YYYY-NNNNNNN-C), ensure sandbox mode is enabled

**Q: Copay not calculating**
A: Ensure ICD-10 code is added to consultation, check payer rules exist

**Q: Pre-auth form not closing**
A: Refresh page, check browser console for JS errors

**Q: DHA submission fails**
A: Check sandbox mode enabled, verify credentials in admin settings

---

# Manual Test Checklist

Use this during pre-demo testing:

| # | Test | Expected | Actual | Pass? |
|---|------|----------|--------|-------|
| 1 | Login as Receptionist | Dashboard loads | | ☐ |
| 2 | Navigate to OPD | Queue visible | | ☐ |
| 3 | Check in patient with insurance | Copay modal appears | | ☐ |
| 4 | Copay calculation shown | Correct amounts | | ☐ |
| 5 | Login as Doctor | Dashboard loads | | ☐ |
| 6 | Order lab test | Cost estimate shown | | ☐ |
| 7 | Order MRI | Pre-auth warning shown | | ☐ |
| 8 | View invoice | VAT calculated | | ☐ |
| 9 | Print receipt | Arabic + English | | ☐ |
| 10 | View claims dashboard | Claims listed | | ☐ |

---

**Document End**

*Generated by TeaBot ☕ for Taqon Team*
*For questions: teabot@taqon.ai*
