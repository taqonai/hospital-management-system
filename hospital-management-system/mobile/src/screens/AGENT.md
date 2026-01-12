# AGENT.md - Mobile Screens Directory

## Purpose

This directory contains all screen components for the React Native patient portal mobile app. Screens are organized by feature area and correspond to navigation routes defined in the navigation directory.

## Directory Structure

```
screens/
├── auth/                      # Authentication screens
│   ├── LoginScreen.tsx        # Email/password + OTP login
│   ├── RegisterScreen.tsx     # Patient registration
│   └── OTPVerificationScreen.tsx # OTP entry and verification
├── dashboard/
│   └── DashboardScreen.tsx    # Patient dashboard with stats
├── appointments/
│   ├── AppointmentsScreen.tsx # Upcoming/past appointments list
│   ├── BookAppointmentScreen.tsx # Department/doctor selection
│   └── AppointmentDetailScreen.tsx # Single appointment view
├── records/
│   └── MedicalRecordsScreen.tsx # Medical record history
├── health/
│   ├── HealthHubScreen.tsx    # Central health information
│   ├── HealthInsightsScreen.tsx # Analytics with vitals trends
│   ├── SymptomCheckerScreen.tsx # AI symptom assessment
│   ├── HealthAssistantScreen.tsx # AI chat assistant
│   ├── PrescriptionsScreen.tsx # Active/completed prescriptions
│   └── LabResultsScreen.tsx   # Test results with interpretations
├── billing/
│   ├── BillingScreen.tsx      # Bill summary and history
│   └── BillDetailScreen.tsx   # Itemized bill details
└── settings/
    ├── SettingsScreen.tsx     # Main settings menu
    ├── ProfileScreen.tsx      # Patient profile management
    ├── NotificationSettingsScreen.tsx # Push notification prefs
    ├── CommunicationSettingsScreen.tsx # Email/SMS preferences
    ├── ChangePasswordScreen.tsx # Password change
    └── AboutScreen.tsx        # App information
```

## Screen Categories

### Authentication Screens
| Screen | Purpose | Auth Required |
|--------|---------|---------------|
| `LoginScreen` | Email/password or OTP login | No |
| `RegisterScreen` | New patient registration | No |
| `OTPVerificationScreen` | SMS/WhatsApp OTP entry | No |

### Dashboard
| Screen | Purpose | Auth Required |
|--------|---------|---------------|
| `DashboardScreen` | Overview with upcoming appointments, prescriptions, lab results, health score | Yes |

### Appointments
| Screen | Purpose | Auth Required |
|--------|---------|---------------|
| `AppointmentsScreen` | List with tabs for upcoming/past | Yes |
| `BookAppointmentScreen` | Multi-step booking flow | Yes |
| `AppointmentDetailScreen` | Full details, reschedule/cancel | Yes |

### Health & Records
| Screen | Purpose | Auth Required |
|--------|---------|---------------|
| `HealthHubScreen` | Health information hub | Yes |
| `HealthInsightsScreen` | Vitals trends and analytics | Yes |
| `SymptomCheckerScreen` | AI-powered symptom assessment | Yes |
| `HealthAssistantScreen` | Conversational health AI | Yes |
| `MedicalRecordsScreen` | Consultation history | Yes |
| `PrescriptionsScreen` | Medication list and refills | Yes |
| `LabResultsScreen` | Test results with flags | Yes |

### Billing
| Screen | Purpose | Auth Required |
|--------|---------|---------------|
| `BillingScreen` | Pending bills, payment history | Yes |
| `BillDetailScreen` | Line items, payment options | Yes |

### Settings
| Screen | Purpose | Auth Required |
|--------|---------|---------------|
| `SettingsScreen` | Settings menu | Yes |
| `ProfileScreen` | Edit profile information | Yes |
| `NotificationSettingsScreen` | Push notification preferences | Yes |
| `CommunicationSettingsScreen` | Contact preferences | Yes |
| `ChangePasswordScreen` | Update password | Yes |
| `AboutScreen` | App version and info | Yes |

## Key Patterns

### Screen Component Structure
```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { patientPortalApi } from '../../services/api/patientPortal';

export default function MyScreen() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['myData'],
    queryFn: patientPortalApi.getData,
  });

  if (isLoading) {
    return <LoadingView />;
  }

  if (error) {
    return <ErrorView error={error} />;
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Screen Title</Text>
      {/* Screen content */}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
});
```

### Screen with Offline Support
```typescript
import { useOfflineData } from '../../hooks/useOfflineData';

export default function OfflineAwareScreen() {
  const { data, isLoading, isFromCache, isStale } = useOfflineData(
    'appointments',
    patientPortalApi.getAppointments
  );

  return (
    <View>
      {isFromCache && <OfflineBanner isStale={isStale} />}
      {/* Render data */}
    </View>
  );
}
```

### Screen with Navigation
```typescript
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type Props = NativeStackNavigationProp<RootStackParamList, 'MyScreen'>;

export default function MyScreen() {
  const navigation = useNavigation<Props>();
  const route = useRoute();

  const handleNavigate = () => {
    navigation.navigate('NextScreen', { id: route.params.id });
  };

  return (/* ... */);
}
```

## Dependencies

### Internal
- `../../services/api/*` - API clients
- `../../hooks/*` - Custom hooks
- `../../store` - Redux state
- `../../components/*` - Reusable components
- `../../theme` - Colors, typography

### External
- `@react-navigation/native` - Navigation
- `@tanstack/react-query` - Data fetching
- `react-native` - Core components

## Common Operations

### Adding a New Screen

1. **Create screen file:**
```bash
touch mobile/src/screens/myfeature/MyNewScreen.tsx
```

2. **Implement screen component:**
```typescript
export default function MyNewScreen() {
  return (
    <View style={styles.container}>
      <Text>My New Screen</Text>
    </View>
  );
}
```

3. **Add to navigator** (in `navigation/` directory):
```typescript
<Stack.Screen
  name="MyNewScreen"
  component={MyNewScreen}
  options={{ title: 'My New Screen' }}
/>
```

4. **Add TypeScript types** (in `types/navigation.ts`):
```typescript
export type RootStackParamList = {
  // ... existing screens
  MyNewScreen: { id: string };
};
```

## Related Files

- `/src/navigation/` - Navigator definitions
- `/src/services/api/` - API clients
- `/src/hooks/` - Custom hooks
- `/src/components/` - Reusable components
- `/src/types/` - TypeScript types

## Testing

Screens are tested with React Native Testing Library:
```bash
npm test -- screens/
```

## Common Issues

### Issue: Navigation not working
- Verify screen is registered in navigator
- Check navigation types match
- Ensure params are passed correctly

### Issue: Data not loading
- Check API endpoint is correct
- Verify auth token is present
- Test API in isolation

### Issue: Offline data not showing
- Verify useOfflineData hook usage
- Check cache TTL settings
- Ensure CacheManager is initialized
