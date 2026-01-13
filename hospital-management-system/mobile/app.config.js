/**
 * Dynamic Expo configuration
 *
 * This file allows for environment-specific configuration
 * and is used by EAS Build to inject environment variables.
 */

// Load environment variables from .env file for local builds
require('dotenv').config();

const IS_DEV = process.env.APP_ENV === 'development';
const IS_PREVIEW = process.env.APP_ENV === 'preview';
const IS_PROD = process.env.APP_ENV === 'production';

const getAppName = () => {
  if (IS_DEV) return 'Spetaar (Dev)';
  if (IS_PREVIEW) return 'Spetaar (Preview)';
  return 'Spetaar Patient Portal';
};

const getBundleId = () => {
  if (IS_DEV) return 'com.spetaar.patientportal.dev';
  if (IS_PREVIEW) return 'com.spetaar.patientportal.preview';
  return 'com.spetaar.patientportal';
};

export default ({ config }) => {
  return {
    ...config,
    name: getAppName(),
    ios: {
      ...config.ios,
      bundleIdentifier: getBundleId(),
    },
    android: {
      ...config.android,
      package: getBundleId(),
    },
    extra: {
      ...config.extra,
      APP_ENV: process.env.APP_ENV || 'development',
      API_URL: process.env.API_URL || 'http://localhost:3001/api/v1',
      SENTRY_DSN: process.env.SENTRY_DSN || '',
    },
  };
};
