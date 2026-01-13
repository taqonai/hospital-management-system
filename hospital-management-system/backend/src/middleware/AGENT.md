# AGENT.md - Backend Middleware Directory

## Purpose

This directory contains Express.js middleware functions for authentication, authorization, validation, and error handling. Middleware is applied to routes to enforce security, validate input, and handle errors consistently across the API.

## Directory Structure

```
middleware/
├── auth.ts           # Staff JWT authentication & authorization
├── patientAuth.ts    # Patient portal authentication
├── rbac.ts           # Role-based access control (granular permissions)
├── validation.ts     # Zod schema validation + common schemas
└── errorHandler.ts   # Error classes and centralized error handling
```

## File Details

### auth.ts - Staff Authentication

**Purpose:** JWT-based authentication and role-based authorization for staff users.

**Exports:**
```typescript
// Require valid JWT token
export const authenticate = (req, res, next) => { ... }

// Require specific user roles (after authenticate)
export const authorize = (...allowedRoles: UserRole[]) => { ... }

// Multi-tenant hospital isolation
export const authorizeHospital = (req, res, next) => { ... }

// Optional auth - continues without token, sets user if valid
export const optionalAuth = (req, res, next) => { ... }
```

**JWT Payload (JwtPayload):**
```typescript
{
  userId: string;
  email: string;
  role: UserRole;
  hospitalId: string;
  firstName: string;
  lastName: string;
}
```

**Usage:**
```typescript
// Basic authentication
router.get('/protected', authenticate, handler);

// Role-based access
router.get('/admin', authenticate, authorize('HOSPITAL_ADMIN'), handler);

// Multiple roles allowed
router.get('/clinical', authenticate, authorize('DOCTOR', 'NURSE'), handler);

// Hospital isolation
router.get('/hospital/:hospitalId', authenticate, authorizeHospital, handler);

// Public with optional user context
router.get('/public', optionalAuth, handler);
```

---

### patientAuth.ts - Patient Portal Authentication

**Purpose:** Separate authentication for patient portal users. Patient tokens have `type: 'patient'` to distinguish from staff tokens.

**Exports:**
```typescript
// Require valid patient JWT
export const patientAuthenticate = (req, res, next) => { ... }

// Optional patient auth
export const optionalPatientAuth = (req, res, next) => { ... }

// Types
export interface PatientJwtPayload {
  patientId: string;
  hospitalId: string;
  email: string;
  mobile: string;
  type: 'patient';
}

export interface PatientAuthenticatedRequest extends Request {
  patient?: PatientJwtPayload;
}
```

**Usage:**
```typescript
// Patient portal routes
router.get('/my-records', patientAuthenticate, (req, res) => {
  const patientId = req.patient!.patientId;
  // ...
});

// Symptom checker with optional patient context
router.post('/check', optionalPatientAuth, handler);
```

---

### rbac.ts - Role-Based Access Control

**Purpose:** Granular permission checking beyond role-based authorization. Permissions use `module:action` format (e.g., `patients:read`, `billing:write`).

**Exports:**
```typescript
// Require single permission
export const requirePermission = (permission: string) => { ... }

// Require any of multiple permissions
export const requireAnyPermission = (...permissions: string[]) => { ... }

// Require all specified permissions
export const requireAllPermissions = (...permissions: string[]) => { ... }

// Attach permissions to request for downstream use
export const attachPermissions = async (req, res, next) => { ... }
```

**Permission Format:**
```
module:action

Examples:
- patients:read
- patients:write
- patients:delete
- billing:read
- billing:write
- appointments:manage
- laboratory:results
- pharmacy:dispense
```

**Usage:**
```typescript
// Single permission
router.get('/patients', authenticate, requirePermission('patients:read'), handler);

// Any permission (OR logic)
router.get('/reports', authenticate, requireAnyPermission('reports:read', 'admin:all'), handler);

// All permissions (AND logic)
router.post('/critical', authenticate, requireAllPermissions('critical:access', 'audit:write'), handler);
```

**SUPER_ADMIN Bypass:**
Users with `SUPER_ADMIN` role bypass all permission checks.

---

### validation.ts - Input Validation

**Purpose:** Zod schema validation for request body, query, and params. Provides consistent error responses for invalid input.

**Exports:**
```typescript
// Main validation middleware factory
export const validate = (schema: z.ZodSchema) => { ... }

// Common schemas
export const paginationSchema = z.object({ ... });
export const uuidParamSchema = z.object({ ... });
export const loginSchema = z.object({ ... });
export const registerSchema = z.object({ ... });
export const createPatientSchema = z.object({ ... });
export const createAppointmentSchema = z.object({ ... });
// ... 50+ predefined schemas
```

**Schema Structure:**
```typescript
const mySchema = z.object({
  body: z.object({
    field1: z.string().min(1),
    field2: z.number().optional(),
  }),
  query: z.object({
    search: z.string().optional(),
  }),
  params: z.object({
    id: z.string().uuid(),
  }),
});
```

**Usage:**
```typescript
router.post('/create', authenticate, validate(createSchema), handler);
router.get('/', authenticate, validate(paginationSchema), handler);
router.get('/:id', authenticate, validate(uuidParamSchema), handler);
```

**Error Response:**
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    { "field": "body.email", "message": "Invalid email address" },
    { "field": "body.password", "message": "Password must be at least 6 characters" }
  ]
}
```

---

### errorHandler.ts - Error Handling

**Purpose:** Custom error classes1 and centralized error handler for consistent error responses.

**Error Classes:**
```typescript
// Base error class
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  constructor(message: string, statusCode: number = 400) { ... }
}

// Specific error types
export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403);
  }
}

export class ValidationError extends AppError {
  errors: any[];
  constructor(message: string = 'Validation failed', errors: any[] = []) {
    super(message, 400);
    this.errors = errors;
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists') {
    super(message, 409);
  }
}
```

**Utility Functions:**
```typescript
// Centralized error handler (registered in app.ts)
export const errorHandler = (err, req, res, next) => { ... }

// 404 handler for undefined routes
export const notFoundHandler = (req, res, next) => { ... }

// Async handler wrapper (catches promise rejections)
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
```

**Prisma Error Handling:**
```typescript
// Automatically handled in errorHandler
P2002 → 409 Conflict (unique constraint)
P2025 → 404 Not Found
P2003 → 400 Foreign key constraint
P2014 → 400 Relation violation
```

**Usage in Services:**
```typescript
import { NotFoundError, ConflictError } from '../middleware/errorHandler';

if (!resource) {
  throw new NotFoundError('Patient not found');
}

if (exists) {
  throw new ConflictError('Email already registered');
}
```

**Usage in Routes:**
```typescript
import { asyncHandler } from '../middleware/errorHandler';

router.get('/', authenticate, asyncHandler(async (req, res) => {
  // Errors automatically caught and passed to errorHandler
  const data = await service.findAll();
  sendSuccess(res, data);
}));
```

## Middleware Chain Order

Standard order for route handlers:

```typescript
router.method(
  '/path',
  authenticate,                    // 1. Verify JWT
  authorize('ROLE1', 'ROLE2'),     // 2. Check role
  requirePermission('module:act'), // 3. Check RBAC permission (optional)
  validate(schema),                // 4. Validate input
  asyncHandler(handler)            // 5. Execute handler
);
```

## Dependencies

### Internal
- `../config/index` - JWT secrets, configuration
- `../types/index` - TypeScript interfaces
- `../utils/response` - Response utilities
- `../services/rbacService` - Permission checking

### External
- `express` - Request, Response, NextFunction types
- `jsonwebtoken` - JWT verification
- `zod` - Schema validation
- `@prisma/client` - Prisma error types

## Common Operations

### Adding a New Validation Schema

In `validation.ts`:
```typescript
export const createMyEntitySchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    type: z.enum(['TYPE_A', 'TYPE_B']),
    amount: z.number().positive(),
    metadata: z.record(z.unknown()).optional(),
  }),
});
```

### Creating Custom Middleware

```typescript
export const myCustomMiddleware = (options: MyOptions) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Pre-processing

    // Check conditions
    if (!condition) {
      sendForbidden(res, 'Condition not met');
      return;
    }

    // Attach data to request
    (req as any).customData = processedData;

    next();
  };
};
```

## Related Files

- `/src/routes/` - Route files that apply middleware
- `/src/services/rbacService.ts` - Permission logic
- `/src/config/index.ts` - JWT configuration
- `/src/types/index.ts` - Request interfaces
- `/src/utils/response.ts` - Response utilities

## Testing

Middleware is tested via integration tests:
```bash
npm test -- middleware/
```

Test scenarios:
- Valid/invalid tokens
- Expired tokens
- Role authorization
- Permission checking
- Validation success/failure
- Error response formats

## Common Issues and Solutions

### Issue: "No token provided"
- Check `Authorization` header format: `Bearer <token>`
- Ensure token is not empty

### Issue: "Token expired"
- Access tokens expire in 15 minutes
- Use refresh token to get new access token
- Check client token rotation logic

### Issue: "Invalid token"
- Token was tampered with
- Wrong JWT secret
- Token from different environment

### Issue: Permission Denied Despite Correct Role
- RBAC permission not assigned to role
- Check `UserPermission` or `CustomRole` assignments
- Verify permission string matches exactly

### Issue: Validation Failing Unexpectedly
- Check Zod schema matches request structure
- Verify `body`, `query`, `params` nesting
- Check date format (ISO 8601 required)
- Ensure enums match exactly (case-sensitive)
