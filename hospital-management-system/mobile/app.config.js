/**
 * Dynamic Expo configuration
 *
 * This file allows for environment-specific configuration
 * and is used by EAS Build to inject environment variables.
 */

const IS_DEV = process.env.APP_ENV === 'development';
const IS_PREVIEW = process.env.APP_ENV === 'preview';
const IS_PROD = process.env.APP_ENV === 'production';

const getAppName = () => {
  if (IS_DEV) return 'HMS Patient (Dev)';
  if (IS_PREVIEW) return 'HMS Patient (Preview)';
  return 'HMS Patient Portal';
};

const getBundleId = () => {
  if (IS_DEV) return 'com.hms.patientportal.dev';
  if (IS_PREVIEW) return 'com.hms.patientportal.preview';
  return 'com.hms.patientportal';
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
