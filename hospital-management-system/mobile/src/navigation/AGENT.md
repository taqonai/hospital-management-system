# AGENT.md - Mobile Navigation Directory

## Purpose

This directory defines the navigation structure for the React Native patient portal app using React Navigation. It implements a three-level hierarchy: Root (auth gate), Auth stack, and Main tab navigator.

## Directory Structure

```
navigation/
├── RootNavigator.tsx         # Top-level auth gate
├── AuthNavigator.tsx         # Unauthenticated screens
├── MainNavigator.tsx         # Bottom tab navigation
└── types.ts                  # Navigation TypeScript types
```

## Navigation Architecture

```
RootNavigator
├── AuthNavigator (when not authenticated)
│   ├── LoginScreen
│   ├── RegisterScreen
│   └── OTPVerificationScreen
└── MainNavigator (when authenticated)
    ├── HomeTab (DashboardStack)
    │   └── DashboardScreen
    ├── AppointmentsTab (AppointmentsStack)
    │   ├── AppointmentsScreen
    │   ├── BookAppointmentScreen
    │   └── AppointmentDetailScreen
    ├── HealthTab (HealthStack)
    │   ├── HealthHubScreen
    │   ├── SymptomCheckerScreen
    │   ├── HealthAssistantScreen
    │   ├── PrescriptionsScreen
    │   ├── LabResultsScreen
    │   └── MedicalRecordsScreen
    └── SettingsTab (SettingsStack)
        ├── SettingsScreen
        ├── ProfileScreen
        ├── NotificationSettingsScreen
        ├── CommunicationSettingsScreen
        ├── ChangePasswordScreen
        ├── BillingScreen
        └── AboutScreen
```

## Navigator Details

### RootNavigator (`RootNavigator.tsx`)

Top-level navigator that handles authentication state:

```typescript
import { useSelector } from 'react-redux';

export function RootNavigator() {
  const { isAuthenticated, isInitialized } = useSelector(state => state.auth);

  if (!isInitialized) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
```

### AuthNavigator (`AuthNavigator.tsx`)

Stack navigator for unauthenticated users:

```typescript
const AuthStack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
      <AuthStack.Screen name="OTPVerification" component={OTPVerificationScreen} />
    </AuthStack.Navigator>
  );
}
```

### MainNavigator (`MainNavigator.tsx`)

Bottom tab navigator with nested stacks:

```typescript
const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color }) => {
          // Icon logic
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="HomeTab" component={DashboardStack} options={{ title: 'Home' }} />
      <Tab.Screen name="AppointmentsTab" component={AppointmentsStack} options={{ title: 'Appointments' }} />
      <Tab.Screen name="HealthTab" component={HealthStack} options={{ title: 'Health' }} />
      <Tab.Screen name="SettingsTab" component={SettingsStack} options={{ title: 'Settings' }} />
    </Tab.Navigator>
  );
}
```

### Type Definitions (`types.ts`)

```typescript
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  OTPVerification: { mobile: string; method: 'sms' | 'whatsapp' };
};

export type MainTabParamList = {
  HomeTab: undefined;
  AppointmentsTab: undefined;
  HealthTab: undefined;
  SettingsTab: undefined;
};

export type AppointmentsStackParamList = {
  Appointments: undefined;
  BookAppointment: undefined;
  AppointmentDetail: { appointmentId: string };
};

export type HealthStackParamList = {
  HealthHub: undefined;
  SymptomChecker: undefined;
  HealthAssistant: undefined;
  Prescriptions: undefined;
  LabResults: undefined;
  MedicalRecords: undefined;
};

export type SettingsStackParamList = {
  Settings: undefined;
  Profile: undefined;
  NotificationSettings: undefined;
  CommunicationSettings: undefined;
  ChangePassword: undefined;
  Billing: undefined;
  BillDetail: { billId: string };
  About: undefined;
};
```

## Navigation Patterns

### Typed Navigation Hook

```typescript
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProp = NativeStackNavigationProp<AppointmentsStackParamList>;

function MyComponent() {
  const navigation = useNavigation<NavigationProp>();

  const handlePress = () => {
    navigation.navigate('AppointmentDetail', { appointmentId: '123' });
  };
}
```

### Accessing Route Params

```typescript
import { useRoute, RouteProp } from '@react-navigation/native';

type RouteProps = RouteProp<AppointmentsStackParamList, 'AppointmentDetail'>;

function AppointmentDetailScreen() {
  const route = useRoute<RouteProps>();
  const { appointmentId } = route.params;
}
```

### Deep Linking Configuration

```typescript
const linking = {
  prefixes: ['hmspatient://', 'https://patient.hospital.com'],
  config: {
    screens: {
      MainNavigator: {
        screens: {
          AppointmentsTab: {
            screens: {
              AppointmentDetail: 'appointment/:appointmentId',
            },
          },
        },
      },
    },
  },
};
```

## Dependencies

### External Packages
- `@react-navigation/native` - Core navigation
- `@react-navigation/native-stack` - Stack navigator
- `@react-navigation/bottom-tabs` - Tab navigator
- `react-native-screens` - Native screens
- `react-native-safe-area-context` - Safe area handling

## Common Operations

### Adding a New Screen

1. **Create screen component** in `/src/screens/`

2. **Add type definition** in `types.ts`:
```typescript
export type MyStackParamList = {
  // ... existing
  NewScreen: { id: string };
};
```

3. **Add to stack navigator**:
```typescript
<Stack.Screen
  name="NewScreen"
  component={NewScreen}
  options={{ title: 'New Screen' }}
/>
```

### Adding a New Tab

1. Create new stack navigator
2. Add to MainTabParamList
3. Add Tab.Screen in MainNavigator

## Related Files

- `/src/screens/` - Screen components
- `/src/store/authSlice.ts` - Auth state for navigation gate
- `/App.tsx` - Root component wrapping navigation

## Common Issues

### Issue: Screen not found
- Check screen is registered in navigator
- Verify type definitions match
- Check navigator nesting

### Issue: Header not showing
- Check `headerShown` option
- Verify screen options are set
- Check nested navigator options

### Issue: Deep link not working
- Verify linking configuration
- Check URL scheme is registered
- Test with `npx uri-scheme open`
