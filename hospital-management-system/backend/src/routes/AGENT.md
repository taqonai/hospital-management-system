# AGENT.md - Backend Routes Directory

## Purpose

This directory contains all Express.js route modules for the Hospital Management System API. Routes define HTTP endpoints, apply middleware for authentication/validation, and delegate business logic to services.

## Directory Structure

```
routes/
├── index.ts                    # Central route aggregator - registers all routes
├── authRoutes.ts               # Staff authentication (login, register, profile)
├── patientAuthRoutes.ts        # Patient portal authentication (OTP, mobile login)
├── patientRoutes.ts            # Patient CRUD and medical data
├── appointmentRoutes.ts        # Appointment booking and management
├── doctorRoutes.ts             # Doctor profiles and schedules
├── departmentRoutes.ts         # Department management
├── opdRoutes.ts                # Outpatient workflow, queue, booking ticket
├── ipdRoutes.ts                # Inpatient admission, beds, discharge
├── emergencyRoutes.ts          # Emergency department, triage
├── laboratoryRoutes.ts         # Lab orders, samples, results
├── pharmacyRoutes.ts           # Drug inventory, dispensing
├── radiologyRoutes.ts          # Imaging orders and reports
├── surgeryRoutes.ts            # Surgical scheduling
├── billingRoutes.ts            # Invoices, payments, insurance
├── hrRoutes.ts                 # Staff management, attendance
├── housekeepingRoutes.ts       # Facility maintenance
├── bloodBankRoutes.ts          # Blood inventory, transfusions
├── medicalRecordsRoutes.ts     # EMR, document management
├── dietaryRoutes.ts            # Meal planning, nutrition
├── assetRoutes.ts              # Equipment tracking
├── ambulanceRoutes.ts          # Fleet management
├── cssdRoutes.ts               # Sterilization tracking
├── mortuaryRoutes.ts           # Deceased management
├── telemedicineRoutes.ts       # Video consultations
├── qualityRoutes.ts            # QA audits, incidents
├── reportsRoutes.ts            # Analytics, dashboards
├── queueRoutes.ts              # Queue management
├── kioskRoutes.ts              # Self-service kiosk
├── aiRoutes.ts                 # Core AI services proxy
├── aiScribeRoutes.ts           # Voice transcription
├── aiConsultationRoutes.ts     # AI consultation support
├── advancedPharmacyAIRoutes.ts # Drug interaction AI
├── symptomCheckerRoutes.ts     # Symptom assessment
├── earlyWarningRoutes.ts       # NEWS2, clinical alerts
├── medSafetyRoutes.ts          # Medication safety
├── smartOrderRoutes.ts         # AI order recommendations
├── pdfRoutes.ts                # PDF generation/analysis
├── patientPortalRoutes.ts      # Patient self-service
├── wellnessRoutes.ts           # Health sync, fitness
├── rbacRoutes.ts               # Role-based access control
├── notificationRoutes.ts       # Email, SMS, push
└── publicRoutes.ts             # Unauthenticated endpoints
```

## Key Patterns

### Route File Structure
Every route file follows this pattern:

```typescript
import { Router, Response } from 'express';
import { someService } from '../services/someService';
import { authenticate, authorize } from '../middleware/auth';
import { validate, someSchema } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated, sendPaginated } from '../utils/response';
import { AuthenticatedRequest } from '../types';

const router = Router();

// GET list with pagination
router.get(
  '/',
  authenticate,
  authorize('ROLE1', 'ROLE2'),
  validate(paginationSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await someService.findAll(req.user!.hospitalId, req.query);
    sendPaginated(res, result.data, result.pagination);
  })
);

// POST create
router.post(
  '/',
  authenticate,
  authorize('ROLE1'),
  validate(createSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await someService.create({
      ...req.body,
      hospitalId: req.user!.hospitalId,
      createdBy: req.user!.userId,
    });
    sendCreated(res, result, 'Resource created');
  })
);

export default router;
```

### Middleware Chain Order
1. `authenticate` - Validates JWT token
2. `authorize(...roles)` - Checks user role
3. `validate(schema)` - Validates request body/query/params
4. `asyncHandler(handler)` - Wraps async handlers for error catching

### Authentication Types
- `authenticate` - Requires valid JWT token
- `authorize(...roles)` - Role-based access (UserRole enum)
- `authorizeHospital` - Multi-tenant isolation
- `optionalAuth` - Token optional (public with user context if provided)

### Response Utilities
- `sendSuccess(res, data, message?)` - 200 OK
- `sendCreated(res, data, message?)` - 201 Created
- `sendPaginated(res, data, pagination)` - 200 with pagination meta
- `sendError(res, message, statusCode, errors?)` - Error response

## Route Registration (index.ts)

All routes are registered in `index.ts`:

```typescript
// Public routes (no authentication)
router.use('/public', publicRoutes);
router.use('/kiosk', kioskRoutes);
router.use('/patient-auth', patientAuthRoutes);

// Protected routes
router.use('/auth', authRoutes);
router.use('/patients', patientRoutes);
// ... all other routes
```

**Route Categories:**
| Category | Routes | Auth Required |
|----------|--------|---------------|
| Public | `/public`, `/kiosk`, `/patient-auth` | No |
| Staff Auth | `/auth` | Partial |
| Core Clinical | `/patients`, `/appointments`, `/doctors`, `/departments` | Yes |
| Workflow | `/opd`, `/ipd`, `/emergency`, `/surgery` | Yes |
| Diagnostics | `/laboratory`, `/radiology` | Yes |
| Pharmacy | `/pharmacy`, `/advanced-pharmacy-ai` | Yes |
| AI Services | `/ai`, `/ai-scribe`, `/ai-consultation`, `/symptom-checker` | Yes/Optional |
| Clinical Safety | `/early-warning`, `/med-safety`, `/smart-orders` | Yes |
| Operations | `/billing`, `/hr`, `/housekeeping`, `/dietary`, etc. | Yes |
| Patient Portal | `/patient-portal`, `/wellness` | Patient Auth |
| Admin | `/rbac` | Admin Only |

## Dependencies

### Internal
- `../services/*` - Business logic layer
- `../middleware/auth.ts` - Authentication middleware
- `../middleware/validation.ts` - Zod validation schemas
- `../middleware/errorHandler.ts` - Error classes and async handler
- `../utils/response.ts` - Response formatting
- `../types/index.ts` - TypeScript interfaces

### External
- `express` - Router, Request, Response types
- `zod` - Schema validation (via validation.ts)

## Common Operations

### Adding a New Route Module

1. **Create route file** (`src/routes/newModuleRoutes.ts`):
```typescript
import { Router, Response } from 'express';
import { newModuleService } from '../services/newModuleService';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated } from '../utils/response';
import { AuthenticatedRequest } from '../types';

const router = Router();

// Define routes...

export default router;
```

2. **Create validation schemas** (in `middleware/validation.ts` or separate file):
```typescript
export const createNewModuleSchema = z.object({
  body: z.object({
    // fields...
  }),
});
```

3. **Register in index.ts**:
```typescript
import newModuleRoutes from './newModuleRoutes';
// ...
router.use('/new-module', newModuleRoutes);
```

### Adding an Endpoint to Existing Route

1. Add validation schema if needed
2. Add route handler with proper middleware chain
3. Ensure service method exists

### Multi-Tenant Considerations
Always include `hospitalId` filtering:
```typescript
// In route handler
const result = await service.findAll(req.user!.hospitalId, req.query);

// In create operations
const result = await service.create({
  ...req.body,
  hospitalId: req.user!.hospitalId,
});
```

## User Roles (UserRole Enum)

```typescript
type UserRole =
  | 'SUPER_ADMIN'      // Full system access
  | 'HOSPITAL_ADMIN'   // Hospital-level admin
  | 'DOCTOR'           // Clinical staff
  | 'NURSE'            // Nursing staff
  | 'RECEPTIONIST'     // Front desk
  | 'LAB_TECHNICIAN'   // Laboratory
  | 'PHARMACIST'       // Pharmacy
  | 'RADIOLOGIST'      // Radiology
  | 'ACCOUNTANT'       // Billing
  | 'PATIENT'          // Patient portal
  | 'HR_MANAGER'       // HR management
  | 'HR_STAFF'         // HR operations
  | 'HOUSEKEEPING_MANAGER'
  | 'HOUSEKEEPING_STAFF'
  | 'MAINTENANCE_STAFF'
  | 'SECURITY_STAFF'
  | 'DIETARY_STAFF';
```

## Related Files

- `/src/services/` - Service layer (business logic)
- `/src/middleware/` - Middleware functions
- `/src/types/index.ts` - Request/Response types
- `/prisma/schema.prisma` - Data models

## Testing

Routes are tested via integration tests:
```bash
npm test -- routes/
```

Test files should cover:
- Authentication requirements
- Authorization for different roles
- Validation error responses
- Success responses
- Error handling

## Common Issues and Solutions

### Issue: 401 Unauthorized
- Check JWT token is valid and not expired
- Verify token is in `Authorization: Bearer <token>` format
- Ensure user exists in database

### Issue: 403 Forbidden
- User role not in `authorize()` list
- Hospital ID mismatch (multi-tenant isolation)
- Custom RBAC permission denied

### Issue: 400 Validation Error
- Request body doesn't match Zod schema
- Check error response for specific field errors
- Ensure date formats are ISO 8601

### Issue: Route Not Found
- Check route is registered in `index.ts`
- Verify HTTP method matches
- Check for typos in URL path
