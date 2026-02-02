# Phase 5: Deposit & Refund Management - Changelog

**Implementation Date:** February 2, 2026  
**Implemented by:** TeaBot (Subagent)  
**Module:** Finance Module - Phase 5

## Overview

Phase 5 adds comprehensive Deposit and Refund Management capabilities to the HMS Finance Module, enabling hospitals to:
- Record and track patient advance deposits
- Apply deposits to invoices automatically or manually
- Create and manage credit notes
- Process refund requests with approval workflows
- Maintain detailed audit trails of all financial transactions

---

## 🗄️ Database Changes

### New Enums

```typescript
enum DepositStatus {
  ACTIVE      // Deposit has remaining balance
  UTILIZED    // Fully used up
  REFUNDED    // Refunded to patient
  EXPIRED     // Expired (if applicable)
}

enum LedgerEntryType {
  DEPOSIT     // Initial deposit
  UTILIZATION // Applied to invoice
  REFUND      // Refunded to patient
  ADJUSTMENT  // Manual adjustment
}

enum CreditNoteStatus {
  DRAFT       // Not yet issued
  ISSUED      // Active credit note
  APPLIED     // Applied to invoice
  CANCELLED   // Cancelled
}

enum RefundStatus {
  REQUESTED   // Refund request submitted
  APPROVED    // Approved by accountant
  PROCESSED   // Payment processed
  REJECTED    // Request rejected
  CANCELLED   // Request cancelled
}
```

### New Tables

#### 1. `deposits`
Stores patient advance deposits.

**Columns:**
- `id` (TEXT, PK)
- `hospitalId` (TEXT, FK → hospitals)
- `patientId` (TEXT, FK → patients)
- `amount` (DECIMAL(10,2))
- `currency` (TEXT, default: 'AED')
- `paymentMethod` (PaymentMethod enum)
- `referenceNumber` (TEXT, nullable)
- `reason` (TEXT, nullable)
- `status` (DepositStatus, default: ACTIVE)
- `remainingBalance` (DECIMAL(10,2))
- `createdAt` (TIMESTAMP)
- `updatedAt` (TIMESTAMP)
- `createdBy` (TEXT)

**Relations:**
- hospital → Hospital
- patient → Patient
- ledgerEntries → DepositLedger[]
- refunds → Refund[]

---

#### 2. `deposit_ledger`
Transaction log for deposit movements.

**Columns:**
- `id` (TEXT, PK)
- `depositId` (TEXT, FK → deposits)
- `type` (LedgerEntryType enum)
- `amount` (DECIMAL(10,2))
- `invoiceId` (TEXT, FK → invoices, nullable)
- `description` (TEXT)
- `createdAt` (TIMESTAMP)
- `createdBy` (TEXT)

**Relations:**
- deposit → Deposit
- invoice → Invoice (optional)

---

#### 3. `credit_notes`
Credit notes for refunds or adjustments.

**Columns:**
- `id` (TEXT, PK)
- `hospitalId` (TEXT, FK → hospitals)
- `invoiceId` (TEXT, FK → invoices, nullable)
- `patientId` (TEXT, FK → patients)
- `creditNoteNumber` (TEXT, UNIQUE)
- `amount` (DECIMAL(10,2))
- `reason` (TEXT)
- `status` (CreditNoteStatus, default: DRAFT)
- `appliedToInvoiceId` (TEXT, FK → invoices, nullable)
- `createdAt` (TIMESTAMP)
- `updatedAt` (TIMESTAMP)
- `createdBy` (TEXT)

**Relations:**
- hospital → Hospital
- patient → Patient
- sourceInvoice → Invoice (optional)
- appliedToInvoice → Invoice (optional)

---

#### 4. `refunds`
Refund request and processing tracking.

**Columns:**
- `id` (TEXT, PK)
- `hospitalId` (TEXT, FK → hospitals)
- `patientId` (TEXT, FK → patients)
- `depositId` (TEXT, FK → deposits, nullable)
- `creditNoteId` (TEXT, nullable)
- `paymentId` (TEXT, nullable)
- `amount` (DECIMAL(10,2))
- `refundMethod` (TEXT)
- `status` (RefundStatus, default: REQUESTED)
- `requestReason` (TEXT)
- `approvedBy` (TEXT, nullable)
- `processedAt` (TIMESTAMP, nullable)
- `bankDetails` (JSONB, nullable)
- `notes` (TEXT, nullable)
- `createdAt` (TIMESTAMP)
- `updatedAt` (TIMESTAMP)
- `createdBy` (TEXT)

**Relations:**
- hospital → Hospital
- patient → Patient
- deposit → Deposit (optional)

---

### Modified Tables

#### `hospitals`
**Added Relations:**
```typescript
deposits    Deposit[]
creditNotes CreditNote[]
refunds     Refund[]
```

#### `patients`
**Added Relations:**
```typescript
deposits    Deposit[]
creditNotes CreditNote[]
refunds     Refund[]
```

#### `invoices`
**Added Relations:**
```typescript
depositLedgerEntries DepositLedger[]
sourceCreditNotes    CreditNote[] @relation("SourceInvoice")
appliedCreditNotes   CreditNote[] @relation("AppliedInvoice")
```

---

## 📁 Backend Implementation

### New Service: `depositService.ts`

Location: `backend/src/services/depositService.ts`

**Key Methods:**

1. **`recordDeposit(hospitalId, patientId, data, createdBy)`**
   - Records new patient deposit
   - Creates initial ledger entry
   - Wrapped in transaction for atomicity
   - Validates amount > 0 and patient exists

2. **`getDepositBalance(hospitalId, patientId)`**
   - Returns sum of all ACTIVE deposits for patient
   - Shows total balance and count of active deposits

3. **`getDeposits(hospitalId, filters)`**
   - List deposits with pagination
   - Filters: patientId, status, date range
   - Includes patient details

4. **`getDepositLedger(depositId)`**
   - Returns complete ledger for a deposit
   - Shows all DEPOSIT, UTILIZATION, REFUND entries
   - Links to invoices where applicable

5. **`applyDepositToInvoice(hospitalId, patientId, invoiceId, amount, createdBy)`**
   - Applies deposit(s) to invoice in FIFO order
   - Updates deposit balance and invoice paid amount
   - Creates UTILIZATION ledger entry
   - All wrapped in transaction
   - Prevents negative balances

6. **`autoApplyDeposits(hospitalId, patientId, invoiceId, createdBy)`**
   - Automatically applies available deposits up to invoice balance
   - Uses FIFO logic
   - Convenience wrapper around `applyDepositToInvoice`

7. **`createCreditNote(hospitalId, data, createdBy)`**
   - Creates credit note with auto-generated number (CN-XXXXX)
   - Links to source invoice if provided
   - Status: ISSUED by default

8. **`applyCreditNote(creditNoteId, invoiceId, createdBy)`**
   - Applies credit note to invoice
   - Updates invoice balance
   - Marks credit note as APPLIED
   - Transaction-safe

9. **`requestRefund(hospitalId, data, createdBy)`**
   - Creates refund request
   - Validates deposit balance if deposit-based
   - Status: REQUESTED
   - Can include bank details for transfer

10. **`approveRefund(refundId, approvedBy)`**
    - Approves pending refund request
    - Status: REQUESTED → APPROVED
    - Records approver ID

11. **`processRefund(refundId, processedBy)`**
    - Marks refund as processed
    - Updates deposit status if applicable
    - Creates REFUND ledger entry
    - Status: APPROVED → PROCESSED

12. **`rejectRefund(refundId, reason, rejectedBy)`**
    - Rejects refund request with reason
    - Status: REQUESTED/APPROVED → REJECTED

13. **`getRefunds(hospitalId, filters)`**
    - List refunds with pagination
    - Filters: patientId, status

14. **`getCreditNotes(hospitalId, filters)`**
    - List credit notes with pagination
    - Filters: patientId, status

---

### New Routes: `depositRoutes.ts`

Location: `backend/src/routes/depositRoutes.ts`

**All routes require authentication** (`authenticate` middleware)

#### Deposit Routes

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| POST | `/api/v1/billing/deposits` | Record new deposit | Default |
| GET | `/api/v1/billing/deposits` | List deposits | Default |
| GET | `/api/v1/billing/patients/:patientId/deposit-balance` | Get patient balance | Default |
| GET | `/api/v1/billing/deposits/:id/ledger` | View deposit ledger | Default |
| POST | `/api/v1/billing/deposits/apply` | Apply deposit to invoice | Default |

#### Credit Note Routes

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| POST | `/api/v1/billing/credit-notes` | Create credit note | `billing:write` |
| POST | `/api/v1/billing/credit-notes/:id/apply` | Apply credit note | `billing:write` |
| GET | `/api/v1/billing/credit-notes` | List credit notes | Default |

#### Refund Routes

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| POST | `/api/v1/billing/refunds` | Request refund | Default |
| GET | `/api/v1/billing/refunds` | List refunds | Default |
| PATCH | `/api/v1/billing/refunds/:id/approve` | Approve refund | `billing:approve` |
| PATCH | `/api/v1/billing/refunds/:id/process` | Process refund | `billing:approve` |
| PATCH | `/api/v1/billing/refunds/:id/reject` | Reject refund | `billing:approve` |

**Routes registered in:** `backend/src/routes/index.ts`
```typescript
router.use('/billing', depositRoutes);
```

---

## 🎨 Frontend Implementation

### New Pages

#### 1. `Deposits.tsx`
Location: `frontend/src/pages/Billing/Deposits.tsx`

**Features:**
- ✅ Record new deposits with payment method selection
- ✅ View deposit balance for selected patient (highlighted card)
- ✅ List all deposits with filters (patient, status, date)
- ✅ View deposit ledger (modal with transaction history)
- ✅ Status badges with color coding (Active, Utilized, Refunded, Expired)
- ✅ Patient search with balance display
- ✅ Responsive table design with Tailwind CSS
- ✅ Uses Heroicons for icons

**UI Components:**
- Deposit recording form (collapsible)
- Balance display card (gradient blue)
- Filters panel (patient, status)
- Deposits table (patient, amount, balance, method, status, date)
- Ledger modal (transaction history with type badges)

---

#### 2. `Refunds.tsx`
Location: `frontend/src/pages/Billing/Refunds.tsx`

**Features:**
- ✅ Request refund form with bank details
- ✅ Refund approval queue (for accountants)
- ✅ Status workflow visualization (Requested → Approved → Processed)
- ✅ Approve/Reject/Process actions
- ✅ Rejection reason input
- ✅ Status badges with icons
- ✅ Filters (patient, status)
- ✅ Refund management modal

**UI Components:**
- Refund request form (with bank details section)
- Filters panel
- Refunds table (patient, amount, method, status, date)
- Approval modal (approve, reject with reason, or process)
- Status workflow visualization

**Permissions:**
- Only ACCOUNTANT and HOSPITAL_ADMIN can approve/process/reject

---

## 🧪 Tests

Location: `backend/src/tests/depositService.test.ts`

**Test Coverage:**

### 1. `recordDeposit()`
- ✅ Successfully records deposit with ledger entry
- ✅ Throws error for negative amount
- ✅ Throws error if patient not found

### 2. `getDepositBalance()`
- ✅ Correctly calculates total balance from multiple deposits
- ✅ Returns zero when no active deposits

### 3. `applyDepositToInvoice()`
- ✅ Applies deposit to invoice and updates records
- ✅ Uses FIFO logic for multiple deposits
- ✅ Throws error for insufficient balance
- ✅ Prevents applying to PAID/CANCELLED invoices
- ✅ Correctly updates invoice status (PENDING → PARTIALLY_PAID → PAID)

### 4. `createCreditNote()`
- ✅ Creates credit note with auto-generated number
- ✅ Sets status to ISSUED

### 5. Refund Workflow
- ✅ Complete workflow: Request → Approve → Process
- ✅ Prevents processing unapproved refunds
- ✅ Updates deposit balance on refund processing
- ✅ Creates refund ledger entry

### 6. Balance Validation
- ✅ **CRITICAL:** Deposit balance can never go negative
- ✅ All transactions are atomic (wrapped in `$transaction`)

**Test Framework:** Vitest with Prisma mocks

---

## 🔄 Migration

**File:** `backend/prisma/migrations/20260202_add_deposit_refund_management/migration.sql`

**Includes:**
- Create 4 new enums
- Create 4 new tables with proper foreign keys
- Add indexes for performance
- Uses camelCase column names (as per project standard)
- All IDs are TEXT type (NOT UUID)

**To Apply:**
```bash
cd backend
npx prisma migrate deploy
```

---

## 🔑 Key Features

### 1. FIFO Deposit Application
When applying deposits to invoices, the system uses **First-In-First-Out** logic:
- Oldest deposits are used first
- Automatically handles multiple deposits
- Transparent through ledger entries

### 2. Atomic Transactions
All financial operations are wrapped in database transactions:
- Deposit recording + ledger entry
- Deposit application + invoice update + ledger entry
- Credit note application + invoice update
- Refund processing + deposit update + ledger entry

### 3. Audit Trail
Complete audit trail through:
- Deposit ledger (every movement tracked)
- createdBy/approvedBy/processedBy fields
- Timestamps for all operations
- Notes and reason fields

### 4. Approval Workflow
Three-stage refund workflow:
1. **REQUESTED** - Submitted by staff/patient
2. **APPROVED** - Approved by accountant
3. **PROCESSED** - Payment completed

Can also be **REJECTED** or **CANCELLED** at any stage.

### 5. Balance Protection
- Validates deposit balance before application
- Prevents negative balances
- Real-time balance calculation
- Immutable ledger entries

---

## 📊 Business Logic

### Deposit Application Rules
1. Deposits can only be applied to PENDING or PARTIALLY_PAID invoices
2. Cannot exceed available deposit balance
3. FIFO application order
4. Automatically updates invoice status:
   - Balance = 0 → PAID
   - Balance > 0 and Paid > 0 → PARTIALLY_PAID

### Credit Note Rules
1. Must be ISSUED to be applied
2. Can only be applied once
3. Linked to source invoice (if from refund)
4. Applied to target invoice

### Refund Rules
1. Must be APPROVED before PROCESSING
2. Deposit-based refunds check remaining balance
3. Cannot request more than deposit balance
4. Bank details required for bank transfers
5. Rejection requires reason

---

## 🎯 Integration Points

### With Existing Finance Module
- **Invoices:** Deposits can be applied to invoices
- **Payments:** Deposits complement payment methods
- **Billing:** Credit notes integrate with billing flow

### With Patient Module
- **Patient Records:** Deposits linked to patient accounts
- **Balance Display:** Real-time deposit balance shown

### With RBAC Module
- **Permissions:** `billing:write`, `billing:approve`
- **Role Checks:** Accountant/Admin for approvals

---

## 🚀 Testing Checklist

- [x] Schema validation (prisma validate)
- [x] Migration created
- [x] Service unit tests written (100% coverage target)
- [x] API routes created
- [x] Routes registered
- [x] Frontend pages created (Deposits, Refunds)
- [x] Tailwind CSS styling (no MUI)
- [x] Heroicons used
- [x] Toast notifications implemented
- [x] Error handling (try-catch blocks)
- [x] Permission checks (RBAC)
- [x] Transaction safety verified
- [x] Balance validation tested

---

## 📝 Notes for Kamil

**What's NOT Done (As Per Your Instructions):**
- ❌ NOT committed to Git
- ❌ NOT pushed to remote
- ❌ NOT deployed to staging/production
- ❌ Database migration NOT run

**What IS Done:**
- ✅ Schema changes (4 models, 4 enums)
- ✅ Migration SQL file created
- ✅ Backend service (depositService.ts)
- ✅ Backend routes (depositRoutes.ts)
- ✅ Routes registered
- ✅ Frontend pages (Deposits.tsx, Refunds.tsx)
- ✅ Tests written (depositService.test.ts)
- ✅ This comprehensive changelog

**Next Steps (Your Responsibility):**
1. Review all changes
2. Test manually (you may need to run migration first)
3. Commit to Git when ready
4. Push and deploy

**Testing Recommendations:**
1. Run migration: `cd backend && npx prisma migrate deploy`
2. Generate Prisma client: `npx prisma generate`
3. Test deposit recording
4. Test deposit application to invoice
5. Test refund workflow
6. Verify permissions work correctly
7. Check frontend UI in browser

---

## 📞 Contact

**Implementation by:** TeaBot (Subagent)  
**For questions:** Contact Kamil (+971585220125)

---

## 🎉 Summary

Phase 5 adds **complete Deposit & Refund Management** to the HMS Finance Module. The implementation follows all project conventions:
- ✅ camelCase columns
- ✅ TEXT IDs (not UUID)
- ✅ Tailwind CSS + Heroicons
- ✅ RBAC middleware patterns
- ✅ Transaction safety
- ✅ Comprehensive tests

**Total Lines of Code Added:** ~3,500 lines
**Files Created:** 8 (1 migration, 2 backend, 2 frontend, 1 test, 1 changelog, 1 route)
**Files Modified:** 2 (schema.prisma, routes/index.ts)

**Ready for Review and Testing!** 🚀
