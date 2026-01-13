# AGENT.md - Frontend Components Directory

## Purpose

This directory contains reusable React components organized by feature domain. Components range from basic UI elements to complex feature-specific components with embedded business logic.

## Directory Structure

```
components/
├── layout/                    # Page layouts and navigation
│   ├── MainLayout.tsx         # Staff dashboard layout with sidebar
│   ├── AuthLayout.tsx         # Login page layout
│   └── PatientPortalLayout.tsx # Patient portal layout
├── common/                    # Shared basic components
│   └── LoadingSpinner.tsx
├── ui/                        # UI primitives
│   ├── ThemeToggle.tsx        # Dark/light mode toggle
│   ├── GlassCard.tsx          # Glassmorphic card
│   └── AnimatedBackground.tsx
├── ai/                        # AI-powered components
│   ├── DiagnosticAssistant.tsx
│   ├── SymptomCheckerChat.tsx
│   ├── SymptomCheckerChatbot.tsx
│   ├── MedicalImagingAI.tsx
│   ├── AIScribeNotes.tsx
│   ├── AIScribeRecorder.tsx
│   ├── PatientRiskPrediction.tsx
│   ├── ClinicalNotesAI.tsx
│   ├── DrugInteractionChecker.tsx
│   ├── PredictiveRiskAnalytics.tsx
│   ├── PatientAIInsights.tsx
│   ├── AIInsightsWidget.tsx
│   ├── AIInsightsPanel.tsx
│   ├── AIBookingAssistant.tsx
│   ├── AICommandCenter/
│   └── AICreationAssistant/
├── booking/                   # Unified booking workflow
│   ├── BookingTicket.tsx      # Main unified view
│   ├── BookingStatusTimeline.tsx
│   ├── VitalsSummaryCard.tsx
│   └── LabOrdersCard.tsx
├── nursing/                   # Nursing workflow
│   ├── EWSCalculator.tsx      # NEWS2 scoring
│   ├── EWSAlertCard.tsx       # High-risk alerts
│   ├── VitalsTrendChart.tsx
│   ├── MedSchedule.tsx
│   ├── MedAdminRecord.tsx
│   ├── MedVerification.tsx    # 5 Rights
│   └── BarcodeScanner.tsx
├── ews/                       # Early Warning System
│   ├── PatientCard.tsx
│   ├── VitalsForm.tsx
│   └── AlertPanel.tsx
├── consultation/              # Doctor consultation
│   └── PrescriptionSection.tsx
├── laboratory/                # Lab workflow
│   ├── SampleTracker.tsx
│   ├── SampleCollection.tsx
│   ├── BarcodeLabel.tsx
│   └── SampleStatusBadge.tsx
├── pharmacy/                  # Pharmacy features
│   ├── PolypharmacyRisk.tsx
│   ├── IVCompatibility.tsx
│   ├── TDMMonitoring.tsx
│   └── CostAlternatives.tsx
├── dietary/                   # Dietary features
│   ├── MealOrderTracker.tsx
│   └── AINutritionAssistant.tsx
├── orders/                    # Smart Orders
│   ├── OrderSetRecommendation.tsx
│   ├── OrderCustomizer.tsx
│   └── OrderBundleCard.tsx
├── rbac/                      # Role-based access control
│   ├── RoleCard.tsx
│   ├── PermissionGrid.tsx
│   ├── UserRoleManager.tsx
│   ├── RoleFormModal.tsx
│   └── AuditLogTable.tsx
├── telemedicine/              # Video consultation
│   ├── SessionRecording.tsx
│   ├── RecordingPlayer.tsx
│   └── RecordingHistory.tsx
└── assets/                    # Asset management
    ├── AIAssetAnalytics.tsx
    └── MaintenanceSchedule.tsx
```

## Component Categories

### Layout Components
Core layout components that wrap page content:

| Component | Purpose |
|-----------|---------|
| `MainLayout` | Staff dashboard with sidebar navigation (40+ nav items, role-based) |
| `AuthLayout` | Minimal layout for authentication pages |
| `PatientPortalLayout` | Patient portal with patient-specific navigation |

### AI Components
Components integrating with AI services:

| Component | Purpose | API Integration |
|-----------|---------|-----------------|
| `DiagnosticAssistant` | ICD-10 suggestions | `aiApi.diagnose()` |
| `SymptomCheckerChat` | Interactive symptom assessment | `symptomCheckerApi` |
| `MedicalImagingAI` | X-ray/CT/MRI analysis | `aiApi.analyzeImage()` |
| `AIScribeRecorder` | Voice recording | `useAudioRecorder` hook |
| `AIScribeNotes` | Generated SOAP notes | `aiApi.generateNotes()` |
| `PatientRiskPrediction` | Readmission risk | `aiApi.predictRisk()` |
| `DrugInteractionChecker` | Medication safety | `pharmacyApi.checkInteractions()` |

### Booking Workflow Components
Unified booking ticket system:

| Component | Purpose |
|-----------|---------|
| `BookingTicket` | Main unified view (patient, vitals, consultation, labs) |
| `BookingStatusTimeline` | Visual progress (Scheduled → Checked-in → Vitals → Complete) |
| `VitalsSummaryCard` | Vitals with abnormal value highlighting |
| `LabOrdersCard` | Lab orders with status badges and critical flags |

### Clinical Components
Components for clinical workflows:

| Component | Purpose |
|-----------|---------|
| `EWSCalculator` | NEWS2 score calculation |
| `EWSAlertCard` | Display high-risk patient alerts |
| `VitalsTrendChart` | Vitals history visualization |
| `MedVerification` | 5 Rights medication checking |
| `BarcodeScanner` | Medication barcode scanning |
| `SampleTracker` | Lab sample status tracking |

## Key Patterns

### Component Structure
```typescript
import { useState, useEffect } from 'react';

interface MyComponentProps {
  data: SomeData;
  onAction?: (id: string) => void;
}

export default function MyComponent({ data, onAction }: MyComponentProps) {
  const [state, setState] = useState(initialState);

  // Event handlers
  const handleClick = () => {
    onAction?.(data.id);
  };

  return (
    <div className="rounded-lg border p-4">
      {/* Component content */}
    </div>
  );
}
```

### Component with Data Fetching
```typescript
import { useQuery } from '@tanstack/react-query';
import { someApi } from '@/services/api';

export default function DataComponent({ id }: { id: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['myData', id],
    queryFn: () => someApi.getById(id),
  });

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage />;

  return <div>{/* Render data */}</div>;
}
```

### Component with Real-time Polling
```typescript
import { useQuery } from '@tanstack/react-query';

export default function PollingComponent() {
  const { data } = useQuery({
    queryKey: ['liveData'],
    queryFn: fetchLiveData,
    refetchInterval: 15000, // Poll every 15 seconds
  });

  return <div>{/* Live data display */}</div>;
}
```

## Dependencies

### Internal
- `@/services/api` - API client
- `@/hooks/*` - Custom hooks
- `@/store` - Redux state
- `@/types` - TypeScript types

### External
- `@heroicons/react` - Icons (24/24 outline + solid)
- `@tanstack/react-query` - Data fetching
- `clsx` - Conditional class names
- `react-hot-toast` - Toast notifications

## Common Operations

### Adding a New Component

1. **Create component file**:
```bash
mkdir -p frontend/src/components/myfeature
touch frontend/src/components/myfeature/MyComponent.tsx
```

2. **Implement component**:
```typescript
interface MyComponentProps {
  // Props definition
}

export default function MyComponent({ ...props }: MyComponentProps) {
  return (
    <div className="...">
      {/* Component content */}
    </div>
  );
}
```

3. **Export from index if needed**:
```typescript
// components/myfeature/index.ts
export { default as MyComponent } from './MyComponent';
```

4. **Use in page**:
```typescript
import MyComponent from '@/components/myfeature/MyComponent';
```

### Styling with Tailwind
```typescript
// Use Tailwind utility classes
<div className="flex items-center gap-4 p-4 bg-white rounded-lg shadow">
  <span className="text-gray-600">Label</span>
  <span className="font-semibold text-blue-600">{value}</span>
</div>

// Conditional classes with clsx
import clsx from 'clsx';

<div className={clsx(
  'p-4 rounded-lg',
  isActive && 'bg-blue-50 border-blue-500',
  !isActive && 'bg-gray-50 border-gray-200'
)}>
```

## Related Files

- `/src/pages/` - Page components using these
- `/src/hooks/` - Custom hooks
- `/src/services/api.ts` - API client
- `/src/types/` - TypeScript types

## Testing

Components are tested with React Testing Library:
```bash
npm test -- components/
```

Test scenarios:
- Component renders correctly
- Props are handled properly
- User interactions work
- Loading/error states display

## Common Issues and Solutions

### Issue: Component not updating
- Check React Query cache invalidation
- Verify state updates trigger re-render
- Use React DevTools to inspect state

### Issue: Styling not applied
- Verify Tailwind classes exist
- Check for CSS specificity conflicts
- Ensure Tailwind config includes component path

### Issue: Icon not displaying
- Import from correct @heroicons package
- Check icon name spelling (PascalCase + Icon suffix)
- Use 24x24 size for consistency
