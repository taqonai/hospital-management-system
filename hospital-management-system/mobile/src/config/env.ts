import Constants from 'expo-constants';

/**
 * Environment configuration
 *
 * Values are set via EAS Build environment variables
 * and can be overridden in app.config.js or eas.json
 */

export type Environment = 'development' | 'preview' | 'production';

interface EnvironmentConfig {
  APP_ENV: Environment;
  API_URL: string;
  ENABLE_DEBUG: boolean;
  SENTRY_DSN?: string;
  ANALYTICS_ENABLED: boolean;
  PUSH_NOTIFICATIONS_ENABLED: boolean;
  OFFLINE_MODE_ENABLED: boolean;
  BIOMETRIC_ENABLED: boolean;
  AUTO_LOGOUT_TIMEOUT_MS: number;
  BACKGROUND_LOCK_THRESHOLD_MS: number;
}

// Get environment variables from EAS Build or fallback to defaults
const getEnvVar = (key: string, defaultValue: string): string => {
  // Check for EAS Build environment variables
  const extra = Constants.expoConfig?.extra;
  if (extra?.[key]) {
    return extra[key];
  }

  // Check process.env (for local development)
  if (process.env[key]) {
    return process.env[key] as string;
  }

  return defaultValue;
};

const APP_ENV = getEnvVar('APP_ENV', 'development') as Environment;

// Environment-specific configurations
const configs: Record<Environment, EnvironmentConfig> = {
  development: {
    APP_ENV: 'development',
    API_URL: getEnvVar('API_URL', 'http://localhost:3001/api/v1'),
    ENABLE_DEBUG: true,
    ANALYTICS_ENABLED: false,
    PUSH_NOTIFICATIONS_ENABLED: true,
    OFFLINE_MODE_ENABLED: true,
    BIOMETRIC_ENABLED: true,
    AUTO_LOGOUT_TIMEOUT_MS: 15 * 60 * 1000, // 15 minutes
    BACKGROUND_LOCK_THRESHOLD_MS: 30 * 1000, // 30 seconds
  },
  preview: {
    APP_ENV: 'preview',
    API_URL: getEnvVar('API_URL', 'https://staging-api.hms.example.com/api/v1'),
    ENABLE_DEBUG: true,
    ANALYTICS_ENABLED: true,
    PUSH_NOTIFICATIONS_ENABLED: true,
    OFFLINE_MODE_ENABLED: true,
    BIOMETRIC_ENABLED: true,
    AUTO_LOGOUT_TIMEOUT_MS: 15 * 60 * 1000,
    BACKGROUND_LOCK_THRESHOLD_MS: 30 * 1000,
  },
  production: {
    APP_ENV: 'production',
    API_URL: getEnvVar('API_URL', 'https://api.spetaar.ai/api/v1'),
    ENABLE_DEBUG: false,
    SENTRY_DSN: getEnvVar('SENTRY_DSN', ''),
    ANALYTICS_ENABLED: true,
    PUSH_NOTIFICATIONS_ENABLED: true,
    OFFLINE_MODE_ENABLED: true,
    BIOMETRIC_ENABLED: true,
    AUTO_LOGOUT_TIMEOUT_MS: 15 * 60 * 1000,
    BACKGROUND_LOCK_THRESHOLD_MS: 30 * 1000,
  },
};

// Export current environment config
export const env: EnvironmentConfig = configs[APP_ENV];

// Helper functions
export const isDevelopment = (): boolean => env.APP_ENV === 'development';
export const isPreview = (): boolean => env.APP_ENV === 'preview';
export const isProduction = (): boolean => env.APP_ENV === 'production';

// Debugging helper - only logs in non-production
export const debugLog = (...args: any[]): void => {
  if (env.ENABLE_DEBUG) {
    console.log('[DEBUG]', ...args);
  }
};

export default env;
