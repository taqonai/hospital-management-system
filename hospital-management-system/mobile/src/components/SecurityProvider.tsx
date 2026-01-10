import React, { createContext, useContext, useEffect, useRef, useCallback, useState } from 'react';
import { AppState, AppStateStatus, PanResponder, View, StyleSheet, Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../hooks/useAuth';
import { useAppLock } from '../hooks/useAppLock';
import LockScreen from './LockScreen';
import { enableScreenSecurity } from '../utils/screenSecurity';

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const BACKGROUND_LOCK_THRESHOLD_MS = 30 * 1000; // 30 seconds

interface SecurityContextType {
  resetActivityTimer: () => void;
  isLocked: boolean;
  isBiometricLockEnabled: boolean;
  toggleBiometricLock: () => Promise<void>;
  lastActivityTime: number;
}

const SecurityContext = createContext<SecurityContextType>({
  resetActivityTimer: () => {},
  isLocked: false,
  isBiometricLockEnabled: false,
  toggleBiometricLock: async () => {},
  lastActivityTime: Date.now(),
});

export const useSecurity = () => useContext(SecurityContext);

interface SecurityProviderProps {
  children: React.ReactNode;
}

export const SecurityProvider: React.FC<SecurityProviderProps> = ({ children }) => {
  const { isAuthenticated, logout } = useAuth();
  const {
    isLocked,
    isBiometricEnabled,
    unlockWithBiometric,
    toggleBiometricLock,
  } = useAppLock();

  const [internalLocked, setInternalLocked] = useState(false);
  const [lastActivityTime, setLastActivityTime] = useState(Date.now());

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const backgroundTimeRef = useRef<number | null>(null);

  // Combined lock state
  const isAppLocked = isLocked || internalLocked;

  // Clear the inactivity timer
  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Handle inactivity timeout
  const handleInactivityTimeout = useCallback(() => {
    console.log('Inactivity timeout - logging out user');
    Alert.alert(
      'Session Expired',
      'You have been logged out due to inactivity.',
      [{ text: 'OK' }]
    );
    logout();
  }, [logout]);

  // Start the inactivity timer
  const startTimer = useCallback(() => {
    clearTimer();
    if (isAuthenticated && !isAppLocked) {
      timeoutRef.current = setTimeout(handleInactivityTimeout, INACTIVITY_TIMEOUT_MS);
    }
  }, [clearTimer, isAuthenticated, isAppLocked, handleInactivityTimeout]);

  // Reset activity timer (called on user interaction)
  const resetActivityTimer = useCallback(() => {
    setLastActivityTime(Date.now());
    startTimer();
  }, [startTimer]);

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (!isAuthenticated) {
        appStateRef.current = nextAppState;
        return;
      }

      if (nextAppState.match(/inactive|background/)) {
        // App going to background
        backgroundTimeRef.current = Date.now();
        clearTimer();
      } else if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App coming to foreground
        const now = Date.now();

        if (backgroundTimeRef.current) {
          const timeInBackground = now - backgroundTimeRef.current;
          const timeSinceLastActivity = now - lastActivityTime;

          // Check for inactivity timeout
          if (timeSinceLastActivity >= INACTIVITY_TIMEOUT_MS) {
            handleInactivityTimeout();
            backgroundTimeRef.current = null;
            appStateRef.current = nextAppState;
            return;
          }

          // Check for biometric lock threshold
          if (isBiometricEnabled && timeInBackground >= BACKGROUND_LOCK_THRESHOLD_MS) {
            setInternalLocked(true);
          } else {
            // Resume timer with remaining time
            const remainingTime = INACTIVITY_TIMEOUT_MS - timeSinceLastActivity;
            clearTimer();
            if (remainingTime > 0) {
              timeoutRef.current = setTimeout(handleInactivityTimeout, remainingTime);
            }
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
  }, [
    isAuthenticated,
    isBiometricEnabled,
    lastActivityTime,
    clearTimer,
    handleInactivityTimeout,
  ]);

  // Start/stop timer based on auth state
  useEffect(() => {
    if (isAuthenticated && !isAppLocked) {
      startTimer();
    } else {
      clearTimer();
    }

    return () => {
      clearTimer();
    };
  }, [isAuthenticated, isAppLocked, startTimer, clearTimer]);

  // Enable screen security when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      enableScreenSecurity();
    }
  }, [isAuthenticated]);

  // Handle unlock
  const handleUnlock = useCallback(async () => {
    const success = await unlockWithBiometric();
    if (success) {
      setInternalLocked(false);
      resetActivityTimer();
    }
  }, [unlockWithBiometric, resetActivityTimer]);

  // Handle logout from lock screen
  const handleLogout = useCallback(() => {
    setInternalLocked(false);
    logout();
  }, [logout]);

  // Create pan responder to detect user activity
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => {
        resetActivityTimer();
        return false; // Don't capture the touch
      },
      onMoveShouldSetPanResponder: () => false,
    })
  ).current;

  const contextValue: SecurityContextType = {
    resetActivityTimer,
    isLocked: isAppLocked,
    isBiometricLockEnabled: isBiometricEnabled,
    toggleBiometricLock,
    lastActivityTime,
  };

  // Show lock screen if locked
  if (isAuthenticated && isAppLocked) {
    return (
      <SecurityContext.Provider value={contextValue}>
        <LockScreen onUnlock={handleUnlock} onLogout={handleLogout} />
      </SecurityContext.Provider>
    );
  }

  return (
    <SecurityContext.Provider value={contextValue}>
      <View style={styles.container} {...panResponder.panHandlers}>
        {children}
      </View>
    </SecurityContext.Provider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default SecurityProvider;
