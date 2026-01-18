# Health Platform Native Module

This module provides native integration with health platforms for the A'mad Precision Health app.

## Supported Platforms

- **iOS**: Apple HealthKit
- **Android**: Google Health Connect, Samsung Health

## Project Structure

```
health-platform/
├── src/
│   ├── index.ts              # Module exports
│   ├── types.ts              # TypeScript type definitions
│   ├── HealthPlatformService.ts  # Main service class
│   └── adapters/
│       ├── AppleHealthAdapter.ts     # iOS HealthKit adapter
│       ├── GoogleHealthAdapter.ts    # Android Health Connect adapter
│       └── SamsungHealthAdapter.ts   # Android Samsung Health adapter
├── ios/
│   └── HealthKitModule.swift         # Native iOS implementation
├── android/
│   └── src/main/java/expo/modules/healthplatform/
│       ├── HealthConnectModule.kt    # Health Connect implementation
│       └── SamsungHealthModule.kt    # Samsung Health implementation
└── expo-module.config.json           # Expo module configuration
```

## iOS Setup (HealthKit)

### 1. Enable HealthKit Capability

In Xcode:
1. Select your project target
2. Go to "Signing & Capabilities"
3. Click "+ Capability"
4. Add "HealthKit"

### 2. Add Info.plist Entries

```xml
<key>NSHealthShareUsageDescription</key>
<string>A'mad needs access to your health data to provide personalized recommendations and track your wellness progress.</string>

<key>NSHealthUpdateUsageDescription</key>
<string>A'mad can save your health activities and measurements to Apple Health.</string>
```

### 3. Native Implementation

Implement `HealthKitModule.swift` with the following methods:
- `isHealthDataAvailable()` - Check if HealthKit is available
- `requestAuthorization(types)` - Request read/write permissions
- `querySamples(type, startDate, endDate)` - Query health samples
- `queryWorkouts(startDate, endDate)` - Query workout data
- `querySleepAnalysis(startDate, endDate)` - Query sleep data
- `saveSample(type, value, unit, startDate, endDate)` - Write health sample
- `enableBackgroundDelivery(types, frequency)` - Enable background updates
- `disableAllBackgroundDelivery()` - Disable background updates

## Android Setup (Health Connect)

### 1. Add Dependencies

In `android/app/build.gradle`:
```groovy
dependencies {
    implementation "androidx.health.connect:connect-client:1.1.0-alpha07"
}
```

### 2. Add Permissions

In `AndroidManifest.xml`:
```xml
<!-- Health Connect Permissions -->
<uses-permission android:name="android.permission.health.READ_STEPS" />
<uses-permission android:name="android.permission.health.READ_HEART_RATE" />
<uses-permission android:name="android.permission.health.READ_SLEEP" />
<uses-permission android:name="android.permission.health.READ_EXERCISE" />
<uses-permission android:name="android.permission.health.READ_DISTANCE" />
<uses-permission android:name="android.permission.health.READ_ACTIVE_CALORIES_BURNED" />
<uses-permission android:name="android.permission.health.READ_OXYGEN_SATURATION" />
<uses-permission android:name="android.permission.health.READ_BLOOD_GLUCOSE" />
<uses-permission android:name="android.permission.health.READ_BLOOD_PRESSURE" />
<uses-permission android:name="android.permission.health.READ_BODY_TEMPERATURE" />
<uses-permission android:name="android.permission.health.READ_WEIGHT" />
<uses-permission android:name="android.permission.health.READ_RESPIRATORY_RATE" />

<!-- Intent filter for Health Connect -->
<intent-filter>
    <action android:name="androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE" />
</intent-filter>
```

### 3. Native Implementation

Implement `HealthConnectModule.kt` with the following methods:
- `isAvailable()` - Check if Health Connect is installed
- `requestAuthorization(permissions)` - Request permissions
- `readRecords(type, startTime, endTime)` - Read health records
- `readExerciseSessions(startTime, endTime)` - Read workout data
- `readSleepSessions(startTime, endTime)` - Read sleep data
- `writeRecord(record)` - Write health record

## Samsung Health Setup

> Note: Samsung Health SDK is being deprecated. Consider using Health Connect as the primary Android adapter.

### 1. Register as Partner App

Samsung Health SDK requires partner app registration at:
https://developer.samsung.com/health

### 2. Add SDK

Download the Samsung Health SDK and add to your project.

### 3. Add Permissions

In `AndroidManifest.xml`:
```xml
<uses-permission android:name="com.samsung.android.health.permission.read" />
```

## Usage

```typescript
import { HealthPlatformService } from '@modules/health-platform';

const healthService = HealthPlatformService.getInstance();

// Check availability
const isAvailable = await healthService.isAvailable();

// Request permissions
const authResult = await healthService.requestAuthorization([
  'STEPS',
  'HEART_RATE',
  'SLEEP_DURATION',
]);

if (authResult.granted) {
  // Sync last 7 days of data
  const endDate = new Date().toISOString();
  const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const syncResult = await healthService.syncData({
    startDate,
    endDate,
    dataTypes: ['STEPS', 'HEART_RATE', 'SLEEP_DURATION'],
  });

  console.log('Synced data points:', syncResult.dataPoints.length);
}
```

## Data Types

| Type | iOS | Android (Health Connect) |
|------|-----|-------------------------|
| STEPS | HKQuantityTypeIdentifierStepCount | StepsRecord |
| HEART_RATE | HKQuantityTypeIdentifierHeartRate | HeartRateRecord |
| SLEEP_DURATION | HKCategoryTypeIdentifierSleepAnalysis | SleepSessionRecord |
| CALORIES_BURNED | HKQuantityTypeIdentifierActiveEnergyBurned | ActiveCaloriesBurnedRecord |
| BLOOD_OXYGEN | HKQuantityTypeIdentifierOxygenSaturation | OxygenSaturationRecord |
| BLOOD_GLUCOSE | HKQuantityTypeIdentifierBloodGlucose | BloodGlucoseRecord |
| BLOOD_PRESSURE | HKQuantityTypeIdentifierBloodPressure* | BloodPressureRecord |
| WEIGHT | HKQuantityTypeIdentifierBodyMass | WeightRecord |
| WORKOUT | HKWorkoutType | ExerciseSessionRecord |

## Background Sync

Both iOS and Android support background updates:

### iOS
Uses HealthKit's background delivery with configurable update frequency.

### Android
Uses Health Connect's data change notifications.

## Testing

For development/testing without native builds:
1. The adapters include stub implementations that log calls
2. Use Expo Go for basic TypeScript testing
3. Create a development build for full native testing

## Next Steps

1. Implement native modules (Swift/Kotlin)
2. Add unit tests for adapters
3. Add E2E tests for data sync flow
4. Implement background sync with expo-background-fetch
5. Add offline queue for data that can't be synced immediately
