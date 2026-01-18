import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';
import { secureStorage } from '../securestore/secureStorage';

export type BiometricType = 'fingerprint' | 'facial' | 'iris' | 'none';

export interface BiometricStatus {
  isAvailable: boolean;
  isEnrolled: boolean;
  biometricType: BiometricType;
  supportedTypes: LocalAuthentication.AuthenticationType[];
}

export const biometricService = {
  /**
   * Check if biometric authentication is available on the device
   */
  async checkAvailability(): Promise<BiometricStatus> {
    const isAvailable = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

    let biometricType: BiometricType = 'none';

    if (isAvailable && isEnrolled && supportedTypes.length > 0) {
      // Determine the primary biometric type
      if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        biometricType = 'facial';
      } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        biometricType = 'fingerprint';
      } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        biometricType = 'iris';
      }
    }

    return {
      isAvailable,
      isEnrolled,
      biometricType,
      supportedTypes,
    };
  },

  /**
   * Get a friendly name for the biometric type
   */
  getBiometricDisplayName(type: BiometricType): string {
    switch (type) {
      case 'facial':
        return Platform.OS === 'ios' ? 'Face ID' : 'Face Recognition';
      case 'fingerprint':
        return Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint';
      case 'iris':
        return 'Iris Recognition';
      default:
        return 'Biometric';
    }
  },

  /**
   * Get the icon name for the biometric type
   */
  getBiometricIcon(type: BiometricType): string {
    switch (type) {
      case 'facial':
        return 'scan-outline';
      case 'fingerprint':
        return 'finger-print-outline';
      case 'iris':
        return 'eye-outline';
      default:
        return 'finger-print-outline';
    }
  },

  /**
   * Authenticate user with biometrics
   */
  async authenticate(
    promptMessage?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const status = await this.checkAvailability();

      if (!status.isAvailable) {
        return { success: false, error: 'Biometric authentication is not available on this device' };
      }

      if (!status.isEnrolled) {
        return { success: false, error: 'No biometric credentials are enrolled' };
      }

      const displayName = this.getBiometricDisplayName(status.biometricType);
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: promptMessage || `Login with ${displayName}`,
        cancelLabel: 'Cancel',
        disableDeviceFallback: false, // Allow PIN/password fallback
        fallbackLabel: 'Use Passcode',
      });

      if (result.success) {
        return { success: true };
      } else {
        let errorMessage = 'Authentication failed';
        if (result.error === 'user_cancel') {
          errorMessage = 'Authentication cancelled';
        } else if (result.error === 'user_fallback') {
          errorMessage = 'User chose passcode';
        } else if (result.error === 'lockout') {
          errorMessage = 'Too many attempts. Please try again later';
        }
        return { success: false, error: errorMessage };
      }
    } catch (error) {
      return { success: false, error: 'Authentication error occurred' };
    }
  },

  /**
   * Check if biometric login is enabled for this user
   */
  async isBiometricLoginEnabled(): Promise<boolean> {
    const isEnabled = await secureStorage.isBiometricEnabled();
    if (!isEnabled) return false;

    // Also check if we have stored credentials
    const hasToken = await secureStorage.getAccessToken();
    const hasUser = await secureStorage.getPatientUser();

    return isEnabled && hasToken !== null && hasUser !== null;
  },

  /**
   * Enable biometric login for the current user
   */
  async enableBiometricLogin(): Promise<{ success: boolean; error?: string }> {
    const status = await this.checkAvailability();

    if (!status.isAvailable || !status.isEnrolled) {
      return {
        success: false,
        error: 'Biometric authentication is not available. Please set up biometrics in your device settings.',
      };
    }

    // Verify the user wants to enable biometrics
    const authResult = await this.authenticate('Verify your identity to enable biometric login');

    if (!authResult.success) {
      return authResult;
    }

    await secureStorage.setBiometricEnabled(true);
    return { success: true };
  },

  /**
   * Disable biometric login
   */
  async disableBiometricLogin(): Promise<void> {
    await secureStorage.setBiometricEnabled(false);
  },

  /**
   * Perform biometric login - authenticates and returns stored session
   */
  async performBiometricLogin(): Promise<{
    success: boolean;
    error?: string;
  }> {
    const status = await this.checkAvailability();
    const displayName = this.getBiometricDisplayName(status.biometricType);

    const authResult = await this.authenticate(`Sign in with ${displayName}`);

    if (!authResult.success) {
      return authResult;
    }

    // Verify we have valid stored credentials
    const [token, user] = await Promise.all([
      secureStorage.getAccessToken(),
      secureStorage.getPatientUser(),
    ]);

    if (!token || !user) {
      return {
        success: false,
        error: 'No stored credentials found. Please sign in with your password first.',
      };
    }

    return { success: true };
  },
};
