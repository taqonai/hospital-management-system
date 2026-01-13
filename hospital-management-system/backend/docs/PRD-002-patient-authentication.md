# Patient Authentication - Product Requirements Document

## Document Info
- **Version**: 1.0
- **Last Updated**: 2026-01-12
- **Status**: Current Implementation
- **Module**: Patient Portal Authentication

---

## 1. Overview

### 1.1 Purpose
The Patient Authentication system provides secure authentication for patients accessing the patient portal via web or mobile applications. It uses a separate authentication flow from staff authentication, supporting mobile number-based OTP verification in addition to email/password login.

### 1.2 Scope
This PRD covers:
- Patient account registration and claiming
- Email/password authentication
- OTP-based authentication (SMS and WhatsApp)
- Patient-specific JWT tokens (type: 'patient')
- Mobile app biometric integration support
- Secure token storage patterns

### 1.3 Background
Patients need a simple, secure way to access their medical records, appointments, and health information. The system supports account claiming (linking existing patient records to login credentials) and provides multiple authentication methods to accommodate varying patient preferences and technology access.

---

## 2. User Stories

### 2.1 Primary User Stories

**US-001: Patient Registration**
> As a new patient, I want to create an account so that I can access my health information online.

**Acceptance Criteria:**
- Patient can register with email, mobile number, and password
- System validates mobile number format
- Account is linked to existing patient record if found
- Welcome notification sent via preferred channel

**US-002: Account Claiming**
> As an existing patient with medical records, I want to claim my account so that I can view my history online.

**Acceptance Criteria:**
- Patient can verify identity using MRN + date of birth
- Successful verification links patient record to new credentials
- Existing patient data becomes accessible immediately

**US-003: Email/Password Login**
> As a registered patient, I want to log in with my email and password so that I can access my portal.

**Acceptance Criteria:**
- Valid credentials return patient-type JWT tokens
- Login response includes patient profile data
- Failed login returns generic "Invalid credentials" message

**US-004: OTP Login**
> As a patient, I want to log in using my mobile number and OTP so that I can access my account without remembering a password.

**Acceptance Criteria:**
- Patient requests OTP to registered mobile number
- OTP valid for 10 minutes
- OTP can be sent via SMS or WhatsApp
- 6-digit numeric OTP generated
- 3 incorrect attempts lock OTP for 15 minutes

**US-005: Mobile Biometric Login**
> As a mobile app user, I want to use Face ID or fingerprint to log in so that access is quick and secure.

**Acceptance Criteria:**
- Biometric can be enabled after initial login
- Biometric authentication issues new tokens
- Biometric data stored on device only
- Fallback to password always available

### 2.2 Edge Cases

**EC-001: Duplicate Mobile Numbers**
- Mobile number must be unique per hospital
- Clear error message if number already registered

**EC-002: Expired OTP**
- User informed OTP has expired
- Can request new OTP immediately

**EC-003: Account Lockout**
- 5 failed password attempts = 30-minute lockout
- 3 failed OTP attempts = 15-minute lockout for that OTP
- Admin can unlock accounts

---

## 3. Acceptance Criteria

### 3.1 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | System shall authenticate patients with email/password | Must |
| FR-002 | System shall support OTP authentication via SMS | Must |
| FR-003 | System shall support OTP authentication via WhatsApp | Should |
| FR-004 | System shall issue patient-specific JWT tokens | Must |
| FR-005 | System shall support account claiming | Should |
| FR-006 | System shall enforce mobile number uniqueness per hospital | Must |
| FR-007 | System shall rate limit OTP requests | Must |
| FR-008 | Mobile app shall support biometric authentication | Should |

### 3.2 Non-Functional Requirements

**Security:**
- OTP transmitted via secure channels only (SMS/WhatsApp)
- OTP expires after 10 minutes
- Patient tokens include `type: 'patient'` for differentiation
- Tokens stored in secure storage on mobile

**Performance:**
- OTP delivery < 30 seconds
- Login response < 500ms

**Compliance:**
- HIPAA-compliant patient data handling
- Audit logging for authentication events

---

## 4. Technical Specifications

### 4.1 Backend Layer

**API Endpoints:**

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/api/v1/patient-auth/register` | Register new patient account | No |
| POST | `/api/v1/patient-auth/login` | Email/password login | No |
| POST | `/api/v1/patient-auth/send-otp` | Request SMS OTP | No |
| POST | `/api/v1/patient-auth/send-whatsapp-otp` | Request WhatsApp OTP | No |
| POST | `/api/v1/patient-auth/verify-otp` | Verify OTP and login | No |
| POST | `/api/v1/patient-auth/refresh` | Refresh access token | No |
| GET | `/api/v1/patient-auth/profile` | Get patient profile | Patient |
| PUT | `/api/v1/patient-auth/profile` | Update profile | Patient |
| POST | `/api/v1/patient-auth/change-password` | Change password | Patient |
| POST | `/api/v1/patient-auth/can-claim` | Check if account can be claimed | No |
| POST | `/api/v1/patient-auth/claim` | Claim existing patient record | No |

**Patient JWT Payload:**
```typescript
interface PatientJwtPayload {
  patientId: string;
  hospitalId: string;
  email: string;
  mobile: string;
  type: 'patient';  // Distinguishes from staff tokens
}
```

**OTP Request:**
```json
POST /api/v1/patient-auth/send-otp
{
  "mobile": "+1234567890",
  "hospitalId": "hospital-uuid"
}
```

**OTP Verification:**
```json
POST /api/v1/patient-auth/verify-otp
{
  "mobile": "+1234567890",
  "otp": "123456",
  "hospitalId": "hospital-uuid"
}
```

**Service Layer:**
- **File:** `backend/src/services/patientAuthService.ts`
- **Class:** `PatientAuthService`
- **Methods:** `register()`, `login()`, `sendOtp()`, `sendWhatsAppOtp()`, `verifyOtp()`, `canClaimAccount()`, `claimAccount()`, `refreshToken()`

### 4.2 Data Models

**Patient Credentials Extension:**
```prisma
model Patient {
  // ... existing patient fields

  // Authentication fields
  email           String?
  mobile          String?
  passwordHash    String?
  isPortalActive  Boolean   @default(false)
  otpSecret       String?
  otpExpiry       DateTime?
  failedAttempts  Int       @default(0)
  lockedUntil     DateTime?

  @@unique([hospitalId, email])
  @@unique([hospitalId, mobile])
}
```

### 4.3 Frontend Layer (Patient Portal)

**Pages:**
- `frontend/src/pages/PatientPortal/Login/index.tsx` - Login form
- `frontend/src/pages/PatientPortal/Register/index.tsx` - Registration form

**State Management:**
```typescript
// Separate patient token storage
localStorage.setItem('patientPortalToken', accessToken);
localStorage.setItem('patientPortalRefreshToken', refreshToken);
```

**API Client:**
- Separate token handling for patient portal routes
- Checks for `patientPortalToken` on patient portal requests

### 4.4 Mobile Layer

**Screens:**
- `mobile/src/screens/auth/LoginScreen.tsx` - Login with email/password or OTP
- `mobile/src/screens/auth/RegisterScreen.tsx` - Patient registration
- `mobile/src/screens/auth/OTPVerificationScreen.tsx` - OTP entry

**Services:**
```typescript
// mobile/src/services/api/auth.ts
export const patientAuthApi = {
  login: (credentials) => client.post('/patient-auth/login', credentials),
  sendOTP: (mobile) => client.post('/patient-auth/send-otp', { mobile }),
  verifyOTP: (mobile, otp) => client.post('/patient-auth/verify-otp', { mobile, otp }),
  // ...
};
```

**Biometric Service:**
```typescript
// mobile/src/services/biometric/biometricService.ts
export const biometricService = {
  checkAvailability: () => Promise<BiometricStatus>,
  authenticate: (promptMessage: string) => Promise<boolean>,
  enableBiometricLogin: () => Promise<void>,
  performBiometricLogin: () => Promise<AuthResponse>,
};
```

**Secure Storage:**
```typescript
// mobile/src/services/storage/secureStorage.ts
// Tokens stored in expo-secure-store (encrypted)
export const secureStorage = {
  setTokens: (access, refresh) => Promise<void>,
  getAccessToken: () => Promise<string | null>,
  clearTokens: () => Promise<void>,
};
```

---

## 5. Dependencies

### 5.1 Internal Dependencies
- Patient entity and portal activation
- Notification service (SMS/WhatsApp)
- Twilio integration

### 5.2 External Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `twilio` | ^4.x | SMS and WhatsApp OTP delivery |
| `expo-local-authentication` | ~14.x | Mobile biometric auth |
| `expo-secure-store` | ~13.x | Secure token storage |

---

## 6. Risks and Mitigations

### 6.1 Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| OTP interception | Low | High | Use secure delivery channels, short expiry |
| SIM swap attacks | Low | High | Encourage email backup, biometric enrollment |
| Biometric spoofing | Low | Medium | Use platform-provided security APIs |

### 6.2 Business Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| SMS delivery failure | Medium | Medium | WhatsApp fallback, retry mechanism |
| Patient frustration with OTP | Medium | Low | Clear instructions, support contact |

---

## 7. Testing Strategy

### 7.1 Unit Tests
- OTP generation and validation
- Token type verification ('patient')
- Account claiming logic

### 7.2 Integration Tests
```typescript
describe('Patient Authentication', () => {
  it('should send OTP successfully', async () => {
    const res = await request(app)
      .post('/api/v1/patient-auth/send-otp')
      .send({ mobile: '+1234567890', hospitalId: 'test-hospital' });
    expect(res.status).toBe(200);
  });

  it('should verify OTP and return patient tokens', async () => {
    const res = await request(app)
      .post('/api/v1/patient-auth/verify-otp')
      .send({ mobile: '+1234567890', otp: '123456', hospitalId: 'test-hospital' });
    expect(res.status).toBe(200);
    expect(res.body.data.tokens.accessToken).toBeDefined();
  });

  it('should reject invalid OTP', async () => {
    const res = await request(app)
      .post('/api/v1/patient-auth/verify-otp')
      .send({ mobile: '+1234567890', otp: '000000', hospitalId: 'test-hospital' });
    expect(res.status).toBe(401);
  });
});
```

### 7.3 E2E Tests
- Complete OTP flow on mobile
- Biometric enrollment and authentication
- Account claiming process

---

## 8. File References

### Backend
- `backend/src/routes/patientAuthRoutes.ts` - Route definitions
- `backend/src/services/patientAuthService.ts` - Business logic
- `backend/src/middleware/patientAuth.ts` - Patient auth middleware
- `backend/src/services/smsService.ts` - SMS delivery
- `backend/src/services/whatsappService.ts` - WhatsApp delivery

### Frontend
- `frontend/src/pages/PatientPortal/Login/index.tsx` - Login page
- `frontend/src/services/api.ts` - Patient portal API client

### Mobile
- `mobile/src/screens/auth/LoginScreen.tsx` - Login screen
- `mobile/src/screens/auth/OTPVerificationScreen.tsx` - OTP screen
- `mobile/src/services/api/auth.ts` - Auth API
- `mobile/src/services/biometric/biometricService.ts` - Biometrics
- `mobile/src/services/storage/secureStorage.ts` - Secure storage
- `mobile/src/store/authSlice.ts` - Auth state with biometric support

### Database
- `backend/prisma/schema.prisma` - Patient model with auth fields
