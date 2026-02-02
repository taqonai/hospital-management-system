# Finance Module — User Journey (Role-wise)
## Focus: Insurance Copay during Appointment Check-in

---

## Overview

This document maps the end-to-end user journey for the **Finance Module** with a focus on how **insurance copay** is handled during the **appointment check-in** flow. Each role's responsibilities are outlined step by step.

---

## Roles Involved

| Role | Primary Responsibility |
|------|----------------------|
| **Receptionist** | Patient check-in, insurance verification, copay collection |
| **Doctor** | Consultation, diagnosis (ICD-10), procedure ordering (CPT) |
| **Accountant** | Invoice management, claims, GL entries, reconciliation |
| **Hospital Admin** | Oversight, approvals, financial reports |
| **Patient** | Payment, portal access, billing history |

---

## 1. RECEPTIONIST — Front Desk / Check-in

### Step 1: Patient Arrival & Appointment Lookup
- Navigate to **OPD → Queue** or **Appointments**
- Search patient by MRN, name, or phone number
- Locate the scheduled appointment

### Step 2: Insurance Verification
- Open patient profile → **Insurance** tab
- System displays active insurance policy details:
  - Payer name & policy number
  - Coverage percentage (e.g., 80%)
  - Network status (in-network / out-of-network)
  - Policy expiry date
- Click **"Verify Coverage"** → triggers real-time eligibility check
  - System calls `/pre-auth/verify-coverage` API
  - Returns:
    - ✅ Coverage active / ❌ Inactive
    - Copay amount (fixed AED or %)
    - Deductible (total & remaining)
    - Whether pre-authorization is required
    - Estimated patient responsibility

### Step 3: Copay Collection at Check-in
- System auto-calculates copay based on payer rules:
  - **Fixed copay** (e.g., AED 50 per visit) — from `ICD10PayerRule.copayAmount`
  - **Percentage copay** (e.g., 20% of consultation fee) — from `ICD10PayerRule.copayPercentage`
  - **Deductible** remaining is shown if applicable
- Receptionist collects copay payment:
  - Payment methods: Cash, Card, or apply from **Patient Deposit** balance
  - Issues payment receipt
- If copay is waived or deferred → mark as "Copay Pending" with reason
- **Check-in the patient** → status moves to `ARRIVED` in OPD queue

### Step 4: Deposit Handling (Optional)
- If patient has a deposit balance → can auto-deduct copay from deposit
- If no deposit → receptionist can collect a new deposit (especially for uninsured/partial coverage)
- Deposit ledger tracks: DEPOSIT → UTILIZATION → REFUND entries

---

## 2. DOCTOR — Consultation

### Step 5: Patient Consultation
- Doctor sees the patient (OPD visit or via Telemedicine)
- Insurance status & copay collection status visible on patient banner
- No financial action required from doctor during consultation

### Step 6: Diagnosis & Orders
- Doctor records:
  - **ICD-10 diagnosis codes** (triggers payer rule lookup)
  - **CPT procedure codes** for any procedures ordered
- System checks payer rules in background:
  - Does this diagnosis/procedure require **pre-authorization**?
  - What is the coverage % for this specific code?
  - Any exclusions or limits?

### Step 7: Pre-Authorization (if required)
- If payer rule flags `requiresPreAuth = true`:
  - System auto-generates a **Pre-Auth Request** (`preAuthRequest`)
  - Status: PENDING → sent to insurance
  - Doctor/Nurse can track approval status
  - Procedure is held until pre-auth is APPROVED

---

## 3. ACCOUNTANT — Billing & Finance

### Step 8: Invoice Generation
- Navigate to **Billing → Invoices**
- After consultation, system can auto-generate invoice or accountant creates manually
- Invoice line items:
  - Consultation fee (mapped to CPT code)
  - Procedures / Lab / Radiology charges
  - Medications dispensed
- System splits charges:
  - **Insurance portion** = Total × Coverage % (from payer rules)
  - **Patient portion** = Copay + Deductible + Non-covered items
  - **Copay already collected** at check-in is reflected

### Step 9: Insurance Claim Submission
- Navigate to **Billing → Claims** tab
- Create claim from invoice:
  - ICD-10 + CPT codes auto-populated from consultation
  - DHA/HAAD coding compliance checked (Insurance Coding module)
  - Attach pre-auth approval number if applicable
- Submit claim to payer (E-Claim link integration)
- Track claim status: SUBMITTED → IN_REVIEW → APPROVED / DENIED / PARTIAL

### Step 10: Payment Reconciliation
- When insurance remittance arrives:
  - Match payment to claim
  - Record insurance payment in **Payments** tab
  - If partial payment → calculate remaining patient balance
  - If claim denied → flag for appeal or bill patient
- Copay already collected is reconciled against final patient responsibility:
  - If overpaid → credit to patient deposit or issue refund
  - If underpaid → generate balance-due notice

### Step 11: GL & Accounting Entries
- Navigate to **Accounting** module
- System auto-posts journal entries:
  - **At check-in (copay collected):**
    - DR: Cash/Bank (copay amount)
    - CR: Patient Receivable
  - **At invoice creation:**
    - DR: Insurance Receivable (insurer portion)
    - DR: Patient Receivable (patient portion)
    - CR: Revenue
  - **At insurance payment:**
    - DR: Cash/Bank
    - CR: Insurance Receivable
  - **At refund (if overpaid):**
    - DR: Patient Receivable
    - CR: Cash/Bank
- View **Trial Balance** and **Chart of Accounts** for financial oversight

### Step 12: Financial Reports
- Navigate to **Financial Reports**
- Key reports:
  - Revenue by payer / department / doctor
  - Outstanding insurance receivables (aging)
  - Copay collection rate
  - Claim denial rate & reasons
  - Deposit utilization summary

---

## 4. HOSPITAL ADMIN — Oversight

### Step 13: Payer Configuration
- Navigate to **Insurance Coding → Payer Rules**
- Configure per-payer rules:
  - Copay amounts (fixed or %) per ICD-10 code
  - Coverage percentages per CPT code
  - Pre-auth requirements
  - Deductible applicability
  - Modifiers and exclusions

### Step 14: Monitoring & Approvals
- Dashboard shows:
  - Daily copay collections
  - Pending pre-authorizations
  - Claim submission pipeline
  - Denied claims requiring attention
- Access all financial reports and accounting data
- Manage **RBAC** permissions for finance-related roles

---

## 5. PATIENT — Portal

### Step 15: Patient Portal Access
- Patient logs into **Patient Portal**
- **Billing** tab shows:
  - Outstanding balances
  - Invoice history
  - Insurance coverage details
  - Copay paid at check-in
  - Payment history & receipts
- Can make online payments for remaining balances

---

## Flow Diagram (Check-in with Insurance Copay)

```
Patient Arrives
       │
       ▼
┌─────────────────────┐
│  RECEPTIONIST       │
│  1. Find Appointment│
│  2. Verify Insurance│◄──── Payer Rules DB
│  3. Calculate Copay │      (copay amount/%)
│  4. Collect Payment │
│  5. Check-in Patient│
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  DOCTOR             │
│  6. Consultation    │
│  7. ICD-10 + CPT    │──── Pre-Auth Check
│  8. Orders          │     (if required)
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  ACCOUNTANT         │
│  9. Generate Invoice│
│  10. Submit Claim   │──── Insurance Payer
│  11. Reconcile      │◄─── Remittance
│  12. GL Entries     │
│  13. Reports        │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  PATIENT PORTAL     │
│  View bills & pay   │
│  remaining balance  │
└─────────────────────┘
```

---

## System Modules Involved

| Module | Route | Used By |
|--------|-------|---------|
| Appointments | `/appointments` | Receptionist |
| OPD / Queue | `/opd`, `/queue` | Receptionist, Nurse, Doctor |
| Insurance Coding | `/insurance-coding` | Admin, Accountant |
| Coverage Verification | Component in patient profile | Receptionist |
| Billing | `/billing` | Accountant, Receptionist |
| Deposits | `/billing` → Deposits | Receptionist, Accountant |
| Pre-Authorization | `/insurance/pre-auth` | Doctor, Accountant |
| Accounting | `/accounting` | Accountant, Admin |
| Financial Reports | `/financial-reports` | Accountant, Admin |
| Patient Portal | `/patient-portal/billing` | Patient |

---

## Permissions Required

| Action | Permission Code | Roles |
|--------|----------------|-------|
| Check-in patient | `opd:visits:read` | Receptionist, Nurse, Doctor, Admin |
| Verify coverage | `billing:read` | Receptionist, Accountant, Admin |
| Collect copay | `billing:write` | Receptionist, Accountant, Admin |
| Create invoice | `billing:write` | Accountant, Admin |
| Submit claims | `billing:reports` | Accountant, Admin |
| Manage payer rules | `insurance_coding:read` | Accountant, Admin |
| View accounting | `billing:reports` | Accountant, Admin |
| View financial reports | `reports:financial` | Accountant, Admin |
| Process refunds | `billing:refund` | Accountant, Admin |
| Manage deposits | `billing:write` | Receptionist, Accountant, Admin |

---

*Last updated: 2026-02-02*
