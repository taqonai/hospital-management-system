# Phase 4: Quick Reference Card

## 🚀 DHA eClaimLink Integration

### Submit Claim
```typescript
import { eclaimLinkService } from './services/eclaimLinkService';

// Generate and submit claim
const result = await eclaimLinkService.submitClaimToDHA(
  claimId,        // InsuranceClaim ID
  hospitalId
);

// Returns: { success, dhaClaimId, submittedAt, errorMessage }
```

### Check Claim Status
```typescript
const result = await eclaimLinkService.refreshClaimStatus(claimId);
// Returns: { updated, status, errorMessage }
```

### Process Remittance (ERA)
```typescript
const result = await eclaimLinkService.processRemittance({
  dhaClaimId: 'DHA-12345',
  claimNumber: 'CLM-ABC123',
  status: 'PARTIALLY_APPROVED',
  approvedAmount: 800.00,
  deniedAmount: 200.00,
  adjustmentReason: 'Procedure not covered',
  remittanceDate: new Date(),
  rawResponse: { /* DHA API response */ },
});

// Auto-creates:
// - Payment (if approved)
// - Secondary claim (if COB applicable)
// - GL entries
```

---

## ✅ Emirates ID Validation

### Validate Format
```typescript
import { validateEmiratesId } from './utils/uaeValidation';

const result = validateEmiratesId('784-1990-1234567-1');

if (result.isValid) {
  console.log('Formatted:', result.formatted);
} else {
  console.error('Error:', result.error);
}
```

### Search Patient by Emirates ID
```bash
GET /api/v1/patients/search/eid/784-1990-1234567-1
Authorization: Bearer <jwt_token>
```

---

## 🔄 COB (Coordination of Benefits)

### How It Works:
1. Primary claim is `PARTIALLY_APPROVED` with remaining balance
2. System checks if patient has secondary insurance
3. Auto-creates secondary claim with:
   - `isPrimary = false`
   - `linkedClaimId = primary claim ID`
   - `claimAmount = remaining balance`

### Manual COB Check:
```typescript
// In updateClaimStatus():
if (status === 'PARTIALLY_APPROVED' && newBalance > 0) {
  // Check patient.insurances for secondary insurance
  // Auto-create if exists
}
```

---

## 📋 XML Structure

### OPD Claim XML:
```xml
<Claim.Submission>
  <Claim.Header>
    <SenderID>facility_code</SenderID>
    <ReceiverID>payer_id</ReceiverID>
  </Claim.Header>
  <Claim>
    <ClaimType>OPD</ClaimType>
    <Encounter>
      <EncounterType>1</EncounterType>
    </Encounter>
    <Diagnosis.List>
      <Diagnosis>
        <Type>Principal</Type>
        <Code>A00.0</Code>
      </Diagnosis>
    </Diagnosis.List>
    <Activity.List>
      <Activity>
        <Code>99213</Code>
        <Quantity>1</Quantity>
        <Net>150.00</Net>
      </Activity>
    </Activity.List>
  </Claim>
</Claim.Submission>
```

---

## 🛠️ Environment Setup

```bash
# DHA eClaimLink
DHA_ECLAIM_MODE=sandbox
DHA_ECLAIM_USERNAME=your_username
DHA_ECLAIM_PASSWORD=your_password
DHA_ECLAIM_FACILITY_CODE=FAC123
ENABLE_ECLAIM_API_SUBMISSION=true

# DHA Riayati
DHA_RIAYATI_MODE=sandbox
DHA_RIAYATI_API_KEY=your_api_key
```

---

## 🔍 Debugging

### Enable Sandbox Mode:
```bash
DHA_ECLAIM_MODE=sandbox
```
Returns mock responses, no actual API calls.

### Check Logs:
```typescript
logger.info('[DHA eClaimLink] ...'); // Look for these
logger.info('[COB] ...'); // COB operations
logger.error('[DHA eClaimLink] API Error:', ...);
```

### Database Query:
```sql
SELECT 
  claimNumber,
  eclaimLinkId,
  eclaimLinkStatus,
  isPrimary,
  linkedClaimId
FROM insurance_claims
WHERE eclaimLinkStatus IS NOT NULL
ORDER BY createdAt DESC;
```

---

## 📊 Common Workflows

### 1. Submit New Claim
```typescript
// 1. Create insurance claim
const claim = await billingService.submitInsuranceClaim(invoiceId, {
  insuranceProvider: 'Daman',
  policyNumber: 'POL-12345',
  claimAmount: 1000.00,
  ...
});

// 2. Submit to DHA
const result = await eclaimLinkService.submitClaimToDHA(
  claim.id,
  hospitalId
);
```

### 2. Process Remittance
```typescript
// When DHA sends ERA/CRA
const result = await eclaimLinkService.processRemittance({
  dhaClaimId: 'DHA-12345',
  claimNumber: 'CLM-ABC123',
  status: 'APPROVED',
  approvedAmount: 1000.00,
  remittanceDate: new Date(),
  rawResponse: eraData,
});

// Auto-creates payment and updates invoice
```

### 3. Handle COB
```typescript
// Automatic when processing PARTIALLY_APPROVED
// No manual intervention needed!

// Check result:
if (result.secondaryClaimCreated) {
  console.log('Secondary claim created for remaining balance');
}
```

---

## 🐛 Troubleshooting

### Claim Submission Fails
- ✅ Check `ENABLE_ECLAIM_API_SUBMISSION=true`
- ✅ Verify `DHA_ECLAIM_USERNAME` and `DHA_ECLAIM_PASSWORD`
- ✅ Ensure payer has `claimPlatform = 'eClaimLink'`

### Emirates ID Validation Fails
- ✅ Format must be: `784-YYYY-NNNNNNN-C`
- ✅ 15 digits total
- ✅ Must start with 784

### COB Not Triggering
- ✅ Primary claim must have `isPrimary = true`
- ✅ Patient must have active secondary insurance (`isPrimary = false, isActive = true`)
- ✅ Remaining balance must be > 0

---

## 📞 Quick Links

- **Full Documentation:** `PHASE4_IMPLEMENTATION_SUMMARY.md`
- **Validation Utils:** `backend/src/utils/uaeValidation.ts`
- **eClaimLink Service:** `backend/src/services/eclaimLinkService.ts`
- **Billing Service:** `backend/src/services/billingService.ts`
- **Patient Routes:** `backend/src/routes/patientRoutes.ts`

---

**Last Updated:** February 3, 2025
