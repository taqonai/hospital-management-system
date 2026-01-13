# Multi-Tenant Security - Product Requirements Document

## Document Info
- **Version**: 1.0
- **Last Updated**: 2026-01-12
- **Status**: Current Implementation
- **Module**: Data Isolation & Security

---

## 1. Overview

### 1.1 Purpose
The Multi-Tenant Security system ensures complete data isolation between hospitals in the shared SaaS platform. Each hospital's data (patients, appointments, staff, billing) is logically separated and protected from unauthorized cross-tenant access.

### 1.2 Scope
This PRD covers:
- Hospital-based data partitioning
- Automatic tenant filtering in queries
- Cross-tenant access prevention
- SUPER_ADMIN cross-hospital access
- Tenant context in JWT tokens

### 1.3 Background
The HMS serves multiple hospitals on shared infrastructure. Data privacy regulations (HIPAA, GDPR) require strict isolation between tenants. A user from Hospital A must never access Hospital B's data, even through API manipulation or SQL injection.

---

## 2. User Stories

### 2.1 Primary User Stories

**US-001: Tenant Data Isolation**
> As a hospital administrator, I want assurance that only my hospital's staff can access our data.

**Acceptance Criteria:**
- All queries filter by hospitalId
- API requests cannot access other hospitals' data
- Error response if hospitalId mismatch detected

**US-002: User-Tenant Binding**
> As a staff member, I want to only see data from my hospital when I log in.

**Acceptance Criteria:**
- User's hospitalId embedded in JWT token
- All queries automatically scoped to user's hospital
- No UI or API option to select different hospital

**US-003: SUPER_ADMIN Cross-Tenant Access**
> As a platform administrator, I need to access any hospital's data for support purposes.

**Acceptance Criteria:**
- SUPER_ADMIN can specify hospitalId in requests
- Audit log captures cross-tenant access
- Dashboard shows all hospitals

**US-004: Tenant Onboarding**
> As a platform operator, I want to create new hospital tenants securely.

**Acceptance Criteria:**
- New hospital gets unique UUID
- Initial admin account created
- Seed data isolated to new tenant

### 2.2 Edge Cases

**EC-001: URL Parameter Manipulation**
- hospitalId in URL must match JWT hospitalId
- Mismatched hospitalId returns 403 Forbidden

**EC-002: Nested Resource Access**
- Accessing patient→appointments checks both patient and appointment hospitalId
- Parent resource hospital validation

**EC-003: Shared Reference Data**
- ICD codes, drug databases are global (no hospitalId)
- Clearly documented which tables are shared

---

## 3. Acceptance Criteria

### 3.1 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | All tenant data tables shall include hospitalId | Must |
| FR-002 | All queries shall filter by hospitalId | Must |
| FR-003 | JWT tokens shall include hospitalId claim | Must |
| FR-004 | API shall reject cross-tenant requests with 403 | Must |
| FR-005 | SUPER_ADMIN shall bypass tenant restrictions | Must |
| FR-006 | Audit log shall capture cross-tenant access attempts | Should |

### 3.2 Non-Functional Requirements

**Security:**
- Defense in depth (API + database level)
- No hospitalId = global/shared data only
- Regular penetration testing for isolation

**Performance:**
- hospitalId indexed on all tenant tables
- Query performance unaffected by tenant filtering

**Compliance:**
- HIPAA Business Associate requirements
- SOC 2 data isolation controls

---

## 4. Technical Specifications

### 4.1 Backend Layer

**Middleware:**
```typescript
// backend/src/middleware/auth.ts

export const authorizeHospital = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const hospitalId = req.params.hospitalId || req.body.hospitalId;

  if (!req.user) {
    sendUnauthorized(res, 'User not authenticated');
    return;
  }

  // SUPER_ADMIN can access any hospital
  if (req.user.role === 'SUPER_ADMIN') {
    next();
    return;
  }

  // Verify hospitalId matches user's hospital
  if (hospitalId && req.user.hospitalId !== hospitalId) {
    sendForbidden(res, 'Access denied to this hospital');
    return;
  }

  next();
};
```

**Service Layer Pattern:**
```typescript
// All service methods receive hospitalId from authenticated user

class PatientService {
  async findAll(hospitalId: string, params: SearchParams) {
    return prisma.patient.findMany({
      where: {
        hospitalId,  // Always filter by tenant
        isActive: true,
        // ... other filters
      },
    });
  }

  async findById(id: string, hospitalId: string) {
    const patient = await prisma.patient.findFirst({
      where: {
        id,
        hospitalId,  // Verify tenant ownership
      },
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    return patient;
  }

  async create(data: CreatePatientDto, hospitalId: string, userId: string) {
    return prisma.patient.create({
      data: {
        ...data,
        hospitalId,  // Set tenant on creation
        createdBy: userId,
      },
    });
  }
}
```

**Route Handler Pattern:**
```typescript
router.get(
  '/',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'RECEPTIONIST'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // hospitalId from JWT, not request params
    const result = await patientService.findAll(
      req.user!.hospitalId,
      req.query
    );
    sendPaginated(res, result.data, result.pagination);
  })
);

router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Service validates hospitalId ownership
    const patient = await patientService.findById(
      req.params.id,
      req.user!.hospitalId
    );
    sendSuccess(res, patient);
  })
);
```

### 4.2 Data Models

**Tenant Entity:**
```prisma
model Hospital {
  id          String   @id @default(uuid())
  name        String
  code        String   @unique  // Short code like "HOSP001"
  address     String?
  phone       String?
  email       String?
  website     String?
  logo        String?
  settings    Json?    // Hospital-specific settings
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relations - all tenant data
  users        User[]
  patients     Patient[]
  doctors      Doctor[]
  departments  Department[]
  appointments Appointment[]
  // ... all other tenant entities
}
```

**Tenant Field Pattern:**
```prisma
model Patient {
  id          String   @id @default(uuid())
  hospitalId  String   // Foreign key to Hospital
  hospital    Hospital @relation(fields: [hospitalId], references: [id])
  // ... other fields

  @@index([hospitalId])  // Index for query performance
}

model Appointment {
  id          String   @id @default(uuid())
  hospitalId  String
  hospital    Hospital @relation(fields: [hospitalId], references: [id])
  // ... other fields

  @@index([hospitalId])
}
```

**Shared Reference Data (No hospitalId):**
```prisma
model ICDCode {
  id          String @id
  code        String @unique
  description String
  category    String
  // No hospitalId - shared across all tenants
}

model DrugDatabase {
  id          String @id
  genericName String
  brandNames  String[]
  // No hospitalId - shared reference data
}
```

### 4.3 JWT Token Structure

```typescript
interface JwtPayload {
  userId: string;
  hospitalId: string;  // Tenant identifier - always present
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
}
```

### 4.4 Database Indexing Strategy

```sql
-- All tenant tables have hospitalId index
CREATE INDEX idx_patients_hospital ON patients(hospital_id);
CREATE INDEX idx_appointments_hospital ON appointments(hospital_id);
CREATE INDEX idx_users_hospital ON users(hospital_id);

-- Composite indexes for common queries
CREATE INDEX idx_patients_hospital_active ON patients(hospital_id, is_active);
CREATE INDEX idx_appointments_hospital_date ON appointments(hospital_id, appointment_date);
```

---

## 5. Dependencies

### 5.1 Internal Dependencies
- Authentication middleware (JWT with hospitalId)
- All service layer implementations

### 5.2 External Dependencies
None - architectural pattern

---

## 6. Security Controls

### 6.1 Defense Layers

| Layer | Control | Description |
|-------|---------|-------------|
| API Gateway | Rate limiting | Per-tenant rate limits |
| Middleware | authorizeHospital | Validates hospitalId in requests |
| Service | Query filtering | hospitalId in all WHERE clauses |
| Database | Row-level security | Optional PostgreSQL RLS policies |

### 6.2 Attack Prevention

**SQL Injection:**
- Parameterized queries via Prisma
- hospitalId from JWT, never from user input

**IDOR (Insecure Direct Object Reference):**
- All resource lookups include hospitalId
- Returns 404 for resources in other tenants

**Privilege Escalation:**
- hospitalId in JWT is immutable
- Server-side validation only

---

## 7. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Developer forgetting hospitalId filter | Medium | Critical | Code review, linting rules, integration tests |
| SUPER_ADMIN abuse | Low | High | Audit logging, access reviews |
| Database misconfiguration | Low | Critical | Infrastructure as code, testing |

---

## 8. Testing Strategy

### 8.1 Unit Tests
- Middleware hospitalId validation
- Service hospitalId filtering

### 8.2 Integration Tests
```typescript
describe('Multi-Tenant Isolation', () => {
  it('should not return other hospital patients', async () => {
    // Create patients in two hospitals
    const patient1 = await createPatient(hospital1Id);
    const patient2 = await createPatient(hospital2Id);

    // Login as hospital1 user
    const token = await loginAsHospital1User();

    // Query patients
    const res = await request(app)
      .get('/api/v1/patients')
      .set('Authorization', `Bearer ${token}`);

    // Should only see hospital1 patient
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(patient1.id);
  });

  it('should reject access to other hospital patient', async () => {
    const patient = await createPatient(hospital2Id);
    const token = await loginAsHospital1User();

    const res = await request(app)
      .get(`/api/v1/patients/${patient.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404); // Not found (not 403 to avoid leaking info)
  });

  it('SUPER_ADMIN should access any hospital', async () => {
    const patient = await createPatient(hospital2Id);
    const token = await loginAsSuperAdmin();

    const res = await request(app)
      .get(`/api/v1/patients/${patient.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });
});
```

### 8.3 Penetration Testing
- Cross-tenant access attempts
- hospitalId parameter manipulation
- Token forgery attempts

---

## 9. File References

### Backend
- `backend/src/middleware/auth.ts` - authorizeHospital middleware
- `backend/src/services/*.ts` - All services with hospitalId filtering
- `backend/prisma/schema.prisma` - Hospital model and relations

### Database
- All tenant tables include `hospitalId` column
- Indexes on `hospitalId` for performance

### Configuration
- `backend/src/config/index.ts` - No tenant-specific config needed
