# Phase 4: Testing Guide

## Test Scenarios

### 1. Emirates ID Validation

#### Valid Emirates IDs:
```typescript
// Test cases that should PASS
validateEmiratesId('784-1990-1234567-1')  // ✅
validateEmiratesId('784-2000-7654321-9')  // ✅
validateEmiratesId('78419901234567 1')    // ✅ (accepts spaces)
validateEmiratesId('784 1990 1234567 1')  // ✅ (accepts spaces)
```

#### Invalid Emirates IDs:
```typescript
// Test cases that should FAIL
validateEmiratesId('784-1899-1234567-1')  // ❌ Year too old
validateEmiratesId('784-2050-1234567-1')  // ❌ Year too far in future
validateEmiratesId('971-1990-1234567-1')  // ❌ Wrong country code
validateEmiratesId('784-1990-123456-1')   // ❌ Too few digits
validateEmiratesId('784-1990-12345678-1') // ❌ Too many digits
```

#### API Test:
```bash
# Valid search
curl -X GET \
  'http://localhost:3001/api/v1/patients/search/eid/784-1990-1234567-1' \
  -H 'Authorization: Bearer <jwt_token>'

# Expected Response:
{
  "success": true,
  "data": {
    "id": "uuid",
    "firstName": "Ahmed",
    "lastName": "Al Mansoori",
    "emiratesId": "784-1990-1234567-1",
    ...
  }
}

# Invalid format
curl -X GET \
  'http://localhost:3001/api/v1/patients/search/eid/971-1990-1234567-1' \
  -H 'Authorization: Bearer <jwt_token>'

# Expected Response:
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "params.emiratesId",
      "message": "Invalid Emirates ID format. Expected: 784-YYYY-NNNNNNN-C"
    }
  ]
}
```

---

### 2. DHA eClaimLink XML Generation

#### Test OPD Claim:
```typescript
import { eclaimLinkService } from './services/eclaimLinkService';

// Generate XML for consultation
const xml = await eclaimLinkService.generateConsultationClaimXML(
  consultationId
);

console.log(xml);

// Expected output:
/*
<?xml version="1.0" encoding="UTF-8"?>
<Claim.Submission xmlns="http://dha.gov.ae/schema/eclaimlink" version="2.0">
  <Claim.Header>
    <SenderID>HOSP123</SenderID>
    <ReceiverID>DAMAN</ReceiverID>
    ...
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
*/
```

#### Test IPD Claim:
```typescript
// Generate XML for discharge coding
const xml = await eclaimLinkService.generateDischargeCodingClaimXML(
  dischargeCodingId
);

// Should include:
// - <ClaimType>IPD</ClaimType>
// - <EncounterType>2</EncounterType>
// - Multiple diagnoses (principal + secondary)
// - Bed charges, procedures, medications
```

---

### 3. Claim Submission (Sandbox Mode)

#### Setup:
```bash
# .env
DHA_ECLAIM_MODE=sandbox
ENABLE_ECLAIM_API_SUBMISSION=true
```

#### Test:
```typescript
const result = await eclaimLinkService.submitClaimToDHA(
  claimId,
  hospitalId
);

console.log(result);

// Expected (sandbox mode):
{
  success: true,
  dhaClaimId: 'MOCK-CLM-ABC123-1234567890',
  submittedAt: Date,
}

// Check database:
const claim = await prisma.insuranceClaim.findUnique({
  where: { id: claimId }
});

console.log(claim.eclaimLinkId);      // 'MOCK-CLM-ABC123-1234567890'
console.log(claim.eclaimLinkStatus);  // 'SUBMITTED'
console.log(claim.eclaimLinkResponse); // { status: 'ACCEPTED', ... }
```

---

### 4. ERA Processing

#### Test APPROVED Claim:
```typescript
const result = await eclaimLinkService.processRemittance({
  dhaClaimId: 'MOCK-CLM-ABC123',
  claimNumber: 'CLM-ABC123',
  status: 'APPROVED',
  approvedAmount: 1000.00,
  remittanceDate: new Date(),
  rawResponse: { status: 'APPROVED' },
});

console.log(result);
// Expected:
{
  success: true,
  claimUpdated: true,
  paymentCreated: true,
  appealCreated: false,
  secondaryClaimCreated: false,
}

// Check database:
const invoice = await prisma.invoice.findUnique({
  where: { id: invoiceId },
  include: { payments: true, claims: true }
});

console.log(invoice.status);      // 'PAID'
console.log(invoice.paidAmount);  // 1000.00
console.log(invoice.balanceAmount); // 0.00
console.log(invoice.payments.length); // 1
console.log(invoice.payments[0].paymentMethod); // 'INSURANCE'
```

#### Test PARTIALLY_APPROVED with COB:
```typescript
// Setup: Patient has primary + secondary insurance
const patient = await prisma.patient.findUnique({
  where: { id: patientId },
  include: { insurances: true }
});

// Patient has:
// - Primary: Daman (isPrimary=true, isActive=true)
// - Secondary: NGI (isPrimary=false, isActive=true)

// Primary claim for AED 1000
const primaryClaim = await billingService.submitInsuranceClaim(invoiceId, {
  insuranceProvider: 'Daman',
  policyNumber: 'POL-12345',
  claimAmount: 1000.00,
  ...
});

// Process partial approval (80% approved)
const result = await eclaimLinkService.processRemittance({
  dhaClaimId: 'MOCK-CLM-ABC123',
  claimNumber: primaryClaim.claimNumber,
  status: 'PARTIALLY_APPROVED',
  approvedAmount: 800.00,
  deniedAmount: 200.00,
  adjustmentReason: 'Copay 20%',
  remittanceDate: new Date(),
  rawResponse: { status: 'PARTIALLY_APPROVED' },
});

console.log(result);
// Expected:
{
  success: true,
  claimUpdated: true,
  paymentCreated: true,
  appealCreated: false,
  secondaryClaimCreated: true,  // ← COB triggered!
}

// Check database:
const invoice = await prisma.invoice.findUnique({
  where: { id: invoiceId },
  include: { claims: true }
});

console.log(invoice.status);      // 'PARTIALLY_PAID'
console.log(invoice.paidAmount);  // 800.00
console.log(invoice.balanceAmount); // 200.00
console.log(invoice.claims.length); // 2

// Primary claim:
const primary = invoice.claims.find(c => c.isPrimary);
console.log(primary.status);          // 'PARTIALLY_APPROVED'
console.log(primary.approvedAmount);  // 800.00

// Secondary claim (auto-created):
const secondary = invoice.claims.find(c => !c.isPrimary);
console.log(secondary.insuranceProvider); // 'NGI'
console.log(secondary.claimAmount);       // 200.00
console.log(secondary.linkedClaimId);     // primary.id
console.log(secondary.status);            // 'SUBMITTED'
console.log(secondary.notes);
// 'Secondary claim - Primary claim CLM-ABC123 partially approved for 800'
```

#### Test REJECTED Claim:
```typescript
const result = await eclaimLinkService.processRemittance({
  dhaClaimId: 'MOCK-CLM-ABC123',
  claimNumber: 'CLM-ABC123',
  status: 'REJECTED',
  deniedAmount: 1000.00,
  adjustmentReason: 'Service not covered',
  remittanceDate: new Date(),
  rawResponse: { status: 'REJECTED' },
});

console.log(result);
// Expected:
{
  success: true,
  claimUpdated: true,
  paymentCreated: false,
  appealCreated: false,  // Manual process
  secondaryClaimCreated: false,
}

// Check database:
const claim = await prisma.insuranceClaim.findUnique({
  where: { claimNumber: 'CLM-ABC123' }
});

console.log(claim.status);              // 'REJECTED'
console.log(claim.denialReasonCode);    // 'Service not covered'
console.log(claim.eclaimLinkStatus);    // 'REJECTED'

// Invoice remains unpaid:
const invoice = await prisma.invoice.findUnique({
  where: { id: claim.invoiceId }
});

console.log(invoice.status);        // 'PENDING'
console.log(invoice.balanceAmount); // 1000.00 (no payment)
```

---

### 5. COB Edge Cases

#### Case 1: No Secondary Insurance
```typescript
// Patient has ONLY primary insurance
const result = await eclaimLinkService.processRemittance({
  status: 'PARTIALLY_APPROVED',
  approvedAmount: 800.00,
  ...
});

console.log(result.secondaryClaimCreated); // false
// No secondary claim created (patient has no secondary insurance)
```

#### Case 2: Full Approval (No COB)
```typescript
// Primary claim fully approved
const result = await eclaimLinkService.processRemittance({
  status: 'APPROVED',
  approvedAmount: 1000.00,
  ...
});

console.log(result.secondaryClaimCreated); // false
// No remaining balance, so no secondary claim needed
```

#### Case 3: Secondary Claim is Primary
```typescript
// If the claim itself is secondary (isPrimary=false)
const secondaryClaim = { isPrimary: false, ... };

const result = await eclaimLinkService.processRemittance({
  status: 'PARTIALLY_APPROVED',
  approvedAmount: 150.00,
  ...
});

console.log(result.secondaryClaimCreated); // false
// Secondary claims don't trigger further COB
```

---

### 6. GL Entry Verification

#### Test Payment GL Posting:
```typescript
// After claim approved and payment created
const glEntries = await prisma.gLEntry.findMany({
  where: {
    description: {
      contains: 'Insurance claim payment'
    }
  },
  orderBy: { transactionDate: 'desc' },
  take: 2
});

// Expected 2 entries (double-entry accounting):
console.log(glEntries[0]);
// {
//   accountCode: '1010',  // Cash/Bank (DEBIT)
//   amount: 800.00,
//   type: 'DEBIT'
// }

console.log(glEntries[1]);
// {
//   accountCode: '1200',  // Accounts Receivable (CREDIT)
//   amount: 800.00,
//   type: 'CREDIT'
// }
```

---

### 7. Integration Test Flow

#### Complete OPD Billing → Claim → Remittance Flow:
```typescript
// 1. Create consultation
const consultation = await opdService.createConsultation(...);

// 2. Auto-generate invoice (triggered by consultation completion)
const invoice = await billingService.autoGenerateInvoice(
  consultation.appointmentId,
  hospitalId,
  'system'
);

// 3. Submit insurance claim
const claim = await billingService.submitInsuranceClaim(invoice.id, {
  insuranceProvider: 'Daman',
  policyNumber: 'POL-12345',
  claimAmount: invoice.totalAmount,
  createdBy: userId,
});

// 4. Submit to DHA eClaimLink
const submitResult = await eclaimLinkService.submitClaimToDHA(
  claim.id,
  hospitalId
);

console.log(submitResult.dhaClaimId); // 'MOCK-CLM-ABC123-...'

// 5. Simulate ERA from DHA (partial approval with COB)
const eraResult = await eclaimLinkService.processRemittance({
  dhaClaimId: submitResult.dhaClaimId,
  claimNumber: claim.claimNumber,
  status: 'PARTIALLY_APPROVED',
  approvedAmount: 800.00,
  deniedAmount: 200.00,
  adjustmentReason: 'Copay 20%',
  remittanceDate: new Date(),
  rawResponse: {},
});

console.log(eraResult);
// {
//   success: true,
//   paymentCreated: true,
//   secondaryClaimCreated: true
// }

// 6. Verify final state
const finalInvoice = await prisma.invoice.findUnique({
  where: { id: invoice.id },
  include: { claims: true, payments: true }
});

console.log('Invoice Status:', finalInvoice.status);        // 'PARTIALLY_PAID'
console.log('Paid Amount:', finalInvoice.paidAmount);       // 800.00
console.log('Balance:', finalInvoice.balanceAmount);        // 200.00
console.log('Claims Count:', finalInvoice.claims.length);   // 2
console.log('Payments Count:', finalInvoice.payments.length); // 1

const secondaryClaim = finalInvoice.claims.find(c => !c.isPrimary);
console.log('Secondary Claim Amount:', secondaryClaim.claimAmount); // 200.00
```

---

## Automated Testing

### Jest/Vitest Test Suite:

```typescript
// __tests__/eclaimLinkService.test.ts

describe('EClaimLinkService', () => {
  describe('XML Generation', () => {
    it('should generate valid OPD claim XML', async () => {
      const xml = await eclaimLinkService.generateConsultationClaimXML(
        consultationId
      );
      
      expect(xml).toContain('<ClaimType>OPD</ClaimType>');
      expect(xml).toContain('<EncounterType>1</EncounterType>');
      expect(xml).toContain('<Diagnosis>');
      expect(xml).toContain('<Activity>');
    });

    it('should generate valid IPD claim XML', async () => {
      const xml = await eclaimLinkService.generateDischargeCodingClaimXML(
        dischargeCodingId
      );
      
      expect(xml).toContain('<ClaimType>IPD</ClaimType>');
      expect(xml).toContain('<EncounterType>2</EncounterType>');
    });
  });

  describe('Remittance Processing', () => {
    it('should create payment for approved claim', async () => {
      const result = await eclaimLinkService.processRemittance({
        status: 'APPROVED',
        approvedAmount: 1000.00,
        ...
      });

      expect(result.success).toBe(true);
      expect(result.paymentCreated).toBe(true);
    });

    it('should create secondary claim for partial approval with COB', async () => {
      // Setup patient with secondary insurance
      const result = await eclaimLinkService.processRemittance({
        status: 'PARTIALLY_APPROVED',
        approvedAmount: 800.00,
        ...
      });

      expect(result.success).toBe(true);
      expect(result.secondaryClaimCreated).toBe(true);
    });
  });
});

// __tests__/uaeValidation.test.ts

describe('UAE Validation', () => {
  describe('Emirates ID', () => {
    it('should validate correct format', () => {
      const result = validateEmiratesId('784-1990-1234567-1');
      expect(result.isValid).toBe(true);
      expect(result.formatted).toBe('784-1990-1234567-1');
    });

    it('should reject invalid country code', () => {
      const result = validateEmiratesId('971-1990-1234567-1');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('784');
    });

    it('should reject invalid year', () => {
      const result = validateEmiratesId('784-1899-1234567-1');
      expect(result.isValid).toBe(false);
    });
  });
});
```

---

## Performance Testing

### Load Test Scenarios:

1. **Bulk Claim Submission:**
   ```typescript
   // Submit 100 claims in parallel (sandbox mode)
   const claims = await Promise.all(
     Array.from({ length: 100 }, async (_, i) => {
       return eclaimLinkService.submitClaimToDHA(
         claimIds[i],
         hospitalId
       );
     })
   );
   
   console.log('Success Rate:', claims.filter(c => c.success).length / 100);
   ```

2. **Concurrent ERA Processing:**
   ```typescript
   // Process 50 ERAs concurrently
   const results = await Promise.all(
     Array.from({ length: 50 }, async (_, i) => {
       return eclaimLinkService.processRemittance({
         dhaClaimId: `MOCK-${i}`,
         claimNumber: `CLM-${i}`,
         status: 'APPROVED',
         approvedAmount: 1000.00,
         remittanceDate: new Date(),
         rawResponse: {},
       });
     })
   );
   ```

---

## Troubleshooting

### Common Issues:

**Issue:** Emirates ID validation fails with "Invalid format"
```typescript
// Debug:
const eid = '78419901234567 1';
const digitsOnly = eid.replace(/\D/g, '');
console.log('Length:', digitsOnly.length); // Should be 15
console.log('Starts with 784:', digitsOnly.startsWith('784'));
```

**Issue:** COB not triggering
```typescript
// Debug:
const patient = await prisma.patient.findUnique({
  where: { id: patientId },
  include: {
    insurances: {
      where: { isActive: true }
    }
  }
});

console.log('Primary:', patient.insurances.filter(i => i.isPrimary));
console.log('Secondary:', patient.insurances.filter(i => !i.isPrimary));
// Should have at least one of each
```

**Issue:** Claim submission returns "Payer does not use eClaimLink"
```typescript
// Debug:
const claim = await prisma.insuranceClaim.findUnique({
  where: { id: claimId },
  include: { insurancePayer: true }
});

console.log(claim.insurancePayer?.claimPlatform);
// Should be 'eClaimLink'
```

---

**Testing Complete!** 🎉
