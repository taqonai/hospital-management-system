# AGENT.md - Backend Services Directory

## Purpose

This directory contains the business logic layer of the Hospital Management System. Services handle data operations, business rules, external integrations, and Prisma database interactions. Routes delegate to services for all non-trivial operations.

## Directory Structure

```
services/
├── authService.ts              # Staff authentication, JWT tokens, sessions
├── patientAuthService.ts       # Patient portal auth, OTP verification
├── patientService.ts           # Patient CRUD, vitals, allergies, history
├── patientLookupService.ts     # Patient search and lookup
├── patientPortalService.ts     # Patient self-service portal
├── appointmentService.ts       # Appointment booking and management
├── doctorService.ts            # Doctor profiles, schedules
├── departmentService.ts        # Department management
├── opdService.ts               # OPD workflow, queue, booking ticket
├── ipdService.ts               # IPD admission, beds, discharge
├── emergencyService.ts         # Emergency department, triage
├── laboratoryService.ts        # Lab orders, samples, results
├── pharmacyService.ts          # Drug inventory, dispensing
├── radiologyService.ts         # Imaging orders, reports
├── surgeryService.ts           # Surgical scheduling
├── billingService.ts           # Invoicing, payments, insurance
├── hrService.ts                # Staff management, attendance, payroll
├── housekeepingService.ts      # Facility maintenance tasks
├── bloodBankService.ts         # Blood inventory, transfusions
├── medicalRecordsService.ts    # EMR, document management
├── dietaryService.ts           # Meal planning, nutrition orders
├── assetService.ts             # Equipment tracking, maintenance
├── ambulanceService.ts         # Fleet management, dispatch
├── cssdService.ts              # Sterilization tracking
├── mortuaryService.ts          # Deceased management
├── telemedicineService.ts      # Video consultation sessions
├── qualityService.ts           # QA audits, incident reporting
├── reportsService.ts           # Analytics, dashboards
├── queueService.ts             # Queue management, predictions
├── aiService.ts                # Core AI services proxy
├── aiScribeService.ts          # Voice transcription, note generation
├── aiConsultationService.ts    # AI consultation support
├── advancedPharmacyAIService.ts # Drug interactions, safety
├── symptomCheckerService.ts    # Interactive symptom assessment
├── earlyWarningService.ts      # NEWS2, clinical alerts
├── medSafetyService.ts         # Medication safety checks
├── smartOrderService.ts        # AI order recommendations
├── pdfService.ts               # PDF generation and analysis
├── rbacService.ts              # Role-based access control
├── notificationService.ts      # Multi-channel notifications
├── emailService.ts             # Email sending (SES)
├── smsService.ts               # SMS sending (Twilio)
├── whatsappService.ts          # WhatsApp messages (Twilio)
├── storageService.ts           # S3/MinIO file storage
├── publicBookingService.ts     # Public appointment booking
└── aiBookingService.ts         # AI-assisted booking
```

## Key Patterns

### Service Class Structure

Every service follows this singleton pattern:

```typescript
import prisma from '../config/database';
import { AppError, NotFoundError } from '../middleware/errorHandler';

interface CreateSomethingData {
  // Input type
}

interface UpdateSomethingData {
  // Partial input type
}

export class SomethingService {
  // List with pagination
  async findAll(hospitalId: string, query: QueryParams) {
    const { page = 1, limit = 10, search, sortBy, sortOrder } = query;

    const where = {
      hospitalId,
      isActive: true,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          // other searchable fields
        ],
      }),
    };

    const [data, total] = await Promise.all([
      prisma.something.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy || 'createdAt']: sortOrder || 'desc' },
        include: { /* relations */ },
      }),
      prisma.something.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Get by ID
  async findById(id: string, hospitalId: string) {
    const result = await prisma.something.findFirst({
      where: { id, hospitalId, isActive: true },
      include: { /* relations */ },
    });

    if (!result) {
      throw new NotFoundError('Resource not found');
    }

    return result;
  }

  // Create
  async create(data: CreateSomethingData) {
    return prisma.something.create({
      data,
      include: { /* relations */ },
    });
  }

  // Update
  async update(id: string, hospitalId: string, data: UpdateSomethingData) {
    await this.findById(id, hospitalId); // Verify exists

    return prisma.something.update({
      where: { id },
      data,
      include: { /* relations */ },
    });
  }

  // Soft delete
  async delete(id: string, hospitalId: string) {
    await this.findById(id, hospitalId);

    return prisma.something.update({
      where: { id },
      data: { isActive: false },
    });
  }
}

// Export singleton instance
export const somethingService = new SomethingService();
```

### Multi-Tenancy Pattern
All queries must filter by `hospitalId`:
```typescript
prisma.entity.findMany({
  where: {
    hospitalId,  // Always include
    isActive: true,
    // other conditions
  },
});
```

### Soft Deletes
Resources are marked inactive rather than deleted:
```typescript
async delete(id: string, hospitalId: string) {
  return prisma.entity.update({
    where: { id },
    data: { isActive: false },
  });
}
```

### Pagination Response
```typescript
return {
  data: results,
  pagination: {
    page: number,
    limit: number,
    total: number,
    totalPages: number,
  },
};
```

## Dependencies

### Internal
- `../config/database` - Prisma client instance
- `../config/index` - Configuration values
- `../middleware/errorHandler` - Custom error classes
- `../types/index` - TypeScript interfaces

### External
- `@prisma/client` - Database ORM
- `bcryptjs` - Password hashing
- `jsonwebtoken` - JWT operations
- `axios` - HTTP client (for AI service calls)
- `uuid` - UUID generation

## Service Categories

### Core Services
| Service | Purpose | Prisma Models |
|---------|---------|---------------|
| `authService` | Staff login, tokens | User, Session |
| `patientAuthService` | Patient login, OTP | Patient |
| `patientService` | Patient data management | Patient, Vital, Allergy, MedicalHistory |
| `appointmentService` | Appointment booking | Appointment, Doctor, Patient |
| `doctorService` | Doctor management | Doctor, DoctorSchedule, Specialization |
| `departmentService` | Department CRUD | Department, Specialization |

### Clinical Workflow Services
| Service | Purpose | Prisma Models |
|---------|---------|---------------|
| `opdService` | Outpatient flow, queues | Appointment, Consultation, Vital |
| `ipdService` | Inpatient management | Admission, Bed, Ward, DischargeSummary |
| `emergencyService` | Emergency triage | Emergency, Triage |
| `laboratoryService` | Lab workflow | LabOrder, LabTest, LabOrderTest |
| `radiologyService` | Imaging workflow | ImagingOrder, ImagingStudy |
| `pharmacyService` | Drug dispensing | Drug, DrugInventory, Prescription |
| `surgeryService` | Surgical scheduling | Surgery, SurgeryTeam |

### AI Services
| Service | Purpose | External Integration |
|---------|---------|---------------------|
| `aiService` | Core AI proxy | FastAPI (AI_SERVICE_URL) |
| `aiScribeService` | Voice transcription | OpenAI Whisper via FastAPI |
| `aiConsultationService` | Consultation AI | FastAPI |
| `symptomCheckerService` | Symptom assessment | FastAPI |
| `advancedPharmacyAIService` | Drug safety | FastAPI |
| `smartOrderService` | Order recommendations | FastAPI |
| `earlyWarningService` | Clinical alerts | Rule-based + FastAPI |
| `medSafetyService` | Med safety checks | FastAPI |

### Support Services
| Service | Purpose | External Integration |
|---------|---------|---------------------|
| `notificationService` | Multi-channel alerts | Email, SMS, WhatsApp, Push |
| `emailService` | Email delivery | AWS SES |
| `smsService` | SMS delivery | Twilio |
| `whatsappService` | WhatsApp messages | Twilio |
| `storageService` | File storage | AWS S3 / MinIO |
| `pdfService` | PDF generation | Custom + AI |

## Common Operations

### Adding a New Service

1. **Create service file** (`src/services/newModuleService.ts`):
```typescript
import prisma from '../config/database';
import { AppError, NotFoundError } from '../middleware/errorHandler';

export class NewModuleService {
  async findAll(hospitalId: string, query: any) {
    // Implementation
  }

  async findById(id: string, hospitalId: string) {
    // Implementation
  }

  async create(data: any) {
    // Implementation
  }

  async update(id: string, hospitalId: string, data: any) {
    // Implementation
  }

  async delete(id: string, hospitalId: string) {
    // Implementation
  }
}

export const newModuleService = new NewModuleService();
```

2. **Add TypeScript interfaces** for input/output types

3. **Import in route file**:
```typescript
import { newModuleService } from '../services/newModuleService';
```

### Calling AI Services

AI services are accessed via HTTP proxy:
```typescript
import axios from 'axios';
import { config } from '../config';

const response = await axios.post(
  `${config.aiServiceUrl}/endpoint`,
  payload,
  { timeout: 60000 } // 60s timeout for AI calls
);
```

### Transaction Example
```typescript
async createWithRelations(data: any) {
  return prisma.$transaction(async (tx) => {
    const parent = await tx.parent.create({ data: parentData });

    const children = await tx.child.createMany({
      data: childrenData.map(c => ({ ...c, parentId: parent.id })),
    });

    return { parent, children };
  });
}
```

## Error Handling

Use custom error classes from `errorHandler.ts`:
```typescript
import {
  AppError,         // Generic error (400)
  NotFoundError,    // 404
  UnauthorizedError,// 401
  ForbiddenError,   // 403
  ValidationError,  // 400 with field errors
  ConflictError,    // 409
} from '../middleware/errorHandler';

// Usage
if (!resource) {
  throw new NotFoundError('Resource not found');
}

if (exists) {
  throw new ConflictError('Resource already exists');
}
```

## Related Files

- `/src/routes/` - Route handlers that call services
- `/src/middleware/` - Auth, validation, error handling
- `/src/config/database.ts` - Prisma client
- `/prisma/schema.prisma` - Data models (4600+ lines)

## Testing

Services are unit tested with mocked Prisma:
```bash
npm test -- services/
```

Test files should:
- Mock `prisma` client
- Test success and error paths
- Verify multi-tenant filtering
- Test pagination logic

## Common Issues and Solutions

### Issue: Prisma Query Timeout
- Add indexes to frequently queried fields
- Use `select` to limit returned fields
- Consider pagination for large datasets

### Issue: N+1 Queries
Use `include` for eager loading:
```typescript
prisma.appointment.findMany({
  include: {
    patient: true,
    doctor: { include: { specialization: true } },
  },
});
```

### Issue: Transaction Deadlocks
- Keep transactions short
- Consistent ordering of operations
- Use `$transaction` with proper isolation

### Issue: Missing hospitalId
- All queries must include `hospitalId`
- Check route handler passes `req.user.hospitalId`
- Verify SUPER_ADMIN bypass logic if needed
