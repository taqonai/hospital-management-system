# AGENT.md - Mobile Hooks Directory

## Purpose

This directory contains custom React hooks for the mobile app, providing reusable logic for authentication, offline data management, network status, biometric security, push notifications, and app lifecycle management.

## Directory Structure

```
hooks/
├── useAuth.ts                 # Authentication state and logout
├── useOfflineData.ts          # Fetch with cache fallback
├── useOfflineQueue.ts         # Offline action queue management
├── useNetworkStatus.ts        # Real-time connectivity monitoring
├── useAppLock.ts              # Biometric app lock on background
├── useInactivityTimer.ts      # Auto-logout after inactivity
├── usePushNotifications.ts    # Push notification handling
├── useAppointmentReminders.ts # Appointment reminder scheduling
└── useMedicationReminders.ts  # Medication reminder scheduling
```

## Hook Details

### useAuth

Access authentication state and logout action:

```typescript
const { user, isAuthenticated, logout } = useAuth();
```

**Returns:**
- `user: PatientUser | null` - Current patient user
- `isAuthenticated: boolean` - Auth state
- `logout: () => void` - Clear auth and navigate to login

**Usage:**
```typescript
function MyScreen() {
  const { user, isAuthenticated, logout } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="Login" />;
  }

  return (
    <View>
      <Text>Welcome, {user?.firstName}</Text>
      <Button onPress={logout} title="Logout" />
    </View>
  );
}
```

---

### useOfflineData

Fetch data with automatic cache fallback:

```typescript
const {
  data,
  isLoading,
  isFromCache,
  isStale,
  error,
  refetch,
} = useOfflineData<T>(cacheKey, fetchFn, ttl?);
```

**Parameters:**
- `cacheKey: string` - Unique cache identifier
- `fetchFn: () => Promise<T>` - API call function
- `ttl?: number` - Cache TTL in ms (default varies by type)

**Returns:**
- `data: T | null` - Fetched or cached data
- `isLoading: boolean` - Loading state
- `isFromCache: boolean` - True if data from cache
- `isStale: boolean` - True if cache expired but used
- `error: Error | null` - Error if any
- `refetch: () => void` - Manual refresh

**Usage:**
```typescript
function AppointmentsScreen() {
  const { data, isLoading, isFromCache, isStale } = useOfflineData(
    'appointments',
    () => patientPortalApi.getAppointments(),
    CacheTTL.APPOINTMENTS
  );

  return (
    <View>
      {isFromCache && <OfflineBanner isStale={isStale} />}
      {isLoading ? <Loading /> : <AppointmentList data={data} />}
    </View>
  );
}
```

---

### useOfflineQueue

Manage offline action queue:

```typescript
const {
  queue,
  pendingCount,
  hasPending,
  enqueue,
  processQueue,
  removeAction,
} = useOfflineQueue();
```

**Returns:**
- `queue: Action[]` - Pending actions
- `pendingCount: number` - Count of pending
- `hasPending: boolean` - Has any pending
- `enqueue: (type, payload) => void` - Add action
- `processQueue: () => void` - Process all (when online)
- `removeAction: (id) => void` - Remove specific action

**Usage:**
```typescript
function CancelAppointment({ appointmentId }) {
  const { enqueue } = useOfflineQueue();
  const { isOnline } = useNetworkStatus();

  const handleCancel = async (reason) => {
    if (isOnline) {
      await patientPortalApi.cancelAppointment(appointmentId, reason);
    } else {
      enqueue(ActionType.CANCEL_APPOINTMENT, { appointmentId, reason });
      toast.show('Cancellation will be processed when online');
    }
  };
}
```

---

### useNetworkStatus

Monitor network connectivity:

```typescript
const { isOnline, networkType, refresh } = useNetworkStatus();
```

**Returns:**
- `isOnline: boolean` - Current connectivity
- `networkType: string` - 'wifi', 'cellular', 'none'
- `refresh: () => void` - Recheck connectivity

**Usage:**
```typescript
function MyScreen() {
  const { isOnline } = useNetworkStatus();

  return (
    <View>
      {!isOnline && <OfflineBanner />}
      {/* Rest of UI */}
    </View>
  );
}
```

---

### useAppLock

Biometric app lock when backgrounded:

```typescript
const {
  isLocked,
  unlock,
  lock,
  isBiometricEnabled,
  toggleBiometric,
} = useAppLock();
```

**Features:**
- Auto-locks after 30 seconds in background
- Biometric unlock prompt
- Manual lock/unlock control

**Usage:**
```typescript
// In App.tsx
function App() {
  const { isLocked, unlock } = useAppLock();

  if (isLocked) {
    return <LockScreen onUnlock={unlock} />;
  }

  return <MainApp />;
}
```

---

### useInactivityTimer

Auto-logout after inactivity:

```typescript
const { resetTimer, remainingTime } = useInactivityTimer(timeoutMs?);
```

**Parameters:**
- `timeoutMs: number` - Timeout in ms (default: 15 minutes)

**Features:**
- Resets on user interaction
- Auto-logout when timer expires
- Configurable timeout

**Usage:**
```typescript
function App() {
  const { resetTimer } = useInactivityTimer(15 * 60 * 1000);

  return (
    <TouchableWithoutFeedback onPress={resetTimer}>
      <MainApp />
    </TouchableWithoutFeedback>
  );
}
```

---

### usePushNotifications

Initialize and handle push notifications:

```typescript
const {
  pushToken,
  isEnabled,
  requestPermission,
  registerToken,
} = usePushNotifications();
```

**Features:**
- Request notification permission
- Get Expo push token
- Register token with backend
- Handle notification taps

**Usage:**
```typescript
function App() {
  const { requestPermission, registerToken } = usePushNotifications();

  useEffect(() => {
    const setup = async () => {
      const granted = await requestPermission();
      if (granted) {
        await registerToken();
      }
    };
    setup();
  }, []);
}
```

---

### useAppointmentReminders

Schedule appointment reminders:

```typescript
const {
  scheduleReminder,
  cancelReminder,
  rescheduleReminder,
} = useAppointmentReminders();
```

**Usage:**
```typescript
function AppointmentList({ appointments }) {
  const { scheduleReminder } = useAppointmentReminders();

  useEffect(() => {
    appointments.forEach(apt => {
      scheduleReminder(apt, '24h'); // 24 hours before
      scheduleReminder(apt, '1h');  // 1 hour before
    });
  }, [appointments]);
}
```

---

### useMedicationReminders

Schedule medication reminders:

```typescript
const {
  scheduleReminder,
  cancelReminder,
  getScheduled,
} = useMedicationReminders();
```

**Usage:**
```typescript
function PrescriptionDetail({ prescription }) {
  const { scheduleReminder } = useMedicationReminders();

  const handleSetReminder = () => {
    scheduleReminder(prescription, {
      times: ['08:00', '20:00'],
      repeating: true,
    });
  };
}
```

## Common Patterns

### Hook with TanStack Query

```typescript
export function useMyData(id: string) {
  return useQuery({
    queryKey: ['myData', id],
    queryFn: () => api.getData(id),
    staleTime: 5 * 60 * 1000,
  });
}
```

### Hook with Offline Support

```typescript
export function useOfflineAwareData<T>(
  key: string,
  fetcher: () => Promise<T>
) {
  const { isOnline } = useNetworkStatus();
  const [data, setData] = useState<T | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (isOnline) {
        try {
          const fresh = await fetcher();
          setData(fresh);
          await cacheManager.set(key, fresh);
          setIsFromCache(false);
        } catch {
          // Fall back to cache
          const cached = await cacheManager.getStale(key);
          if (cached) {
            setData(cached.data);
            setIsFromCache(true);
          }
        }
      } else {
        // Offline - use cache
        const cached = await cacheManager.getStale(key);
        if (cached) {
          setData(cached.data);
          setIsFromCache(true);
        }
      }
    };
    load();
  }, [key, isOnline]);

  return { data, isFromCache };
}
```

## Dependencies

### Internal
- `../services/*` - Service layer
- `../store` - Redux state

### External
- `@tanstack/react-query` - Data fetching
- `@react-native-community/netinfo` - Network status
- `expo-notifications` - Push notifications

## Common Operations

### Creating a New Hook

```typescript
// hooks/useMyFeature.ts
import { useState, useEffect } from 'react';

export function useMyFeature(param: string) {
  const [state, setState] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Effect logic
  }, [param]);

  const action = useCallback(() => {
    // Action logic
  }, []);

  return { state, isLoading, action };
}
```

## Related Files

- `/src/services/` - Services used by hooks
- `/src/store/` - Redux state
- `/src/screens/` - Screens consuming hooks

## Common Issues

### Issue: Hook not updating
- Check dependency array
- Verify state updates correctly
- Use React DevTools to inspect

### Issue: Network status wrong
- Ensure NetInfo is configured
- Test on real device
- Check for simulator limitations

### Issue: Push notifications not working
- Physical device required
- Verify Expo push token
- Check notification permissions
