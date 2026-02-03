# DHA eClaimLink XML Structure Reference

**Implementation**: Phase 4 - `/backend/src/services/eclaimLinkService.ts`

---

## Complete XML Structure

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Claim.Submission xmlns="http://dha.gov.ae/schema/eclaimlink" version="2.0">
  
  <!-- ==================== HEADER ==================== -->
  <Claim.Header>
    <SenderID>HOSP-12345</SenderID>              <!-- Provider License Number -->
    <ReceiverID>PAYER-001</ReceiverID>           <!-- Insurance Payer ID -->
    <TransactionDate>2025-01-20 14:30:00</TransactionDate>
    <TransactionID>CLM-ABC123</TransactionID>    <!-- Unique Claim ID -->
    <TradingPartnerServiceID>FAC-67890</TradingPartnerServiceID> <!-- Facility Code -->
  </Claim.Header>

  <!-- ==================== CLAIM BODY ==================== -->
  <Claim>
    
    <!-- Claim Information -->
    <ClaimInfo>
      <ClaimID>CLM-ABC123</ClaimID>
      <ClaimType>OPD</ClaimType>                <!-- OPD or IPD -->
      <FilingIndicatorCode>MC</FilingIndicatorCode>
      <SubmissionDate>2025-01-20</SubmissionDate>
    </ClaimInfo>

    <!-- Payer Information -->
    <Payer>
      <PayerID>PAYER-001</PayerID>
      <PayerName>Daman Health Insurance</PayerName>
    </Payer>

    <!-- Provider Information -->
    <Provider>
      <ProviderID>HOSP-12345</ProviderID>
      <ProviderName>Spetaar General Hospital</ProviderName>
      <TaxID>FAC-67890</TaxID>
    </Provider>

    <!-- Subscriber (Policy Holder) -->
    <Subscriber>
      <MemberID>POL-123456789</MemberID>
      <PolicyNumber>PAYER-001</PolicyNumber>
    </Subscriber>

    <!-- Patient Information -->
    <Patient>
      <PatientFileNo>MRN-001234</PatientFileNo>
      <EmiratesIDNumber>784-2020-1234567-1</EmiratesIDNumber>
      <Relationship>SELF</Relationship>          <!-- SELF, SPOUSE, CHILD, etc. -->
    </Patient>

    <!-- Claim Charges Summary -->
    <ClaimCharges>
      <GrossAmount>1000.00</GrossAmount>         <!-- Total billed amount -->
      <PatientShare>200.00</PatientShare>        <!-- Copay / patient portion -->
      <NetAmount>800.00</NetAmount>              <!-- Insurance portion -->
      <Currency>AED</Currency>
    </ClaimCharges>

    <!-- Encounter Details -->
    <Encounter>
      <FacilityID>HOSP-12345</FacilityID>
      <EncounterType>1</EncounterType>           <!-- 1=OUTPATIENT, 2=INPATIENT -->
      <EncounterTypeDescription>OUTPATIENT</EncounterTypeDescription>
      <PatientAccountNo>MRN-001234</PatientAccountNo>
      <AdmissionDate>2025-01-20 09:00:00</AdmissionDate>
      <DischargeDate>2025-01-20 11:00:00</DischargeDate>
      <AdmissionType>1</AdmissionType>           <!-- 1=Emergency, 2=Elective, etc. -->
      <DischargeStatus>1</DischargeStatus>       <!-- 1=Home, 2=Transfer, etc. -->
    </Encounter>

    <!-- ==================== DIAGNOSES ==================== -->
    <Diagnosis.List>
      
      <!-- Principal Diagnosis -->
      <Diagnosis>
        <Sequence>1</Sequence>
        <Type>Principal</Type>
        <Code>J18.9</Code>                       <!-- ICD-10 Code -->
        <CodeType>ICD10</CodeType>
        <DxInfoType>Y</DxInfoType>               <!-- POA: Y=Yes, N=No, U=Unknown, W=Not Applicable -->
      </Diagnosis>

      <!-- Secondary Diagnosis -->
      <Diagnosis>
        <Sequence>2</Sequence>
        <Type>Secondary</Type>
        <Code>E11.65</Code>
        <CodeType>ICD10</CodeType>
        <DxInfoType>N</DxInfoType>
      </Diagnosis>

    </Diagnosis.List>

    <!-- ==================== ACTIVITIES (Procedures/Services) ==================== -->
    <Activity.List>
      
      <!-- Activity 1: Consultation -->
      <Activity>
        <ID>ACT-1</ID>
        <Start>2025-01-20 09:00:00</Start>
        <Type>CPT</Type>                         <!-- CPT, DRUG, OTHER -->
        <Code>99213</Code>                       <!-- CPT Code -->
        <CodeType>CPT</CodeType>
        <Modifier>25</Modifier>                  <!-- Optional modifiers (comma-separated) -->
        <Quantity>1</Quantity>
        <UnitPrice>250.00</UnitPrice>
        <Net>250.00</Net>                        <!-- Quantity × UnitPrice -->
        <Clinician>
          <LicenseNo>DOC-12345</LicenseNo>
        </Clinician>
        <PriorAuthorizationID>AUTH-67890</PriorAuthorizationID> <!-- Optional -->
      </Activity>

      <!-- Activity 2: Laboratory Test -->
      <Activity>
        <ID>ACT-2</ID>
        <Start>2025-01-20 09:30:00</Start>
        <Type>CPT</Type>
        <Code>80053</Code>
        <CodeType>CPT</CodeType>
        <Quantity>1</Quantity>
        <UnitPrice>150.00</UnitPrice>
        <Net>150.00</Net>
        <Clinician>
          <LicenseNo>DOC-12345</LicenseNo>
        </Clinician>
      </Activity>

      <!-- Activity 3: Medication -->
      <Activity>
        <ID>ACT-3</ID>
        <Start>2025-01-20 10:00:00</Start>
        <Type>DRUG</Type>
        <Code>J1100</Code>                       <!-- HCPCS Code for drugs -->
        <CodeType>CPT</CodeType>
        <Quantity>10</Quantity>
        <UnitPrice>5.00</UnitPrice>
        <Net>50.00</Net>
        <Clinician>
          <LicenseNo>DOC-12345</LicenseNo>
        </Clinician>
      </Activity>

    </Activity.List>

    <!-- ==================== OBSERVATIONS (Clinical Notes) ==================== -->
    <Observation.List>
      
      <Observation>
        <ObservationType>CHIEF_COMPLAINT</ObservationType>
        <Value>Fever and cough for 3 days</Value>
      </Observation>

      <Observation>
        <ObservationType>VITAL_SIGNS</ObservationType>
        <Value>BP: 120/80, Temp: 38.5°C, HR: 88, SpO2: 96%</Value>
      </Observation>

      <Observation>
        <ObservationType>CLINICAL_NOTES</ObservationType>
        <Value>Patient presents with respiratory symptoms. Physical examination reveals crackles in lower lung fields.</Value>
      </Observation>

    </Observation.List>

  </Claim>
</Claim.Submission>
```

---

## Field Mappings

### OPD (Outpatient) Claim Mapping

| XML Element | Source | Prisma Model |
|-------------|--------|--------------|
| `ClaimID` | `consultation.id` (first 8 chars) | `Consultation` |
| `ClaimType` | `OPD` | Hardcoded |
| `PatientFileNo` | `patient.mrn` | `Patient.mrn` |
| `EmiratesIDNumber` | `patient.emiratesId` | `Patient.emiratesId` |
| `AdmissionDate` | `consultation.createdAt` | `Consultation.createdAt` |
| `Diagnosis.Code` | `icd10Code.code` | `ConsultationDiagnosis → ICD10Code.code` |
| `Activity.Code` | `cptCode.code` | `ConsultationProcedure → CPTCode.code` |
| `Clinician.LicenseNo` | `doctor.licenseNumber` | `Doctor.licenseNumber` |

### IPD (Inpatient) Claim Mapping

| XML Element | Source | Prisma Model |
|-------------|--------|--------------|
| `ClaimID` | `dischargeCoding.id` (first 8 chars) | `DischargeCoding` |
| `ClaimType` | `IPD` | Hardcoded |
| `PatientFileNo` | `patient.mrn` | `Patient.mrn` |
| `AdmissionDate` | `admission.admissionDate` | `Admission.admissionDate` |
| `DischargeDate` | `admission.dischargeDate` | `Admission.dischargeDate` |
| `Diagnosis.Code` | `icd10Code.code` | `DischargeDiagnosis → ICD10Code.code` |
| `Activity.Code` | `cptCode.code` | `DischargeProcedure → CPTCode.code` |
| `TotalCharges` | `dischargeCoding.totalCharges` | `DischargeCoding.totalCharges` |

---

## Activity Types

| Type | Description | Example Codes |
|------|-------------|---------------|
| `CPT` | Current Procedural Terminology | 99213 (Office visit), 80053 (Comprehensive metabolic panel) |
| `DRUG` | Medication / Pharmaceutical | J1100 (Dexamethasone injection) |
| `OTHER` | Miscellaneous services | Custom facility codes |

---

## Encounter Types

| Code | Description | Use Case |
|------|-------------|----------|
| `1` | OUTPATIENT | OPD consultations, clinic visits |
| `2` | INPATIENT | IPD admissions, hospitalization |
| `3` | EMERGENCY | ER visits |
| `4` | DAY_CARE | Day surgery, observation |

---

## Diagnosis Types

| Type | Description | Sequence |
|------|-------------|----------|
| `Principal` | Primary reason for visit/admission | 1 |
| `Secondary` | Additional diagnoses | 2+ |

### POA (Present on Admission) Indicators

| Code | Meaning | Use Case |
|------|---------|----------|
| `Y` | Yes, present on admission | Condition existed before hospitalization |
| `N` | No, acquired after admission | Hospital-acquired condition |
| `U` | Unknown | Documentation insufficient |
| `W` | Not applicable | Non-inpatient setting (OPD) |

---

## CPT Modifiers

Common modifiers used in UAE healthcare:

| Modifier | Description | Use Case |
|----------|-------------|----------|
| `25` | Significant, separately identifiable E&M service | E&M on same day as procedure |
| `26` | Professional component | Radiology/lab interpretation only |
| `TC` | Technical component | Equipment/facility only |
| `59` | Distinct procedural service | Unbundle procedures |
| `76` | Repeat procedure by same physician | Same procedure, same day |
| `77` | Repeat procedure by different physician | Same procedure, different physician |

---

## Validation Rules

### Required Fields

**Header**:
- `SenderID` (Provider License)
- `ReceiverID` (Payer ID)
- `TransactionDate`
- `TransactionID` (Claim ID)

**Claim**:
- `ClaimType` (OPD/IPD)
- `MemberID` (Policy Number)
- `PatientFileNo` (MRN)
- At least 1 `Diagnosis` (type=Principal)
- At least 1 `Activity` (procedure/service)
- `NetAmount` > 0

### Business Rules

1. **Balanced Charges**: `NetAmount` = sum of all `Activity.Net`
2. **Diagnosis Sequencing**: Exactly one `Principal` diagnosis (Sequence=1)
3. **Activity Dates**: Must fall within `AdmissionDate` and `DischargeDate`
4. **CPT Modifiers**: Max 4 modifiers per activity
5. **Emirates ID**: Format `784-YYYY-NNNNNNN-C` (if provided)

---

## XML Escaping

Special characters are escaped to prevent XML parsing errors:

| Character | Escaped As |
|-----------|------------|
| `&` | `&amp;` |
| `<` | `&lt;` |
| `>` | `&gt;` |
| `"` | `&quot;` |
| `'` | `&apos;` |

**Example**:
```typescript
const escapeXml = (str: string) => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};
```

---

## Date/Time Formatting

| Format | Example | Use Case |
|--------|---------|----------|
| Date | `2025-01-20` | `SubmissionDate` |
| DateTime | `2025-01-20 14:30:00` | `TransactionDate`, `AdmissionDate` |
| ISO 8601 | `2025-01-20T14:30:00.000Z` | Internal timestamps |

---

## Sample XML Files

### OPD (Outpatient) Example

**Scenario**: Patient with respiratory infection, prescribed antibiotics

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Claim.Submission xmlns="http://dha.gov.ae/schema/eclaimlink" version="2.0">
  <Claim.Header>
    <SenderID>HOSP-001</SenderID>
    <ReceiverID>DAMAN</ReceiverID>
    <TransactionDate>2025-01-20 10:15:00</TransactionDate>
    <TransactionID>OPD-ABC123</TransactionID>
    <TradingPartnerServiceID>FAC-001</TradingPartnerServiceID>
  </Claim.Header>
  <Claim>
    <ClaimInfo>
      <ClaimID>OPD-ABC123</ClaimID>
      <ClaimType>OPD</ClaimType>
      <FilingIndicatorCode>MC</FilingIndicatorCode>
      <SubmissionDate>2025-01-20</SubmissionDate>
    </ClaimInfo>
    <Payer>
      <PayerID>DAMAN</PayerID>
      <PayerName>Daman Health Insurance</PayerName>
    </Payer>
    <Provider>
      <ProviderID>HOSP-001</ProviderID>
      <ProviderName>Spetaar General Hospital</ProviderName>
      <TaxID>FAC-001</TaxID>
    </Provider>
    <Subscriber>
      <MemberID>12345678</MemberID>
      <PolicyNumber>DAMAN</PolicyNumber>
    </Subscriber>
    <Patient>
      <PatientFileNo>MRN-001</PatientFileNo>
      <EmiratesIDNumber>784-2020-1234567-1</EmiratesIDNumber>
      <Relationship>SELF</Relationship>
    </Patient>
    <ClaimCharges>
      <GrossAmount>450.00</GrossAmount>
      <PatientShare>50.00</PatientShare>
      <NetAmount>400.00</NetAmount>
      <Currency>AED</Currency>
    </ClaimCharges>
    <Encounter>
      <FacilityID>HOSP-001</FacilityID>
      <EncounterType>1</EncounterType>
      <EncounterTypeDescription>OUTPATIENT</EncounterTypeDescription>
      <PatientAccountNo>MRN-001</PatientAccountNo>
      <AdmissionDate>2025-01-20 09:00:00</AdmissionDate>
      <DischargeDate>2025-01-20 09:30:00</DischargeDate>
      <AdmissionType>1</AdmissionType>
      <DischargeStatus>1</DischargeStatus>
    </Encounter>
    <Diagnosis.List>
      <Diagnosis>
        <Sequence>1</Sequence>
        <Type>Principal</Type>
        <Code>J06.9</Code>
        <CodeType>ICD10</CodeType>
        <DxInfoType>W</DxInfoType>
      </Diagnosis>
    </Diagnosis.List>
    <Activity.List>
      <Activity>
        <ID>ACT-1</ID>
        <Start>2025-01-20 09:00:00</Start>
        <Type>CPT</Type>
        <Code>99213</Code>
        <CodeType>CPT</CodeType>
        <Quantity>1</Quantity>
        <UnitPrice>250.00</UnitPrice>
        <Net>250.00</Net>
        <Clinician>
          <LicenseNo>DOC-001</LicenseNo>
        </Clinician>
      </Activity>
      <Activity>
        <ID>ACT-2</ID>
        <Start>2025-01-20 09:20:00</Start>
        <Type>DRUG</Type>
        <Code>J0690</Code>
        <CodeType>CPT</CodeType>
        <Quantity>10</Quantity>
        <UnitPrice>15.00</UnitPrice>
        <Net>150.00</Net>
        <Clinician>
          <LicenseNo>DOC-001</LicenseNo>
        </Clinician>
      </Activity>
    </Activity.List>
    <Observation.List>
      <Observation>
        <ObservationType>CHIEF_COMPLAINT</ObservationType>
        <Value>Sore throat and fever</Value>
      </Observation>
    </Observation.List>
  </Claim>
</Claim.Submission>
```

### IPD (Inpatient) Example

**Scenario**: 2-day hospital admission for pneumonia treatment

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Claim.Submission xmlns="http://dha.gov.ae/schema/eclaimlink" version="2.0">
  <Claim.Header>
    <SenderID>HOSP-001</SenderID>
    <ReceiverID>NEURON</ReceiverID>
    <TransactionDate>2025-01-22 16:00:00</TransactionDate>
    <TransactionID>IPD-XYZ789</TransactionID>
    <TradingPartnerServiceID>FAC-001</TradingPartnerServiceID>
  </Claim.Header>
  <Claim>
    <ClaimInfo>
      <ClaimID>IPD-XYZ789</ClaimID>
      <ClaimType>IPD</ClaimType>
      <FilingIndicatorCode>MC</FilingIndicatorCode>
      <SubmissionDate>2025-01-22</SubmissionDate>
    </ClaimInfo>
    <Payer>
      <PayerID>NEURON</PayerID>
      <PayerName>Neuron Insurance</PayerName>
    </Payer>
    <Provider>
      <ProviderID>HOSP-001</ProviderID>
      <ProviderName>Spetaar General Hospital</ProviderName>
      <TaxID>FAC-001</TaxID>
    </Provider>
    <Subscriber>
      <MemberID>87654321</MemberID>
      <PolicyNumber>NEURON</PolicyNumber>
    </Subscriber>
    <Patient>
      <PatientFileNo>MRN-002</PatientFileNo>
      <EmiratesIDNumber>784-2019-9876543-2</EmiratesIDNumber>
      <Relationship>SELF</Relationship>
    </Patient>
    <ClaimCharges>
      <GrossAmount>8500.00</GrossAmount>
      <PatientShare>500.00</PatientShare>
      <NetAmount>8000.00</NetAmount>
      <Currency>AED</Currency>
    </ClaimCharges>
    <Encounter>
      <FacilityID>HOSP-001</FacilityID>
      <EncounterType>2</EncounterType>
      <EncounterTypeDescription>INPATIENT</EncounterTypeDescription>
      <PatientAccountNo>MRN-002</PatientAccountNo>
      <AdmissionDate>2025-01-20 14:00:00</AdmissionDate>
      <DischargeDate>2025-01-22 12:00:00</DischargeDate>
      <AdmissionType>1</AdmissionType>
      <DischargeStatus>1</DischargeStatus>
    </Encounter>
    <Diagnosis.List>
      <Diagnosis>
        <Sequence>1</Sequence>
        <Type>Principal</Type>
        <Code>J18.9</Code>
        <CodeType>ICD10</CodeType>
        <DxInfoType>Y</DxInfoType>
      </Diagnosis>
      <Diagnosis>
        <Sequence>2</Sequence>
        <Type>Secondary</Type>
        <Code>E11.9</Code>
        <CodeType>ICD10</CodeType>
        <DxInfoType>Y</DxInfoType>
      </Diagnosis>
    </Diagnosis.List>
    <Activity.List>
      <Activity>
        <ID>ACT-1</ID>
        <Start>2025-01-20 14:00:00</Start>
        <Type>CPT</Type>
        <Code>99223</Code>
        <CodeType>CPT</CodeType>
        <Quantity>1</Quantity>
        <UnitPrice>500.00</UnitPrice>
        <Net>500.00</Net>
        <Clinician>
          <LicenseNo>DOC-002</LicenseNo>
        </Clinician>
      </Activity>
      <Activity>
        <ID>ACT-2</ID>
        <Start>2025-01-20 14:00:00</Start>
        <Type>OTHER</Type>
        <Code>ROOM-GENERAL</Code>
        <CodeType>CPT</CodeType>
        <Quantity>2</Quantity>
        <UnitPrice>1500.00</UnitPrice>
        <Net>3000.00</Net>
        <Clinician>
          <LicenseNo>DOC-002</LicenseNo>
        </Clinician>
      </Activity>
      <Activity>
        <ID>ACT-3</ID>
        <Start>2025-01-20 15:00:00</Start>
        <Type>CPT</Type>
        <Code>71046</Code>
        <CodeType>CPT</CodeType>
        <Quantity>1</Quantity>
        <UnitPrice>300.00</UnitPrice>
        <Net>300.00</Net>
        <Clinician>
          <LicenseNo>DOC-002</LicenseNo>
        </Clinician>
      </Activity>
      <Activity>
        <ID>ACT-4</ID>
        <Start>2025-01-20 16:00:00</Start>
        <Type>DRUG</Type>
        <Code>J1100</Code>
        <CodeType>CPT</CodeType>
        <Quantity>20</Quantity>
        <UnitPrice>10.00</UnitPrice>
        <Net>200.00</Net>
        <Clinician>
          <LicenseNo>DOC-002</LicenseNo>
        </Clinician>
      </Activity>
    </Activity.List>
    <Observation.List>
      <Observation>
        <ObservationType>CHIEF_COMPLAINT</ObservationType>
        <Value>Fever, cough, and shortness of breath for 5 days</Value>
      </Observation>
      <Observation>
        <ObservationType>CLINICAL_NOTES</ObservationType>
        <Value>Patient admitted with community-acquired pneumonia. Treated with IV antibiotics. Condition improved, discharged on oral antibiotics.</Value>
      </Observation>
    </Observation.List>
  </Claim>
</Claim.Submission>
```

---

## Implementation Notes

1. **XML Validation**: Consider adding XSD schema validation before submission
2. **Performance**: Batch claim generation for multiple patients
3. **Error Handling**: Retry logic for network failures (exponential backoff)
4. **Logging**: Log all DHA API requests/responses for audit trail
5. **Security**: Store DHA credentials in encrypted vault (not plain text .env)

---

## Testing Checklist

- [ ] Generate valid XML for OPD consultation
- [ ] Generate valid XML for IPD discharge
- [ ] Validate required fields (diagnoses, activities, amounts)
- [ ] Escape special characters in patient names, notes
- [ ] Test with missing optional fields (modifiers, prior auth)
- [ ] Test with multiple diagnoses (principal + secondary)
- [ ] Test with multiple activities (consultation + lab + drugs)
- [ ] Submit to DHA sandbox and verify acceptance
- [ ] Process mock remittance and verify payment creation
- [ ] Verify GL entries posted correctly

---

**Reference**: `/backend/src/services/eclaimLinkService.ts` (lines 570-720)
