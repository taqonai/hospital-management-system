# AGENT.md - Backend Types Directory

## Purpose

This directory contains TypeScript type definitions, interfaces, and DTOs (Data Transfer Objects) shared across the backend application. Types ensure consistency between routes, services, and external integrations.

## Directory Structure

```
types/
└── index.ts    # All shared type definitions
```

## Type Categories

### Authentication Types

```typescript
// JWT token payload (used in middleware/auth.ts)
export interface JwtPayload {
  userId: string;
  hospitalId: string;
  email: string;
  role: UserRole;       // From @prisma/client
  firstName?: string;
  lastName?: string;
}

// Extended Request with authenticated user
export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}
```

**Usage:**
```typescript
import { AuthenticatedRequest } from '../types';

router.get('/', authenticate, async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;
  const hospitalId = req.user!.hospitalId;
});
```

---

### Pagination Types

```typescript
// Basic pagination parameters
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Extended with search
export interface SearchParams extends PaginationParams {
  search?: string;
  filters?: Record<string, any>;
}
```

**Usage:**
```typescript
async findAll(hospitalId: string, params: SearchParams) {
  const { page, limit, search, sortBy, sortOrder } = params;
  // ...
}
```

---

### Entity DTOs (Data Transfer Objects)

**Patient:**
```typescript
export interface CreatePatientDto {
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  bloodGroup?: string;
  phone: string;
  email?: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  occupation?: string;
  maritalStatus?: string;
  nationality?: string;
}
```

**Doctor:**
```typescript
export interface CreateDoctorDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  departmentId: string;
  specialization: string;
  qualification: string;
  experience: number;
  licenseNumber: string;
  consultationFee: number;
  bio?: string;
  availableDays: string[];
  slotDuration?: number;
  maxPatientsPerDay?: number;
}
```

**Appointment:**
```typescript
export interface CreateAppointmentDto {
  patientId: string;
  doctorId: string;
  appointmentDate: Date;
  startTime: string;
  endTime: string;
  type: 'CONSULTATION' | 'FOLLOW_UP' | 'EMERGENCY' | 'TELEMEDICINE' | 'PROCEDURE';
  reason?: string;
  notes?: string;
  isFollowUp?: boolean;
  parentAppointmentId?: string;
}
```

**Consultation:**
```typescript
export interface CreateConsultationDto {
  appointmentId: string;
  chiefComplaint: string;
  historyOfIllness?: string;
  examination?: string;
  diagnosis: string[];
  icdCodes: string[];
  treatmentPlan?: string;
  advice?: string;
  followUpDate?: Date;
  notes?: string;
}
```

**Prescription:**
```typescript
export interface CreatePrescriptionDto {
  consultationId?: string;
  patientId: string;
  admissionId?: string;
  notes?: string;
  medications: PrescriptionMedicationDto[];
}

export interface PrescriptionMedicationDto {
  drugId?: string;
  drugName: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number;
  route: string;
  instructions?: string;
  beforeAfterFood?: string;
}
```

**Admission (IPD):**
```typescript
export interface CreateAdmissionDto {
  patientId: string;
  bedId: string;
  admissionType: 'EMERGENCY' | 'ELECTIVE' | 'TRANSFER' | 'MATERNITY';
  admittingDoctorId: string;
  chiefComplaint: string;
  diagnosis: string[];
  icdCodes: string[];
  treatmentPlan?: string;
  estimatedDays?: number;
  notes?: string;
}
```

**Laboratory:**
```typescript
export interface CreateLabOrderDto {
  patientId: string;
  consultationId?: string;
  priority?: 'STAT' | 'URGENT' | 'ROUTINE';
  clinicalNotes?: string;
  specialInstructions?: string;
  testIds: string[];
}
```

**Radiology:**
```typescript
export interface CreateImagingOrderDto {
  patientId: string;
  consultationId?: string;
  modalityType: 'XRAY' | 'CT' | 'MRI' | 'ULTRASOUND' | 'MAMMOGRAPHY' | 'PET' | 'FLUOROSCOPY';
  bodyPart: string;
  priority?: 'STAT' | 'URGENT' | 'ROUTINE';
  clinicalHistory?: string;
  scheduledDate?: Date;
  notes?: string;
}
```

**Billing:**
```typescript
export interface CreateInvoiceDto {
  patientId: string;
  items: InvoiceItemDto[];
  discount?: number;
  notes?: string;
}

export interface InvoiceItemDto {
  description: string;
  category: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
}
```

---

### AI Service Types

**Request Types:**
```typescript
export interface AISymptomAnalysisRequest {
  patientId: string;
  symptoms: string[];
  medicalHistory?: string[];
  currentMedications?: string[];
  vitalSigns?: {
    temperature?: number;
    bloodPressure?: string;
    heartRate?: number;
    respiratoryRate?: number;
    oxygenSaturation?: number;
  };
}

export interface AIRiskPredictionRequest {
  patientId: string;
  predictionType: 'READMISSION' | 'LENGTH_OF_STAY' | 'MORTALITY' | 'DISEASE_PROGRESSION' | 'NO_SHOW' | 'DETERIORATION';
  timeframe?: string;
}

export interface AIImageAnalysisRequest {
  imagingOrderId: string;
  imageUrl: string;
  modalityType: string;
  bodyPart: string;
}
```

**Response Types:**
```typescript
export interface AIDiagnosis {
  icd10: string;
  name: string;
  confidence: number;
  category?: string;
  severity?: string;
}

export interface AIDrugInteraction {
  drug1: string;
  drug2: string;
  severity: string;
  warning: string;
}

export interface AIRiskFactor {
  factor: string;
  relevance: string;
}

export interface AIDiagnosisResponse {
  diagnoses: AIDiagnosis[];
  recommendedTests: string[];
  treatmentSuggestions: string[];
  drugInteractions: AIDrugInteraction[];
  riskFactors: AIRiskFactor[];
  confidence: number;
  modelVersion: string;
}

export interface AIRiskPredictionResponse {
  riskScore: number;
  riskLevel: string;
  factors: string[];
  recommendations: string[];
  modelVersion: string;
}

export interface AIImageFinding {
  region: string;
  finding: string;
  abnormal: boolean;
  confidence: number;
  severity?: string;
  pathology?: string;
}

export interface AIImageAnalysisResponse {
  findings: AIImageFinding[];
  impression: string;
  recommendations: string[];
  heatmapUrl: string | null;
  abnormalityDetected: boolean;
  confidence: number;
  urgency: string;
  studyInfo: AIStudyInfo;
  modelVersion: string;
}
```

---

## Prisma Enums (from @prisma/client)

These enums are defined in `prisma/schema.prisma` and imported from `@prisma/client`:

```typescript
// User roles
enum UserRole {
  SUPER_ADMIN
  HOSPITAL_ADMIN
  DOCTOR
  NURSE
  RECEPTIONIST
  LAB_TECHNICIAN
  PHARMACIST
  RADIOLOGIST
  ACCOUNTANT
  PATIENT
  HR_MANAGER
  HR_STAFF
  HOUSEKEEPING_MANAGER
  HOUSEKEEPING_STAFF
  MAINTENANCE_STAFF
  SECURITY_STAFF
  DIETARY_STAFF
}

// Gender
enum Gender {
  MALE
  FEMALE
  OTHER
}

// Blood groups
enum BloodGroup {
  A_POSITIVE, A_NEGATIVE
  B_POSITIVE, B_NEGATIVE
  AB_POSITIVE, AB_NEGATIVE
  O_POSITIVE, O_NEGATIVE
}

// Appointment types
enum AppointmentType {
  CONSULTATION
  FOLLOW_UP
  EMERGENCY
  TELEMEDICINE
  PROCEDURE
}

// Appointment status
enum AppointmentStatus {
  SCHEDULED
  CONFIRMED
  CHECKED_IN
  IN_PROGRESS
  COMPLETED
  CANCELLED
  NO_SHOW
}

// Lab priority
enum LabPriority {
  STAT
  URGENT
  ROUTINE
}

// Modality types (Radiology)
enum ModalityType {
  XRAY, CT, MRI, ULTRASOUND
  MAMMOGRAPHY, PET, FLUOROSCOPY
}
```

**Usage:**
```typescript
import { UserRole, AppointmentStatus } from '@prisma/client';

// In type definitions
interface MyDto {
  role: UserRole;
  status: AppointmentStatus;
}
```

## Dependencies

### Internal
- `@prisma/client` - Prisma-generated types and enums
- `express` - Request type for extension

### External
None - pure TypeScript definitions

## Common Operations

### Adding a New DTO

1. Define the interface in `types/index.ts`:
```typescript
export interface CreateMyEntityDto {
  field1: string;
  field2: number;
  optionalField?: string;
}
```

2. Use in service:
```typescript
import { CreateMyEntityDto } from '../types';

async create(data: CreateMyEntityDto) {
  return prisma.myEntity.create({ data });
}
```

3. Validate with Zod schema (in validation.ts):
```typescript
export const createMyEntitySchema = z.object({
  body: z.object({
    field1: z.string().min(1),
    field2: z.number().positive(),
    optionalField: z.string().optional(),
  }),
});
```

### Extending Request Interface

```typescript
// For custom request properties
export interface MyCustomRequest extends AuthenticatedRequest {
  myData?: {
    customField: string;
  };
}

// In middleware
app.use((req: MyCustomRequest, res, next) => {
  req.myData = { customField: 'value' };
  next();
});
```

## Related Files

- `/src/middleware/validation.ts` - Zod schemas matching DTOs
- `/src/services/*` - Services using types
- `/prisma/schema.prisma` - Source of Prisma enums
- `/src/middleware/auth.ts` - Uses JwtPayload
- `/src/middleware/patientAuth.ts` - Uses PatientJwtPayload

## Type Naming Conventions

| Suffix | Usage |
|--------|-------|
| `Dto` | Data Transfer Object (input to create/update) |
| `Response` | API response structure |
| `Request` | API request structure (especially AI) |
| `Params` | Query/URL parameters |

## Common Issues and Solutions

### Issue: Type mismatch with Prisma
- Ensure DTOs match Prisma model fields
- Use Prisma enums directly: `import { EnumType } from '@prisma/client'`
- Run `npx prisma generate` after schema changes

### Issue: Optional vs Required fields
- Use `?` for optional: `field?: string`
- Zod schema must match: `z.string().optional()`

### Issue: Date handling
- Use `Date` type in DTOs
- Zod accepts: `z.string().datetime()` or `z.date()`
- Prisma handles Date serialization automatically
