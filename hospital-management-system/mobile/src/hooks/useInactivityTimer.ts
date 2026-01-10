import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth } from './useAuth';

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

interface UseInactivityTimerOptions {
  onTimeout?: () => void;
  timeoutMs?: number;
  enabled?: boolean;
}

export const useInactivityTimer = (options: UseInactivityTimerOptions = {}) => {
  const {
    onTimeout,
    timeoutMs = INACTIVITY_TIMEOUT_MS,
    enabled = true,
  } = options;

  const { isAuthenticated, logout } = useAuth();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const handleTimeout = useCallback(() => {
    console.log('Inactivity timeout reached - logging out user');
    if (onTimeout) {
      onTimeout();
    } else {
      logout();
    }
  }, [onTimeout, logout]);

  const startTimer = useCallback(() => {
    clearTimer();
    if (enabled && isAuthenticated) {
      timeoutRef.current = setTimeout(handleTimeout, timeoutMs);
    }
  }, [clearTimer, enabled, isAuthenticated, handleTimeout, timeoutMs]);

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    startTimer();
  }, [startTimer]);

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has come to foreground
        const timeSinceLastActivity = Date.now() - lastActivityRef.current;

        if (timeSinceLastActivity >= timeoutMs) {
          // User was inactive for too long while app was in background
          handleTimeout();
        } else {
          // Resume timer with remaining time
          const remainingTime = timeoutMs - timeSinceLastActivity;
          clearTimer();
          if (enabled && isAuthenticated) {
            timeoutRef.current = setTimeout(handleTimeout, remainingTime);
          }
        }
      } else if (nextAppState.match(/inactive|background/)) {
        // App going to background - clear timer but keep last activity timestamp
        clearTimer();
      }

      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [clearTimer, enabled, handleTimeout, isAuthenticated, timeoutMs]);

  // Start timer when authenticated
  useEffect(() => {
    if (enabled && isAuthenticated) {
      startTimer();
    } else {
      clearTimer();
    }

    return () => {
      clearTimer();
    };
  }, [enabled, isAuthenticated, startTimer, clearTimer]);

  return {
    resetTimer,
    clearTimer,
    lastActivity: lastActivityRef.current,
  };
};

export default useInactivityTimer;
