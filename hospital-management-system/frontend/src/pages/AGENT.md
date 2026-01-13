# AGENT.md - Frontend Pages Directory

## Purpose

This directory contains all page components for the Hospital Management System web application. Pages are React components that correspond to routes defined in `App.tsx`. Each page represents a distinct view or feature module.

## Directory Structure

```
pages/
├── Home/                      # Public landing page
├── Login/                     # Staff authentication
├── Dashboard/                 # Staff dashboard with stats
├── Patients/                  # Patient list and management
├── PatientDetail/             # Single patient profile
├── PatientForm/               # Create/edit patient
├── Appointments/              # Appointment list
├── AppointmentForm/           # Create/edit appointment
├── Doctors/                   # Doctor directory
├── DoctorForm/                # Create/edit doctor
├── Departments/               # Department management
│   └── DepartmentForm.tsx
├── OPD/                       # Outpatient department queue
├── Consultation/              # Doctor consultation view
├── IPD/                       # Inpatient department
├── Emergency/                 # Emergency department
├── Laboratory/                # Lab orders and results
├── Radiology/                 # Imaging orders
├── Pharmacy/                  # Drug dispensing
├── Surgery/                   # Surgical scheduling
├── Billing/                   # Invoicing and payments
├── HR/                        # Human resources
├── Housekeeping/              # Facility management
├── Dietary/                   # Meal planning
├── BloodBank/                 # Blood inventory
├── Reports/                   # Analytics dashboards
├── Telemedicine/              # Video consultations
├── Queue/                     # Queue management
│   ├── DisplayBoard.tsx       # TV display for queue
│   └── PatientStatus.tsx      # Patient queue lookup
├── Kiosk/                     # Self check-in kiosk
├── Assets/                    # Equipment management
├── Quality/                   # QA and compliance
├── RBAC/                      # Role-based access control
├── AIAssistant/               # Conversational AI
├── DiagnosticAssistant/       # AI diagnosis suggestions
├── MedicalImaging/            # AI image analysis
├── DrugInteractions/          # Drug safety checker
├── ClinicalNotes/             # AI note generation
├── PatientRisk/               # Risk prediction
├── RiskAnalytics/             # Population analytics
├── AIScribe/                  # Voice transcription
├── EarlyWarning/              # NEWS2 scoring
├── MedicationSafety/          # 5 Rights checking
├── SmartOrders/               # AI order recommendations
├── PDFAnalysis/               # Document analysis
├── SymptomChecker/            # Public symptom assessment
└── PatientPortal/             # Patient self-service portal
    ├── Login.tsx
    ├── Dashboard.tsx
    ├── Appointments.tsx
    ├── MedicalRecords.tsx
    ├── Prescriptions.tsx
    ├── LabResults.tsx
    ├── Billing.tsx
    ├── Settings.tsx
    ├── SymptomChecker.tsx
    ├── HealthAssistant.tsx
    ├── HealthInsights.tsx
    ├── MedicalHistory.tsx
    ├── HealthSync.tsx
    ├── FitnessTracker.tsx
    ├── NutritionPlan.tsx
    └── WellnessHub.tsx
```

## Route Categories

### Public Routes (No Auth)
| Path | Component | Description |
|------|-----------|-------------|
| `/` | Home | Landing page |
| `/login` | Login | Staff login |
| `/kiosk` | Kiosk | Self check-in |
| `/queue/display` | QueueDisplayBoard | TV queue display |
| `/queue/status` | PatientQueueStatus | Queue lookup |
| `/symptom-checker` | SymptomChecker | Public symptom tool |
| `/patient-portal/login` | PatientPortalLogin | Patient login |

### Staff Routes (Authenticated)
| Path | Component | Roles |
|------|-----------|-------|
| `/dashboard` | Dashboard | All staff |
| `/patients` | Patients | Clinical + Admin |
| `/appointments` | Appointments | All staff |
| `/doctors` | Doctors | Admin |
| `/departments` | Departments | Admin |
| `/opd` | OPD | Receptionist, Nurse, Doctor |
| `/consultation/:appointmentId` | Consultation | Doctor |
| `/ipd` | IPD | Clinical staff |
| `/emergency` | Emergency | Clinical staff |
| `/laboratory` | Laboratory | Lab technician, Doctor |
| `/radiology` | Radiology | Radiologist, Doctor |
| `/pharmacy` | Pharmacy | Pharmacist |
| `/surgery` | Surgery | Surgeon, Nurse |
| `/billing` | Billing | Accountant, Admin |
| `/hr` | HR | HR Manager, Admin |
| `/rbac` | RBAC | Admin only |
| `/ai-assistant` | AIAssistant | Doctor, Nurse, Admin |

### Patient Portal Routes (Patient Auth)
| Path | Component |
|------|-----------|
| `/patient-portal` | PatientPortalDashboard |
| `/patient-portal/appointments` | PatientPortalAppointments |
| `/patient-portal/records` | PatientPortalMedicalRecords |
| `/patient-portal/prescriptions` | PatientPortalPrescriptions |
| `/patient-portal/labs` | PatientPortalLabResults |
| `/patient-portal/billing` | PatientPortalBilling |
| `/patient-portal/settings` | PatientPortalSettings |
| `/patient-portal/symptom-checker` | PatientPortalSymptomChecker |
| `/patient-portal/health-assistant` | PatientPortalHealthAssistant |
| `/patient-portal/health-insights` | PatientPortalHealthInsights |

## Key Patterns

### Page Structure
```typescript
// Standard page component
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { someApi } from '@/services/api';

export default function MyPage() {
  const navigate = useNavigate();

  // Data fetching with TanStack Query
  const { data, isLoading, error } = useQuery({
    queryKey: ['myData'],
    queryFn: () => someApi.getData(),
  });

  // Mutations
  const mutation = useMutation({
    mutationFn: someApi.createItem,
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries(['myData']);
    },
  });

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Page Title</h1>
      {/* Page content */}
    </div>
  );
}
```

### Protected Route Pattern
```typescript
// In App.tsx
<ProtectedRoute allowedRoles={['DOCTOR', 'NURSE']}>
  <MyPage />
</ProtectedRoute>
```

### Layout Wrapping
- **MainLayout**: Staff dashboard with sidebar navigation
- **AuthLayout**: Login pages with minimal chrome
- **PatientPortalLayout**: Patient portal with patient-specific nav

## Dependencies

### Internal
- `@/services/api` - API client
- `@/store` - Redux store and hooks
- `@/components/*` - Reusable components
- `@/hooks/*` - Custom hooks

### External
- `react-router-dom` - Routing
- `@tanstack/react-query` - Data fetching
- `react-redux` - State management
- `react-hot-toast` - Notifications

## Common Operations

### Adding a New Page

1. **Create page directory and index.tsx**:
```bash
mkdir frontend/src/pages/MyNewPage
touch frontend/src/pages/MyNewPage/index.tsx
```

2. **Implement page component**:
```typescript
export default function MyNewPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">My New Page</h1>
    </div>
  );
}
```

3. **Add route in App.tsx**:
```typescript
import MyNewPage from './pages/MyNewPage';

// In Routes
<Route path="/my-new-page" element={<MyNewPage />} />
```

4. **Add navigation link in MainLayout.tsx** (if needed)

### Adding Protected Route

```typescript
<Route
  path="/admin-only"
  element={
    <ProtectedRoute allowedRoles={['HOSPITAL_ADMIN', 'SUPER_ADMIN']}>
      <AdminPage />
    </ProtectedRoute>
  }
/>
```

## Related Files

- `/src/App.tsx` - Route definitions
- `/src/components/layout/` - Layout components
- `/src/services/api.ts` - API client
- `/src/store/` - Redux state
- `/src/hooks/` - Custom hooks

## Testing

Pages are tested with React Testing Library:
```bash
npm test -- pages/
```

Test scenarios:
- Component renders without crashing
- Data fetching and display
- User interactions
- Route navigation
- Protected route enforcement

## Common Issues and Solutions

### Issue: Page not rendering
- Check route is defined in App.tsx
- Verify import path is correct
- Check for JavaScript errors in console

### Issue: Data not loading
- Verify API endpoint is correct
- Check authentication token is present
- Inspect network tab for errors

### Issue: Navigation not working
- Use `useNavigate()` hook from react-router-dom
- Ensure Link component uses correct `to` prop
- Check for nested Router issues

### Issue: Auth redirect loop
- Verify isAuthenticated state
- Check ProtectedRoute logic
- Clear localStorage and re-login
