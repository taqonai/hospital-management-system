import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PatientUser } from '../../types';

// Keys for secure storage
const KEYS = {
  ACCESS_TOKEN: 'patientPortalToken',
  REFRESH_TOKEN: 'patientRefreshToken',
  PATIENT_USER: 'patientUser',
  BIOMETRIC_ENABLED: 'biometricEnabled',
  LAST_LOGIN_EMAIL: 'lastLoginEmail',
  PUSH_TOKEN: 'pushToken',
};

// Secure storage wrapper for sensitive data
export const secureStorage = {
  // Token management
  async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    await Promise.all([
      SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, accessToken),
      SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, refreshToken),
    ]);
  },

  async getAccessToken(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.ACCESS_TOKEN);
  },

  async getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.REFRESH_TOKEN);
  },

  async updateAccessToken(accessToken: string): Promise<void> {
    await SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, accessToken);
  },

  async clearTokens(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN),
      SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN),
    ]);
  },

  // Patient user data
  async setPatientUser(user: PatientUser): Promise<void> {
    await SecureStore.setItemAsync(KEYS.PATIENT_USER, JSON.stringify(user));
  },

  async getPatientUser(): Promise<PatientUser | null> {
    const data = await SecureStore.getItemAsync(KEYS.PATIENT_USER);
    return data ? JSON.parse(data) : null;
  },

  async clearPatientUser(): Promise<void> {
    await SecureStore.deleteItemAsync(KEYS.PATIENT_USER);
  },

  // Biometric settings
  async setBiometricEnabled(enabled: boolean): Promise<void> {
    await SecureStore.setItemAsync(KEYS.BIOMETRIC_ENABLED, String(enabled));
  },

  async isBiometricEnabled(): Promise<boolean> {
    const value = await SecureStore.getItemAsync(KEYS.BIOMETRIC_ENABLED);
    return value === 'true';
  },

  // Last login email (for convenience)
  async setLastLoginEmail(email: string): Promise<void> {
    await SecureStore.setItemAsync(KEYS.LAST_LOGIN_EMAIL, email);
  },

  async getLastLoginEmail(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.LAST_LOGIN_EMAIL);
  },

  // Push notification token
  async setPushToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(KEYS.PUSH_TOKEN, token);
  },

  async getPushToken(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.PUSH_TOKEN);
  },

  // Clear all secure data (logout)
  async clearAll(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN),
      SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN),
      SecureStore.deleteItemAsync(KEYS.PATIENT_USER),
      // Keep biometric and last login settings
    ]);
  },

  // Check if user is logged in
  async isLoggedIn(): Promise<boolean> {
    const token = await this.getAccessToken();
    return token !== null;
  },
};

// AsyncStorage wrapper for non-sensitive cached data
const CACHE_KEYS = {
  DASHBOARD: 'cache_dashboard',
  APPOINTMENTS: 'cache_appointments',
  PRESCRIPTIONS: 'cache_prescriptions',
  LAB_RESULTS: 'cache_labs',
  MEDICAL_HISTORY: 'cache_medical_history',
  HEALTH_INSIGHTS: 'cache_health_insights',
};

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// Cache TTL in milliseconds
const CACHE_TTL = {
  DASHBOARD: 5 * 60 * 1000,       // 5 minutes
  APPOINTMENTS: 15 * 60 * 1000,   // 15 minutes
  PRESCRIPTIONS: 30 * 60 * 1000,  // 30 minutes
  LAB_RESULTS: 60 * 60 * 1000,    // 1 hour
  MEDICAL_HISTORY: 24 * 60 * 60 * 1000, // 24 hours
  HEALTH_INSIGHTS: 15 * 60 * 1000, // 15 minutes
};

export const cacheStorage = {
  async set<T>(key: string, data: T, ttl: number): Promise<void> {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    };
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  },

  async get<T>(key: string): Promise<T | null> {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;

    const entry: CacheEntry<T> = JSON.parse(raw);
    const isExpired = Date.now() - entry.timestamp > entry.ttl;

    if (isExpired) {
      await AsyncStorage.removeItem(key);
      return null;
    }

    return entry.data;
  },

  async remove(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  },

  async clearAll(): Promise<void> {
    const keys = Object.values(CACHE_KEYS);
    await AsyncStorage.multiRemove(keys);
  },

  // Specific cache methods
  async cacheDashboard<T>(data: T): Promise<void> {
    await this.set(CACHE_KEYS.DASHBOARD, data, CACHE_TTL.DASHBOARD);
  },

  async getCachedDashboard<T>(): Promise<T | null> {
    return this.get<T>(CACHE_KEYS.DASHBOARD);
  },

  async cacheAppointments<T>(data: T): Promise<void> {
    await this.set(CACHE_KEYS.APPOINTMENTS, data, CACHE_TTL.APPOINTMENTS);
  },

  async getCachedAppointments<T>(): Promise<T | null> {
    return this.get<T>(CACHE_KEYS.APPOINTMENTS);
  },

  async cachePrescriptions<T>(data: T): Promise<void> {
    await this.set(CACHE_KEYS.PRESCRIPTIONS, data, CACHE_TTL.PRESCRIPTIONS);
  },

  async getCachedPrescriptions<T>(): Promise<T | null> {
    return this.get<T>(CACHE_KEYS.PRESCRIPTIONS);
  },

  async cacheLabResults<T>(data: T): Promise<void> {
    await this.set(CACHE_KEYS.LAB_RESULTS, data, CACHE_TTL.LAB_RESULTS);
  },

  async getCachedLabResults<T>(): Promise<T | null> {
    return this.get<T>(CACHE_KEYS.LAB_RESULTS);
  },

  async cacheMedicalHistory<T>(data: T): Promise<void> {
    await this.set(CACHE_KEYS.MEDICAL_HISTORY, data, CACHE_TTL.MEDICAL_HISTORY);
  },

  async getCachedMedicalHistory<T>(): Promise<T | null> {
    return this.get<T>(CACHE_KEYS.MEDICAL_HISTORY);
  },

  async cacheHealthInsights<T>(data: T): Promise<void> {
    await this.set(CACHE_KEYS.HEALTH_INSIGHTS, data, CACHE_TTL.HEALTH_INSIGHTS);
  },

  async getCachedHealthInsights<T>(): Promise<T | null> {
    return this.get<T>(CACHE_KEYS.HEALTH_INSIGHTS);
  },
};

export { KEYS, CACHE_KEYS, CACHE_TTL };
