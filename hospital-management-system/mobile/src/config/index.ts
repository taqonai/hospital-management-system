export { env, isDevelopment, isPreview, isProduction, debugLog } from './env';
export type { Environment } from './env';

/**
 * App configuration constants
 */
export const APP_CONFIG = {
  // App info
  APP_NAME: 'Spetaar Patient Portal',
  APP_VERSION: '1.0.0',

  // API configuration
  API_TIMEOUT: 30000, // 30 seconds

  // Cache TTL (in milliseconds)
  CACHE_TTL: {
    DASHBOARD: 5 * 60 * 1000,      // 5 minutes
    APPOINTMENTS: 15 * 60 * 1000,  // 15 minutes
    PRESCRIPTIONS: 30 * 60 * 1000, // 30 minutes
    LAB_RESULTS: 60 * 60 * 1000,   // 1 hour
    MEDICAL_HISTORY: 24 * 60 * 60 * 1000, // 24 hours
  },

  // Pagination
  DEFAULT_PAGE_SIZE: 20,

  // Security
  INACTIVITY_TIMEOUT_MS: 15 * 60 * 1000, // 15 minutes
  BACKGROUND_LOCK_THRESHOLD_MS: 30 * 1000, // 30 seconds
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION_MS: 30 * 60 * 1000, // 30 minutes

  // Push Notifications
  NOTIFICATION_CHANNELS: {
    APPOINTMENTS: 'appointments',
    MEDICATIONS: 'medications',
    LAB_RESULTS: 'lab-results',
    GENERAL: 'general',
  },

  // Feature flags
  FEATURES: {
    SYMPTOM_CHECKER: true,
    HEALTH_ASSISTANT: true,
    TELEMEDICINE: false, // Coming soon
    MEDICATION_REMINDERS: true,
    OFFLINE_MODE: true,
  },
} as const;

export default APP_CONFIG;
