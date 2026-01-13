# Staff Authentication - Product Requirements Document

## Document Info
- **Version**: 1.0
- **Last Updated**: 2026-01-12
- **Status**: Current Implementation
- **Module**: Authentication & Authorization

---

## 1. Overview

### 1.1 Purpose
The Staff Authentication system provides secure authentication for all hospital staff members including doctors, nurses, administrators, lab technicians, pharmacists, and other personnel. It implements JWT-based authentication with access and refresh tokens to ensure secure API access while maintaining usability.

### 1.2 Scope
This PRD covers:
- User registration and login for staff accounts
- JWT access token and refresh token management
- Session management and multi-device logout
- Password management (change password)
- Profile retrieval and updates

### 1.3 Background
The HMS requires secure, role-based access for 17 different user roles. Staff authentication is separate from patient portal authentication to maintain clear security boundaries. The system supports multi-tenant architecture where each staff member is associated with a specific hospital.

---

## 2. User Stories

### 2.1 Primary User Stories

**US-001: Staff Login**
> As a hospital staff member, I want to log in with my email and password so that I can access the hospital management system.

**Acceptance Criteria:**
- User can submit email and password credentials
- Valid credentials return access token (15m expiry) and refresh token (7d expiry)
- Invalid credentials return 401 Unauthorized with "Invalid credentials" message
- User profile data is returned on successful login
- Login works for all 17 user roles

**US-002: Token Refresh**
> As an authenticated user, I want my session to be automatically refreshed so that I don't have to log in repeatedly during my shift.

**Acceptance Criteria:**
- Client can submit refresh token to get new access token
- Refresh token rotation: new refresh token issued on each refresh
- Expired refresh token returns 401 Unauthorized
- Invalid refresh token returns 401 Unauthorized

**US-003: User Registration**
> As a hospital administrator, I want to register new staff members so they can access the system.

**Acceptance Criteria:**
- Admin can create accounts with email, password, name, role, and hospital ID
- Email must be unique within the hospital (multi-tenant)
- Password is hashed before storage (bcrypt, 12 rounds)
- Appropriate user role must be specified
- Account is immediately active after creation

**US-004: Profile Management**
> As a staff member, I want to view and update my profile information so that my records stay current.

**Acceptance Criteria:**
- User can retrieve their profile (name, email, role, hospital)
- User can update allowed fields (name, phone, avatar)
- User cannot change their own role or hospital ID
- Changes are reflected immediately

**US-005: Password Change**
> As a staff member, I want to change my password so that I can maintain account security.

**Acceptance Criteria:**
- User must provide current password for verification
- New password must meet minimum requirements (6+ characters)
- Password is hashed before storage
- User receives success confirmation

**US-006: Logout**
> As a staff member, I want to log out from my current device or all devices for security.

**Acceptance Criteria:**
- Single device logout invalidates current access token
- "Logout all" invalidates all sessions for the user
- Subsequent API calls with invalidated tokens return 401

### 2.2 Edge Cases

**EC-001: Concurrent Sessions**
- Multiple devices can be logged in simultaneously
- Each device has its own token pair
- "Logout all" affects all active sessions

**EC-002: Duplicate Registration**
- Attempting to register with existing email returns 409 Conflict
- Check is scoped to hospital (same email can exist in different hospitals)

**EC-003: Hospital Validation**
- Registration requires valid hospital ID
- Invalid hospital ID returns 404 Not Found

---

## 3. Acceptance Criteria

### 3.1 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | System shall authenticate users with email and password | Must |
| FR-002 | System shall issue JWT access tokens (15m expiry) | Must |
| FR-003 | System shall issue JWT refresh tokens (7d expiry) | Must |
| FR-004 | System shall support token refresh without re-authentication | Must |
| FR-005 | System shall hash passwords using bcrypt (12 rounds) | Must |
| FR-006 | System shall enforce unique email per hospital | Must |
| FR-007 | System shall support single and all-device logout | Should |
| FR-008 | System shall allow profile updates | Should |
| FR-009 | System shall support password changes | Must |

### 3.2 Non-Functional Requirements

**Security:**
- Passwords never stored in plaintext
- JWT secrets must be strong random strings (32+ characters)
- Access tokens short-lived (15 minutes) to limit exposure
- Refresh tokens longer-lived (7 days) for usability

**Performance:**
- Login response time < 500ms under normal load
- Token verification < 50ms per request

**Availability:**
- Authentication service must be highly available
- Database connection pooling for concurrent requests

---

## 4. Technical Specifications

### 4.1 Backend Layer

**API Endpoints:**

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/api/v1/auth/login` | Authenticate user | No |
| POST | `/api/v1/auth/register` | Create new user | No* |
| POST | `/api/v1/auth/refresh` | Refresh access token | No |
| POST | `/api/v1/auth/logout` | Logout current session | Yes |
| POST | `/api/v1/auth/logout-all` | Logout all sessions | Yes |
| GET | `/api/v1/auth/profile` | Get user profile | Yes |
| PUT | `/api/v1/auth/profile` | Update profile | Yes |
| POST | `/api/v1/auth/change-password` | Change password | Yes |

*Note: Registration may require admin authorization in production.

**Request/Response Examples:**

**Login Request:**
```json
POST /api/v1/auth/login
{
  "email": "doctor@hospital.com",
  "password": "securepassword123"
}
```

**Login Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid",
      "email": "doctor@hospital.com",
      "firstName": "John",
      "lastName": "Smith",
      "role": "DOCTOR",
      "hospitalId": "hospital-uuid",
      "avatar": null
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
      "expiresIn": 900
    }
  }
}
```

**Service Layer:**
- **File:** `backend/src/services/authService.ts`
- **Class:** `AuthService`
- **Methods:** `login()`, `register()`, `refreshToken()`, `logout()`, `logoutAll()`, `getProfile()`, `updateProfile()`, `changePassword()`

**JWT Payload Structure:**
```typescript
interface JwtPayload {
  userId: string;
  hospitalId: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
}
```

### 4.2 Data Models

**User Model (Prisma):**
```prisma
model User {
  id            String    @id @default(uuid())
  email         String
  password      String
  firstName     String
  lastName      String
  phone         String?
  avatar        String?
  role          UserRole
  hospitalId    String
  hospital      Hospital  @relation(fields: [hospitalId], references: [id])
  isActive      Boolean   @default(true)
  lastLogin     DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@unique([hospitalId, email])
}
```

**Session Model (for logout tracking):**
```prisma
model Session {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  token     String
  expiresAt DateTime
  createdAt DateTime @default(now())
}
```

### 4.3 Frontend Layer

**Components:**
- `frontend/src/pages/Login/index.tsx` - Login form
- `frontend/src/store/authSlice.ts` - Redux auth state

**State Management:**
```typescript
interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
```

**API Client:**
- Axios interceptor adds Bearer token to requests
- 401 response triggers token refresh
- Failed refresh redirects to login

### 4.4 Mobile Layer

**Screens:**
- `mobile/src/screens/auth/LoginScreen.tsx`

**Services:**
- `mobile/src/services/api/auth.ts` - API client
- `mobile/src/services/storage/secureStorage.ts` - Token storage

**Security:**
- Tokens stored in expo-secure-store (encrypted)
- Biometric authentication optional (see PRD-100)

---

## 5. Dependencies

### 5.1 Internal Dependencies
- Prisma ORM for database operations
- Hospital entity for multi-tenant validation
- Middleware for route protection

### 5.2 External Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| `bcryptjs` | ^2.4.3 | Password hashing |
| `jsonwebtoken` | ^9.0.0 | JWT generation/verification |
| `express` | ^4.18.2 | HTTP server framework |

---

## 6. Risks and Mitigations

### 6.1 Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| JWT secret exposure | Low | Critical | Store in environment variables, rotate periodically |
| Brute force attacks | Medium | High | Implement rate limiting (100 req/15min) |
| Token theft | Medium | High | Short access token expiry, HTTPS only |
| Session hijacking | Low | High | Secure token storage, SameSite cookies |

### 6.2 Business Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| User lockout | Low | Medium | Admin password reset capability |
| Compliance issues | Low | High | Audit logging for authentication events |

---

## 7. Testing Strategy

### 7.1 Unit Tests
- Password hashing and verification
- JWT generation and validation
- Token expiry logic

### 7.2 Integration Tests
```typescript
describe('Authentication', () => {
  it('should login with valid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@hospital.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.data.tokens.accessToken).toBeDefined();
  });

  it('should reject invalid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@hospital.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('should refresh token successfully', async () => {
    // ... test implementation
  });
});
```

### 7.3 E2E Tests
- Complete login flow from frontend
- Token refresh on API call
- Logout and session termination

---

## 8. File References

### Backend
- `backend/src/routes/authRoutes.ts` - Route definitions
- `backend/src/services/authService.ts` - Business logic
- `backend/src/middleware/auth.ts` - Authentication middleware
- `backend/src/middleware/validation.ts` - Login/register schemas
- `backend/src/config/index.ts` - JWT configuration

### Frontend
- `frontend/src/pages/Login/index.tsx` - Login page
- `frontend/src/store/authSlice.ts` - Auth state management
- `frontend/src/services/api.ts` - API client with interceptors

### Mobile
- `mobile/src/screens/auth/LoginScreen.tsx` - Login screen
- `mobile/src/store/authSlice.ts` - Auth state
- `mobile/src/services/api/auth.ts` - Auth API client
- `mobile/src/services/storage/secureStorage.ts` - Secure token storage

### Database
- `backend/prisma/schema.prisma` - User, Session models
