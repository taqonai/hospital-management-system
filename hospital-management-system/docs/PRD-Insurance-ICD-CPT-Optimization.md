# PRD: Insurance Coding Optimization System (ICD-10 / CPT)

**Version:** 2.0
**Date:** January 2026
**Author:** Engineering Team
**Status:** Draft - Pending Review

---

## 1. Executive Summary

### 1.1 Objective

Build an intelligent insurance coding system that:
1. Provides an **Admin Portal** for managing ICD-10/CPT code configurations, payer rules, and pricing
2. Integrates into the **Doctor's Journey** to recommend optimal ICD-10 and CPT codes after diagnosis
3. Maximizes **claim acceptance rates** and **hospital revenue** through AI-driven code optimization
4. Supports **Dubai regulatory requirements** (DHA/eClaimLink) with fee-for-service billing

### 1.2 Problem Statement

**Current State:**
- ICD codes stored as simple strings in `Consultation.icdCodes[]` without validation or master reference
- CPT codes only exist in `Surgery.cptCode` (string) - no linkage to billing
- No ICD/CPT master tables or payer-specific rules
- Manual invoice creation disconnected from clinical documentation
- No AI assistance for code selection or optimization
- High claim rejection risk due to coding errors, specificity issues, and ICD-CPT mismatches

**Desired State:**
- Comprehensive ICD-10/CPT code database with Dubai/UAE-specific mappings
- AI-powered code recommendations based on clinical documentation
- Automatic code validation against payer rules before claim submission
- Optimized code selection for maximum reimbursement within ethical bounds
- Real-time feedback on code acceptance probability

### 1.3 Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Claim First-Pass Acceptance Rate | ~70% (estimated) | >90% | Claims approved without resubmission |
| Average Coding Time per Consultation | 5-10 min (manual) | <2 min | Time from diagnosis to code selection |
| Revenue per Encounter | Baseline | +15-20% | Optimized code selection |
| Coding Error Rate | Unknown | <2% | Invalid/rejected codes |
| AI Adoption Rate | N/A | >80% | % of consultations using AI suggestions |

---

## 2. Dubai Healthcare Insurance Context

### 2.1 Regulatory Framework

Dubai operates under the Dubai Health Authority (DHA) with the eClaimLink platform for electronic claims submission.

| Aspect | Details |
|--------|---------|
| **Regulator** | DHA (Dubai Health Authority) |
| **Platform** | eClaimLink, NABIDH |
| **Billing Model** | Fee-for-Service (ICD-10-CM + CPT) |
| **Outpatient** | ICD-10-CM diagnosis + CPT procedure codes |
| **Inpatient** | ICD-10-CM diagnosis + CPT procedure codes (itemized billing) |

**Key Standards:**
- **ICD-10-CM**: International Classification of Diseases, 10th Revision, Clinical Modification
- **CPT**: Current Procedural Terminology (AMA standard)
- **HCPCS**: Healthcare Common Procedure Coding System (Level II for supplies/equipment)
- **CDT**: Current Dental Terminology (for dental procedures)

### 2.2 Common Claim Rejection Reasons in Dubai

Based on industry analysis, the top rejection reasons are:

1. **Coding Errors (35-40%)**: Invalid codes, outdated codes, lack of specificity
2. **Medical Necessity (20-25%)**: ICD-CPT mismatch, diagnosis doesn't justify procedure
3. **Missing Pre-Authorization (15-20%)**: Required approval not obtained
4. **Documentation Gaps (10-15%)**: Insufficient clinical notes to support codes
5. **Timely Filing (5-10%)**: Claim submitted after payer deadline

### 2.3 ICD-CPT Relationships

```
FEE-FOR-SERVICE BILLING (OPD & IPD):
  Diagnosis (ICD-10) <-> Procedure (CPT) <-> Payer Rules <-> Reimbursement

Example - Pneumonia Treatment:
  ICD-10: J15.1 (Pneumonia due to Pseudomonas)
  CPT Codes:
    - 99215 (Office visit, established patient, high complexity)
    - 71046 (Chest X-ray, 2 views)
    - 87081 (Culture, bacterial screening)

  Medical Necessity Check: Does J15.1 justify each CPT code?
  Payer Rules: Any pre-auth required? Any coverage limits?
```

---

## 3. Proposed Solution Architecture

### 3.1 High-Level Architecture

```
+-----------------------------------------------------------------------------+
|                              ADMIN PORTAL                                    |
|  +-----------+ +-----------+ +---------------+ +---------------------------+ |
|  |  ICD-10   | |   CPT     | |    Payer      | |  Analytics &              | |
|  |Management | |Management | |    Rules      | |  Optimization             | |
|  +-----------+ +-----------+ +---------------+ +---------------------------+ |
+-----------------------------------------------------------------------------+
                                      |
                                      v
+-----------------------------------------------------------------------------+
|                         AI CODING ENGINE                                     |
|  +-------------------+  +---------------------+  +-------------------------+ |
|  | Code Suggestion   |  | Medical Necessity   |  | Acceptance Probability  | |
|  | (LLM + Rules)     |  | Validator           |  | Predictor               | |
|  +-------------------+  +---------------------+  +-------------------------+ |
+-----------------------------------------------------------------------------+
                                      |
                                      v
+-----------------------------------------------------------------------------+
|                        DOCTOR'S JOURNEY                                      |
|  +------------+  +------------+  +------------+  +------------------------+ |
|  | Diagnosis  |->| Procedures |->| Code       |->| Finalize Bill          | |
|  | Entry      |  | Selection  |  | Suggestions|  |                        | |
|  +------------+  +------------+  +------------+  +------------------------+ |
+-----------------------------------------------------------------------------+
```

### 3.2 Component Overview

| Component | Purpose | Technology |
|-----------|---------|------------|
| ICD-10 Code Manager | Master code database with UAE-specific additions | PostgreSQL + Admin UI |
| CPT Code Manager | Procedure codes with pricing tiers | PostgreSQL + Admin UI |
| Payer Rules Engine | Insurance-specific coverage, limits, requirements | Rule-based JSON configs |
| AI Coding Engine | ML-based code suggestions from clinical text | Python FastAPI + GPT-4o |
| Medical Necessity Validator | ICD-CPT compatibility checking | Rule-based + ML |
| Acceptance Predictor | Probability scoring for code combinations | XGBoost / Neural Network |
| Doctor UI Integration | Code suggestion interface in consultation flow | React components |

---

## 4. Detailed Feature Specifications

### 4.1 Admin Portal - ICD-10 Code Management

#### 4.1.1 ICD-10 Master Table

**Data Model:**
```prisma
model ICD10Code {
  id                String   @id @default(uuid())
  hospitalId        String
  code              String           // e.g., "J15.1"
  description       String           // "Pneumonia due to Pseudomonas"
  shortDescription  String?          // "Pseudomonas pneumonia"
  category          String           // Chapter/Category (e.g., "Respiratory")
  subcategory       String?          // More specific grouping

  // Dubai/UAE-specific fields
  dhaApproved       Boolean @default(true)   // Approved for Dubai claims

  // Specificity & Quality
  specificityLevel  Int     @default(1)      // 1-5 (5 = most specific)
  isUnspecified     Boolean @default(false)  // Flags codes like "X99.9 unspecified"
  preferredCode     String?                  // More specific alternative

  // Usage & Performance
  usageCount        Int     @default(0)
  acceptanceRate    Float?                   // Historical acceptance %
  avgReimbursement  Decimal? @db.Decimal(10,2)

  // Relationships
  validCptCodes     ICD10CPTMapping[]
  payerRules        ICD10PayerRule[]

  isActive          Boolean @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  hospital          Hospital @relation(fields: [hospitalId], references: [id])

  @@unique([hospitalId, code])
  @@index([hospitalId, category])
  @@index([hospitalId, code])
}
```

#### 4.1.2 Admin UI Features

| Feature | Description |
|---------|-------------|
| **Code Browser** | Hierarchical view of ICD-10 chapters/categories with search |
| **Bulk Import** | CSV/Excel import of ICD-10 codes with UAE mappings |
| **Code Editor** | Edit descriptions, DHA approval status, specificity |
| **Specificity Alerts** | Highlight unspecified codes with better alternatives |
| **Usage Analytics** | View most-used codes, acceptance rates, revenue impact |
| **Deactivation** | Soft-disable outdated or problematic codes |

### 4.2 Admin Portal - CPT Code Management

#### 4.2.1 CPT Master Table

**Data Model:**
```prisma
model CPTCode {
  id                String   @id @default(uuid())
  hospitalId        String
  code              String           // e.g., "99214"
  description       String           // "Office visit, est patient, moderate"
  shortDescription  String?
  category          String           // E&M, Surgery, Radiology, Lab, etc.
  subcategory       String?

  // Pricing (multi-tier)
  basePrice         Decimal  @db.Decimal(10,2)
  dhaPrice          Decimal? @db.Decimal(10,2)  // Dubai tariff
  cashPrice         Decimal? @db.Decimal(10,2)  // Self-pay price

  // Complexity & Time
  rvuWork           Float?           // Relative Value Unit (work)
  rvuPractice       Float?           // RVU (practice expense)
  rvuMalpractice    Float?           // RVU (malpractice)
  typicalTime       Int?             // Minutes

  // Requirements
  requiresPreAuth   Boolean @default(false)
  requiresModifier  Boolean @default(false)
  globalPeriod      Int?             // Days (for surgical follow-up)

  // Bundling Rules
  bundledWith       String[]         // CPT codes often billed together
  excludedWith      String[]         // CPT codes that can't be billed together

  // Performance Metrics
  usageCount        Int     @default(0)
  acceptanceRate    Float?
  avgReimbursement  Decimal? @db.Decimal(10,2)

  // Relationships
  validIcdCodes     ICD10CPTMapping[]
  payerRules        CPTPayerRule[]
  modifiers         CPTModifier[]

  isActive          Boolean @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  hospital          Hospital @relation(fields: [hospitalId], references: [id])

  @@unique([hospitalId, code])
  @@index([hospitalId, category])
}
```

#### 4.2.2 CPT Modifier Support

```prisma
model CPTModifier {
  id           String @id @default(uuid())
  hospitalId   String
  code         String        // e.g., "25", "59", "76"
  description  String        // "Significant, separately identifiable E/M"
  priceImpact  Float?        // Percentage adjustment (e.g., 1.5 for +50%)
  usageNotes   String?
  isActive     Boolean @default(true)

  @@unique([hospitalId, code])
}
```

### 4.3 Admin Portal - Payer Rules Engine

#### 4.3.1 Payer Configuration

```prisma
model InsurancePayer {
  id                String   @id @default(uuid())
  hospitalId        String
  name              String            // "Daman", "AXA", "Dubai Insurance"
  code              String            // Payer code for claims
  type              PayerType         // GOVERNMENT, PRIVATE, TPA

  // Regulatory
  regulator         String            // "DHA"
  claimPlatform     String            // "eClaimLink"

  // Timing
  preAuthRequired   Boolean @default(false)
  claimDeadlineDays Int     @default(30)

  // Payment
  avgPaymentDays    Int?
  paymentRate       Float?            // % of billed amount typically paid

  // Rules
  icdRules          ICD10PayerRule[]
  cptRules          CPTPayerRule[]

  isActive          Boolean @default(true)

  hospital          Hospital @relation(fields: [hospitalId], references: [id])

  @@unique([hospitalId, code])
}

enum PayerType {
  GOVERNMENT    // DAMAN, etc.
  PRIVATE       // AXA, MetLife, etc.
  TPA           // Third-party administrators
  SELF_PAY
}
```

#### 4.3.2 ICD-10 to CPT Mapping (Medical Necessity)

```prisma
model ICD10CPTMapping {
  id               String   @id @default(uuid())
  hospitalId       String
  icdCodeId        String
  cptCodeId        String

  // Validity
  isValidPair      Boolean @default(true)      // Medically appropriate
  necessityScore   Float   @default(0.8)       // 0-1 strength of association

  // Context
  context          String?          // When this pairing is appropriate
  documentation    String?          // Required documentation for this pair

  // Performance
  historicalAcceptance Float?       // % of claims approved with this pair

  icdCode          ICD10Code @relation(fields: [icdCodeId], references: [id])
  cptCode          CPTCode @relation(fields: [cptCodeId], references: [id])

  @@unique([hospitalId, icdCodeId, cptCodeId])
}
```

#### 4.3.3 Payer-Specific Rules

```prisma
model ICD10PayerRule {
  id               String   @id @default(uuid())
  hospitalId       String
  payerId          String
  icdCodeId        String

  isCovered        Boolean @default(true)
  requiresPreAuth  Boolean @default(false)
  coverageLimit    Int?             // Max uses per year
  waitingPeriod    Int?             // Days before coverage
  documentation    String[]         // Required documentation

  payer            InsurancePayer @relation(fields: [payerId], references: [id])
  icdCode          ICD10Code @relation(fields: [icdCodeId], references: [id])

  @@unique([hospitalId, payerId, icdCodeId])
}

model CPTPayerRule {
  id               String   @id @default(uuid())
  hospitalId       String
  payerId          String
  cptCodeId        String

  isCovered        Boolean @default(true)
  requiresPreAuth  Boolean @default(false)
  priceOverride    Decimal? @db.Decimal(10,2)
  maxUnits         Int?
  frequencyLimit   String?          // e.g., "2 per year"
  documentation    String[]

  payer            InsurancePayer @relation(fields: [payerId], references: [id])
  cptCode          CPTCode @relation(fields: [cptCodeId], references: [id])

  @@unique([hospitalId, payerId, cptCodeId])
}
```

### 4.4 AI Coding Engine

#### 4.4.1 Service Architecture

**Location:** `/ai-services/insurance_coding/`

```python
# insurance_coding/service.py

class InsuranceCodingAI:
    """
    AI-powered insurance code recommendation engine.

    Combines:
    1. GPT-4o for clinical text understanding
    2. Rule-based medical necessity validation
    3. ML model for acceptance probability prediction
    """

    def __init__(self):
        self.llm = openai_manager
        self.necessity_rules = MedicalNecessityRules()
        self.acceptance_model = AcceptanceProbabilityModel()

    async def suggest_codes(
        self,
        clinical_text: str,
        patient_context: dict,
        encounter_type: str,  # "OUTPATIENT" or "INPATIENT"
        payer_id: str = None
    ) -> CodeSuggestionResult:
        """
        Main entry point for code suggestions.

        Args:
            clinical_text: Combined SOAP notes, diagnosis, procedures
            patient_context: Age, gender, existing conditions
            encounter_type: OUTPATIENT or INPATIENT
            payer_id: Optional - optimize for specific payer

        Returns:
            CodeSuggestionResult with ranked ICD-10, CPT codes
            and acceptance probability
        """

    async def validate_codes(
        self,
        icd_codes: list[str],
        cpt_codes: list[str],
        payer_id: str
    ) -> ValidationResult:
        """
        Validate ICD-CPT combinations against payer rules.
        """

    async def predict_acceptance(
        self,
        icd_codes: list[str],
        cpt_codes: list[str],
        payer_id: str,
        documentation_score: float
    ) -> AcceptancePrediction:
        """
        Predict probability of claim acceptance.
        """

    async def check_medical_necessity(
        self,
        icd_codes: list[str],
        cpt_codes: list[str]
    ) -> MedicalNecessityResult:
        """
        Verify ICD-CPT pairs are medically appropriate.
        """
```

#### 4.4.2 Code Suggestion Algorithm

```
+---------------------------------------------------------------------+
|                        INPUT                                         |
|  Clinical Notes + Diagnosis + Procedures + Patient Demographics     |
+---------------------------------------------------------------------+
                                |
                                v
+---------------------------------------------------------------------+
|                    STEP 1: LLM EXTRACTION                           |
|  GPT-4o extracts:                                                   |
|  - Primary diagnosis candidates (with confidence)                    |
|  - Secondary diagnoses                                               |
|  - Procedures performed                                              |
|  - Severity indicators                                               |
|  - Laterality, anatomical specificity                                |
+---------------------------------------------------------------------+
                                |
                                v
+---------------------------------------------------------------------+
|                    STEP 2: CODE MAPPING                             |
|  For each extracted entity:                                          |
|  - Semantic search against ICD-10/CPT database                      |
|  - Return top-K candidates with similarity scores                    |
|  - Apply specificity preference (more specific = higher rank)       |
+---------------------------------------------------------------------+
                                |
                                v
+---------------------------------------------------------------------+
|                    STEP 3: MEDICAL NECESSITY                        |
|  - Check ICD-CPT validity pairs                                     |
|  - Apply payer rules                                                |
|  - Flag pre-auth needs                                              |
|  - Identify missing documentation                                    |
+---------------------------------------------------------------------+
                                |
                                v
+---------------------------------------------------------------------+
|                    STEP 4: PAYER OPTIMIZATION                       |
|  If payer specified:                                                 |
|  - Apply payer-specific rules (coverage, limits, pre-auth)          |
|  - Adjust pricing to allowed amounts                                 |
|  - Flag codes requiring pre-authorization                            |
+---------------------------------------------------------------------+
                                |
                                v
+---------------------------------------------------------------------+
|                    STEP 5: ACCEPTANCE PREDICTION                    |
|  ML Model predicts P(acceptance) based on:                          |
|  - Historical acceptance rates for code combinations                 |
|  - Payer-specific patterns                                           |
|  - Documentation completeness score                                  |
|  - Code specificity level                                            |
+---------------------------------------------------------------------+
                                |
                                v
+---------------------------------------------------------------------+
|                    STEP 6: VALUE OPTIMIZATION                       |
|  Score = alpha(Acceptance) + beta(Reimbursement) + gamma(Specificity)|
|                                                                      |
|  Default weights:                                                    |
|  - alpha (acceptance): 0.5                                           |
|  - beta (value): 0.3                                                 |
|  - gamma (specificity): 0.2                                          |
+---------------------------------------------------------------------+
                                |
                                v
+---------------------------------------------------------------------+
|                         OUTPUT                                       |
|  - Suggested ICD-10 codes (primary + secondary)                     |
|  - Suggested CPT codes with modifiers                                |
|  - Acceptance probability per payer                                  |
|  - Expected reimbursement                                            |
|  - Pre-auth alerts                                                   |
|  - Documentation recommendations                                     |
+---------------------------------------------------------------------+
```

#### 4.4.3 Value Optimization Formula

```python
def calculate_composite_score(
    acceptance_prob: float,        # 0-1
    expected_reimbursement: float,
    specificity_level: int,        # 1-5
    weights: dict = None           # Configurable by hospital
) -> float:
    """
    Calculate composite optimization score.

    Default weights:
    - alpha (acceptance): 0.5
    - beta (value): 0.3
    - gamma (specificity): 0.2
    """
    alpha = weights.get('acceptance', 0.5)
    beta = weights.get('value', 0.3)
    gamma = weights.get('specificity', 0.2)

    norm_reimbursement = min(expected_reimbursement / max_possible, 1.0)
    norm_specificity = specificity_level / 5.0

    return (alpha * acceptance_prob +
            beta * norm_reimbursement +
            gamma * norm_specificity)
```

### 4.5 Doctor's Journey Integration

#### 4.5.1 OPD Consultation Flow

```
+------------------------------------------------------------------------+
|                     DOCTOR'S CONSULTATION FLOW (OPD)                    |
|                                                                        |
|  +---------+    +---------+    +---------+    +---------------------+  |
|  | Patient | -> | Vitals  | -> | History | -> | Examination         |  |
|  | Info    |    | Entry   |    | Review  |    |                     |  |
|  +---------+    +---------+    +---------+    +---------------------+  |
|                                                        |               |
|                                                        v               |
|  +------------------------------------------------------------------+  |
|  |                    DIAGNOSIS & PROCEDURES                         |  |
|  |  +-------------------------------------------------------------+ |  |
|  |  | Chief Complaint: [                                        ] | |  |
|  |  | Clinical Notes:  [                                        ] | |  |
|  |  | Diagnosis:       [Free text with autocomplete            ] | |  |
|  |  | Procedures:      [Select from procedure list             ] | |  |
|  |  +-------------------------------------------------------------+ |  |
|  |                              |                                    |  |
|  |                              v                                    |  |
|  |  +-------------------------------------------------------------+ |  |
|  |  |              AI CODE SUGGESTIONS                             | |  |
|  |  |  ----------------------------------------------------------- | |  |
|  |  |  Based on your clinical documentation:                       | |  |
|  |  |                                                              | |  |
|  |  |  RECOMMENDED ICD-10 CODES                                    | |  |
|  |  |  +--------------------------------------------------------+  | |  |
|  |  |  | * J15.1 - Pneumonia due to Pseudomonas                 |  | |  |
|  |  |  |    Acceptance: 94% | Value: AED 850 | Specific         |  | |  |
|  |  |  +--------------------------------------------------------+  | |  |
|  |  |  | o J18.9 - Pneumonia, unspecified                       |  | |  |
|  |  |  |    Acceptance: 78% | Value: AED 650 | ! Unspecific     |  | |  |
|  |  |  +--------------------------------------------------------+  | |  |
|  |  |                                                              | |  |
|  |  |  RECOMMENDED CPT CODES                                       | |  |
|  |  |  +--------------------------------------------------------+  | |  |
|  |  |  | * 99215 - Office visit, high complexity                |  | |  |
|  |  |  |    Acceptance: 91% | Value: AED 450                    |  | |  |
|  |  |  +--------------------------------------------------------+  | |  |
|  |  |                                                              | |  |
|  |  |  ALERTS                                                      | |  |
|  |  |  - Pre-auth required for CPT 71046 (Chest X-ray)            | |  |
|  |  +-------------------------------------------------------------+ |  |
|  +------------------------------------------------------------------+  |
|                                                        |               |
|                                                        v               |
|  +-------------+    +-------------+    +-----------------------------+ |
|  | Lab Orders  | -> |Prescriptions| -> | Finalize Consultation       | |
|  |             |    |             |    | [Generate Bill] [Complete]  | |
|  +-------------+    +-------------+    +-----------------------------+ |
+------------------------------------------------------------------------+
```

#### 4.5.2 IPD Discharge Coding Flow (Fee-for-Service)

```
+------------------------------------------------------------------------+
|                     IPD DISCHARGE CODING FLOW                           |
|                                                                        |
|  +-------------------------------------------------------------------+ |
|  | PATIENT ADMISSION SUMMARY                                          | |
|  | ------------------------------------------------------------------ | |
|  | Patient: John Doe (M, 65)  |  Admission: 2026-01-10               | |
|  | LOS: 5 days                |  Discharge: 2026-01-15               | |
|  | Attending: Dr. Smith       |  Discharge Status: Home              | |
|  +-------------------------------------------------------------------+ |
|                                                                        |
|  +-------------------------------------------------------------------+ |
|  | DIAGNOSIS CODING                                                   | |
|  | ------------------------------------------------------------------ | |
|  |                                                                    | |
|  | Primary Diagnosis: *Required                                       | |
|  | +---------------------------------------------------------------+ | |
|  | | [I21.0 - ST elevation MI of anterior wall            ] [Change]| | |
|  | +---------------------------------------------------------------+ | |
|  |                                                                    | |
|  | Secondary Diagnoses:                                               | |
|  | +---------------------------------------------------------------+ | |
|  | | 1. [I50.33 - Acute diastolic heart failure           ]   [x]  | | |
|  | | 2. [E11.65 - Type 2 DM with hyperglycemia            ]   [x]  | | |
|  | | 3. [I10 - Essential hypertension                     ]   [x]  | | |
|  | | [+ Add Secondary Diagnosis]                                    | | |
|  | +---------------------------------------------------------------+ | |
|  +-------------------------------------------------------------------+ |
|                                                                        |
|  +-------------------------------------------------------------------+ |
|  | PROCEDURE CODING                                                   | |
|  | ------------------------------------------------------------------ | |
|  | +---------------------------------------------------------------+ | |
|  | | 1. [92928 - Percutaneous coronary stent       ] Date: 01/11   | | |
|  | | 2. [93458 - Left heart catheterization        ] Date: 01/11   | | |
|  | | 3. [93000 - ECG                               ] Date: 01/10   | | |
|  | | 4. [71046 - Chest X-ray                       ] Date: 01/10   | | |
|  | | [+ Add Procedure]                                              | | |
|  | +---------------------------------------------------------------+ | |
|  +-------------------------------------------------------------------+ |
|                                                                        |
|  +-------------------------------------------------------------------+ |
|  | BILLING SUMMARY (Fee-for-Service)                                  | |
|  | ------------------------------------------------------------------ | |
|  |                                                                    | |
|  |  +-------------------------------------------------------------+  | |
|  |  |  ITEMIZED CHARGES                                           |  | |
|  |  |                                                             |  | |
|  |  |  Procedures:                                                |  | |
|  |  |    92928 - Percutaneous coronary stent    AED 15,000       |  | |
|  |  |    93458 - Left heart catheterization     AED  3,500       |  | |
|  |  |    93000 - ECG                            AED    150       |  | |
|  |  |    71046 - Chest X-ray                    AED    250       |  | |
|  |  |                                                             |  | |
|  |  |  Room & Board (5 days):                   AED  5,000       |  | |
|  |  |  Pharmacy:                                AED  2,500       |  | |
|  |  |  Lab & Diagnostics:                       AED  1,200       |  | |
|  |  |  -----------------------------------------------           |  | |
|  |  |  TOTAL:                                   AED 27,600       |  | |
|  |  +-------------------------------------------------------------+  | |
|  |                                                                    | |
|  |  Acceptance Probability: 89% [===========-] High                   | |
|  |                                                                    | |
|  |  +-------------------------------------------------------------+  | |
|  |  | ALERTS                                                      |  | |
|  |  | - Pre-auth verified for 92928 (Coronary stent)              |  | |
|  |  | - Consider adding E78.5 (Hyperlipidemia) if documented      |  | |
|  |  +-------------------------------------------------------------+  | |
|  +-------------------------------------------------------------------+ |
|                                                                        |
|  +--------------------------------------------------------------------+|
|  |  [Save Draft]  [Finalize & Generate Claim]                         ||
|  +--------------------------------------------------------------------+|
+------------------------------------------------------------------------+
```

#### 4.5.3 UI Components

**New React Components:**

```typescript
// frontend/src/components/insurance/

// Shared Components
CodeSuggestionPanel.tsx        // Main AI suggestion panel
ICD10CodePicker.tsx            // Searchable ICD-10 selector
CPTCodePicker.tsx              // Searchable CPT selector
AcceptanceMeter.tsx            // Visual probability indicator
PayerRulesAlert.tsx            // Pre-auth and coverage warnings
CodeOptimizationSummary.tsx    // Summary of selected codes & value

// IPD Components
ItemizedBillingSummary.tsx     // Fee-for-service itemized view
DischargeCodeEditor.tsx        // Discharge coding interface
ProcedureListEditor.tsx        // Manage procedures with dates
```

#### 4.5.4 API Endpoints

**Backend Routes:**

```typescript
// POST /api/v1/insurance-coding/suggest
// Get AI code suggestions from clinical text
{
  consultationId?: string,      // For OPD
  admissionId?: string,         // For IPD
  clinicalText: string,
  diagnosis: string[],
  procedures: string[],
  patientId: string,
  encounterType: "OUTPATIENT" | "INPATIENT",
  payerId?: string
}

// Response
{
  icdSuggestions: [
    {
      code: "J15.1",
      description: "Pneumonia due to Pseudomonas",
      isPrimary: true,
      confidence: 0.95,
      acceptanceProbability: 0.94,
      specificityLevel: 5,
      reimbursement: 850
    }
  ],
  cptSuggestions: [
    {
      code: "99215",
      description: "Office visit, high complexity",
      confidence: 0.92,
      acceptanceProbability: 0.91,
      price: 450,
      requiresPreAuth: false
    }
  ],
  alerts: [
    {
      type: "PRE_AUTH_REQUIRED",
      cptCode: "71046",
      message: "Pre-authorization required for Chest X-ray"
    }
  ],
  overallAcceptance: 0.89,
  estimatedReimbursement: 1300
}

// POST /api/v1/insurance-coding/validate
// Validate selected codes before finalizing
{
  consultationId?: string,
  admissionId?: string,
  selectedIcdCodes: string[],
  selectedCptCodes: string[],
  payerId: string
}

// POST /api/v1/insurance-coding/finalize
// Save codes and generate claim
{
  consultationId?: string,
  admissionId?: string,
  icdCodes: [{code, isPrimary}],
  cptCodes: [{code, modifier?, quantity, unitPrice}],
  generateClaim: boolean
}

// GET /api/v1/insurance-coding/icd10/search
// Search ICD-10 codes
{
  query: string,
  category?: string,
  limit?: number
}

// GET /api/v1/insurance-coding/cpt/search
// Search CPT codes
{
  query: string,
  category?: string,
  limit?: number
}
```

### 4.6 Data Model Updates

#### 4.6.1 Consultation Model Updates (OPD)

```prisma
model Consultation {
  // ... existing fields ...

  // Enhanced ICD-10 (replaces string array)
  diagnoses           ConsultationDiagnosis[]

  // New: CPT codes for procedures
  procedureCodes      ConsultationProcedure[]

  // AI Assistance tracking
  aiSuggestionsUsed   Boolean @default(false)
  aiSuggestionData    Json?
  codingCompletedAt   DateTime?
  codingCompletedBy   String?
}

model ConsultationDiagnosis {
  id              String   @id @default(uuid())
  consultationId  String
  icdCode         String
  description     String
  isPrimary       Boolean @default(false)
  sequenceNumber  Int

  // AI metadata
  aiSuggested     Boolean @default(false)
  aiConfidence    Float?

  consultation    Consultation @relation(fields: [consultationId], references: [id])

  @@unique([consultationId, icdCode])
}

model ConsultationProcedure {
  id              String   @id @default(uuid())
  consultationId  String
  cptCode         String
  description     String
  modifier        String?
  quantity        Int     @default(1)
  unitPrice       Decimal @db.Decimal(10,2)
  linkedDiagnosis String?
  aiSuggested     Boolean @default(false)
  aiConfidence    Float?

  consultation    Consultation @relation(fields: [consultationId], references: [id])
}
```

#### 4.6.2 Admission Model Updates (IPD)

```prisma
model Admission {
  // ... existing fields ...

  // Discharge Coding
  dischargeCoding     DischargeCoding?
}

model DischargeCoding {
  id                  String   @id @default(uuid())
  hospitalId          String
  admissionId         String   @unique

  // Primary Diagnosis
  primaryDiagnosis    String              // ICD-10 code
  primaryDxDesc       String

  // Secondary Diagnoses
  secondaryDiagnoses  DischargeDiagnosis[]

  // Procedures
  procedures          DischargeProcedure[]

  // Billing Totals (Fee-for-Service)
  totalProcedures     Decimal? @db.Decimal(10,2)
  totalRoomBoard      Decimal? @db.Decimal(10,2)
  totalPharmacy       Decimal? @db.Decimal(10,2)
  totalDiagnostics    Decimal? @db.Decimal(10,2)
  grandTotal          Decimal? @db.Decimal(10,2)

  // AI Assistance
  aiSuggestionsUsed   Boolean @default(false)
  aiSuggestionData    Json?

  // Audit
  codingStatus        CodingStatus @default(DRAFT)
  codingCompletedAt   DateTime?
  codingCompletedBy   String?

  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  admission           Admission @relation(fields: [admissionId], references: [id])
  hospital            Hospital @relation(fields: [hospitalId], references: [id])

  @@index([hospitalId, codingStatus])
}

model DischargeDiagnosis {
  id                  String   @id @default(uuid())
  dischargeCodingId   String
  icdCode             String
  description         String
  sequenceNumber      Int

  // AI metadata
  aiSuggested         Boolean @default(false)
  aiConfidence        Float?

  dischargeCoding     DischargeCoding @relation(fields: [dischargeCodingId], references: [id])

  @@unique([dischargeCodingId, icdCode])
}

model DischargeProcedure {
  id                  String   @id @default(uuid())
  dischargeCodingId   String
  cptCode             String
  description         String
  procedureDate       DateTime
  quantity            Int @default(1)
  unitPrice           Decimal @db.Decimal(10,2)
  totalPrice          Decimal @db.Decimal(10,2)

  // Modifiers
  modifier1           String?
  modifier2           String?

  // AI metadata
  aiSuggested         Boolean @default(false)
  aiConfidence        Float?

  dischargeCoding     DischargeCoding @relation(fields: [dischargeCodingId], references: [id])
}

enum CodingStatus {
  DRAFT
  PENDING_REVIEW
  REVIEWED
  FINALIZED
  SUBMITTED
}
```

---

## 5. Analytics & Reporting

### 5.1 Admin Dashboard Metrics

| Metric | Description | Visualization |
|--------|-------------|---------------|
| Code Usage Distribution | Top ICD/CPT codes by frequency | Bar chart |
| Acceptance Rate by Code | Codes with low acceptance | Heatmap |
| Acceptance Rate by Payer | Payer comparison | Comparison chart |
| Revenue by Code | Revenue impact of codes | Treemap |
| AI Adoption Rate | % consultations using AI suggestions | Trend line |
| Coding Time | Average time to complete coding | Trend line |
| Pre-Auth Compliance | % of pre-auths obtained when required | Gauge |
| Rejection Analysis | Top rejection reasons by payer | Stacked bar |

### 5.2 Performance Reports

```sql
-- Code Acceptance Analysis
SELECT
  icd.code,
  icd.description,
  COUNT(*) as total_claims,
  SUM(CASE WHEN ic.status = 'APPROVED' THEN 1 ELSE 0 END) as approved,
  SUM(CASE WHEN ic.status = 'APPROVED' THEN 1 ELSE 0 END)::float / COUNT(*) as acceptance_rate,
  AVG(ic.approvedAmount) as avg_reimbursement
FROM ConsultationDiagnosis cd
JOIN ICD10Code icd ON cd.icdCode = icd.code
JOIN InsuranceClaim ic ON cd.consultationId = ic.consultationId
WHERE icd.hospitalId = $hospitalId
GROUP BY icd.code, icd.description
ORDER BY total_claims DESC;

-- Payer Performance Comparison
SELECT
  ip.name as payer_name,
  COUNT(*) as total_claims,
  AVG(ic.approvedAmount / NULLIF(ic.billedAmount, 0)) as payment_rate,
  AVG(ic.processingDays) as avg_processing_days
FROM InsuranceClaim ic
JOIN InsurancePayer ip ON ic.payerId = ip.id
WHERE ic.hospitalId = $hospitalId
GROUP BY ip.name
ORDER BY total_claims DESC;

-- AI Suggestion Adoption
SELECT
  DATE_TRUNC('week', c.createdAt) as week,
  COUNT(*) as total_consultations,
  SUM(CASE WHEN c.aiSuggestionsUsed THEN 1 ELSE 0 END) as ai_used,
  SUM(CASE WHEN c.aiSuggestionsUsed THEN 1 ELSE 0 END)::float / COUNT(*) as adoption_rate
FROM Consultation c
WHERE c.hospitalId = $hospitalId
GROUP BY week
ORDER BY week;
```

---

## 6. Implementation Plan

### 6.1 Phase 1: Foundation (Weeks 1-3)

**Deliverables:**
- [ ] Database schema for ICD-10, CPT models
- [ ] Prisma migrations
- [ ] ICD-10 code import script (UAE/Dubai subset ~15,000 codes)
- [ ] CPT code import script (~10,000 codes)
- [ ] Basic Admin UI: Code browser, editor, search

**Files to Create/Modify:**
```
backend/prisma/schema.prisma              # Add new models
backend/src/services/icdService.ts        # ICD CRUD
backend/src/services/cptService.ts        # CPT CRUD
backend/src/routes/insuranceCodingRoutes.ts
frontend/src/pages/Admin/InsuranceCoding/
```

### 6.2 Phase 2: Payer Rules & ICD-CPT Mappings (Weeks 4-5)

**Deliverables:**
- [ ] InsurancePayer management
- [ ] ICD10PayerRule configuration
- [ ] CPTPayerRule configuration
- [ ] ICD10CPTMapping table (medical necessity)
- [ ] Admin UI for payer and mapping configuration

### 6.3 Phase 3: AI Coding Engine (Weeks 6-8)

**Deliverables:**
- [ ] AI service: `/ai-services/insurance_coding/`
- [ ] LLM-based code extraction from clinical text
- [ ] Medical necessity validation
- [ ] Acceptance probability model (rule-based initially)
- [ ] Backend proxy routes

**Files to Create:**
```
ai-services/insurance_coding/
  ├── __init__.py
  ├── service.py              # Main InsuranceCodingAI class
  ├── code_mapper.py          # Semantic search for codes
  ├── necessity_validator.py  # ICD-CPT validation
  ├── acceptance_predictor.py # ML/rule-based prediction
  └── prompts.py              # LLM prompts
```

### 6.4 Phase 4: Doctor's Journey Integration (Weeks 9-11)

**Deliverables:**
- [ ] CodeSuggestionPanel component
- [ ] ICD10/CPT picker components
- [ ] Integration into OPD consultation flow
- [ ] Integration into IPD discharge coding
- [ ] Auto-save and finalization
- [ ] Invoice generation from codes

### 6.5 Phase 5: Analytics, Optimization & eClaimLink Prep (Weeks 12-14)

**Deliverables:**
- [ ] Admin analytics dashboard
- [ ] Code performance reports
- [ ] ML model training pipeline (if data available)
- [ ] Feedback loop: claim outcomes → model improvement
- [ ] eClaimLink XML format preparation
- [ ] Documentation and training materials

---

## 7. Technical Considerations

### 7.1 Performance Requirements

| Operation | Target Latency | Notes |
|-----------|---------------|-------|
| Code search (autocomplete) | <100ms | Elasticsearch or PostgreSQL FTS |
| AI suggestion generation | <3s | Async with loading state |
| Code validation | <500ms | Rule engine, cached rules |
| Invoice/Claim generation | <1s | Background job for complex cases |

### 7.2 Data Volume Estimates

| Entity | Estimated Count | Storage |
|--------|-----------------|---------|
| ICD-10 Codes | ~15,000 (UAE subset) | ~5MB |
| CPT Codes | ~10,000 | ~3MB |
| ICD-CPT Mappings | ~50,000 | ~10MB |
| Payer Rules | ~5,000 per payer | ~2MB/payer |

### 7.3 Security & Compliance

- All code suggestions logged for audit trail
- PHI handling compliant with UAE data protection
- Role-based access: only authorized users can modify code masters
- Encryption for claim data in transit and at rest

### 7.4 Ethical Considerations

**Guardrails to prevent abuse:**
1. **No upcoding**: System should not suggest codes unsupported by documentation
2. **Transparency**: Always show why a code was suggested
3. **Human oversight**: Doctor must approve all codes
4. **Audit trail**: All selections logged with reasoning
5. **Specificity preference**: Always prefer more specific codes when supported

---

## 8. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Low AI accuracy initially | User distrust | High | Start with rule-based, add ML later |
| Code database outdated | Claim rejections | Medium | Annual update process, alerts for deprecated codes |
| Payer rules change frequently | Invalid suggestions | Medium | Version control for rules, update notifications |
| Doctors bypass AI suggestions | Low adoption | Medium | Track adoption metrics, gather feedback |
| Performance issues with large code sets | Poor UX | Low | Implement caching, search optimization |

---

## 9. Open Questions

1. **Data Sources**: Where will we obtain the initial ICD-10/CPT code databases with Dubai-specific mappings?
   - Options: DHA official lists, commercial databases, open sources (CMS)

2. **ML Training Data**: Do we have historical claims data with outcomes to train the acceptance model?
   - If not, start with rule-based and collect data

3. **Pricing Data**: Will hospitals provide their contracted rates with payers?

4. **eClaimLink Integration**: What is the timeline for direct eClaimLink API integration?

---

## 10. Appendix

### 10.1 Sample ICD-10 Categories (UAE Common)

| Chapter | Description | Code Range |
|---------|-------------|------------|
| I | Infectious diseases | A00-B99 |
| IX | Circulatory system | I00-I99 |
| X | Respiratory system | J00-J99 |
| XI | Digestive system | K00-K95 |
| XIII | Musculoskeletal | M00-M99 |
| XIX | Injury, poisoning | S00-T88 |

### 10.2 Sample CPT Categories

| Range | Category |
|-------|----------|
| 99201-99499 | Evaluation & Management |
| 10000-19999 | Integumentary |
| 20000-29999 | Musculoskeletal |
| 70000-79999 | Radiology |
| 80000-89999 | Pathology & Lab |
| 90000-99199 | Medicine |

### 10.3 References

- [eClaimLink Codes & Lists](https://www.eclaimlink.ae/dhd_codes.aspx)
- [Navigating CDT, CPT and ICD-10 Codes in UAE](https://blog.balsammedico.com/blog/2025/03/27/navigating-cdt-cpt-and-icd-10-codes-2/)
- [Top 5 Reasons for Claims Denials in UAE Healthcare](https://samcoglobal.ae/top-5-reasons-for-claims-denials-in-uae-healthcare-and-how-to-avoid-them/)
- [Common ICD-10 Coding Errors](https://www.codeemr.com/avoid-common-icd-10-coding-errors-claim-denials/)

---

**Document Status:** Ready for Review

**Next Steps:**
1. Review and approve PRD
2. Clarify open questions (especially data sources)
3. Begin Phase 1 implementation
