import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from './useAuth';

const BIOMETRIC_LOCK_KEY = 'biometricLockEnabled';
const BACKGROUND_THRESHOLD_MS = 30 * 1000; // 30 seconds - require auth after this

interface UseAppLockReturn {
  isLocked: boolean;
  isBiometricEnabled: boolean;
  isInitialized: boolean;
  unlockWithBiometric: () => Promise<boolean>;
  enableBiometricLock: () => Promise<void>;
  disableBiometricLock: () => Promise<void>;
  toggleBiometricLock: () => Promise<void>;
}

export const useAppLock = (): UseAppLockReturn => {
  const { isAuthenticated } = useAuth();
  const [isLocked, setIsLocked] = useState(false);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const backgroundTimeRef = useRef<number | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Load biometric lock preference
  useEffect(() => {
    const loadBiometricPreference = async () => {
      try {
        const enabled = await SecureStore.getItemAsync(BIOMETRIC_LOCK_KEY);
        setIsBiometricEnabled(enabled === 'true');
      } catch (error) {
        console.error('Failed to load biometric preference:', error);
      } finally {
        setIsInitialized(true);
      }
    };

    loadBiometricPreference();
  }, []);

  // Handle app state changes for biometric lock
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (!isAuthenticated || !isBiometricEnabled) {
        appStateRef.current = nextAppState;
        return;
      }

      if (nextAppState.match(/inactive|background/)) {
        // App going to background - record timestamp
        backgroundTimeRef.current = Date.now();
      } else if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App coming to foreground
        if (backgroundTimeRef.current) {
          const timeInBackground = Date.now() - backgroundTimeRef.current;

          if (timeInBackground >= BACKGROUND_THRESHOLD_MS) {
            // Was in background long enough - require authentication
            setIsLocked(true);
          }
        }
        backgroundTimeRef.current = null;
      }

      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated, isBiometricEnabled]);

  const unlockWithBiometric = useCallback(async (): Promise<boolean> => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) {
        // No biometric hardware - just unlock
        setIsLocked(false);
        return true;
      }

      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!isEnrolled) {
        // No biometrics enrolled - just unlock
        setIsLocked(false);
        return true;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access your health data',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
        fallbackLabel: 'Use passcode',
      });

      if (result.success) {
        setIsLocked(false);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Biometric authentication error:', error);
      return false;
    }
  }, []);

  const enableBiometricLock = useCallback(async () => {
    try {
      // First verify biometric is available
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        throw new Error('Biometric authentication is not available');
      }

      // Verify with biometric before enabling
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to enable biometric lock',
        cancelLabel: 'Cancel',
      });

      if (result.success) {
        await SecureStore.setItemAsync(BIOMETRIC_LOCK_KEY, 'true');
        setIsBiometricEnabled(true);
      }
    } catch (error) {
      console.error('Failed to enable biometric lock:', error);
      throw error;
    }
  }, []);

  const disableBiometricLock = useCallback(async () => {
    try {
      await SecureStore.setItemAsync(BIOMETRIC_LOCK_KEY, 'false');
      setIsBiometricEnabled(false);
      setIsLocked(false);
    } catch (error) {
      console.error('Failed to disable biometric lock:', error);
      throw error;
    }
  }, []);

  const toggleBiometricLock = useCallback(async () => {
    if (isBiometricEnabled) {
      await disableBiometricLock();
    } else {
      await enableBiometricLock();
    }
  }, [isBiometricEnabled, enableBiometricLock, disableBiometricLock]);

  return {
    isLocked,
    isBiometricEnabled,
    isInitialized,
    unlockWithBiometric,
    enableBiometricLock,
    disableBiometricLock,
    toggleBiometricLock,
  };
};

export default useAppLock;
