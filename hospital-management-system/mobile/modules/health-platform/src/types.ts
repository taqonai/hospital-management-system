/**
 * Health Platform Types
 * Types for native health platform integration (HealthKit, Health Connect, Samsung Health)
 */

export type HealthPlatformType =
  | 'APPLE_HEALTH_KIT'
  | 'GOOGLE_HEALTH_CONNECT'
  | 'SAMSUNG_HEALTH';

export type HealthDataType =
  | 'STEPS'
  | 'SLEEP_DURATION'
  | 'SLEEP_STAGE'
  | 'HEART_RATE'
  | 'HEART_RATE_RESTING'
  | 'HRV'
  | 'WORKOUT'
  | 'CALORIES_BURNED'
  | 'BLOOD_OXYGEN'
  | 'STRESS_LEVEL'
  | 'BLOOD_PRESSURE_SYSTOLIC'
  | 'BLOOD_PRESSURE_DIASTOLIC'
  | 'BLOOD_GLUCOSE'
  | 'BODY_TEMPERATURE'
  | 'WEIGHT'
  | 'RESPIRATORY_RATE'
  | 'DISTANCE'
  | 'FLOORS_CLIMBED'
  | 'ACTIVE_MINUTES';

export interface HealthDataPoint {
  dataType: HealthDataType;
  value: number;
  unit: string;
  timestamp: string; // ISO 8601
  metadata?: Record<string, any>;
}

export interface HealthPermission {
  dataType: HealthDataType;
  read: boolean;
  write: boolean;
}

export interface HealthPlatformStatus {
  platform: HealthPlatformType;
  isAvailable: boolean;
  isConnected: boolean;
  lastSyncTime?: string;
  permissions: HealthPermission[];
}

export interface SyncOptions {
  startDate: string; // ISO 8601
  endDate: string; // ISO 8601
  dataTypes: HealthDataType[];
}

export interface SyncResult {
  success: boolean;
  dataPoints: HealthDataPoint[];
  syncedAt: string;
  error?: string;
}

export interface AuthorizationResult {
  granted: boolean;
  permissions: HealthPermission[];
  error?: string;
}

// Workout types for activity data
export type WorkoutType =
  | 'WALKING'
  | 'RUNNING'
  | 'CYCLING'
  | 'SWIMMING'
  | 'HIIT'
  | 'STRENGTH_TRAINING'
  | 'YOGA'
  | 'OTHER';

export interface WorkoutData {
  workoutType: WorkoutType;
  startTime: string;
  endTime: string;
  duration: number; // minutes
  calories?: number;
  distance?: number; // meters
  avgHeartRate?: number;
  maxHeartRate?: number;
  metadata?: Record<string, any>;
}

// Sleep stage types
export type SleepStage =
  | 'AWAKE'
  | 'LIGHT'
  | 'DEEP'
  | 'REM'
  | 'UNKNOWN';

export interface SleepData {
  startTime: string;
  endTime: string;
  duration: number; // minutes
  stages?: Array<{
    stage: SleepStage;
    startTime: string;
    endTime: string;
  }>;
}
