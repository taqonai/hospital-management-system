import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { secureStorage } from '../storage/secureStorage';

// Configure how notifications should be displayed when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface PushNotificationData {
  type: 'APPOINTMENT_REMINDER' | 'LAB_RESULT' | 'PRESCRIPTION_REMINDER' | 'MESSAGE' | 'BILL_DUE' | 'GENERAL';
  title: string;
  body: string;
  data?: Record<string, any>;
}

export type NotificationResponseHandler = (notification: Notifications.NotificationResponse) => void;

class PushNotificationService {
  private notificationListener: Notifications.Subscription | null = null;
  private responseListener: Notifications.Subscription | null = null;
  private responseHandler: NotificationResponseHandler | null = null;

  /**
   * Initialize push notifications
   * Call this on app startup
   */
  async initialize(): Promise<string | null> {
    // Check if we're on a physical device
    if (!Device.isDevice) {
      console.log('Push notifications require a physical device');
      return null;
    }

    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permission not granted');
      return null;
    }

    // Configure Android notification channel
    if (Platform.OS === 'android') {
      await this.setupAndroidChannel();
    }

    // Get push token
    try {
      const token = await this.getExpoPushToken();
      if (token) {
        await secureStorage.setPushToken(token);
      }
      return token;
    } catch (error) {
      console.error('Failed to get push token:', error);
      return null;
    }
  }

  /**
   * Get the Expo push token
   */
  private async getExpoPushToken(): Promise<string | null> {
    try {
      const { data: token } = await Notifications.getExpoPushTokenAsync({
        projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
      });
      return token;
    } catch (error) {
      console.error('Failed to get Expo push token:', error);
      return null;
    }
  }

  /**
   * Setup Android notification channel
   */
  private async setupAndroidChannel(): Promise<void> {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0891B2', // Primary color
    });

    // Channel for appointment reminders
    await Notifications.setNotificationChannelAsync('appointments', {
      name: 'Appointment Reminders',
      description: 'Reminders for upcoming appointments',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0891B2',
    });

    // Channel for lab results
    await Notifications.setNotificationChannelAsync('lab-results', {
      name: 'Lab Results',
      description: 'Notifications when lab results are ready',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#10B981', // Success color
    });

    // Channel for medication reminders
    await Notifications.setNotificationChannelAsync('medications', {
      name: 'Medication Reminders',
      description: 'Reminders to take your medications',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 500, 250, 500],
      lightColor: '#F59E0B', // Warning color
    });
  }

  /**
   * Add listener for incoming notifications (when app is in foreground)
   */
  addNotificationReceivedListener(
    callback: (notification: Notifications.Notification) => void
  ): void {
    this.notificationListener = Notifications.addNotificationReceivedListener(callback);
  }

  /**
   * Add listener for notification responses (when user taps notification)
   */
  addNotificationResponseListener(callback: NotificationResponseHandler): void {
    this.responseHandler = callback;
    this.responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      if (this.responseHandler) {
        this.responseHandler(response);
      }
    });
  }

  /**
   * Remove all notification listeners
   */
  removeListeners(): void {
    if (this.notificationListener) {
      this.notificationListener.remove();
      this.notificationListener = null;
    }
    if (this.responseListener) {
      this.responseListener.remove();
      this.responseListener = null;
    }
  }

  /**
   * Get the last notification response (for handling app opened from notification)
   */
  async getLastNotificationResponse(): Promise<Notifications.NotificationResponse | null> {
    return Notifications.getLastNotificationResponseAsync();
  }

  /**
   * Schedule a local notification
   */
  async scheduleLocalNotification(
    title: string,
    body: string,
    trigger: Notifications.NotificationTriggerInput,
    data?: Record<string, any>,
    channelId?: string
  ): Promise<string> {
    return Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
        ...(Platform.OS === 'android' && channelId ? { channelId } : {}),
      },
      trigger,
    });
  }

  /**
   * Schedule an appointment reminder
   */
  async scheduleAppointmentReminder(
    appointmentId: string,
    doctorName: string,
    appointmentDate: Date,
    reminderMinutesBefore: number = 60
  ): Promise<string | null> {
    const reminderDate = new Date(appointmentDate.getTime() - reminderMinutesBefore * 60 * 1000);

    // Don't schedule if reminder time has already passed
    if (reminderDate <= new Date()) {
      return null;
    }

    return this.scheduleLocalNotification(
      'Appointment Reminder',
      `Your appointment with Dr. ${doctorName} is in ${reminderMinutesBefore} minutes`,
      { type: SchedulableTriggerInputTypes.DATE, date: reminderDate },
      { type: 'APPOINTMENT_REMINDER', appointmentId },
      'appointments'
    );
  }

  /**
   * Schedule a medication reminder
   */
  async scheduleMedicationReminder(
    prescriptionId: string,
    medicationName: string,
    scheduledTime: Date
  ): Promise<string> {
    return this.scheduleLocalNotification(
      'Medication Reminder',
      `Time to take your ${medicationName}`,
      { type: SchedulableTriggerInputTypes.DATE, date: scheduledTime },
      { type: 'PRESCRIPTION_REMINDER', prescriptionId },
      'medications'
    );
  }

  /**
   * Cancel a scheduled notification
   */
  async cancelNotification(notificationId: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  }

  /**
   * Cancel all scheduled notifications
   */
  async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  /**
   * Get all scheduled notifications
   */
  async getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    return Notifications.getAllScheduledNotificationsAsync();
  }

  /**
   * Set badge count (iOS only)
   */
  async setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count);
  }

  /**
   * Get current badge count
   */
  async getBadgeCount(): Promise<number> {
    return Notifications.getBadgeCountAsync();
  }

  /**
   * Dismiss all notifications from notification center
   */
  async dismissAllNotifications(): Promise<void> {
    await Notifications.dismissAllNotificationsAsync();
  }
}

// Export singleton instance
export const pushNotificationService = new PushNotificationService();

// Export types for navigation
export type NotificationType = PushNotificationData['type'];

/**
 * Helper function to handle notification navigation
 * Call this from your navigation container
 */
export function getNotificationNavigationTarget(
  notification: Notifications.NotificationResponse
): { screen: string; params?: Record<string, any> } | null {
  const data = notification.notification.request.content.data as PushNotificationData['data'] & { type?: string };

  if (!data?.type) return null;

  switch (data.type) {
    case 'APPOINTMENT_REMINDER':
      return {
        screen: 'AppointmentDetail',
        params: { appointmentId: data.appointmentId },
      };
    case 'LAB_RESULT':
      return {
        screen: 'LabResultDetail',
        params: { resultId: data.resultId },
      };
    case 'PRESCRIPTION_REMINDER':
      return {
        screen: 'PrescriptionDetail',
        params: { prescriptionId: data.prescriptionId },
      };
    case 'MESSAGE':
      return {
        screen: 'Messages',
        params: { messageId: data.messageId },
      };
    case 'BILL_DUE':
      return {
        screen: 'BillDetail',
        params: { billId: data.billId },
      };
    default:
      return { screen: 'Dashboard' };
  }
}
