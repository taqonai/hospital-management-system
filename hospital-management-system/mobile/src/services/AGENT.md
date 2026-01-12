# AGENT.md - Mobile Services Directory

## Purpose

This directory contains all service modules for the React Native patient portal app, including API clients, offline support, biometric authentication, push notifications, and secure storage.

## Directory Structure

```
services/
├── api/
│   ├── client.ts             # Axios instance with interceptors
│   ├── auth.ts               # Patient authentication API
│   ├── patientPortal.ts      # Main patient portal API
│   └── symptomChecker.ts     # AI symptom checker API
├── offline/
│   ├── cacheManager.ts       # TTL-based cache manager
│   └── actionQueue.ts        # Offline action queue
├── biometric/
│   └── biometricService.ts   # Face ID/Touch ID/fingerprint
├── notifications/
│   └── pushNotifications.ts  # Push notification handling
└── storage/
    ├── secureStorage.ts      # Encrypted token storage
    └── cacheStorage.ts       # AsyncStorage wrapper
```

## Service Details

### API Client (`api/client.ts`)

Axios instance with authentication interceptors:

```typescript
const client = axios.create({
  baseURL: env.API_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor - adds Bearer token
client.interceptors.request.use(async (config) => {
  const token = await secureStorage.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handles 401 with refresh
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Attempt token refresh
      const newToken = await refreshToken();
      if (newToken) {
        // Retry original request
        return client(error.config);
      }
      // Refresh failed - redirect to login
      store.dispatch(logout());
    }
    return Promise.reject(error);
  }
);
```

### Authentication API (`api/auth.ts`)

```typescript
export const authApi = {
  login: (credentials) => client.post('/patient-auth/login', credentials),
  register: (data) => client.post('/patient-auth/register', data),
  sendOTP: (mobile) => client.post('/patient-auth/send-otp', { mobile }),
  verifyOTP: (mobile, otp) => client.post('/patient-auth/verify-otp', { mobile, otp }),
  sendWhatsAppOTP: (mobile) => client.post('/patient-auth/send-whatsapp-otp', { mobile }),
  refreshToken: () => client.post('/patient-auth/refresh'),
  getProfile: () => client.get('/patient-auth/profile'),
  updateProfile: (data) => client.put('/patient-auth/profile', data),
  changePassword: (data) => client.post('/patient-auth/change-password', data),
  logout: () => client.post('/patient-auth/logout'),
  canClaimAccount: (data) => client.post('/patient-auth/can-claim', data),
  claimAccount: (data) => client.post('/patient-auth/claim', data),
};
```

### Patient Portal API (`api/patientPortal.ts`)

```typescript
export const patientPortalApi = {
  // Dashboard
  getSummary: () => client.get('/patient-portal/dashboard'),

  // Appointments
  getAppointments: (params) => client.get('/patient-portal/appointments', { params }),
  getAppointmentById: (id) => client.get(`/patient-portal/appointments/${id}`),
  bookAppointment: (data) => client.post('/patient-portal/appointments', data),
  cancelAppointment: (id, reason) => client.post(`/patient-portal/appointments/${id}/cancel`, { reason }),
  rescheduleAppointment: (id, data) => client.post(`/patient-portal/appointments/${id}/reschedule`, data),
  getAvailableSlots: (doctorId, date) => client.get(`/patient-portal/doctors/${doctorId}/slots`, { params: { date } }),
  getDoctors: (params) => client.get('/patient-portal/doctors', { params }),
  getDepartments: () => client.get('/patient-portal/departments'),

  // Medical Records
  getMedicalRecords: (params) => client.get('/patient-portal/records', { params }),
  getMedicalRecordById: (id) => client.get(`/patient-portal/records/${id}`),

  // Prescriptions
  getPrescriptions: (params) => client.get('/patient-portal/prescriptions', { params }),
  getPrescriptionById: (id) => client.get(`/patient-portal/prescriptions/${id}`),
  requestRefill: (id) => client.post(`/patient-portal/prescriptions/${id}/refill`),

  // Lab Results
  getLabResults: (params) => client.get('/patient-portal/lab-results', { params }),
  getLabResultById: (id) => client.get(`/patient-portal/lab-results/${id}`),

  // Billing
  getBillingSummary: () => client.get('/patient-portal/billing/summary'),
  getBills: (params) => client.get('/patient-portal/billing', { params }),
  getBillById: (id) => client.get(`/patient-portal/billing/${id}`),

  // Health
  getHealthInsights: () => client.get('/patient-portal/health-insights'),
  getMedicalHistory: () => client.get('/patient-portal/medical-history'),
  getAllergies: () => client.get('/patient-portal/allergies'),

  // Settings
  getNotificationPreferences: () => client.get('/patient-portal/notifications/preferences'),
  updateNotificationPreferences: (data) => client.put('/patient-portal/notifications/preferences', data),
  registerPushToken: (token, platform) => client.post('/patient-portal/notifications/register', { token, platform }),

  // AI
  aiChat: (message, context) => client.post('/patient-portal/health-assistant/chat', { message, context }),
};
```

### Symptom Checker API (`api/symptomChecker.ts`)

```typescript
export const symptomCheckerApi = {
  transcribeAudio: (audioUri) => {
    const formData = new FormData();
    formData.append('audio', { uri: audioUri, type: 'audio/m4a', name: 'recording.m4a' });
    return client.post('/symptom-checker/transcribe', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  startSession: (patientInfo) => client.post('/symptom-checker/start', patientInfo),
  respond: (sessionId, responses) => client.post('/symptom-checker/respond', { sessionId, responses }),
  complete: (sessionId) => client.post('/symptom-checker/complete', { sessionId }),
  getSession: (sessionId) => client.get(`/symptom-checker/session/${sessionId}`),
  quickCheck: (symptoms, age) => client.post('/symptom-checker/quick', { symptoms, age }),
};
```

### Cache Manager (`offline/cacheManager.ts`)

TTL-based cache with stale data support:

```typescript
export const CacheTTL = {
  DASHBOARD: 5 * 60 * 1000,      // 5 minutes
  APPOINTMENTS: 15 * 60 * 1000,  // 15 minutes
  PRESCRIPTIONS: 30 * 60 * 1000, // 30 minutes
  LAB_RESULTS: 60 * 60 * 1000,   // 1 hour
  MEDICAL_HISTORY: 24 * 60 * 60 * 1000, // 24 hours
  DOCTORS: 60 * 60 * 1000,       // 1 hour
  DEPARTMENTS: 24 * 60 * 60 * 1000, // 24 hours
};

export const cacheManager = {
  set: async <T>(key: string, data: T, ttl: number) => { ... },
  get: async <T>(key: string) => { ... },           // Fails if expired
  getStale: async <T>(key: string) => { ... },      // Returns with isStale flag
  isValid: async (key: string) => boolean,
  clearAll: async () => { ... },
  clearExpired: async () => { ... },
};
```

### Action Queue (`offline/actionQueue.ts`)

Queue for offline mutations:

```typescript
export enum ActionType {
  CANCEL_APPOINTMENT = 'CANCEL_APPOINTMENT',
  RESCHEDULE_APPOINTMENT = 'RESCHEDULE_APPOINTMENT',
  REQUEST_REFILL = 'REQUEST_REFILL',
  UPDATE_PROFILE = 'UPDATE_PROFILE',
  UPDATE_MEDICAL_HISTORY = 'UPDATE_MEDICAL_HISTORY',
}

export const actionQueue = {
  enqueue: async (type: ActionType, payload: any) => { ... },
  getQueue: async () => Action[],
  processQueue: async () => { ... },  // Process when online
  remove: async (actionId: string) => { ... },
  getPendingCount: async () => number,
  hasPendingActions: async () => boolean,
};
```

### Biometric Service (`biometric/biometricService.ts`)

```typescript
export const biometricService = {
  checkAvailability: async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    return { available: compatible && enrolled, types };
  },

  authenticate: async (promptMessage: string) => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel: 'Use password',
      disableDeviceFallback: false,
    });
    return result.success;
  },

  isBiometricLoginEnabled: async () => {
    return await secureStorage.isBiometricEnabled();
  },

  enableBiometricLogin: async () => {
    await secureStorage.setBiometricEnabled(true);
  },

  getBiometricDisplayName: (type) => {
    // Returns "Face ID", "Touch ID", "Fingerprint", etc.
  },
};
```

### Secure Storage (`storage/secureStorage.ts`)

Encrypted storage using expo-secure-store:

```typescript
export const secureStorage = {
  setTokens: async (access: string, refresh: string) => {
    await SecureStore.setItemAsync('accessToken', access);
    await SecureStore.setItemAsync('refreshToken', refresh);
  },

  getAccessToken: async () => SecureStore.getItemAsync('accessToken'),
  getRefreshToken: async () => SecureStore.getItemAsync('refreshToken'),
  clearTokens: async () => {
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
  },

  setPatientUser: async (user: PatientUser) => {
    await SecureStore.setItemAsync('patientUser', JSON.stringify(user));
  },
  getPatientUser: async () => { ... },

  setBiometricEnabled: async (enabled: boolean) => { ... },
  isBiometricEnabled: async () => boolean,

  clearAll: async () => { ... }, // Logout
  isLoggedIn: async () => boolean,
};
```

### Push Notifications (`notifications/pushNotifications.ts`)

```typescript
export const pushNotifications = {
  initialize: async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status === 'granted') {
      const token = await Notifications.getExpoPushTokenAsync();
      return token.data;
    }
    return null;
  },

  scheduleLocalNotification: async (title, body, trigger) => {
    return await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger,
    });
  },

  scheduleAppointmentReminder: async (appointment) => { ... },
  scheduleMedicationReminder: async (medication) => { ... },
  cancelNotification: async (id) => { ... },
  setBadgeCount: async (count) => { ... },
};
```

## Dependencies

### Internal
- `../../store` - Redux store for auth state
- `../../config/env` - Environment configuration

### External
- `axios` - HTTP client
- `@react-native-async-storage/async-storage` - Cache storage
- `expo-secure-store` - Encrypted storage
- `expo-local-authentication` - Biometrics
- `expo-notifications` - Push notifications

## Common Operations

### Adding New API Method

```typescript
// In api/patientPortal.ts
export const patientPortalApi = {
  // ... existing methods

  newMethod: (params) => client.get('/patient-portal/new-endpoint', { params }),
  createItem: (data) => client.post('/patient-portal/new-endpoint', data),
};
```

### Using Cache with API Call

```typescript
import { useOfflineData } from '../hooks/useOfflineData';

const { data, isLoading, isFromCache } = useOfflineData(
  'myData',
  () => patientPortalApi.getData(),
  CacheTTL.APPOINTMENTS
);
```

## Related Files

- `/src/hooks/` - Hooks using these services
- `/src/store/authSlice.ts` - Auth state management
- `/src/config/env.ts` - API URL configuration

## Common Issues

### Issue: Token not attached to requests
- Check secureStorage has token
- Verify interceptor is running
- Debug with network inspector

### Issue: Offline data not persisting
- Verify AsyncStorage is working
- Check cache key is consistent
- Ensure TTL is appropriate

### Issue: Biometric not available
- Physical device required
- Check device has biometric enrolled
- Verify expo-local-authentication version
