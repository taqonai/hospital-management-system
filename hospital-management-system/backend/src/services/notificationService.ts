import prisma from '../config/database';
import { NotFoundError } from '../middleware/errorHandler';
import { NotificationType } from '@prisma/client';

// Channel types for notification delivery
export type NotificationChannel = 'email' | 'sms' | 'whatsapp' | 'in_app';

// Notification priority levels
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

// Delivery status for tracking
export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'read';

// Notification delivery log entry
interface NotificationDeliveryLog {
  id: string;
  notificationId?: string;
  channel: NotificationChannel;
  recipient: string;
  status: DeliveryStatus;
  sentAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  failureReason?: string;
  retryCount: number;
  metadata?: Record<string, any>;
}

// User notification preferences
export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  inApp: boolean;
  quietHoursStart?: string; // HH:mm format
  quietHoursEnd?: string;   // HH:mm format
  enabledTypes: NotificationType[];
}

// Default preferences for new users
const DEFAULT_PREFERENCES: NotificationPreferences = {
  email: true,
  sms: true,
  whatsapp: false,
  inApp: true,
  enabledTypes: Object.values(NotificationType) as NotificationType[],
};

// In-memory storage for delivery logs (would be database table in production)
const deliveryLogs: Map<string, NotificationDeliveryLog> = new Map();

// In-memory storage for user preferences (would be in User model or separate table)
const userPreferences: Map<string, NotificationPreferences> = new Map();

// Background job queue (simple implementation, can be upgraded to Bull later)
interface BackgroundJob {
  id: string;
  type: string;
  data: any;
  scheduledAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retryCount: number;
  maxRetries: number;
}

const jobQueue: Map<string, BackgroundJob> = new Map();

// Import placeholders for channel services (to be created)
// These would be actual imports in production:
// import { emailService } from './emailService';
// import { smsService } from './smsService';
// import { whatsappService } from './whatsappService';

// Placeholder channel services (these will be replaced with actual implementations)
const emailService = {
  async send(to: string, subject: string, body: string, html?: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    console.log(`[EMAIL] Sending to ${to}: ${subject}`);
    // Simulated success - replace with actual email service implementation
    return { success: true, messageId: `email-${Date.now()}` };
  }
};

const smsService = {
  async send(phoneNumber: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    console.log(`[SMS] Sending to ${phoneNumber}: ${message.substring(0, 50)}...`);
    // Simulated success - replace with actual SMS service implementation
    return { success: true, messageId: `sms-${Date.now()}` };
  }
};

const whatsappService = {
  async send(phoneNumber: string, message: string, templateId?: string, hospitalId?: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    console.log(`[WHATSAPP] Sending to ${phoneNumber}: ${message.substring(0, 50)}...`);
    // Simulated success - replace with actual WhatsApp service implementation
    return { success: true, messageId: `wa-${Date.now()}` };
  }
};

// Notification data interfaces
export interface BaseNotificationData {
  title: string;
  message: string;
  priority?: NotificationPriority;
  metadata?: Record<string, any>;
}

export interface AppointmentNotificationData extends BaseNotificationData {
  appointmentId: string;
  patientName: string;
  doctorName: string;
  departmentName?: string;
  appointmentDate: Date;
  appointmentTime: string;
  type: 'SCHEDULED' | 'CONFIRMED' | 'REMINDER' | 'RESCHEDULED' | 'CANCELLED';
}

export interface LabResultNotificationData extends BaseNotificationData {
  labOrderId: string;
  orderNumber: string;
  patientName: string;
  testNames: string[];
  hasCriticalResults: boolean;
  hasAbnormalResults: boolean;
  resultsUrl?: string;
}

export interface BillingNotificationData extends BaseNotificationData {
  invoiceId: string;
  invoiceNumber: string;
  patientName: string;
  amount: number;
  currency?: string;
  dueDate?: Date;
  type: 'INVOICE_CREATED' | 'PAYMENT_RECEIVED' | 'PAYMENT_DUE' | 'PAYMENT_OVERDUE';
  paymentUrl?: string;
}

export interface EmergencyAlertData extends BaseNotificationData {
  alertType: 'CRITICAL_RESULT' | 'PATIENT_DETERIORATION' | 'CODE_BLUE' | 'SYSTEM_ALERT' | 'SECURITY';
  location?: string;
  patientId?: string;
  patientName?: string;
  actionRequired?: string;
  respondBy?: Date;
}

export interface OTPNotificationData {
  otp: string;
  purpose: 'LOGIN' | 'REGISTRATION' | 'PASSWORD_RESET' | 'VERIFICATION';
  expiresInMinutes: number;
}

export class NotificationService {
  // Generate unique ID for logs and jobs
  private generateId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
  }

  // ==================== USER PREFERENCES ====================

  /**
   * Get user notification preferences
   */
  async getUserPreferences(userId: string): Promise<NotificationPreferences> {
    // Check in-memory cache first
    if (userPreferences.has(userId)) {
      return userPreferences.get(userId)!;
    }

    // In production, this would fetch from database
    // For now, return default preferences
    const prefs = { ...DEFAULT_PREFERENCES };
    userPreferences.set(userId, prefs);
    return prefs;
  }

  /**
   * Update user notification preferences
   */
  async updateUserPreferences(userId: string, preferences: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    const currentPrefs = await this.getUserPreferences(userId);
    const updatedPrefs = { ...currentPrefs, ...preferences };
    userPreferences.set(userId, updatedPrefs);

    // In production, persist to database
    console.log(`[NOTIFICATION] Updated preferences for user ${userId}`);

    return updatedPrefs;
  }

  /**
   * Check if notification should be sent based on user preferences and quiet hours
   */
  private shouldSendNotification(
    preferences: NotificationPreferences,
    channel: NotificationChannel,
    type: NotificationType,
    priority: NotificationPriority = 'normal'
  ): boolean {
    // Always send urgent notifications
    if (priority === 'urgent') {
      return true;
    }

    // Check if notification type is enabled
    if (!preferences.enabledTypes.includes(type)) {
      return false;
    }

    // Check channel preference
    const channelEnabled = {
      email: preferences.email,
      sms: preferences.sms,
      whatsapp: preferences.whatsapp,
      in_app: preferences.inApp,
    }[channel];

    if (!channelEnabled) {
      return false;
    }

    // Check quiet hours (skip for high priority)
    if (priority !== 'high' && preferences.quietHoursStart && preferences.quietHoursEnd) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      if (currentTime >= preferences.quietHoursStart && currentTime <= preferences.quietHoursEnd) {
        return false;
      }
    }

    return true;
  }

  // ==================== DELIVERY LOGGING ====================

  /**
   * Log notification delivery attempt
   */
  private logDelivery(
    channel: NotificationChannel,
    recipient: string,
    status: DeliveryStatus,
    notificationId?: string,
    metadata?: Record<string, any>
  ): NotificationDeliveryLog {
    const log: NotificationDeliveryLog = {
      id: this.generateId(),
      notificationId,
      channel,
      recipient,
      status,
      sentAt: status === 'sent' || status === 'delivered' ? new Date() : undefined,
      deliveredAt: status === 'delivered' ? new Date() : undefined,
      failedAt: status === 'failed' ? new Date() : undefined,
      retryCount: 0,
      metadata,
    };

    deliveryLogs.set(log.id, log);
    console.log(`[NOTIFICATION LOG] ${channel.toUpperCase()} to ${recipient}: ${status}`);

    return log;
  }

  /**
   * Update delivery log status
   */
  private updateDeliveryLog(logId: string, updates: Partial<NotificationDeliveryLog>): void {
    const log = deliveryLogs.get(logId);
    if (log) {
      Object.assign(log, updates);
      deliveryLogs.set(logId, log);
    }
  }

  /**
   * Get delivery logs for a notification
   */
  async getDeliveryLogs(notificationId: string): Promise<NotificationDeliveryLog[]> {
    const logs: NotificationDeliveryLog[] = [];
    deliveryLogs.forEach((log) => {
      if (log.notificationId === notificationId) {
        logs.push(log);
      }
    });
    return logs;
  }

  // ==================== CHANNEL DELIVERY ====================

  /**
   * Send notification via email
   */
  private async sendEmail(
    to: string,
    subject: string,
    message: string,
    html?: string,
    notificationId?: string
  ): Promise<{ success: boolean; logId: string }> {
    const log = this.logDelivery('email', to, 'pending', notificationId);

    try {
      const result = await emailService.send(to, subject, message, html);

      if (result.success) {
        this.updateDeliveryLog(log.id, {
          status: 'sent',
          sentAt: new Date(),
          metadata: { messageId: result.messageId }
        });
        return { success: true, logId: log.id };
      } else {
        this.updateDeliveryLog(log.id, {
          status: 'failed',
          failedAt: new Date(),
          failureReason: result.error,
        });
        return { success: false, logId: log.id };
      }
    } catch (error: any) {
      this.updateDeliveryLog(log.id, {
        status: 'failed',
        failedAt: new Date(),
        failureReason: error.message,
      });
      console.error(`[EMAIL ERROR] Failed to send to ${to}:`, error.message);
      return { success: false, logId: log.id };
    }
  }

  /**
   * Send notification via SMS
   */
  private async sendSMS(
    phoneNumber: string,
    message: string,
    notificationId?: string,
    hospitalId?: string
  ): Promise<{ success: boolean; logId: string }> {
    const log = this.logDelivery('sms', phoneNumber, 'pending', notificationId);

    try {
      const result = await smsService.send(phoneNumber, message);

      if (result.success) {
        this.updateDeliveryLog(log.id, {
          status: 'sent',
          sentAt: new Date(),
          metadata: { messageId: result.messageId }
        });
        return { success: true, logId: log.id };
      } else {
        this.updateDeliveryLog(log.id, {
          status: 'failed',
          failedAt: new Date(),
          failureReason: result.error,
        });
        return { success: false, logId: log.id };
      }
    } catch (error: any) {
      this.updateDeliveryLog(log.id, {
        status: 'failed',
        failedAt: new Date(),
        failureReason: error.message,
      });
      console.error(`[SMS ERROR] Failed to send to ${phoneNumber}:`, error.message);
      return { success: false, logId: log.id };
    }
  }

  /**
   * Send notification via WhatsApp
   */
  private async sendWhatsApp(
    phoneNumber: string,
    message: string,
    templateId?: string,
    notificationId?: string,
    hospitalId?: string
  ): Promise<{ success: boolean; logId: string }> {
    const log = this.logDelivery('whatsapp', phoneNumber, 'pending', notificationId);

    try {
      const result = await whatsappService.send(phoneNumber, message, templateId, hospitalId);

      if (result.success) {
        this.updateDeliveryLog(log.id, {
          status: 'sent',
          sentAt: new Date(),
          metadata: { messageId: result.messageId, templateId }
        });
        return { success: true, logId: log.id };
      } else {
        this.updateDeliveryLog(log.id, {
          status: 'failed',
          failedAt: new Date(),
          failureReason: result.error,
        });
        return { success: false, logId: log.id };
      }
    } catch (error: any) {
      this.updateDeliveryLog(log.id, {
        status: 'failed',
        failedAt: new Date(),
        failureReason: error.message,
      });
      console.error(`[WHATSAPP ERROR] Failed to send to ${phoneNumber}:`, error.message);
      return { success: false, logId: log.id };
    }
  }

  /**
   * Create in-app notification
   */
  private async createInAppNotification(
    userId: string,
    title: string,
    message: string,
    type: NotificationType,
    data?: Record<string, any>
  ): Promise<{ success: boolean; notificationId: string }> {
    try {
      const notification = await prisma.notification.create({
        data: {
          userId,
          title,
          message,
          type,
          data: data || {},
        },
      });

      this.logDelivery('in_app', userId, 'delivered', notification.id);
      return { success: true, notificationId: notification.id };
    } catch (error: any) {
      console.error(`[IN-APP ERROR] Failed to create notification for ${userId}:`, error.message);
      return { success: false, notificationId: '' };
    }
  }

  // ==================== BACKGROUND JOBS ====================

  /**
   * Schedule a background job (using setTimeout for now, upgrade to Bull later)
   */
  private scheduleJob(
    type: string,
    data: any,
    delayMs: number = 0,
    maxRetries: number = 3
  ): string {
    const jobId = this.generateId();
    const job: BackgroundJob = {
      id: jobId,
      type,
      data,
      scheduledAt: new Date(Date.now() + delayMs),
      status: 'pending',
      retryCount: 0,
      maxRetries,
    };

    jobQueue.set(jobId, job);

    setTimeout(async () => {
      await this.processJob(jobId);
    }, delayMs);

    console.log(`[JOB SCHEDULED] ${type} (${jobId}) - delay: ${delayMs}ms`);
    return jobId;
  }

  /**
   * Process a background job
   */
  private async processJob(jobId: string): Promise<void> {
    const job = jobQueue.get(jobId);
    if (!job || job.status !== 'pending') return;

    job.status = 'processing';
    jobQueue.set(jobId, job);

    try {
      switch (job.type) {
        case 'send_notification':
          await this.sendNotification(
            job.data.userId,
            job.data.type,
            job.data.data,
            job.data.channels
          );
          break;
        case 'send_reminder':
          await this.sendAppointmentReminder(job.data);
          break;
        default:
          console.warn(`[JOB] Unknown job type: ${job.type}`);
      }

      job.status = 'completed';
      jobQueue.set(jobId, job);
      console.log(`[JOB COMPLETED] ${job.type} (${jobId})`);
    } catch (error: any) {
      job.retryCount++;

      if (job.retryCount < job.maxRetries) {
        job.status = 'pending';
        jobQueue.set(jobId, job);

        // Exponential backoff for retries
        const retryDelay = Math.pow(2, job.retryCount) * 1000;
        setTimeout(() => this.processJob(jobId), retryDelay);
        console.log(`[JOB RETRY] ${job.type} (${jobId}) - attempt ${job.retryCount + 1}`);
      } else {
        job.status = 'failed';
        jobQueue.set(jobId, job);
        console.error(`[JOB FAILED] ${job.type} (${jobId}):`, error.message);
      }
    }
  }

  // ==================== MAIN NOTIFICATION METHODS ====================

  /**
   * Send notification to specified channels
   */
  async sendNotification(
    userId: string,
    type: NotificationType,
    data: BaseNotificationData,
    channels: NotificationChannel[]
  ): Promise<{
    success: boolean;
    results: { channel: NotificationChannel; success: boolean; error?: string }[];
    inAppNotificationId?: string;
  }> {
    const results: { channel: NotificationChannel; success: boolean; error?: string }[] = [];
    let inAppNotificationId: string | undefined;

    // Get user data with hospitalId for Twilio routing
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        hospitalId: true,
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const hospitalId = user.hospitalId;

    // Get user preferences
    const preferences = await this.getUserPreferences(userId);

    // Process each channel
    for (const channel of channels) {
      // Check if should send based on preferences
      if (!this.shouldSendNotification(preferences, channel, type, data.priority)) {
        results.push({ channel, success: false, error: 'Disabled by user preferences' });
        continue;
      }

      try {
        switch (channel) {
          case 'email':
            if (user.email) {
              const emailResult = await this.sendEmail(
                user.email,
                data.title,
                data.message,
                this.generateEmailHtml(data),
                inAppNotificationId
              );
              results.push({ channel, success: emailResult.success });
            } else {
              results.push({ channel, success: false, error: 'No email address' });
            }
            break;

          case 'sms':
            if (user.phone) {
              const smsResult = await this.sendSMS(
                user.phone,
                `${data.title}: ${data.message}`,
                inAppNotificationId,
                hospitalId
              );
              results.push({ channel, success: smsResult.success });
            } else {
              results.push({ channel, success: false, error: 'No phone number' });
            }
            break;

          case 'whatsapp':
            if (user.phone) {
              const waResult = await this.sendWhatsApp(
                user.phone,
                `*${data.title}*\n\n${data.message}`,
                undefined,
                inAppNotificationId,
                hospitalId
              );
              results.push({ channel, success: waResult.success });
            } else {
              results.push({ channel, success: false, error: 'No phone number' });
            }
            break;

          case 'in_app':
            const inAppResult = await this.createInAppNotification(
              userId,
              data.title,
              data.message,
              type,
              data.metadata
            );
            inAppNotificationId = inAppResult.notificationId;
            results.push({ channel, success: inAppResult.success });
            break;
        }
      } catch (error: any) {
        results.push({ channel, success: false, error: error.message });
        console.error(`[NOTIFICATION ERROR] ${channel} for user ${userId}:`, error.message);
      }
    }

    const success = results.some(r => r.success);
    return { success, results, inAppNotificationId };
  }

  /**
   * Generate HTML email content
   */
  private generateEmailHtml(data: BaseNotificationData): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #0066cc; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${data.title}</h1>
          </div>
          <div class="content">
            <p>${data.message}</p>
          </div>
          <div class="footer">
            <p>This is an automated message from Hospital Management System.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Send OTP notification for authentication
   */
  async sendOTPNotification(
    contact: string,
    otp: string,
    channel: 'email' | 'sms' | 'whatsapp',
    purpose: OTPNotificationData['purpose'] = 'LOGIN',
    hospitalId?: string
  ): Promise<{ success: boolean; error?: string }> {
    const purposeText = {
      LOGIN: 'login',
      REGISTRATION: 'registration',
      PASSWORD_RESET: 'password reset',
      VERIFICATION: 'verification',
    }[purpose];

    const message = `Your OTP for ${purposeText} is: ${otp}. This code will expire in 10 minutes. Do not share this code with anyone.`;
    const subject = `Your OTP Code for ${purposeText.charAt(0).toUpperCase() + purposeText.slice(1)}`;

    try {
      switch (channel) {
        case 'email':
          const emailResult = await this.sendEmail(contact, subject, message);
          return { success: emailResult.success };

        case 'sms':
          const smsResult = await this.sendSMS(contact, message, undefined, hospitalId);
          return { success: smsResult.success };

        case 'whatsapp':
          const waResult = await this.sendWhatsApp(contact, message, 'otp_template', undefined, hospitalId);
          return { success: waResult.success };

        default:
          return { success: false, error: 'Invalid channel' };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Send appointment notification
   */
  async sendAppointmentNotification(
    appointmentData: AppointmentNotificationData,
    notificationType: 'SCHEDULED' | 'CONFIRMED' | 'REMINDER' | 'RESCHEDULED' | 'CANCELLED'
  ): Promise<{ success: boolean; results: any[] }> {
    // Get patient and related data
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentData.appointmentId },
      include: {
        patient: {
          include: { user: true },
        },
        doctor: {
          include: {
            user: true,
            department: true,
          },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }

    const patientUser = appointment.patient.user;
    const results: any[] = [];

    // Prepare notification message based on type
    const messages = {
      SCHEDULED: {
        title: 'Appointment Scheduled',
        message: `Your appointment with Dr. ${appointment.doctor.user.firstName} ${appointment.doctor.user.lastName} has been scheduled for ${appointmentData.appointmentDate.toLocaleDateString()} at ${appointmentData.appointmentTime}.`,
      },
      CONFIRMED: {
        title: 'Appointment Confirmed',
        message: `Your appointment with Dr. ${appointment.doctor.user.firstName} ${appointment.doctor.user.lastName} on ${appointmentData.appointmentDate.toLocaleDateString()} at ${appointmentData.appointmentTime} has been confirmed.`,
      },
      REMINDER: {
        title: 'Appointment Reminder',
        message: `Reminder: You have an appointment with Dr. ${appointment.doctor.user.firstName} ${appointment.doctor.user.lastName} tomorrow at ${appointmentData.appointmentTime}. Please arrive 15 minutes early.`,
      },
      RESCHEDULED: {
        title: 'Appointment Rescheduled',
        message: `Your appointment with Dr. ${appointment.doctor.user.firstName} ${appointment.doctor.user.lastName} has been rescheduled to ${appointmentData.appointmentDate.toLocaleDateString()} at ${appointmentData.appointmentTime}.`,
      },
      CANCELLED: {
        title: 'Appointment Cancelled',
        message: `Your appointment with Dr. ${appointment.doctor.user.firstName} ${appointment.doctor.user.lastName} on ${appointmentData.appointmentDate.toLocaleDateString()} has been cancelled. Please contact us to reschedule.`,
      },
    };

    const notifData = messages[notificationType];

    // Send to patient if they have a user account
    if (patientUser) {
      const patientResult = await this.sendNotification(
        patientUser.id,
        NotificationType.APPOINTMENT,
        {
          title: notifData.title,
          message: notifData.message,
          priority: notificationType === 'CANCELLED' ? 'high' : 'normal',
          metadata: {
            appointmentId: appointment.id,
            appointmentType: notificationType,
            doctorName: `${appointment.doctor.user.firstName} ${appointment.doctor.user.lastName}`,
          },
        },
        ['email', 'sms', 'in_app']
      );
      results.push({ recipient: 'patient', ...patientResult });
    } else {
      // Send directly to patient phone/email without user account
      if (appointment.patient.phone) {
        const smsResult = await this.sendSMS(
          appointment.patient.phone,
          `${notifData.title}: ${notifData.message}`,
          undefined,
          appointment.hospitalId
        );
        results.push({ recipient: 'patient_phone', ...smsResult });
      }
      if (appointment.patient.email) {
        const emailResult = await this.sendEmail(
          appointment.patient.email,
          notifData.title,
          notifData.message
        );
        results.push({ recipient: 'patient_email', ...emailResult });
      }
    }

    // Also notify doctor for certain types
    if (['CANCELLED', 'RESCHEDULED'].includes(notificationType)) {
      const doctorResult = await this.sendNotification(
        appointment.doctor.user.id,
        NotificationType.APPOINTMENT,
        {
          title: `Patient ${notificationType.toLowerCase()}: ${appointment.patient.firstName} ${appointment.patient.lastName}`,
          message: `Appointment on ${appointmentData.appointmentDate.toLocaleDateString()} at ${appointmentData.appointmentTime} has been ${notificationType.toLowerCase()}.`,
          priority: 'normal',
          metadata: {
            appointmentId: appointment.id,
            patientId: appointment.patient.id,
          },
        },
        ['in_app']
      );
      results.push({ recipient: 'doctor', ...doctorResult });
    }

    return {
      success: results.some(r => r.success),
      results,
    };
  }

  /**
   * Send appointment reminder (helper for scheduled reminders)
   */
  private async sendAppointmentReminder(appointmentId: string): Promise<void> {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: true,
        doctor: {
          include: { user: true },
        },
      },
    });

    if (appointment && appointment.status === 'SCHEDULED') {
      await this.sendAppointmentNotification(
        {
          appointmentId: appointment.id,
          patientName: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
          doctorName: `${appointment.doctor.user.firstName} ${appointment.doctor.user.lastName}`,
          appointmentDate: appointment.appointmentDate,
          appointmentTime: appointment.startTime,
          title: 'Appointment Reminder',
          message: '',
          type: 'REMINDER',
        },
        'REMINDER'
      );
    }
  }

  /**
   * Schedule appointment reminder
   */
  scheduleAppointmentReminder(appointmentId: string, reminderTime: Date): string {
    const now = new Date();
    const delayMs = reminderTime.getTime() - now.getTime();

    if (delayMs <= 0) {
      console.warn(`[REMINDER] Reminder time is in the past for appointment ${appointmentId}`);
      return '';
    }

    return this.scheduleJob('send_reminder', appointmentId, delayMs);
  }

  /**
   * Send lab result notification
   */
  async sendLabResultNotification(
    labOrderData: LabResultNotificationData
  ): Promise<{ success: boolean; results: any[] }> {
    // Get lab order with patient and ordered by doctor
    const labOrder = await prisma.labOrder.findUnique({
      where: { id: labOrderData.labOrderId },
      include: {
        patient: {
          include: { user: true },
        },
        tests: {
          include: { labTest: true },
        },
      },
    });

    if (!labOrder) {
      throw new NotFoundError('Lab order not found');
    }

    const results: any[] = [];
    const priority: NotificationPriority = labOrderData.hasCriticalResults ? 'urgent' :
                                           labOrderData.hasAbnormalResults ? 'high' : 'normal';

    // Build message
    let message = `Lab results for order ${labOrderData.orderNumber} are now available.`;
    if (labOrderData.hasCriticalResults) {
      message = `CRITICAL: Lab results require immediate attention. ${message}`;
    } else if (labOrderData.hasAbnormalResults) {
      message = `Some abnormal results detected. ${message}`;
    }

    // Notify patient if they have a user account
    if (labOrder.patient.user) {
      const patientResult = await this.sendNotification(
        labOrder.patient.user.id,
        NotificationType.LAB_RESULT,
        {
          title: labOrderData.hasCriticalResults ? 'Critical Lab Results Available' : 'Lab Results Available',
          message,
          priority,
          metadata: {
            labOrderId: labOrder.id,
            orderNumber: labOrder.orderNumber,
            hasCritical: labOrderData.hasCriticalResults,
            hasAbnormal: labOrderData.hasAbnormalResults,
            testNames: labOrderData.testNames,
          },
        },
        labOrderData.hasCriticalResults ? ['email', 'sms', 'whatsapp', 'in_app'] : ['email', 'in_app']
      );
      results.push({ recipient: 'patient', ...patientResult });
    }

    // Notify ordering physician for critical results
    if (labOrderData.hasCriticalResults) {
      const orderedByUser = await prisma.user.findFirst({
        where: {
          OR: [
            { id: labOrder.orderedBy },
            { doctor: { id: labOrder.orderedBy } }
          ]
        },
      });

      if (orderedByUser) {
        const doctorResult = await this.sendNotification(
          orderedByUser.id,
          NotificationType.ALERT,
          {
            title: 'CRITICAL Lab Result',
            message: `Critical lab result for patient ${labOrder.patient.firstName} ${labOrder.patient.lastName}. Order: ${labOrder.orderNumber}. Immediate review required.`,
            priority: 'urgent',
            metadata: {
              labOrderId: labOrder.id,
              patientId: labOrder.patientId,
              patientName: `${labOrder.patient.firstName} ${labOrder.patient.lastName}`,
            },
          },
          ['sms', 'in_app']
        );
        results.push({ recipient: 'ordering_physician', ...doctorResult });
      }
    }

    return {
      success: results.some(r => r.success),
      results,
    };
  }

  /**
   * Send billing notification
   */
  async sendBillingNotification(
    billingData: BillingNotificationData
  ): Promise<{ success: boolean; results: any[] }> {
    // Get invoice with patient
    const invoice = await prisma.invoice.findUnique({
      where: { id: billingData.invoiceId },
      include: {
        patient: {
          include: { user: true },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    const results: any[] = [];

    // Build message based on notification type
    const messages = {
      INVOICE_CREATED: {
        title: 'New Invoice Generated',
        message: `A new invoice #${billingData.invoiceNumber} has been generated for ${billingData.currency || 'INR'} ${billingData.amount.toFixed(2)}.${billingData.dueDate ? ` Payment is due by ${billingData.dueDate.toLocaleDateString()}.` : ''}`,
      },
      PAYMENT_RECEIVED: {
        title: 'Payment Received',
        message: `Thank you! We have received your payment of ${billingData.currency || 'INR'} ${billingData.amount.toFixed(2)} for invoice #${billingData.invoiceNumber}.`,
      },
      PAYMENT_DUE: {
        title: 'Payment Reminder',
        message: `Reminder: Payment of ${billingData.currency || 'INR'} ${billingData.amount.toFixed(2)} for invoice #${billingData.invoiceNumber} is due${billingData.dueDate ? ` by ${billingData.dueDate.toLocaleDateString()}` : ' soon'}.`,
      },
      PAYMENT_OVERDUE: {
        title: 'Payment Overdue',
        message: `Your payment of ${billingData.currency || 'INR'} ${billingData.amount.toFixed(2)} for invoice #${billingData.invoiceNumber} is overdue. Please make the payment at your earliest convenience to avoid any service interruption.`,
      },
    };

    const notifData = messages[billingData.type];
    const priority: NotificationPriority = billingData.type === 'PAYMENT_OVERDUE' ? 'high' : 'normal';

    // Notify patient if they have a user account
    if (invoice.patient.user) {
      const patientResult = await this.sendNotification(
        invoice.patient.user.id,
        NotificationType.SYSTEM, // Using SYSTEM as there's no BILLING type in enum
        {
          title: notifData.title,
          message: notifData.message,
          priority,
          metadata: {
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            amount: Number(invoice.totalAmount),
            billingType: billingData.type,
          },
        },
        ['email', 'sms', 'in_app']
      );
      results.push({ recipient: 'patient', ...patientResult });
    } else {
      // Send directly to patient contact info
      if (invoice.patient.phone) {
        const smsResult = await this.sendSMS(
          invoice.patient.phone,
          `${notifData.title}: ${notifData.message}`,
          undefined,
          invoice.hospitalId
        );
        results.push({ recipient: 'patient_phone', ...smsResult });
      }
      if (invoice.patient.email) {
        const emailResult = await this.sendEmail(
          invoice.patient.email,
          notifData.title,
          notifData.message
        );
        results.push({ recipient: 'patient_email', ...emailResult });
      }
    }

    return {
      success: results.some(r => r.success),
      results,
    };
  }

  /**
   * Send emergency alert - high priority, all channels
   */
  async sendEmergencyAlert(
    alertData: EmergencyAlertData,
    recipientUserIds: string[]
  ): Promise<{ success: boolean; results: any[] }> {
    const results: any[] = [];

    // Emergency alerts go through all channels with urgent priority
    for (const userId of recipientUserIds) {
      try {
        const result = await this.sendNotification(
          userId,
          NotificationType.ALERT,
          {
            title: `EMERGENCY: ${alertData.title}`,
            message: alertData.message,
            priority: 'urgent',
            metadata: {
              alertType: alertData.alertType,
              location: alertData.location,
              patientId: alertData.patientId,
              patientName: alertData.patientName,
              actionRequired: alertData.actionRequired,
              respondBy: alertData.respondBy,
            },
          },
          ['email', 'sms', 'whatsapp', 'in_app']
        );
        results.push({ userId, ...result });
      } catch (error: any) {
        results.push({ userId, success: false, error: error.message });
      }
    }

    return {
      success: results.some(r => r.success),
      results,
    };
  }

  /**
   * Broadcast emergency alert to all staff in a hospital
   */
  async broadcastEmergencyAlert(
    hospitalId: string,
    alertData: EmergencyAlertData,
    targetRoles?: string[]
  ): Promise<{ success: boolean; recipientCount: number; results: any[] }> {
    // Get all active users in the hospital (optionally filtered by role)
    const whereClause: any = {
      hospitalId,
      isActive: true,
    };

    if (targetRoles && targetRoles.length > 0) {
      whereClause.role = { in: targetRoles };
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: { id: true },
    });

    const userIds = users.map(u => u.id);
    const result = await this.sendEmergencyAlert(alertData, userIds);

    return {
      ...result,
      recipientCount: userIds.length,
    };
  }

  // ==================== IN-APP NOTIFICATION MANAGEMENT ====================

  /**
   * Get user's in-app notifications
   */
  async getUserNotifications(
    userId: string,
    params: {
      page?: number;
      limit?: number;
      unreadOnly?: boolean;
      type?: NotificationType;
    } = {}
  ): Promise<{
    notifications: any[];
    total: number;
    unreadCount: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20, unreadOnly = false, type } = params;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (unreadOnly) where.isRead = false;
    if (type) where.type = type;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return { notifications, total, unreadCount, page, limit };
  }

  /**
   * Mark notification as read
   */
  async markNotificationRead(notificationId: string, userId?: string): Promise<any> {
    const where: any = { id: notificationId };
    if (userId) where.userId = userId;

    const notification = await prisma.notification.findFirst({ where });
    if (!notification) {
      throw new NotFoundError('Notification not found');
    }

    return prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllNotificationsRead(userId: string): Promise<{ count: number }> {
    const result = await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return { count: result.count };
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string, userId?: string): Promise<void> {
    const where: any = { id: notificationId };
    if (userId) where.userId = userId;

    const notification = await prisma.notification.findFirst({ where });
    if (!notification) {
      throw new NotFoundError('Notification not found');
    }

    await prisma.notification.delete({ where: { id: notificationId } });
  }

  /**
   * Delete old notifications (cleanup job)
   */
  async deleteOldNotifications(daysOld: number = 30): Promise<{ count: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await prisma.notification.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        isRead: true,
      },
    });

    console.log(`[CLEANUP] Deleted ${result.count} old notifications`);
    return { count: result.count };
  }

  // ==================== AI INSIGHT NOTIFICATIONS ====================

  /**
   * Send AI insight notification (for clinical decision support alerts)
   */
  async sendAIInsightNotification(
    userId: string,
    insightData: {
      insightType: 'DRUG_INTERACTION' | 'DIAGNOSIS_SUGGESTION' | 'RISK_ALERT' | 'RECOMMENDATION';
      title: string;
      message: string;
      confidence?: number;
      sourceModel?: string;
      relatedPatientId?: string;
      relatedRecordId?: string;
      actionItems?: string[];
    }
  ): Promise<{ success: boolean; notificationId?: string }> {
    const priority: NotificationPriority =
      insightData.insightType === 'DRUG_INTERACTION' || insightData.insightType === 'RISK_ALERT'
        ? 'high'
        : 'normal';

    const result = await this.sendNotification(
      userId,
      NotificationType.AI_INSIGHT,
      {
        title: `AI Insight: ${insightData.title}`,
        message: insightData.message,
        priority,
        metadata: {
          insightType: insightData.insightType,
          confidence: insightData.confidence,
          sourceModel: insightData.sourceModel,
          patientId: insightData.relatedPatientId,
          recordId: insightData.relatedRecordId,
          actionItems: insightData.actionItems,
        },
      },
      ['in_app'] // AI insights typically go to in-app only
    );

    return {
      success: result.success,
      notificationId: result.inAppNotificationId,
    };
  }

  // ==================== PRESCRIPTION NOTIFICATIONS ====================

  /**
   * Send prescription notification
   */
  async sendPrescriptionNotification(
    patientUserId: string,
    prescriptionData: {
      prescriptionId: string;
      doctorName: string;
      medicationCount: number;
      type: 'NEW' | 'REFILL_REMINDER' | 'EXPIRING' | 'READY_FOR_PICKUP';
    }
  ): Promise<{ success: boolean; results: any[] }> {
    const messages = {
      NEW: {
        title: 'New Prescription',
        message: `Dr. ${prescriptionData.doctorName} has prescribed ${prescriptionData.medicationCount} medication(s) for you. Please visit the pharmacy to collect your medications.`,
      },
      REFILL_REMINDER: {
        title: 'Prescription Refill Reminder',
        message: `Your prescription is running low. Please visit the pharmacy for a refill or contact your doctor if you need a new prescription.`,
      },
      EXPIRING: {
        title: 'Prescription Expiring Soon',
        message: `Your prescription will expire soon. Please contact Dr. ${prescriptionData.doctorName} if you need to renew it.`,
      },
      READY_FOR_PICKUP: {
        title: 'Prescription Ready',
        message: `Your prescription is ready for pickup at the pharmacy.`,
      },
    };

    const notifData = messages[prescriptionData.type];

    const result = await this.sendNotification(
      patientUserId,
      NotificationType.PRESCRIPTION,
      {
        title: notifData.title,
        message: notifData.message,
        priority: prescriptionData.type === 'NEW' ? 'high' : 'normal',
        metadata: {
          prescriptionId: prescriptionData.prescriptionId,
          prescriptionType: prescriptionData.type,
        },
      },
      ['email', 'sms', 'in_app']
    );

    return {
      success: result.success,
      results: result.results,
    };
  }
}

export const notificationService = new NotificationService();
