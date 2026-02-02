# Finance Module — User Journey (Role-wise)
## Insurance Copay, Laboratory, Radiology & Pharmacy Flows

---

## Overview

End-to-end user journey for the **Finance Module** covering how **insurance copay** works during **appointment check-in**, and how **Laboratory**, **Radiology**, and **Pharmacy** orders flow through insurance verification, auto-billing, and claims.

---

## Roles Involved

| Role | Primary Responsibility |
|------|----------------------|
| **Receptionist** | Patient check-in, insurance verification, copay collection |
| **Doctor** | Consultation, diagnosis (ICD-10), orders (Lab/Rad/Rx/Procedures) |
| **Lab Technician** | Process lab orders, report results |
| **Radiologist** | Process imaging orders, report findings |
| **Pharmacist** | Verify prescriptions, dispense medications |
| **Accountant** | Invoices, claims, GL entries, reconciliation |
| **Hospital Admin** | Payer config, ChargeMaster, oversight |
| **Patient** | Portal access, payments, billing history |

---

## PHASE 1: CHECK-IN & COPAY COLLECTION

### 🏥 RECEPTIONIST

**Step 1 — Patient Arrival & Appointment Lookup**
- Navigate to **OPD → Queue** or **Appointments**
- Search patient by MRN, name, or phone
- Locate scheduled appointment

**Step 2 — Insurance Verification**
- Open patient profile → **Insurance** tab
- System displays active policy: payer, policy #, coverage %, network status, expiry
- Click **"Verify Coverage"** → real-time eligibility check via `/pre-auth/verify-coverage`
- Returns:
  - ✅ Active / ❌ Inactive
  - Copay amount (fixed AED) or copay percentage
  - Deductible (total & remaining)
  - Whether pre-authorization is required
  - Estimated patient responsibility

**Step 3 — Copay Collection**
- System auto-calculates copay from **Payer Rules**:
  - Fixed copay (e.g., AED 50) → `ICD10PayerRule.copayAmount`
  - Percentage copay (e.g., 20%) → `ICD10PayerRule.copayPercentage`
- Collect payment: Cash / Card / Deduct from **Patient Deposit**
- Issue receipt
- If waived/deferred → mark "Copay Pending" with reason

**Step 4 — Check-in Patient**
- Patient status → `ARRIVED` in OPD queue
- System records copay payment against the patient's open invoice

---

## PHASE 2: CONSULTATION & ORDERS

### 👨‍⚕️ DOCTOR

**Step 5 — Consultation**
- See patient (OPD / Telemedicine)
- Insurance status & copay collection visible on patient banner
- Record **ICD-10 diagnosis codes**

**Step 6 — Place Orders**
Doctor places one or more of:

| Order Type | What Happens | Auto-Billing Trigger |
|-----------|-------------|---------------------|
| **Lab Order** | Tests sent to Laboratory queue | Charges added at order creation (via `billingService.addLabCharges`) — *currently not auto-triggered; see note* |
| **Imaging Order** | Sent to Radiology queue | **Auto-billed immediately** at order creation (`radiologyService` → `billingService.addImagingCharges`) |
| **Prescription** | Sent to Pharmacy queue | **Auto-billed when fully dispensed** (`pharmacyService.dispensePrescription` → `billingService.addPharmacyCharges`) |
| **Procedure** | Scheduled in Surgery/OPD | Added to invoice manually or via AI Charge Capture |

**Step 7 — Pre-Authorization Check (Automatic)**
- System checks if ordered procedure/test requires pre-auth:
  - Hospital policy rules
  - Insurance payer-specific rules (`CPTPayerRule.requiresPreAuth`)
- If required → auto-creates `PreAuthRequest` (status: PENDING)
- Order held until pre-auth = APPROVED
- Doctor/staff can track status in **Insurance → Pre-Auth** page

---

## PHASE 3: DEPARTMENT PROCESSING

### 🔬 LABORATORY (Lab Technician)

**Step 8 — Receive & Process Lab Order**
- Navigate to **Laboratory** module
- View pending orders in queue
- Collect specimen, process tests

**Step 9 — Insurance & Billing for Lab**
- Each lab test has a **price** (from `LabTest.price` or **ChargeMaster** lookup)
- Auto-billing flow:
  1. System finds or creates an **open invoice** for the patient (`findOrCreateOpenInvoice`)
  2. Each test → added as invoice line item (category: `LAB`)
  3. Price resolution: **ChargeMaster** → fallback to `LabTest.price`
- Insurance split calculated based on payer rules:
  - Covered test → insurance pays coverage %, patient pays remainder
  - Non-covered test → 100% patient responsibility
  - Pre-auth required test → charges held until approved

**Step 10 — Results & Report**
- Lab tech enters results, validates, and finalizes report
- Results available to Doctor and Patient Portal
- No additional billing action at this stage

---

### 📷 RADIOLOGY (Radiologist)

**Step 11 — Receive & Process Imaging Order**
- Navigate to **Radiology** module
- View pending imaging orders

**Step 12 — Insurance & Billing for Radiology**
- **Auto-billed at order creation** (triggered in `radiologyService.createOrder`)
- Price resolution via **ChargeMaster** with modality mapping:

  | Modality | Charge Code | Default Fallback |
  |----------|------------|-----------------|
  | X-Ray | `xray_chest` | AED 150 |
  | CT Scan | `ct_scan` | AED 150 |
  | MRI | `mri` | AED 150 |
  | Ultrasound | `ultrasound` | AED 150 |
  | Mammography | `ultrasound` | AED 150 |
  | PET | `ct_scan` | AED 150 |
  | Fluoroscopy | `xray_chest` | AED 150 |

- Invoice line item added: `Imaging - {description} - {bodyPart}` (category: `IMAGING`)
- Insurance coverage applied based on CPT payer rules for the imaging procedure

**Step 13 — Reporting**
- Radiologist reviews images, creates report
- AI-assisted analysis available (Medical Imaging AI)
- Report finalized → available to Doctor and Patient Portal

---

### 💊 PHARMACY (Pharmacist)

**Step 14 — Receive Prescription**
- Navigate to **Pharmacy** module
- View pending prescriptions queue
- Verify: drug interactions, allergies, dosage, pregnancy/breastfeeding checks

**Step 15 — Dispense Medications**
- Pharmacist dispenses each medication in the prescription
- Marks each item as dispensed

**Step 16 — Insurance & Billing for Pharmacy**
- **Auto-billed when ALL medications in prescription are dispensed**
- Trigger: `pharmacyService.dispensePrescription` → checks if fully dispensed → calls `billingService.addPharmacyCharges`
- Price resolution per medication:
  1. `Drug.price` (from drug database)
  2. **ChargeMaster** lookup by drug code (fallback)
- Invoice line item per medication: `Medication - {drugName} ({dosage})` (category: `MEDICATION`)
- Quantity-aware: `med.quantity` × `unitPrice`
- Insurance coverage:
  - Formulary drugs → covered per payer rules
  - Non-formulary / excluded drugs → patient pays 100%
  - Some payers have drug-specific copay amounts

---

## PHASE 4: BILLING, CLAIMS & RECONCILIATION

### 💰 ACCOUNTANT

**Step 17 — Invoice Review**
- Navigate to **Billing → Invoices**
- Open invoice auto-aggregates all charges:

  | Line Item | Source | Category |
  |-----------|--------|----------|
  | Consultation fee | OPD visit / CPT code | CONSULTATION |
  | Lab Test - CBC | Lab order auto-billing | LAB |
  | Lab Test - Lipid Panel | Lab order auto-billing | LAB |
  | Imaging - MRI - Lumbar Spine | Radiology auto-billing | IMAGING |
  | Medication - Amoxicillin (500mg) | Pharmacy auto-billing | MEDICATION |
  | Copay collected at check-in | Payment recorded | PAYMENT |

- System calculates:
  - **Total charges** (sum of all line items)
  - **Insurance portion** = per-item coverage from payer rules
  - **Patient portion** = copay + deductible + non-covered items
  - **Already paid** = copay collected at check-in
  - **Balance due** = patient portion − already paid

**Step 18 — Insurance Claim Submission**
- Navigate to **Billing → Claims**
- Create claim from invoice:
  - ICD-10 + CPT codes auto-populated
  - DHA/HAAD compliance checked (Insurance Coding module)
  - Pre-auth approval number attached if applicable
  - Each service line maps to: Lab/Imaging/Pharmacy/Procedure
- Submit to payer via **E-Claim Link** integration
- Track: SUBMITTED → IN_REVIEW → APPROVED / DENIED / PARTIAL

**Step 19 — Claim Adjudication & Payment**
- Insurance remittance received:
  - Match payment to claim line items
  - Record in **Payments** tab
  - Handle partial payments → remaining balance to patient
  - Handle denials → appeal or bill patient

**Step 20 — Copay & Payment Reconciliation**
- Copay collected at check-in reconciled against final responsibility:
  - **Overpaid** → credit to patient deposit or refund
  - **Underpaid** → generate balance-due notice
  - **Exact** → invoice marked PAID

**Step 21 — GL Journal Entries**
- Navigate to **Accounting** module
- System auto-posts entries:

  | Event | Debit | Credit |
  |-------|-------|--------|
  | Copay collected (check-in) | Cash/Bank | Patient Receivable |
  | Invoice created | Insurance Receivable + Patient Receivable | Revenue (Lab/Imaging/Pharmacy/Consult) |
  | Insurance payment received | Cash/Bank | Insurance Receivable |
  | Patient payment received | Cash/Bank | Patient Receivable |
  | Refund issued | Patient Receivable | Cash/Bank |
  | Pharmacy inventory cost | COGS - Pharmacy | Inventory |

- View **Trial Balance**, **Chart of Accounts**, **Journal Lookup**

**Step 22 — Financial Reports**
- Navigate to **Financial Reports**
- Key reports:
  - Revenue by department (Lab / Radiology / Pharmacy / OPD)
  - Revenue by payer
  - Insurance receivables aging
  - Copay collection rate
  - Claim denial rate & top denial reasons
  - Pharmacy margin analysis (selling price vs cost price)
  - Lab/Imaging utilization & revenue

---

## PHASE 5: CONFIGURATION & OVERSIGHT

### 🔧 HOSPITAL ADMIN

**Step 23 — ChargeMaster Setup**
- Navigate to **Billing → ChargeMaster**
- Configure pricing for all chargeable items:
  - Lab test codes → prices
  - Imaging modality codes → prices
  - Drug codes → prices
  - Procedure CPT codes → prices
- Payer-specific pricing overrides supported

**Step 24 — Payer Rules Configuration**
- Navigate to **Insurance Coding → Payer Rules**
- Configure per-payer:
  - **ICD-10 rules**: copay amount/%, deductible applicability, coverage
  - **CPT rules**: reimbursement rates, pre-auth requirements, modifiers
  - Exclusions and limits
  - Formulary / non-formulary drug lists

**Step 25 — Monitoring Dashboard**
- Accountant Dashboard shows:
  - Daily collections (copay + payments)
  - Pending pre-authorizations
  - Claim pipeline status
  - Denied claims needing attention
  - Outstanding receivables (insurance + patient)

---

## PHASE 6: PATIENT

### 📱 PATIENT PORTAL

**Step 26 — View & Pay**
- Patient Portal → **Billing** tab:
  - Invoice breakdown (consultation, lab, imaging, pharmacy)
  - Insurance coverage applied per line item
  - Copay paid at check-in
  - Remaining balance
  - Payment history & receipts
- Make online payment for outstanding balance

---

## Complete Flow Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                      PATIENT ARRIVES                             │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│  RECEPTIONIST — CHECK-IN                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐          │
│  │ Find Appt   │→ │ Verify       │→ │ Collect Copay  │→ Check-in│
│  │             │  │ Insurance    │  │ (Cash/Card/    │          │
│  │             │  │ Coverage     │  │  Deposit)      │          │
│  └─────────────┘  └──────────────┘  └────────────────┘          │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│  DOCTOR — CONSULTATION                                           │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │ Examine     │→ │ ICD-10 Dx    │→ │ Place Orders:          │  │
│  │ Patient     │  │ Diagnosis    │  │  • Lab tests           │  │
│  │             │  │              │  │  • Imaging              │  │
│  │             │  │              │  │  • Prescriptions        │  │
│  │             │  │              │  │  • Procedures           │  │
│  └─────────────┘  └──────────────┘  └──────┬─────────────────┘  │
└─────────────────────────────────────────────┼────────────────────┘
                       ┌──────────────────────┼────────────┐
                       │                      │            │
                       ▼                      ▼            ▼
        ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
        │  🔬 LABORATORY   │  │  📷 RADIOLOGY    │  │  💊 PHARMACY     │
        │                  │  │                  │  │                  │
        │ Process tests    │  │ Perform imaging  │  │ Verify & dispense│
        │                  │  │                  │  │                  │
        │ AUTO-BILL:       │  │ AUTO-BILL:       │  │ AUTO-BILL:       │
        │ Per test via     │  │ At order creation│  │ When fully       │
        │ ChargeMaster     │  │ by modality type │  │ dispensed        │
        │ → category: LAB  │  │ → cat: IMAGING   │  │ → cat: MEDICATION│
        └────────┬─────────┘  └────────┬─────────┘  └────────┬────────┘
                 │                     │                      │
                 └─────────────────────┼──────────────────────┘
                                       │
                          All charges → Open Invoice
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────┐
│  ACCOUNTANT — BILLING & CLAIMS                                   │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  ┌────────┐ │
│  │ Review      │→ │ Submit Claim │→ │ Receive    │→ │ GL     │ │
│  │ Invoice     │  │ to Payer     │  │ Remittance │  │ Entries│ │
│  │ (all depts) │  │ (ICD+CPT)   │  │ Reconcile  │  │ Reports│ │
│  └─────────────┘  └──────────────┘  └────────────┘  └────────┘ │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│  PATIENT PORTAL — View bills, insurance coverage, pay balance    │
└──────────────────────────────────────────────────────────────────┘
```

---

## Auto-Billing Summary

| Department | Trigger Point | Billing Method | Price Source |
|-----------|--------------|----------------|-------------|
| **OPD Consultation** | Appointment / AI Charge Capture | Manual or AI-assisted | ChargeMaster (CPT code) |
| **Laboratory** | Lab order created | `billingService.addLabCharges()` | ChargeMaster → `LabTest.price` fallback |
| **Radiology** | Imaging order created | `billingService.addImagingCharges()` | ChargeMaster (modality code) → AED 150 fallback |
| **Pharmacy** | Prescription fully dispensed | `billingService.addPharmacyCharges()` | `Drug.price` → ChargeMaster fallback |
| **IPD** | Daily cron job | `billingService.generateIPDDailyCharges()` | Room/bed rate |
| **Surgery** | Post-procedure | Manual or AI Charge Capture | ChargeMaster (procedure CPT) |

---

## Insurance Coverage per Department

| Department | Coverage Check | Pre-Auth | Payer Rule Source |
|-----------|---------------|----------|-------------------|
| **Consultation** | At check-in (copay) | Rarely | `ICD10PayerRule.copayAmount/copayPercentage` |
| **Laboratory** | Per test code | If flagged by payer | `CPTPayerRule` for lab CPT codes |
| **Radiology** | Per modality + body part | Often required (MRI, CT, PET) | `CPTPayerRule` for imaging CPT codes |
| **Pharmacy** | Per drug (formulary check) | For specialty drugs | Payer formulary + `CPTPayerRule` |
| **Surgery** | Per procedure | Almost always required | `CPTPayerRule.requiresPreAuth` |

---

## Permissions by Department

| Action | Permission | Roles |
|--------|-----------|-------|
| Check-in + copay | `billing:read`, `billing:write` | Receptionist, Accountant, Admin |
| Lab orders | `lab:orders:read` | Doctor, Nurse, Lab Tech, Admin |
| Imaging orders | `radiology:orders:read` | Doctor, Radiologist, Admin |
| Dispense meds | `pharmacy:read` | Pharmacist, Admin |
| Review invoices | `billing:read` | Accountant, Receptionist, Admin |
| Submit claims | `billing:reports` | Accountant, Admin |
| Manage ChargeMaster | `billing:write` | Accountant, Admin |
| Payer rules | `insurance_coding:read` | Accountant, Admin |
| Accounting/GL | `billing:reports` | Accountant, Admin |
| Financial reports | `reports:financial` | Accountant, Admin |
| Pre-auth management | `billing:read` | Doctor, Accountant, Admin |

---

*Last updated: 2026-02-02*
