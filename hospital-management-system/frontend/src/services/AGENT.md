# AGENT.md - Frontend Services Directory

## Purpose

This directory contains the API client and service layer for the frontend application. The main `api.ts` file provides a centralized Axios client with authentication interceptors and organized API namespaces for all backend endpoints.

## Directory Structure

```
services/
├── api.ts              # Main API client (~1600 lines)
└── patientApi.ts       # Extended patient portal APIs (if separate)
```

## API Client Architecture

### Axios Instance Configuration
```typescript
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});
```

### Request Interceptor
Automatically adds authentication tokens to requests:
```typescript
api.interceptors.request.use((config) => {
  // Staff portal - use Redux store token
  const state = store.getState();
  const token = state.auth.accessToken;

  // Patient portal - use separate localStorage token
  if (config.url?.includes('patient-portal')) {
    const patientToken = localStorage.getItem('patientPortalToken');
    if (patientToken) {
      config.headers.Authorization = `Bearer ${patientToken}`;
    }
  } else if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});
```

### Response Interceptor
Handles 401 errors with automatic token refresh:
```typescript
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Attempt token refresh
      const refreshToken = state.auth.refreshToken;
      if (refreshToken) {
        const { data } = await api.post('/auth/refresh', { refreshToken });
        // Update tokens and retry original request
        store.dispatch(updateTokens(data.tokens));
        return api(error.config);
      }
      // Refresh failed - redirect to login
      store.dispatch(logout());
    }
    return Promise.reject(error);
  }
);
```

## API Namespaces

### Core APIs

| Namespace | Base Path | Purpose |
|-----------|-----------|---------|
| `authApi` | `/auth` | Login, register, profile, password |
| `patientApi` | `/patients` | Patient CRUD, vitals, allergies |
| `appointmentApi` | `/appointments` | Booking, scheduling, status |
| `doctorApi` | `/doctors` | Doctor profiles, schedules |
| `departmentApi` | `/departments` | Department management |

### Clinical APIs

| Namespace | Base Path | Purpose |
|-----------|-----------|---------|
| `opdApi` | `/opd` | Queue, booking ticket, check-in |
| `ipdApi` | `/ipd` | Admissions, beds, discharge |
| `emergencyApi` | `/emergency` | Triage, emergency queue |
| `laboratoryApi` | `/laboratory` | Lab orders, results, samples |
| `radiologyApi` | `/radiology` | Imaging orders, reports |
| `pharmacyApi` | `/pharmacy` | Drugs, inventory, dispensing |
| `surgeryApi` | `/surgery` | Surgical scheduling |

### AI APIs

| Namespace | Base Path | Purpose |
|-----------|-----------|---------|
| `aiApi` | `/ai` | Core AI services |
| `aiConsultationApi` | `/ai-consultation` | Consultation support |
| `advancedPharmacyAIApi` | `/advanced-pharmacy-ai` | Drug interactions |
| `symptomCheckerApi` | `/symptom-checker` | Symptom assessment |
| `medSafetyApi` | `/med-safety` | Medication safety |
| `smartOrderApi` | `/smart-orders` | Order recommendations |
| `pdfApi` | `/pdf` | Document analysis |

### Operations APIs

| Namespace | Base Path | Purpose |
|-----------|-----------|---------|
| `billingApi` | `/billing` | Invoices, payments |
| `hrApi` | `/hr` | Staff management |
| `housekeepingApi` | `/housekeeping` | Facility tasks |
| `bloodBankApi` | `/blood-bank` | Blood inventory |
| `dietaryApi` | `/dietary` | Meal planning |
| `assetApi` | `/assets` | Equipment |
| `qualityApi` | `/quality` | QA audits |
| `reportsApi` | `/reports` | Analytics |
| `telemedicineApi` | `/telemedicine` | Video sessions |
| `rbacApi` | `/rbac` | Roles, permissions |

### Patient Portal APIs

| Namespace | Base Path | Purpose |
|-----------|-----------|---------|
| `patientPortalApi` | `/patient-portal` | Patient self-service |
| `patientAuthApi` | `/patient-auth` | Patient authentication |

## Key API Methods

### authApi
```typescript
authApi = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (data) => api.post('/auth/register', data),
  refresh: (refreshToken) => api.post('/auth/refresh', { refreshToken }),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.post('/auth/change-password', data),
  logout: () => api.post('/auth/logout'),
}
```

### patientApi
```typescript
patientApi = {
  getAll: (params) => api.get('/patients', { params }),
  getById: (id) => api.get(`/patients/${id}`),
  create: (data) => api.post('/patients', data),
  update: (id, data) => api.put(`/patients/${id}`, data),
  delete: (id) => api.delete(`/patients/${id}`),
  getMedicalHistory: (id) => api.get(`/patients/${id}/medical-history`),
  addMedicalHistory: (id, data) => api.post(`/patients/${id}/medical-history`, data),
  getAllergies: (id) => api.get(`/patients/${id}/allergies`),
  addAllergy: (id, data) => api.post(`/patients/${id}/allergies`, data),
  getVitals: (id) => api.get(`/patients/${id}/vitals`),
  addVitals: (id, data) => api.post(`/patients/${id}/vitals`, data),
  getTimeline: (id) => api.get(`/patients/${id}/timeline`),
}
```

### aiApi
```typescript
aiApi = {
  health: () => api.get('/ai/health'),
  chat: (message, context) => api.post('/ai/chat', { message, context }),
  voice: (transcript) => api.post('/ai/voice', { transcript }),
  diagnose: (data) => api.post('/ai/diagnose', data, { timeout: 60000 }),
  predictRisk: (data) => api.post('/ai/predict-risk', data, { timeout: 60000 }),
  analyzeImage: (data) => api.post('/ai/analyze-image', data, { timeout: 60000 }),
  submitFeedback: (id, feedback) => api.post(`/ai/feedback/${id}`, feedback),
}
```

### opdApi
```typescript
opdApi = {
  getQueue: (params) => api.get('/opd/queue', { params }),
  getBookingTicket: (appointmentId) => api.get(`/opd/booking-ticket/${appointmentId}`),
  getPatientHistory: (patientId) => api.get(`/opd/patient-history/${patientId}`),
  checkIn: (appointmentId) => api.post(`/opd/check-in/${appointmentId}`),
  startConsultation: (appointmentId) => api.post(`/opd/start-consultation/${appointmentId}`),
  completeConsultation: (appointmentId) => api.post(`/opd/complete/${appointmentId}`),
}
```

### patientPortalApi
```typescript
patientPortalApi = {
  // Dashboard
  getSummary: () => api.get('/patient-portal/dashboard'),

  // Appointments
  getAppointments: (params) => api.get('/patient-portal/appointments', { params }),
  bookAppointment: (data) => api.post('/patient-portal/appointments', data),
  cancelAppointment: (id, reason) => api.post(`/patient-portal/appointments/${id}/cancel`, { reason }),

  // Medical Records
  getMedicalRecords: (params) => api.get('/patient-portal/records', { params }),
  getPrescriptions: (params) => api.get('/patient-portal/prescriptions', { params }),
  getLabResults: (params) => api.get('/patient-portal/lab-results', { params }),

  // Billing
  getBillingSummary: () => api.get('/patient-portal/billing/summary'),
  getBills: (params) => api.get('/patient-portal/billing', { params }),

  // Health
  getHealthInsights: () => api.get('/patient-portal/health-insights'),
  getMedicalHistory: () => api.get('/patient-portal/medical-history'),
}
```

## Usage Patterns

### Basic API Call
```typescript
import { patientApi } from '@/services/api';

// In component or hook
const patients = await patientApi.getAll({ page: 1, limit: 10, search: 'John' });
```

### With TanStack Query
```typescript
import { useQuery } from '@tanstack/react-query';
import { patientApi } from '@/services/api';

function PatientList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['patients', page, search],
    queryFn: () => patientApi.getAll({ page, search }),
  });
}
```

### With Mutation
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { patientApi } from '@/services/api';

function CreatePatient() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: patientApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries(['patients']);
      toast.success('Patient created');
    },
  });

  return (
    <button onClick={() => mutation.mutate(formData)}>
      Create Patient
    </button>
  );
}
```

### AI API with Extended Timeout
```typescript
// AI calls have 60-second timeout configured
const result = await aiApi.diagnose({
  patientId,
  symptoms,
  medicalHistory,
});
```

## Response Format

All API responses follow this structure:
```typescript
interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

## Error Handling

```typescript
try {
  const response = await api.get('/some-endpoint');
  return response.data;
} catch (error) {
  if (axios.isAxiosError(error)) {
    // Handle API error
    const message = error.response?.data?.message || 'Request failed';
    toast.error(message);
  }
  throw error;
}
```

## Dependencies

### Internal
- `@/store` - Redux store for auth tokens
- Environment variables for API URL

### External
- `axios` - HTTP client
- `react-hot-toast` - Error notifications

## Common Operations

### Adding New API Methods

1. Identify the appropriate namespace
2. Add method to the namespace object:
```typescript
const myNamespaceApi = {
  // Existing methods...

  newMethod: (params) => api.get('/my-endpoint', { params }),
  createItem: (data) => api.post('/my-endpoint', data),
};
```

3. Export if new namespace:
```typescript
export { myNamespaceApi };
```

## Related Files

- `/src/hooks/` - Hooks that use API client
- `/src/store/authSlice.ts` - Auth state for interceptor
- `/.env` - API URL configuration

## Common Issues

### Issue: 401 on every request
- Check token is being attached in interceptor
- Verify Redux store has accessToken
- Check token hasn't expired

### Issue: CORS errors
- Verify backend allows frontend origin
- Check API URL is correct
- Ensure no trailing slashes

### Issue: Patient portal requests fail
- Patient portal uses localStorage token
- Check `patientPortalToken` is set
- Verify URL includes `patient-portal`

### Issue: AI requests timeout
- AI endpoints have 60-second timeout
- Check AI service is running
- Verify AI_SERVICE_URL in backend config
