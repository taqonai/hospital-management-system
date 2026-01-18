const { withAndroidManifest, withPlugins, AndroidConfig } = require('expo/config-plugins');

/**
 * Expo config plugin for @amad/health-platform
 *
 * This plugin configures:
 * - Health Connect permissions in AndroidManifest.xml
 * - Intent filters for Health Connect
 * - Privacy policy URL for Health Connect
 */

const withHealthPlatform = (config) => {
  return withPlugins(config, [
    withHealthConnectPermissions,
    withHealthConnectIntentFilters,
  ]);
};

/**
 * Add Health Connect permissions to AndroidManifest.xml
 */
const withHealthConnectPermissions = (config) => {
  return withAndroidManifest(config, async (config) => {
    const manifest = config.modResults.manifest;

    // Ensure permissions array exists
    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }

    const healthPermissions = [
      'android.permission.health.READ_STEPS',
      'android.permission.health.READ_HEART_RATE',
      'android.permission.health.READ_RESTING_HEART_RATE',
      'android.permission.health.READ_HEART_RATE_VARIABILITY',
      'android.permission.health.READ_OXYGEN_SATURATION',
      'android.permission.health.READ_BLOOD_PRESSURE',
      'android.permission.health.READ_BLOOD_GLUCOSE',
      'android.permission.health.READ_WEIGHT',
      'android.permission.health.READ_BODY_TEMPERATURE',
      'android.permission.health.READ_ACTIVE_CALORIES_BURNED',
      'android.permission.health.READ_DISTANCE',
      'android.permission.health.READ_RESPIRATORY_RATE',
      'android.permission.health.READ_SLEEP',
      'android.permission.health.READ_EXERCISE',
    ];

    // Add permissions that don't already exist
    healthPermissions.forEach((permission) => {
      const exists = manifest['uses-permission'].some(
        (p) => p.$['android:name'] === permission
      );
      if (!exists) {
        manifest['uses-permission'].push({
          $: { 'android:name': permission },
        });
      }
    });

    // Add queries for Health Connect package
    if (!manifest.queries) {
      manifest.queries = [];
    }

    const queriesObj = manifest.queries[0] || {};
    if (!queriesObj.package) {
      queriesObj.package = [];
    }

    const healthConnectPackageExists = queriesObj.package.some(
      (p) => p.$['android:name'] === 'com.google.android.apps.healthdata'
    );

    if (!healthConnectPackageExists) {
      queriesObj.package.push({
        $: { 'android:name': 'com.google.android.apps.healthdata' },
      });
    }

    if (manifest.queries.length === 0) {
      manifest.queries.push(queriesObj);
    } else {
      manifest.queries[0] = queriesObj;
    }

    return config;
  });
};

/**
 * Add Health Connect intent filters and metadata
 */
const withHealthConnectIntentFilters = (config) => {
  return withAndroidManifest(config, async (config) => {
    const manifest = config.modResults.manifest;
    const application = manifest.application?.[0];

    if (!application) {
      return config;
    }

    // Add metadata for health permissions privacy policy
    if (!application['meta-data']) {
      application['meta-data'] = [];
    }

    const privacyPolicyExists = application['meta-data'].some(
      (m) => m.$['android:name'] === 'health_permissions_privacy_policy_url'
    );

    if (!privacyPolicyExists) {
      application['meta-data'].push({
        $: {
          'android:name': 'health_permissions_privacy_policy_url',
          'android:value': 'https://taqon.ai/privacy-policy',
        },
      });
    }

    // Add activity for showing permissions rationale
    if (!application.activity) {
      application.activity = [];
    }

    const rationaleActivityName = 'androidx.health.connect.client.permission.HealthPermissionRequest';
    const rationaleActivityExists = application.activity.some(
      (a) => a.$['android:name'] === rationaleActivityName
    );

    if (!rationaleActivityExists) {
      application.activity.push({
        $: {
          'android:name': rationaleActivityName,
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [
              {
                $: { 'android:name': 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE' },
              },
            ],
          },
        ],
      });
    }

    return config;
  });
};

module.exports = withHealthPlatform;
