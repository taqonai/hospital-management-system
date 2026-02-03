# DHA eClaimLink API Usage Guide

Quick reference for using the DHA eClaimLink endpoints in Spetaar HMS.

---

## Prerequisites

1. **Environment Variables** (`.env`):
   ```bash
   DHA_ECLAIM_MODE=sandbox
   DHA_ECLAIM_USERNAME=your_facility_username
   DHA_ECLAIM_PASSWORD=your_facility_password
   DHA_ECLAIM_FACILITY_CODE=your_facility_code
   ENABLE_ECLAIM_API_SUBMISSION=true
   ```

2. **Authentication**: All endpoints require JWT token in `Authorization: Bearer <token>` header

3. **GL Accounts**: Seed default chart of accounts:
   ```bash
   POST /api/v1/accounting/accounts/seed
   ```

---

## Workflow: Complete Claim Lifecycle

```
1. Create Consultation/Admission
   ↓
2. Add Diagnoses (ICD-10) + Procedures (CPT)
   ↓
3. Preview Claim → Validate
   ↓
4. Generate XML
   ↓
5. Submit to DHA eClaimLink
   ↓
6. Check Status (poll or webhook)
   ↓
7. Process Remittance → Payment + GL Posting
   ↓
8. (Optional) COB → Auto-create secondary claim
```

---

## 1. Preview Claim (Validation)

**Preview OPD Consultation**:
```bash
GET /api/v1/insurance-coding/eclaim/preview/consultation/:consultationId

Response:
{
  "success": true,
  "data": {
    "claimData": {
      "header": { ... },
      "diagnoses": [ ... ],
      "activities": [ ... ]
    },
    "validation": {
      "isValid": true,
      "errors": [],
      "warnings": [
        "Using default diagnosis code Z00.00 - please specify actual diagnosis"
      ]
    }
  }
}
```

**Preview IPD Discharge**:
```bash
GET /api/v1/insurance-coding/eclaim/preview/discharge/:dischargeCodingId
```

**Preview Invoice**:
```bash
GET /api/v1/insurance-coding/eclaim/preview/invoice/:invoiceId
```

---

## 2. Generate XML

**Generate for Consultation**:
```bash
POST /api/v1/insurance-coding/eclaim/generate/consultation/:consultationId

Response:
{
  "success": true,
  "data": {
    "xml": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<Claim.Submission ...>...</Claim.Submission>"
  },
  "message": "Claim XML generated successfully"
}
```

**Generate for Discharge**:
```bash
POST /api/v1/insurance-coding/eclaim/generate/discharge/:dischargeCodingId
```

**Batch Generate (Multiple Consultations)**:
```bash
POST /api/v1/insurance-coding/eclaim/generate/batch

Request Body:
{
  "consultationIds": [
    "uuid-1",
    "uuid-2",
    "uuid-3"
  ]
}

Response:
{
  "success": true,
  "data": {
    "results": [
      { "consultationId": "uuid-1", "success": true, "xml": "..." },
      { "consultationId": "uuid-2", "success": false, "error": "Missing primary diagnosis" },
      { "consultationId": "uuid-3", "success": true, "xml": "..." }
    ],
    "summary": {
      "total": 3,
      "success": 2,
      "failed": 1
    }
  },
  "message": "Generated 2 of 3 claims"
}
```

---

## 3. Submit to DHA eClaimLink

**Submit Claim**:
```bash
POST /api/v1/insurance-coding/eclaim/submit/:claimId

Response (Success):
{
  "success": true,
  "data": {
    "success": true,
    "dhaClaimId": "DHA-2025-ABC123",
    "submittedAt": "2025-01-20T14:30:00.000Z"
  },
  "message": "Claim submitted successfully to DHA eClaimLink"
}

Response (Feature Disabled):
{
  "success": false,
  "error": "eClaimLink API submission is not enabled for this hospital",
  "code": "FEATURE_DISABLED"
}

Response (Platform Mismatch):
{
  "success": false,
  "error": "Payer does not use eClaimLink platform",
  "code": "PLATFORM_MISMATCH"
}
```

**Database Updates After Submission**:
- `InsuranceClaim.eclaimLinkId` → DHA claim ID
- `InsuranceClaim.eclaimLinkStatus` → "SUBMITTED"
- `InsuranceClaim.eclaimLinkResponse` → Full API response
- `InsuranceClaim.submittedAt` → Timestamp

---

## 4. Check Claim Status

**Get Status from Database**:
```bash
GET /api/v1/insurance-coding/eclaim/status/:claimId

Response:
{
  "success": true,
  "data": {
    "eclaimLinkId": "DHA-2025-ABC123",
    "status": "SUBMITTED",
    "lastUpdated": "2025-01-20T14:30:00.000Z",
    "response": { ... }
  }
}
```

**Refresh Status from DHA API**:
```bash
POST /api/v1/insurance-coding/eclaim/refresh-status/:claimId

Response:
{
  "success": true,
  "data": {
    "updated": true,
    "status": "APPROVED"
  },
  "message": "Claim status refreshed successfully"
}
```

---

## 5. Process Remittance

### Option A: Fetch and Process (DHA API Pull)

```bash
POST /api/v1/insurance-coding/eclaim/remittance/fetch/:claimId

Response:
{
  "success": true,
  "data": {
    "success": true,
    "message": "Remittance processed successfully for claim CLM-ABC123"
  },
  "message": "Remittance processed successfully for claim CLM-ABC123"
}
```

**What Happens**:
1. Fetches CRA from DHA API
2. Updates claim status (APPROVED/PARTIALLY_APPROVED/REJECTED)
3. Creates payment record
4. Updates invoice (paidAmount, balanceAmount, status)
5. Posts GL entries:
   ```
   DR  Cash/Bank (1000)              AED X,XXX.XX
       CR  Insurance Receivable (1200)    AED X,XXX.XX
   ```
6. (If partial) Checks for secondary insurance → auto-creates secondary claim

---

### Option B: Manual Processing (Webhook/File Upload)

```bash
POST /api/v1/insurance-coding/eclaim/remittance/process

Request Body:
{
  "dhaClaimId": "DHA-2025-ABC123",
  "claimNumber": "CLM-ABC123",
  "status": "APPROVED",
  "approvedAmount": 950.00,
  "deniedAmount": 50.00,
  "adjustmentReason": "Procedure not covered",
  "remittanceDate": "2025-01-22T10:00:00.000Z",
  "rawResponse": {
    "transactionId": "TXN-12345",
    "paymentMethod": "EFT",
    "paymentDate": "2025-01-22"
  }
}

Response:
{
  "success": true,
  "data": {
    "success": true,
    "claimUpdated": true,
    "paymentCreated": true,
    "appealCreated": false,
    "secondaryClaimCreated": false,
    "glEntriesPosted": true
  },
  "message": "Remittance processed successfully"
}
```

---

### Parse ERA XML (Before Manual Processing)

```bash
POST /api/v1/insurance-coding/eclaim/remittance/parse-xml

Request Body:
{
  "xmlResponse": "<?xml version=\"1.0\"?>\n<RemittanceAdvice>...</RemittanceAdvice>"
}

Response:
{
  "success": true,
  "data": {
    "dhaClaimId": "DHA-2025-ABC123",
    "claimNumber": "CLM-ABC123",
    "status": "APPROVED",
    "approvedAmount": 950.00,
    "deniedAmount": 50.00,
    "adjustmentReason": "Procedure not covered",
    "remittanceDate": "2025-01-22T10:00:00.000Z",
    "rawResponse": { "xml": "..." }
  },
  "message": "ERA XML parsed successfully"
}
```

**Then use the parsed data to call `/remittance/process` endpoint**

---

## 6. Get CRA (Claim Reconciliation Advice)

```bash
GET /api/v1/insurance-coding/eclaim/cra/:dhaClaimId

Response:
{
  "success": true,
  "data": {
    "claimId": "DHA-2025-ABC123",
    "status": "APPROVED",
    "approvedAmount": 950.00,
    "deniedAmount": 50.00,
    "adjustmentReason": "Procedure not covered",
    "remittanceDate": "2025-01-22T10:00:00.000Z",
    "response": { ... }
  }
}
```

---

## COB (Coordination of Benefits) Example

**Scenario**: Patient has primary and secondary insurance

**Step 1**: Submit primary claim
```bash
POST /api/v1/insurance-coding/eclaim/submit/:primaryClaimId
```

**Step 2**: Primary payer partially approves (AED 800 of AED 1000)
```bash
POST /api/v1/insurance-coding/eclaim/remittance/process

{
  "dhaClaimId": "DHA-PRIMARY-123",
  "claimNumber": "CLM-001",
  "status": "PARTIALLY_APPROVED",
  "approvedAmount": 800.00,
  "deniedAmount": 200.00,
  ...
}
```

**Step 3**: System auto-creates secondary claim
```sql
-- Automatically created by processRemittance()
INSERT INTO insurance_claims (
  claimNumber: 'CLM-002-SECONDARY',
  insuranceProvider: 'Secondary Payer',
  claimAmount: 200.00,
  isPrimary: false,              -- 🔑 Secondary claim
  linkedClaimId: <primaryClaimId>, -- 🔑 Links to CLM-001
  ...
)
```

**Step 4**: Submit secondary claim
```bash
POST /api/v1/insurance-coding/eclaim/submit/:secondaryClaimId
```

**Step 5**: Secondary payer approves remaining AED 200
```bash
POST /api/v1/insurance-coding/eclaim/remittance/process

{
  "dhaClaimId": "DHA-SECONDARY-456",
  "claimNumber": "CLM-002-SECONDARY",
  "status": "APPROVED",
  "approvedAmount": 200.00,
  ...
}
```

**Result**:
- Primary claim: AED 800 (paid)
- Secondary claim: AED 200 (paid)
- **Total collected**: AED 1000
- **Invoice balance**: AED 0

---

## Error Handling

### Common Errors

**1. Feature Disabled**:
```json
{
  "success": false,
  "error": "eClaimLink API submission is not enabled for this hospital",
  "code": "FEATURE_DISABLED"
}
```
→ Set `ENABLE_ECLAIM_API_SUBMISSION=true` in `.env`

**2. Platform Mismatch**:
```json
{
  "success": false,
  "error": "Payer does not use eClaimLink platform",
  "code": "PLATFORM_MISMATCH"
}
```
→ Update `InsurancePayer.claimPlatform` to `'eClaimLink'`

**3. Validation Errors**:
```json
{
  "success": false,
  "error": "Claim validation failed: Primary diagnosis is required, At least one activity (procedure) is required"
}
```
→ Add diagnoses and procedures to consultation/discharge coding

**4. Network Errors**:
```json
{
  "success": false,
  "error": "Network timeout - unable to reach DHA API",
  "code": "NETWORK_ERROR"
}
```
→ Check network connectivity, DHA API status

---

## Testing in Sandbox Mode

**1. Set Sandbox Mode**:
```bash
DHA_ECLAIM_MODE=sandbox
```

**2. Submit Claims**:
- All submissions return mock success response
- No actual API calls are made

**3. Check Status**:
- Returns mock "APPROVED" status

**4. Process Remittance**:
- Returns mock approved amount (AED 950)
- Actually creates payment + GL entries (for testing)

**5. Switch to Production**:
```bash
DHA_ECLAIM_MODE=production
DHA_ECLAIM_USERNAME=<real_username>
DHA_ECLAIM_PASSWORD=<real_password>
```

---

## Monitoring & Logs

**View Logs**:
```bash
# DHA submission logs
grep "[DHA eClaimLink]" logs/app.log

# Remittance processing logs
grep "processRemittance" logs/app.log

# GL posting logs
grep "GL entries posted" logs/app.log
```

**Log Format**:
```
[DHA eClaimLink] Initialized in sandbox mode baseURL=https://sandbox.eclaimlink.ae/api/v1
[DHA eClaimLink] Claim CLM-ABC123 submitted successfully to DHA eClaimLink: DHA-2025-ABC123
[DHA eClaimLink] Processing remittance for claim: CLM-ABC123
[DHA eClaimLink] Payment created for claim CLM-ABC123: 950.00
[DHA eClaimLink] GL entries posted for claim CLM-ABC123
[DHA eClaimLink] Secondary claim created for remaining balance: 200.00
```

---

## Database Queries

**Find Claims by Status**:
```sql
SELECT * FROM insurance_claims
WHERE eclaimLinkStatus = 'SUBMITTED'
  AND hospitalId = 'your-hospital-id';
```

**Find Pending Remittances**:
```sql
SELECT * FROM insurance_claims
WHERE eclaimLinkStatus IN ('SUBMITTED', 'ACCEPTED')
  AND processedAt IS NULL
  AND hospitalId = 'your-hospital-id';
```

**Find Secondary Claims**:
```sql
SELECT * FROM insurance_claims
WHERE isPrimary = false
  AND linkedClaimId IS NOT NULL
  AND hospitalId = 'your-hospital-id';
```

**Get Claim with Payment + GL Entries**:
```sql
SELECT 
  ic.*,
  p.amount as payment_amount,
  p.paymentDate,
  ge.description as gl_description,
  ge.transactionDate as gl_date
FROM insurance_claims ic
LEFT JOIN payments p ON p.invoiceId = ic.invoiceId
  AND p.paymentMethod = 'INSURANCE'
LEFT JOIN gl_entries ge ON ge.referenceType = 'PAYMENT'
  AND ge.referenceId = ic.id
WHERE ic.claimNumber = 'CLM-ABC123';
```

---

## Cron Jobs (Automated Tasks)

**Daily Remittance Fetching** (example):
```typescript
// backend/src/cron/fetchRemittances.ts
import { eclaimLinkService } from '../services/eclaimLinkService';
import prisma from '../config/database';

async function fetchPendingRemittances() {
  const pendingClaims = await prisma.insuranceClaim.findMany({
    where: {
      eclaimLinkStatus: { in: ['SUBMITTED', 'ACCEPTED'] },
      processedAt: null,
    },
    select: { id: true, claimNumber: true },
  });

  for (const claim of pendingClaims) {
    try {
      await eclaimLinkService.fetchAndProcessRemittance(claim.id);
      console.log(`✅ Remittance processed for ${claim.claimNumber}`);
    } catch (error) {
      console.error(`❌ Failed to process ${claim.claimNumber}:`, error);
    }
  }
}

// Run daily at 10:00 AM
// Schedule with node-cron, bull, or similar
```

---

## Security Checklist

- [ ] Store DHA credentials in encrypted vault (not plain `.env`)
- [ ] Use HTTPS for all API calls
- [ ] Validate JWT tokens on all endpoints
- [ ] Log all DHA API requests/responses (audit trail)
- [ ] Implement rate limiting (avoid DHA API throttling)
- [ ] Mask sensitive data in logs (patient names, Emirates ID)
- [ ] Restrict `/eclaim/submit` and `/eclaim/remittance` to ACCOUNTANT role only
- [ ] Enable feature flag in production only after testing

---

## Troubleshooting

**Issue**: "GL accounts not found. Skipping GL posting."

**Solution**:
```bash
POST /api/v1/accounting/accounts/seed
```

---

**Issue**: "Claim not found or not submitted to eClaimLink"

**Solution**:
- Check if `eclaimLinkId` is set in `InsuranceClaim` table
- Verify claim was submitted successfully

---

**Issue**: "Payer does not use eClaimLink platform"

**Solution**:
```sql
UPDATE insurance_payers
SET claimPlatform = 'eClaimLink'
WHERE code = 'DAMAN';
```

---

**Issue**: No payment created after remittance

**Solution**:
- Check `eclaimLinkStatus` in `InsuranceClaim`
- Verify `approvedAmount > 0` in remittance data
- Check logs for GL posting errors

---

## Quick Reference

| Task | Endpoint | Method |
|------|----------|--------|
| Preview claim | `/eclaim/preview/{type}/:id` | GET |
| Generate XML | `/eclaim/generate/{type}/:id` | POST |
| Submit to DHA | `/eclaim/submit/:claimId` | POST |
| Check status | `/eclaim/status/:claimId` | GET |
| Refresh status | `/eclaim/refresh-status/:claimId` | POST |
| Fetch remittance | `/eclaim/remittance/fetch/:claimId` | POST |
| Process remittance | `/eclaim/remittance/process` | POST |
| Parse ERA XML | `/eclaim/remittance/parse-xml` | POST |
| Get CRA | `/eclaim/cra/:dhaClaimId` | GET |

**Base URL**: `/api/v1/insurance-coding`

---

**Last Updated**: 2025-01-20  
**Version**: Phase 4 - Initial Release
