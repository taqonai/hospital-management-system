# Patient Registration & Management - Product Requirements Document

## Document Info
- **Version**: 1.0
- **Last Updated**: 2026-01-12
- **Status**: Current Implementation
- **Module**: Patient Management

---

## 1. Overview

### 1.1 Purpose
The Patient Registration system manages patient demographic data, medical history, allergies, insurance, and vitals throughout their healthcare journey. It provides comprehensive patient profiles accessible to clinical staff while maintaining privacy and data integrity.

### 1.2 Scope
- Patient registration and profile management
- Medical history tracking
- Allergy management
- Insurance information
- Emergency contacts
- Vital signs recording
- Patient timeline/activity log

### 1.3 Background
Patient data forms the foundation of all clinical workflows. Accurate, complete patient records are essential for quality care, billing, and regulatory compliance (HIPAA). The system generates unique Medical Record Numbers (MRN) and supports integration with patient portal authentication.

---

## 2. User Stories

### 2.1 Primary User Stories

**US-001: Register New Patient**
> As a receptionist, I want to register new patients with their demographic information so they can receive care.

**Acceptance Criteria:**
- Capture required fields: name, DOB, gender, phone, address
- Generate unique MRN automatically
- Optional fields: email, blood group, emergency contact, insurance
- Patient immediately available for appointment booking

**US-002: View Patient Profile**
> As a clinical staff member, I want to view complete patient information so I can provide informed care.

**Acceptance Criteria:**
- Display demographics, medical history, allergies prominently
- Show recent appointments, prescriptions, lab results
- Highlight critical information (allergies, chronic conditions)
- Access controlled by role (clinical vs. administrative views)

**US-003: Update Patient Information**
> As a receptionist, I want to update patient details when they provide new information.

**Acceptance Criteria:**
- Edit demographics, contact info, insurance
- Audit trail of changes
- Cannot change MRN once assigned

**US-004: Record Medical History**
> As a nurse or doctor, I want to document patient medical history for clinical decision making.

**Acceptance Criteria:**
- Chronic conditions, past surgeries, family history
- Immunization records
- Previous hospitalizations
- Lifestyle factors (smoking, alcohol)

**US-005: Manage Allergies**
> As a clinical staff member, I want to record patient allergies so medications can be safely prescribed.

**Acceptance Criteria:**
- Allergen name, reaction type, severity
- Drug allergies highlighted in prescribing
- Environmental and food allergies tracked
- Alert displayed on patient profile

**US-006: Record Vitals**
> As a nurse, I want to record patient vital signs during visits.

**Acceptance Criteria:**
- Blood pressure, heart rate, temperature, SpO2, respiratory rate
- Weight, height, BMI calculation
- Pain level, blood glucose (if applicable)
- Trend visualization over time

---

## 3. Technical Specifications

### 3.1 API Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/v1/patients` | List patients with search/filter | Staff |
| POST | `/api/v1/patients` | Create new patient | Receptionist+ |
| GET | `/api/v1/patients/:id` | Get patient details | Staff |
| PUT | `/api/v1/patients/:id` | Update patient | Receptionist+ |
| DELETE | `/api/v1/patients/:id` | Soft delete patient | Admin |
| GET | `/api/v1/patients/:id/medical-history` | Get medical history | Clinical |
| POST | `/api/v1/patients/:id/medical-history` | Add medical history | Clinical |
| GET | `/api/v1/patients/:id/allergies` | Get allergies | Staff |
| POST | `/api/v1/patients/:id/allergies` | Add allergy | Clinical |
| PUT | `/api/v1/patients/:id/allergies/:allergyId` | Update allergy | Clinical |
| DELETE | `/api/v1/patients/:id/allergies/:allergyId` | Remove allergy | Clinical |
| GET | `/api/v1/patients/:id/vitals` | Get vital history | Clinical |
| POST | `/api/v1/patients/:id/vitals` | Record vitals | Nurse+ |
| GET | `/api/v1/patients/:id/insurance` | Get insurance info | Staff |
| POST | `/api/v1/patients/:id/insurance` | Add/update insurance | Receptionist+ |
| GET | `/api/v1/patients/:id/timeline` | Get activity timeline | Staff |

### 3.2 Data Models

```prisma
model Patient {
  id                String    @id @default(uuid())
  mrn               String    @unique  // Medical Record Number
  hospitalId        String
  hospital          Hospital  @relation(fields: [hospitalId], references: [id])

  // Demographics
  firstName         String
  lastName          String
  dateOfBirth       DateTime
  gender            Gender
  bloodGroup        BloodGroup?

  // Contact
  phone             String
  email             String?
  address           String
  city              String
  state             String
  zipCode           String

  // Emergency Contact
  emergencyContact  String?
  emergencyPhone    String?
  emergencyRelation String?

  // Personal
  occupation        String?
  maritalStatus     MaritalStatus?
  nationality       String?

  // System
  isActive          Boolean   @default(true)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  createdBy         String?

  // Relations
  medicalHistory    MedicalHistory[]
  allergies         Allergy[]
  vitals            Vital[]
  insurance         PatientInsurance[]
  appointments      Appointment[]
  prescriptions     Prescription[]
  admissions        Admission[]
  labOrders         LabOrder[]
  imagingOrders     ImagingOrder[]
}

model MedicalHistory {
  id            String   @id @default(uuid())
  patientId     String
  patient       Patient  @relation(fields: [patientId], references: [id])
  condition     String
  diagnosedDate DateTime?
  status        String   // ACTIVE, RESOLVED, CHRONIC
  notes         String?
  icdCode       String?
  createdAt     DateTime @default(now())
  createdBy     String
}

model Allergy {
  id          String   @id @default(uuid())
  patientId   String
  patient     Patient  @relation(fields: [patientId], references: [id])
  allergen    String
  type        AllergyType  // DRUG, FOOD, ENVIRONMENTAL
  reaction    String
  severity    AllergySeverity  // MILD, MODERATE, SEVERE
  notes       String?
  reportedAt  DateTime @default(now())
  verifiedBy  String?
}

model Vital {
  id              String   @id @default(uuid())
  patientId       String
  patient         Patient  @relation(fields: [patientId], references: [id])
  appointmentId   String?

  temperature     Float?   // Celsius
  bloodPressureSystolic   Int?
  bloodPressureDiastolic  Int?
  heartRate       Int?     // BPM
  respiratoryRate Int?     // breaths/min
  oxygenSaturation Float?  // SpO2 %
  weight          Float?   // kg
  height          Float?   // cm
  bmi             Float?   // Calculated
  bloodGlucose    Float?   // mg/dL
  painLevel       Int?     // 0-10 scale

  recordedAt      DateTime @default(now())
  recordedBy      String
  notes           String?
}

model PatientInsurance {
  id              String   @id @default(uuid())
  patientId       String
  patient         Patient  @relation(fields: [patientId], references: [id])
  provider        String
  policyNumber    String
  groupNumber     String?
  holderName      String
  holderRelation  String   // SELF, SPOUSE, PARENT, etc.
  validFrom       DateTime
  validTo         DateTime?
  isPrimary       Boolean  @default(true)
  createdAt       DateTime @default(now())
}
```

### 3.3 Frontend Components

**Pages:**
- `frontend/src/pages/Patients/index.tsx` - Patient list with search
- `frontend/src/pages/PatientDetail/index.tsx` - Full patient profile
- `frontend/src/pages/PatientForm/index.tsx` - Create/edit patient

**Key Components:**
- Patient search with filters (name, MRN, phone)
- Demographics card
- Medical history section
- Allergies list with severity badges
- Vitals chart with trends
- Insurance cards

### 3.4 Mobile (Patient Portal)

**Screens:**
- `mobile/src/screens/records/MedicalRecordsScreen.tsx` - View own records
- `mobile/src/screens/health/HealthInsightsScreen.tsx` - View vitals trends

**API:**
- `mobile/src/services/api/patientPortal.ts` - getMedicalRecords, getMedicalHistory

---

## 4. File References

### Backend
- `backend/src/routes/patientRoutes.ts`
- `backend/src/services/patientService.ts`
- `backend/prisma/schema.prisma` - Patient, MedicalHistory, Allergy, Vital, PatientInsurance

### Frontend
- `frontend/src/pages/Patients/`
- `frontend/src/pages/PatientDetail/`
- `frontend/src/services/api.ts` - patientApi namespace

### Mobile
- `mobile/src/screens/records/MedicalRecordsScreen.tsx`
- `mobile/src/services/api/patientPortal.ts`
