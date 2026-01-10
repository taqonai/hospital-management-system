import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import {
  pushNotificationService,
  getNotificationNavigationTarget,
} from '../services/notifications';
import { patientPortalApi } from '../services/api';
import { useAppSelector, RootState } from '../store';

interface UsePushNotificationsResult {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
  isInitialized: boolean;
  error: string | null;
}

/**
 * Hook to initialize and handle push notifications
 * Use this in your root component (App.tsx or navigation container)
 */
export function usePushNotifications(): UsePushNotificationsResult {
  const navigation = useNavigation<any>();
  const { isAuthenticated } = useAppSelector((state: RootState) => state.auth);

  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  // Handle notification response (when user taps notification)
  const handleNotificationResponse = useCallback(
    (response: Notifications.NotificationResponse) => {
      const target = getNotificationNavigationTarget(response);
      if (target && navigation) {
        // Navigate to the appropriate screen
        navigation.navigate(target.screen, target.params);
      }
    },
    [navigation]
  );

  // Initialize push notifications
  useEffect(() => {
    const initialize = async () => {
      try {
        const token = await pushNotificationService.initialize();
        if (token) {
          setExpoPushToken(token);
        }
        setIsInitialized(true);
      } catch (err) {
        console.error('Failed to initialize push notifications:', err);
        setError('Failed to initialize push notifications');
        setIsInitialized(true);
      }
    };

    initialize();

    // Check if app was opened from a notification
    pushNotificationService.getLastNotificationResponse().then((response) => {
      if (response) {
        handleNotificationResponse(response);
      }
    });

    return () => {
      pushNotificationService.removeListeners();
    };
  }, []);

  // Set up notification listeners
  useEffect(() => {
    // Listener for notifications received while app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      setNotification(notification);
    });

    // Listener for when user taps on a notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse
    );

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [handleNotificationResponse]);

  // Register push token with backend when authenticated
  useEffect(() => {
    const registerToken = async () => {
      if (isAuthenticated && expoPushToken) {
        try {
          await patientPortalApi.registerPushToken(expoPushToken);
        } catch (err) {
          console.error('Failed to register push token with backend:', err);
        }
      }
    };

    registerToken();
  }, [isAuthenticated, expoPushToken]);

  return {
    expoPushToken,
    notification,
    isInitialized,
    error,
  };
}

/**
 * Hook for scheduling appointment reminders
 */
export function useAppointmentReminders() {
  const scheduleReminder = useCallback(
    async (
      appointmentId: string,
      doctorName: string,
      appointmentDate: Date,
      reminderMinutesBefore?: number
    ) => {
      return pushNotificationService.scheduleAppointmentReminder(
        appointmentId,
        doctorName,
        appointmentDate,
        reminderMinutesBefore
      );
    },
    []
  );

  const cancelReminder = useCallback(async (notificationId: string) => {
    return pushNotificationService.cancelNotification(notificationId);
  }, []);

  return { scheduleReminder, cancelReminder };
}

/**
 * Hook for scheduling medication reminders
 */
export function useMedicationReminders() {
  const scheduleReminder = useCallback(
    async (prescriptionId: string, medicationName: string, scheduledTime: Date) => {
      return pushNotificationService.scheduleMedicationReminder(
        prescriptionId,
        medicationName,
        scheduledTime
      );
    },
    []
  );

  const cancelReminder = useCallback(async (notificationId: string) => {
    return pushNotificationService.cancelNotification(notificationId);
  }, []);

  const cancelAllReminders = useCallback(async () => {
    return pushNotificationService.cancelAllNotifications();
  }, []);

  return { scheduleReminder, cancelReminder, cancelAllReminders };
}
