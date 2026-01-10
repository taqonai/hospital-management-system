import { Platform, NativeModules } from 'react-native';

/**
 * Screen security utilities for HIPAA compliance
 *
 * On Android, this prevents screenshots and screen recording
 * by setting FLAG_SECURE on the window.
 *
 * On iOS, screenshot protection is more limited, but we can
 * detect when screenshots are taken.
 */

// For Android FLAG_SECURE implementation, we need a native module
// This is a placeholder that can be implemented with a custom native module

interface ScreenSecurityModule {
  enableSecureMode: () => Promise<void>;
  disableSecureMode: () => Promise<void>;
}

// Check if native module is available
const ScreenSecurityNative = NativeModules.ScreenSecurity as ScreenSecurityModule | undefined;

/**
 * Enable secure mode to prevent screenshots and screen recording
 *
 * Note: Full implementation requires a native module for Android.
 * This function provides the interface and logs when native module is not available.
 */
export const enableScreenSecurity = async (): Promise<void> => {
  if (Platform.OS === 'android') {
    if (ScreenSecurityNative?.enableSecureMode) {
      try {
        await ScreenSecurityNative.enableSecureMode();
        console.log('Screen security enabled');
      } catch (error) {
        console.error('Failed to enable screen security:', error);
      }
    } else {
      // Native module not available - log warning in production
      console.log('Screen security native module not available. To enable FLAG_SECURE on Android:');
      console.log('1. Create a native module that sets FLAG_SECURE on MainActivity');
      console.log('2. Or use expo-screen-capture package for Expo managed workflow');
    }
  } else if (Platform.OS === 'ios') {
    // iOS doesn't support preventing screenshots at the system level
    // We can only detect when they happen using addScreenshotListener
    console.log('iOS: Screenshot prevention not supported. Consider using screenshot detection.');
  }
};

/**
 * Disable secure mode to allow screenshots and screen recording
 */
export const disableScreenSecurity = async (): Promise<void> => {
  if (Platform.OS === 'android' && ScreenSecurityNative?.disableSecureMode) {
    try {
      await ScreenSecurityNative.disableSecureMode();
      console.log('Screen security disabled');
    } catch (error) {
      console.error('Failed to disable screen security:', error);
    }
  }
};

/**
 * Check if screen security is supported on this platform
 */
export const isScreenSecuritySupported = (): boolean => {
  if (Platform.OS === 'android') {
    return ScreenSecurityNative?.enableSecureMode !== undefined;
  }
  return false;
};

export default {
  enableScreenSecurity,
  disableScreenSecurity,
  isScreenSecuritySupported,
};
