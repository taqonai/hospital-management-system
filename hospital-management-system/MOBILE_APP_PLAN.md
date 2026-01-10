# Mobile App Implementation Plan: React Native + Expo Patient Portal

## Overview

Build a production-ready React Native + Expo mobile app for the HMS Patient Portal, reusing the existing backend APIs with no backend changes required.

---

## Recommended Approach: React Native + Expo (Managed Workflow)

**Why this approach:**
- Same React/TypeScript skills as web frontend
- Single codebase for iOS and Android
- Expo simplifies push notifications, secure storage, biometrics
- EAS Build for app store deployment
- Backend APIs are already mobile-ready (RESTful, consistent responses, pagination)

---

## Project Structure

```
hospital-management-system/mobile/
├── app.json                    # Expo config
├── eas.json                    # EAS Build config
├── src/
│   ├── screens/                # Screen components
│   │   ├── auth/               # Login, Register, OTP
│   │   ├── dashboard/          # Main dashboard
│   │   ├── appointments/       # Book, view, manage
│   │   ├── health/             # Insights, AI chat, symptom checker
│   │   ├── records/            # Medical records, prescriptions, labs
│   │   ├── billing/            # Bills, payments
│   │   └── settings/           # Profile, notifications
│   ├── components/             # Reusable UI components
│   ├── services/
│   │   ├── api/                # API client (adapt from web)
│   │   ├── storage/            # Secure token storage
│   │   ├── notifications/      # Push notifications
│   │   └── offline/            # Cache + queue
│   ├── store/                  # Redux (same patterns as web)
│   ├── hooks/                  # Custom hooks
│   ├── types/                  # Copy from frontend/src/types/
│   ├── navigation/             # React Navigation
│   └── theme/                  # Colors, typography
```

---

## Key Dependencies

| Category | Package | Purpose |
|----------|---------|---------|
| Navigation | `@react-navigation/native`, `@react-navigation/bottom-tabs` | Tab + stack navigation |
| State | `@reduxjs/toolkit`, `react-redux`, `@tanstack/react-query` | Match web patterns |
| API | `axios` | HTTP client |
| Storage | `expo-secure-store`, `@react-native-async-storage/async-storage` | Tokens + cache |
| Notifications | `expo-notifications` | Push notifications |
| Biometrics | `expo-local-authentication` | Face ID / fingerprint |
| Offline | `@react-native-community/netinfo` | Network status |
| Forms | `react-hook-form`, `zod` | Match web validation |

---

## Critical Files to Reference/Adapt

| Source File | Purpose |
|-------------|---------|
| `frontend/src/services/api.ts` | API client with interceptors, token refresh logic |
| `frontend/src/types/index.ts` | TypeScript types (Patient, Appointment, Vital, etc.) |
| `frontend/src/pages/PatientPortal/Login.tsx` | Auth flows (email, SMS OTP, WhatsApp OTP) |
| `frontend/src/pages/PatientPortal/Dashboard.tsx` | Dashboard data fetching patterns |

---

## Backend APIs to Use (No Changes Required)

### Authentication (`/api/v1/patient-auth/`)
- `POST /login` - Email/password
- `POST /send-otp` - SMS OTP
- `POST /verify-otp` - Verify OTP
- `POST /send-whatsapp-otp` - WhatsApp OTP
- `POST /refresh-token` - Token refresh
- `GET/PUT /profile` - Patient profile

### Patient Portal (`/api/v1/patient-portal/`)
- `GET /summary` - Dashboard
- `GET/POST /appointments` - Appointments
- `GET /records` - Medical records
- `GET /prescriptions` - Prescriptions + refill
- `GET /labs` - Lab results
- `GET /bills` - Billing
- `GET /health-insights` - AI health analysis
- `POST /ai-chat` - Health assistant
- `GET/PUT /medical-history` - Medical history
- `GET/POST/PUT/DELETE /allergies` - Allergies
- `GET/PUT /settings/*` - Notification preferences

### Symptom Checker (`/api/v1/ai/symptom-checker/`)
- `POST /start` - Start session
- `POST /respond` - Answer questions
- `POST /complete` - Get triage result

---

## Implementation Phases

### Phase 1: Project Setup & Authentication
- Initialize Expo project with TypeScript
- Set up navigation (Auth + Main stacks)
- Implement secure token storage (`expo-secure-store`)
- Port authentication flows from `Login.tsx`:
  - Email/password login
  - SMS OTP (country code picker)
  - WhatsApp OTP
  - Registration
- Add biometric login option (`expo-local-authentication`)

### Phase 2: Dashboard & Core Navigation
- Tab navigator (Home, Appointments, Health, Settings)
- Dashboard screen with:
  - Health summary cards
  - Upcoming appointments
  - Quick actions
- Pull-to-refresh
- Offline cache for dashboard data

### Phase 3: Appointments
- Appointment list (upcoming, past)
- Book appointment flow:
  - Select department/doctor
  - Pick date/time slot
  - Confirm booking
- Cancel/reschedule
- Integration with symptom checker for AI-guided booking

### Phase 4: Health Data
- Medical records list with PDF viewing
- Prescriptions with refill request
- Lab results with abnormal value highlighting
- Medical history management
- Allergy management

### Phase 5: AI Features
- Symptom checker (interactive Q&A)
- Health insights (vitals trends, AI analysis)
- Health assistant chat

### Phase 6: Billing & Settings
- Bill list and payment history
- Profile management
- Notification preferences
- Change password

### Phase 7: Offline & Notifications
- Limited offline support:
  - Cache: Dashboard, appointments, prescriptions, lab results
  - Queue: Appointment cancellation, refill requests
- Push notifications:
  - Appointment reminders
  - Lab results ready
  - Prescription reminders

### Phase 8: Production & App Stores
- App icons and splash screens
- HIPAA compliance review
- App Store / Play Store submission

---

## Secure Storage Implementation

```typescript
// src/services/storage/secureStorage.ts
import * as SecureStore from 'expo-secure-store';

export const secureStorage = {
  async setTokens(accessToken: string, refreshToken: string) {
    await SecureStore.setItemAsync('patientPortalToken', accessToken);
    await SecureStore.setItemAsync('patientRefreshToken', refreshToken);
  },
  async getAccessToken() {
    return SecureStore.getItemAsync('patientPortalToken');
  },
  async clearAll() {
    await SecureStore.deleteItemAsync('patientPortalToken');
    await SecureStore.deleteItemAsync('patientRefreshToken');
  }
};
```

---

## Offline Strategy

| Data | Cache TTL | Queue Action |
|------|-----------|--------------|
| Dashboard | 5 min | - |
| Appointments | 15 min | Cancel, Reschedule |
| Prescriptions | 30 min | Refill request |
| Lab Results | 1 hour | - |
| Medical History | 24 hours | - |

---

## HIPAA Compliance Considerations

1. **Secure Storage**: Use `expo-secure-store` (iOS Keychain / Android Keystore)
2. **Auto-Logout**: 15-minute inactivity timeout
3. **Biometric Lock**: Require Face ID/fingerprint on app resume
4. **Push Notifications**: Generic content only (no PHI)
5. **SSL/TLS**: Enforce HTTPS (already in backend)
6. **Screen Capture**: Disable in production (`android:windowSecure`)

---

## Verification Plan

1. **Unit Tests**: Jest for services, hooks, utilities
2. **Component Tests**: React Native Testing Library
3. **E2E Tests**: Detox for critical flows (login, booking)
4. **Manual Testing**:
   - Test all auth methods (email, SMS, WhatsApp)
   - Verify token refresh works after 15 minutes
   - Test offline mode (airplane mode)
   - Verify push notifications arrive
   - Test on both iOS and Android physical devices
5. **App Store Review**: Submit to TestFlight and Google Play Internal Testing

---

## Files to Create

```
hospital-management-system/mobile/
├── app.json
├── eas.json
├── package.json
├── tsconfig.json
├── babel.config.js
├── App.tsx
├── src/
│   ├── navigation/
│   │   ├── RootNavigator.tsx
│   │   ├── AuthNavigator.tsx
│   │   ├── MainNavigator.tsx
│   │   └── types.ts
│   ├── services/
│   │   ├── api/client.ts
│   │   ├── storage/secureStorage.ts
│   │   ├── offline/cacheManager.ts
│   │   └── notifications/push.ts
│   ├── screens/auth/
│   │   ├── LoginScreen.tsx
│   │   ├── RegisterScreen.tsx
│   │   └── OTPScreen.tsx
│   ├── screens/dashboard/
│   │   └── DashboardScreen.tsx
│   ├── screens/appointments/
│   │   ├── AppointmentsScreen.tsx
│   │   └── BookAppointmentScreen.tsx
│   ├── screens/health/
│   │   ├── HealthInsightsScreen.tsx
│   │   ├── SymptomCheckerScreen.tsx
│   │   └── HealthAssistantScreen.tsx
│   ├── screens/records/
│   │   ├── MedicalRecordsScreen.tsx
│   │   ├── PrescriptionsScreen.tsx
│   │   └── LabResultsScreen.tsx
│   ├── screens/billing/
│   │   └── BillingScreen.tsx
│   ├── screens/settings/
│   │   ├── SettingsScreen.tsx
│   │   └── ProfileScreen.tsx
│   ├── store/
│   │   ├── index.ts
│   │   └── authSlice.ts
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   └── useNetworkStatus.ts
│   ├── types/index.ts (copy from frontend)
│   └── theme/index.ts
```

---

## Summary

This plan leverages your existing backend APIs (no changes needed) and uses React Native + Expo for a single codebase serving both iOS and Android. The implementation follows the same patterns as your web frontend for consistency, with mobile-specific additions for secure storage, biometrics, push notifications, and offline support.
