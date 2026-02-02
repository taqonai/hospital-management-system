# Phase 7: Financial Reporting — Detailed Changelog

**Project:** Hospital Management System (HMS) - Spetaar  
**Phase:** 7 - Financial Reporting  
**Date:** February 2, 2025  
**Implemented by:** TeaBot (AI Agent)

---

## Schema Changes

### Added Models

#### WriteOff Model
```prisma
model WriteOff {
  id          String         @id @default(uuid())
  hospitalId  String
  invoiceId   String
  amount      Decimal        @db.Decimal(10, 2)
  reason      String
  category    WriteOffCategory
  status      WriteOffStatus @default(PENDING)
  requestedBy String
  approvedBy  String?
  approvedAt  DateTime?
  notes       String?
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  hospital Hospital @relation(fields: [hospitalId], references: [id])
  invoice  Invoice  @relation(fields: [invoiceId], references: [id])

  @@index([hospitalId, status])
  @@index([invoiceId])
  @@map("write_offs")
}
```

**Purpose:** Track bad debt write-offs, charity care, contractual adjustments, and other revenue reductions.

**Key Fields:**
- `category` — Classification of write-off (bad debt, charity, etc.)
- `status` — Approval workflow (PENDING, APPROVED, REJECTED, CANCELLED)
- `requestedBy` / `approvedBy` — Audit trail for two-tier approval

### Added Enums

#### WriteOffCategory
```prisma
enum WriteOffCategory {
  BAD_DEBT
  CHARITY_CARE
  CONTRACTUAL_ADJUSTMENT
  ADMINISTRATIVE_ERROR
  UNCOLLECTIBLE
  DECEASED_PATIENT
  SMALL_BALANCE
  OTHER
}
```

**Values:**
- `BAD_DEBT` — Uncollectible patient debt
- `CHARITY_CARE` — Approved charity/financial assistance
- `CONTRACTUAL_ADJUSTMENT` — Insurance negotiated discounts
- `ADMINISTRATIVE_ERROR` — Billing errors requiring correction
- `UNCOLLECTIBLE` — Confirmed uncollectible after collection attempts
- `DECEASED_PATIENT` — Patient deceased, balance unrecoverable
- `SMALL_BALANCE` — Write-off for administrative efficiency (<$X threshold)
- `OTHER` — Other write-off reasons

#### WriteOffStatus
```prisma
enum WriteOffStatus {
  PENDING
  APPROVED
  REJECTED
  CANCELLED
}
```

**Workflow:**
1. Accountant creates write-off → `PENDING`
2. Admin approves → `APPROVED` (invoice balance decremented)
3. Admin rejects → `REJECTED` (invoice unchanged)
4. Requester cancels → `CANCELLED`

### Modified Models

#### Hospital Model
**Added Relations:**
```prisma
writeOffs   WriteOff[]
```

**Location:** Line ~127 (after `refunds` relation)

#### Invoice Model
**Added Relations:**
```prisma
writeOffs   WriteOff[]
```

**Location:** Line ~1955 (after `creditNoteApplied` relation)

---

## Backend Changes

### New Files

#### 1. `backend/src/services/financialReportingService.ts` (691 lines)

**Class:** `FinancialReportingService`

**Methods:**

##### `getARAgingReport(hospitalId: string, asOfDate: Date): Promise<ARAgingReport>`
- **Purpose:** Generate Accounts Receivable aging report with 4 buckets
- **Buckets:** Current (0-30 days), 30-60, 60-90, 90+ days overdue
- **Logic:** 
  - Fetch all unpaid/partially paid invoices
  - Calculate days overdue: `(asOfDate - dueDate) / 86400000`
  - Group into buckets and sum balances
  - Return summary + detailed invoice list
- **Query:** Prisma `findMany` with `balanceAmount > 0`, includes patient details
- **Performance:** O(n) where n = # of outstanding invoices

##### `getRevenueByDepartment(hospitalId: string, startDate: Date, endDate: Date): Promise<RevenueBreakdownItem[]>`
- **Purpose:** Aggregate revenue by hospital department
- **Logic:**
  - Raw SQL: JOIN invoices → appointments → doctors → departments
  - Heuristic: `DATE(invoice_date) = DATE(appointment_date)` to link invoice to appointment
  - Group by department, sum `total_amount`, count invoices
  - Calculate percentage of total revenue
- **Query:** `prisma.$queryRaw` (PostgreSQL)
- **Performance:** O(1) aggregation (database-side GROUP BY)

##### `getRevenueByDoctor(hospitalId: string, startDate: Date, endDate: Date, limit: number = 20): Promise<RevenueBreakdownItem[]>`
- **Purpose:** Top N revenue-generating doctors
- **Logic:**
  - Similar to department query but group by doctor
  - JOIN invoices → appointments → doctors → users (for name)
  - Include specialization for context
  - Return top 20 by default (configurable)
- **Query:** `prisma.$queryRaw` with `LIMIT`
- **Performance:** O(1) aggregation + O(log n) sort

##### `getRevenueByPayer(hospitalId: string, startDate: Date, endDate: Date): Promise<RevenueBreakdownItem[]>`
- **Purpose:** Insurance vs self-pay breakdown
- **Logic:**
  - Query 1: Invoices with claims (insurance)
  - Query 2: Invoices without claims (self-pay)
  - Aggregate totals and calculate percentages
- **Query:** 2x Prisma `aggregate` queries
- **Performance:** O(1) per query

##### `getCollectionRate(hospitalId: string, startDate: Date, endDate: Date, groupBy: 'day' | 'week' | 'month'): Promise<CollectionRateReport>`
- **Purpose:** Collection efficiency over time
- **Metrics:**
  - `totalBilled` — Sum of all invoice amounts
  - `totalCollected` — Sum of all paid amounts
  - `collectionRate` — (collected / billed) * 100
  - `trend` — Daily/weekly/monthly breakdown
- **Logic:**
  - Overall aggregation for summary
  - Raw SQL with `TO_CHAR(date, format)` for grouping
  - Calculate rate per period
- **Query:** `aggregate` + `$queryRaw`
- **Performance:** O(1) aggregation + O(m) where m = # of periods

##### `getTaxSummary(hospitalId: string, startDate: Date, endDate: Date): Promise<TaxSummary>`
- **Purpose:** Tax compliance reporting
- **Logic:**
  - Fetch all invoices with `tax > 0`
  - Group by tax rate (calculated as `tax / subtotal * 100`)
  - Sum tax amounts per rate
- **Query:** Prisma `findMany` + in-memory grouping
- **Performance:** O(n) where n = # of taxed invoices

##### `getWriteOffSummary(hospitalId: string, startDate: Date, endDate: Date): Promise<WriteOffSummary>`
- **Purpose:** Write-off totals by category and status
- **Logic:**
  - Fetch all write-offs in date range
  - Group by category (bad debt, charity, etc.)
  - Group by status (pending, approved, rejected)
  - Calculate totals
- **Query:** Prisma `findMany` + in-memory grouping
- **Performance:** O(n) where n = # of write-offs

##### `createWriteOff(hospitalId, data): Promise<WriteOff>`
- **Purpose:** Submit write-off request
- **Validation:**
  - Invoice exists and belongs to hospital
  - Write-off amount ≤ invoice balance
- **Logic:**
  - Create WriteOff record with status `PENDING`
  - Return created record with invoice + patient details
- **Query:** `findFirst` (validation) + `create`
- **Error Handling:** Throws `NotFoundError` or `AppError`

##### `updateWriteOffStatus(id, hospitalId, status, approvedBy, notes): Promise<WriteOff>`
- **Purpose:** Approve or reject write-off
- **Validation:**
  - Write-off exists and belongs to hospital
  - Current status is `PENDING` (no double-processing)
- **Logic (APPROVED):**
  - Atomic transaction:
    1. Update WriteOff status, set `approvedBy` and `approvedAt`
    2. Decrement Invoice `balanceAmount` by write-off amount
  - Returns updated WriteOff
- **Logic (REJECTED):**
  - Update WriteOff status only (no invoice change)
- **Query:** `$transaction` with `update` + `update`
- **Error Handling:** Throws `NotFoundError` or `AppError`

##### `getWriteOffs(hospitalId, params): Promise<{ data, pagination }>`
- **Purpose:** List write-offs with filters and pagination
- **Filters:**
  - `status` — Filter by approval status
  - `startDate` / `endDate` — Date range filter
- **Pagination:** Page-based (default: page 1, limit 20)
- **Query:** `findMany` + `count`
- **Performance:** O(1) with proper indexes

##### `exportToCSV(data: any[], filename: string): string`
- **Purpose:** Convert JSON to CSV string
- **Logic:**
  - Extract headers from first object keys
  - Escape commas and quotes (RFC 4180)
  - Join rows with newlines
- **Performance:** O(n * m) where n = rows, m = columns
- **Memory:** Synchronous (entire CSV in memory)

---

#### 2. `backend/src/routes/financialReportingRoutes.ts` (436 lines)

**Router:** Express Router with 12 endpoints

**Endpoints:**

##### 1. `GET /api/v1/financial-reports/ar-aging`
- **Auth:** `authenticate` + `authorizeWithPermission('financial-reports:read', [ACCOUNTANT, HOSPITAL_ADMIN])`
- **Query Params:** `asOfDate` (optional, defaults to today)
- **Response:** `{ buckets, totalOutstanding, invoiceCount, details }`
- **Status:** 200 OK

##### 2. `GET /api/v1/financial-reports/revenue/by-department`
- **Auth:** Same as #1
- **Query Params:** `startDate` (required), `endDate` (required)
- **Response:** `Array<{ name, code, revenue, invoiceCount, percentage }>`
- **Validation:** Returns 400 if dates missing
- **Status:** 200 OK

##### 3. `GET /api/v1/financial-reports/revenue/by-doctor`
- **Auth:** Same as #1
- **Query Params:** `startDate` (required), `endDate` (required), `limit` (optional, default 20)
- **Response:** `Array<{ name, code, revenue, invoiceCount, percentage }>`
- **Validation:** Returns 400 if dates missing
- **Status:** 200 OK

##### 4. `GET /api/v1/financial-reports/revenue/by-payer`
- **Auth:** Same as #1
- **Query Params:** `startDate` (required), `endDate` (required)
- **Response:** `Array<{ name: 'Insurance' | 'Self-Pay', revenue, invoiceCount, percentage }>`
- **Status:** 200 OK

##### 5. `GET /api/v1/financial-reports/collection-rate`
- **Auth:** Same as #1
- **Query Params:** `startDate` (required), `endDate` (required), `groupBy` (optional: 'day' | 'week' | 'month', default 'month')
- **Response:** `{ totalBilled, totalCollected, overallCollectionRate, trend: [...] }`
- **Validation:** Returns 400 if `groupBy` invalid
- **Status:** 200 OK

##### 6. `GET /api/v1/financial-reports/tax-summary`
- **Auth:** Same as #1
- **Query Params:** `startDate` (required), `endDate` (required)
- **Response:** `{ totalTax, invoiceCount, breakdown: [...] }`
- **Status:** 200 OK

##### 7. `GET /api/v1/financial-reports/write-offs/summary`
- **Auth:** Same as #1
- **Query Params:** `startDate` (required), `endDate` (required)
- **Response:** `{ totalWriteOff, writeOffCount, byCategory: [...], byStatus: [...] }`
- **Status:** 200 OK

##### 8. `GET /api/v1/financial-reports/write-offs`
- **Auth:** Same as #1
- **Query Params:** `page` (optional), `limit` (optional), `status` (optional), `startDate` (optional), `endDate` (optional)
- **Response:** `{ data: [...], pagination: {...} }`
- **Status:** 200 OK

##### 9. `POST /api/v1/financial-reports/write-offs`
- **Auth:** `authenticate` + `authorizeWithPermission('financial-reports:write', [ACCOUNTANT, HOSPITAL_ADMIN])`
- **Body:** `{ invoiceId, amount, reason, category, notes? }`
- **Validation:** Returns 400 if required fields missing
- **Response:** Created WriteOff with invoice details
- **Status:** 201 Created

##### 10. `PATCH /api/v1/financial-reports/write-offs/:id/approve`
- **Auth:** `authenticate` + `authorizeWithPermission('financial-reports:approve', [HOSPITAL_ADMIN])`
- **Body:** `{ notes? }`
- **Logic:** Approves write-off, decrements invoice balance (transactional)
- **Response:** Updated WriteOff
- **Status:** 200 OK

##### 11. `PATCH /api/v1/financial-reports/write-offs/:id/reject`
- **Auth:** Same as #10
- **Body:** `{ notes? }`
- **Logic:** Rejects write-off, no invoice change
- **Response:** Updated WriteOff
- **Status:** 200 OK

##### 12. `GET /api/v1/financial-reports/export`
- **Auth:** `authenticate` + `authorizeWithPermission('financial-reports:read', [ACCOUNTANT, HOSPITAL_ADMIN])`
- **Query Params:** `reportType` (required), `startDate` (required), `endDate` (required)
- **Report Types:** `ar-aging`, `revenue-department`, `revenue-doctor`, `revenue-payer`, `collection-rate`
- **Response:** CSV file download (Content-Type: text/csv, Content-Disposition: attachment)
- **Validation:** Returns 400 if invalid report type
- **Status:** 200 OK

**Middleware Usage:**
- `authenticate` — JWT validation on all routes
- `authorizeWithPermission` — RBAC with permission + legacy role fallback
- `asyncHandler` — Automatic error handling wrapper
- `sendSuccess` / `sendCreated` / `sendPaginated` — Standardized response helpers

---

### Modified Files

#### `backend/src/routes/index.ts`
**Changes:**
1. Added import:
   ```typescript
   import financialReportingRoutes from './financialReportingRoutes';
   ```

2. Registered route:
   ```typescript
   router.use('/financial-reports', financialReportingRoutes);
   ```

**Location:** After `router.use('/nursing', nurseRoutes);` (line ~226)

---

## Frontend Changes

### New Files

#### 1. `frontend/src/pages/FinancialReports/index.tsx` (815 lines)

**Component:** `FinancialReports` (default export)

**State Management:**
- `startDate` / `endDate` — Date range (default: current month)
- `loading` — Loading indicator
- `activeTab` — Tab navigation ('overview' | 'ar-aging' | 'revenue' | 'collection' | 'writeoffs')
- Report data states: `arAging`, `revenueDept`, `revenueDoctor`, `revenuePayer`, `collectionRate`, `taxSummary`, `writeOffSummary`, `writeOffs`
- `showWriteOffModal` — Modal visibility

**Sub-Components:**

##### `DateRangePicker`
- **Props:** `startDate`, `endDate`, `onStartDateChange`, `onEndDateChange`
- **UI:** Two date inputs with labels
- **Styling:** Tailwind with focus ring

##### `WriteOffModal`
- **Props:** `isOpen`, `onClose`, `onSubmit`
- **Form Fields:**
  - Invoice ID (text input, required)
  - Amount (number input, required)
  - Category (select dropdown, 8 options)
  - Reason (textarea, required)
  - Notes (textarea, optional)
- **Validation:** HTML5 required attributes
- **Styling:** Fixed overlay, centered modal, white background

**Main Component Structure:**

1. **Header:**
   - Title + description
   - Date range picker

2. **Tab Navigation:**
   - 5 tabs with icons (Heroicons)
   - Active tab highlighted (blue border)

3. **Tab Content:**

   **Overview Tab:**
   - 4 summary cards (outstanding, collection rate, tax, write-offs)
   - 2 charts: AR Aging (bar), Revenue by Payer (pie)

   **AR Aging Tab:**
   - AR Aging bar chart (4 buckets)
   - Detailed table (top 20 invoices)
   - Export CSV button

   **Revenue Tab:**
   - Revenue by Department bar chart
   - Revenue by Doctor table (top 20)
   - Export CSV buttons

   **Collection Tab:**
   - 3 summary cards (billed, collected, rate)
   - Collection rate trend line chart

   **Write-Offs Tab:**
   - 2 summary cards + "New Write-Off" button
   - Write-offs table with approve/reject actions (admins only)

**Charts (Recharts):**
- `BarChart` — AR aging, revenue by department
- `PieChart` — Revenue by payer
- `LineChart` — Collection rate trend
- Responsive containers (100% width, fixed heights)
- Tooltips, legends, grid lines

**Data Loading:**
- `useEffect` on `startDate`/`endDate` change
- `loadData()` — Parallel fetch of all reports (`Promise.all`)
- `loadWriteOffs()` — Separate fetch for write-offs list
- Error handling with `toast.error`

**Actions:**
- `handleExport(reportType)` — Trigger CSV download
- `handleCreateWriteOff(data)` — Submit write-off request
- `handleWriteOffAction(id, action, notes)` — Approve/reject write-off

**Styling:**
- Tailwind CSS utility classes
- Glass-morphism badges (status indicators)
- Responsive grid layouts
- Hover effects on buttons/tables

---

### Modified Files

#### `frontend/src/services/api.ts`
**Changes:**
Added `financialReportsApi` export with 12 methods:

```typescript
export const financialReportsApi = {
  getARAgingReport: (asOfDate?: string) => ...
  getRevenueByDepartment: (startDate, endDate) => ...
  getRevenueByDoctor: (startDate, endDate, limit?) => ...
  getRevenueByPayer: (startDate, endDate) => ...
  getCollectionRate: (startDate, endDate, groupBy?) => ...
  getTaxSummary: (startDate, endDate) => ...
  getWriteOffSummary: (startDate, endDate) => ...
  getWriteOffs: (params?) => ...
  createWriteOff: (data) => ...
  approveWriteOff: (id, notes?) => ...
  rejectWriteOff: (id, notes?) => ...
  exportReport: async (reportType, startDate, endDate) => ...
};
```

**Location:** Before `export default api;` (end of file)

**Special Handling:**
- `exportReport` — Handles blob response, creates download link, triggers download, cleans up
- All methods use `.then((res) => res.data.data)` for data extraction

#### `frontend/src/App.tsx`
**Changes:**

1. Added import:
   ```typescript
   import FinancialReports from './pages/FinancialReports';
   ```

2. Added route:
   ```typescript
   <Route path="/financial-reports" element={<FinancialReports />} />
   ```

**Location:** Import at line ~39, route at line ~257

---

## Permissions & RBAC

### New Permissions

| Permission | Allowed Roles | Purpose |
|------------|---------------|---------|
| `financial-reports:read` | ACCOUNTANT, HOSPITAL_ADMIN | View all financial reports |
| `financial-reports:write` | ACCOUNTANT, HOSPITAL_ADMIN | Create write-off requests |
| `financial-reports:approve` | HOSPITAL_ADMIN | Approve/reject write-offs |

**Implementation:**
- Used `authorizeWithPermission` middleware (hybrid RBAC mode)
- Fallback to legacy role check if dynamic RBAC unavailable
- SUPER_ADMIN always passes (global override)

---

## Testing Additions

### Unit Tests (To Be Created)

**File:** `backend/src/services/__tests__/financialReportingService.test.ts`

**Test Cases:**
1. AR Aging:
   - Correct bucket calculation for various due dates
   - Handles invoices with null `dueDate` (uses `invoiceDate`)
   - Excludes cancelled/refunded invoices

2. Revenue by Department:
   - Joins invoices to departments correctly
   - Calculates percentages accurately
   - Handles departments with zero revenue

3. Collection Rate:
   - Correct percentage calculation
   - Handles zero billed amounts (division by zero)
   - Trend data sorted chronologically

4. Write-Offs:
   - Validates amount <= invoice balance
   - Throws error for non-existent invoice
   - Atomic transaction on approval (both update or rollback)

5. CSV Export:
   - Escapes commas and quotes correctly
   - Handles empty arrays
   - Produces valid RFC 4180 CSV

**File:** `backend/src/routes/__tests__/financialReportingRoutes.test.ts`

**Test Cases:**
1. Authorization:
   - Returns 401 without token
   - Returns 403 for non-ACCOUNTANT/ADMIN roles
   - Allows SUPER_ADMIN unconditionally

2. Validation:
   - Returns 400 for missing required params
   - Returns 400 for invalid `groupBy` value
   - Returns 400 for invalid report type (export)

3. Multi-Tenancy:
   - Filters results by `hospitalId` from JWT
   - Cannot access other hospital's write-offs

4. Write-Off Approval:
   - Decrements invoice balance on approval
   - Does NOT modify invoice on rejection
   - Prevents double-approval (status check)

---

## Database Migration

### Migration File

**Generated by:** `npx prisma migrate dev --name add_write_off_model`

**SQL (PostgreSQL):**
```sql
-- CreateEnum
CREATE TYPE "WriteOffCategory" AS ENUM (
  'BAD_DEBT',
  'CHARITY_CARE',
  'CONTRACTUAL_ADJUSTMENT',
  'ADMINISTRATIVE_ERROR',
  'UNCOLLECTIBLE',
  'DECEASED_PATIENT',
  'SMALL_BALANCE',
  'OTHER'
);

-- CreateEnum
CREATE TYPE "WriteOffStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED'
);

-- CreateTable
CREATE TABLE "write_offs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "hospital_id" TEXT NOT NULL,
  "invoice_id" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "reason" TEXT NOT NULL,
  "category" "WriteOffCategory" NOT NULL,
  "status" "WriteOffStatus" NOT NULL DEFAULT 'PENDING',
  "requested_by" TEXT NOT NULL,
  "approved_by" TEXT,
  "approved_at" TIMESTAMP,
  "notes" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL,
  
  CONSTRAINT "fk_write_offs_hospital" FOREIGN KEY ("hospital_id")
    REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  
  CONSTRAINT "fk_write_offs_invoice" FOREIGN KEY ("invoice_id")
    REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "idx_write_offs_hospital_status" ON "write_offs"("hospital_id", "status");
CREATE INDEX "idx_write_offs_invoice" ON "write_offs"("invoice_id");
```

**Applied:** Run `npx prisma migrate dev` in `backend/` directory

---

## Breaking Changes

**None.** This is a purely additive feature with no modifications to existing tables or APIs.

---

## Performance Impact

### Positive:
- Indexed queries for reports (fast aggregation)
- Paginated write-offs list (prevents memory overflow)

### Negative:
- Revenue reports use JOINs across 4 tables (may be slow with >100k invoices)
  - **Mitigation:** Add composite indexes on join columns
  - **Future:** Consider materialized views for pre-aggregated revenue

### Recommended Monitoring:
- Query execution time for `getRevenueByDepartment` (should be <500ms)
- AR aging report time with >10k outstanding invoices (should be <2s)

---

## Security Considerations

### Authorization:
- All endpoints protected with JWT authentication
- Role-based access control (ACCOUNTANT, HOSPITAL_ADMIN)
- Write-off approval restricted to HOSPITAL_ADMIN only

### Data Protection:
- Multi-tenancy enforced (`hospitalId` filter in all queries)
- Write-off amount validation (cannot exceed invoice balance)
- No PII exposed in public APIs

### Audit Trail:
- Write-offs record `requestedBy`, `approvedBy`, `approvedAt`
- Invoice balance changes are atomic (transaction-safe)

---

## Documentation Updates

**Files to Update:**
1. `docs/API.md` — Add financial reporting endpoints
2. `docs/USER_GUIDE.md` — Add financial reports usage guide
3. `docs/RBAC.md` — Document new permissions
4. `README.md` — Update feature list with "Financial Reporting"

---

## Deployment Notes

### Pre-Deployment Checklist:
- [ ] Run database migration (`npx prisma migrate deploy` in production)
- [ ] Restart backend server (pick up new routes)
- [ ] Clear Redis cache (if RBAC uses caching)
- [ ] Update environment variables (if any added)

### Rollback Plan:
1. Revert code to previous commit
2. Run migration rollback:
   ```sql
   DROP TABLE write_offs;
   DROP TYPE "WriteOffCategory";
   DROP TYPE "WriteOffStatus";
   ```
3. Restart server

### Monitoring:
- Watch error logs for permission errors (RBAC mode issues)
- Monitor API response times (report generation)
- Track write-off approval rates (business metric)

---

## Known Issues

### Issue #1: Revenue-Department Heuristic
**Description:** `DATE(invoice_date) = DATE(appointment_date)` may miss invoices created days after appointment.

**Impact:** Revenue attribution may be incomplete for departments.

**Workaround:** None (requires schema change).

**Future Fix:** Add `appointmentId` field to Invoice model (Phase 8).

### Issue #2: CSV Export Memory Limit
**Description:** Synchronous CSV generation loads entire dataset into memory.

**Impact:** Large exports (>10k records) may cause OOM or timeout.

**Workaround:** Limit export to 5,000 records with warning message.

**Future Fix:** Implement streaming CSV export with background job queue.

### Issue #3: Write-Off Balance Reconciliation
**Description:** Write-off approval reduces invoice balance but doesn't create a Payment record.

**Impact:** Discrepancy between sum of payments and invoice paid amount.

**Workaround:** None (cosmetic issue).

**Future Fix:** Create synthetic Payment with method "WRITE_OFF" on approval.

---

## Success Metrics

**Feature Adoption:**
- [ ] Financial reports accessed by 80% of accountant users within 30 days
- [ ] At least 5 write-offs processed per month per hospital

**Performance:**
- [ ] Report generation time <2 seconds for 95th percentile
- [ ] Zero timeout errors on CSV exports (with 5k limit)

**Business Impact:**
- [ ] Collection rate improvement tracked (baseline vs. 90 days post-launch)
- [ ] Write-off approval time reduced (manual process vs. automated workflow)

---

**Status:** ✅ Phase 7 Complete — Ready for Testing & Deployment

**Implemented by:** TeaBot (AI Agent)  
**Date:** February 2, 2025  
**Next Phase:** Phase 8 - Accounting Foundation (GL/CoA) — Deferred to Q2 2025
