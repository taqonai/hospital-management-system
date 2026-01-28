/**
 * Twilio Service - SMS and WhatsApp integration
 * 
 * This service handles sending SMS and WhatsApp messages via Twilio API.
 * Credentials are loaded per-hospital from NotificationSettings.
 */

import twilio from 'twilio';
import prisma from '../config/database';
import { DeliveryStatus } from '@prisma/client';

// Twilio client cache (per hospital)
const twilioClients: Map<string, twilio.Twilio> = new Map();

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
  whatsappNumber?: string;
}

export interface SendSMSParams {
  hospitalId: string;
  to: string;
  message: string;
  teamContactId?: string;
  notificationId?: string;
}

export interface SendWhatsAppParams {
  hospitalId: string;
  to: string;
  message: string;
  teamContactId?: string;
  notificationId?: string;
  mediaUrl?: string;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  status?: string;
  error?: string;
  deliveryLogId?: string;
}

class TwilioService {
  /**
   * Get or create Twilio client for a hospital
   */
  private async getClient(hospitalId: string): Promise<{ client: twilio.Twilio; config: TwilioConfig } | null> {
    // Check cache first
    if (twilioClients.has(hospitalId)) {
      const settings = await prisma.notificationSettings.findUnique({
        where: { hospitalId },
        select: {
          twilioAccountSid: true,
          twilioAuthToken: true,
          twilioPhoneNumber: true,
          twilioWhatsappNumber: true,
          twilioEnabled: true,
        }
      });

      if (!settings || !settings.twilioEnabled || !settings.twilioAccountSid || !settings.twilioAuthToken) {
        twilioClients.delete(hospitalId);
        return null;
      }

      return {
        client: twilioClients.get(hospitalId)!,
        config: {
          accountSid: settings.twilioAccountSid,
          authToken: settings.twilioAuthToken,
          phoneNumber: settings.twilioPhoneNumber || '',
          whatsappNumber: settings.twilioWhatsappNumber || undefined,
        }
      };
    }

    // Get settings from database
    const settings = await prisma.notificationSettings.findUnique({
      where: { hospitalId },
    });

    if (!settings || !settings.twilioEnabled) {
      console.log(`[TWILIO] Not enabled for hospital ${hospitalId}`);
      return null;
    }

    if (!settings.twilioAccountSid || !settings.twilioAuthToken) {
      console.error(`[TWILIO] Missing credentials for hospital ${hospitalId}`);
      return null;
    }

    // Create new client
    const client = twilio(settings.twilioAccountSid, settings.twilioAuthToken);
    twilioClients.set(hospitalId, client);

    return {
      client,
      config: {
        accountSid: settings.twilioAccountSid,
        authToken: settings.twilioAuthToken,
        phoneNumber: settings.twilioPhoneNumber || '',
        whatsappNumber: settings.twilioWhatsappNumber || undefined,
      }
    };
  }

  /**
   * Clear cached client (call when settings are updated)
   */
  clearClientCache(hospitalId: string): void {
    twilioClients.delete(hospitalId);
    console.log(`[TWILIO] Cleared client cache for hospital ${hospitalId}`);
  }

  /**
   * Format phone number to E.164 format
   */
  private formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters except leading +
    let cleaned = phone.replace(/[^\d+]/g, '');
    
    // If no + prefix, assume it might need one
    if (!cleaned.startsWith('+')) {
      // If starts with 00, replace with +
      if (cleaned.startsWith('00')) {
        cleaned = '+' + cleaned.substring(2);
      } else if (cleaned.length === 10) {
        // Assume US number if 10 digits
        cleaned = '+1' + cleaned;
      } else {
        // Add + prefix
        cleaned = '+' + cleaned;
      }
    }

    return cleaned;
  }

  /**
   * Create delivery log entry
   */
  private async createDeliveryLog(params: {
    hospitalId: string;
    notificationId?: string;
    teamContactId?: string;
    channel: string;
    recipient: string;
    recipientName?: string;
    message: string;
    status: DeliveryStatus;
    externalMessageId?: string;
    failureReason?: string;
    providerResponse?: any;
  }): Promise<string> {
    const log = await prisma.notificationDeliveryLog.create({
      data: {
        hospitalId: params.hospitalId,
        notificationId: params.notificationId,
        teamContactId: params.teamContactId,
        channel: params.channel,
        recipient: params.recipient,
        recipientName: params.recipientName,
        message: params.message,
        status: params.status,
        sentAt: params.status === DeliveryStatus.SENT ? new Date() : undefined,
        failedAt: params.status === DeliveryStatus.FAILED ? new Date() : undefined,
        failureReason: params.failureReason,
        externalMessageId: params.externalMessageId,
        providerResponse: params.providerResponse,
      }
    });

    return log.id;
  }

  /**
   * Update delivery log status
   */
  private async updateDeliveryLog(logId: string, updates: {
    status?: DeliveryStatus;
    sentAt?: Date;
    deliveredAt?: Date;
    failedAt?: Date;
    failureReason?: string;
    externalMessageId?: string;
    providerResponse?: any;
  }): Promise<void> {
    await prisma.notificationDeliveryLog.update({
      where: { id: logId },
      data: updates,
    });
  }

  /**
   * Send SMS via Twilio
   */
  async sendSMS(params: SendSMSParams): Promise<SendResult> {
    const { hospitalId, to, message, teamContactId, notificationId } = params;
    const formattedTo = this.formatPhoneNumber(to);

    // Create pending log first
    const logId = await this.createDeliveryLog({
      hospitalId,
      notificationId,
      teamContactId,
      channel: 'sms',
      recipient: formattedTo,
      message,
      status: DeliveryStatus.PENDING,
    });

    try {
      // Get Twilio client
      const clientData = await this.getClient(hospitalId);
      
      if (!clientData) {
        await this.updateDeliveryLog(logId, {
          status: DeliveryStatus.FAILED,
          failedAt: new Date(),
          failureReason: 'Twilio not configured or disabled',
        });
        return {
          success: false,
          error: 'Twilio not configured or disabled for this hospital',
          deliveryLogId: logId,
        };
      }

      const { client, config } = clientData;

      if (!config.phoneNumber) {
        await this.updateDeliveryLog(logId, {
          status: DeliveryStatus.FAILED,
          failedAt: new Date(),
          failureReason: 'No Twilio phone number configured',
        });
        return {
          success: false,
          error: 'No Twilio phone number configured',
          deliveryLogId: logId,
        };
      }

      // Send SMS
      const result = await client.messages.create({
        body: message,
        from: config.phoneNumber,
        to: formattedTo,
      });

      console.log(`[TWILIO SMS] Sent to ${formattedTo}: ${result.sid}`);

      // Update log with success
      await this.updateDeliveryLog(logId, {
        status: DeliveryStatus.SENT,
        sentAt: new Date(),
        externalMessageId: result.sid,
        providerResponse: {
          sid: result.sid,
          status: result.status,
          dateCreated: result.dateCreated,
        },
      });

      return {
        success: true,
        messageId: result.sid,
        status: result.status,
        deliveryLogId: logId,
      };
    } catch (error: any) {
      console.error(`[TWILIO SMS ERROR] Failed to send to ${formattedTo}:`, error.message);

      await this.updateDeliveryLog(logId, {
        status: DeliveryStatus.FAILED,
        failedAt: new Date(),
        failureReason: error.message,
        providerResponse: {
          code: error.code,
          moreInfo: error.moreInfo,
        },
      });

      return {
        success: false,
        error: error.message,
        deliveryLogId: logId,
      };
    }
  }

  /**
   * Send WhatsApp message via Twilio
   */
  async sendWhatsApp(params: SendWhatsAppParams): Promise<SendResult> {
    const { hospitalId, to, message, teamContactId, notificationId, mediaUrl } = params;
    const formattedTo = this.formatPhoneNumber(to);

    // Create pending log first
    const logId = await this.createDeliveryLog({
      hospitalId,
      notificationId,
      teamContactId,
      channel: 'whatsapp',
      recipient: formattedTo,
      message,
      status: DeliveryStatus.PENDING,
    });

    try {
      // Get Twilio client
      const clientData = await this.getClient(hospitalId);
      
      if (!clientData) {
        await this.updateDeliveryLog(logId, {
          status: DeliveryStatus.FAILED,
          failedAt: new Date(),
          failureReason: 'Twilio not configured or disabled',
        });
        return {
          success: false,
          error: 'Twilio not configured or disabled for this hospital',
          deliveryLogId: logId,
        };
      }

      const { client, config } = clientData;

      // Check if WhatsApp is configured
      const settings = await prisma.notificationSettings.findUnique({
        where: { hospitalId },
        select: { twilioWhatsappEnabled: true, twilioWhatsappNumber: true },
      });

      if (!settings?.twilioWhatsappEnabled || !settings?.twilioWhatsappNumber) {
        await this.updateDeliveryLog(logId, {
          status: DeliveryStatus.FAILED,
          failedAt: new Date(),
          failureReason: 'WhatsApp not enabled or no WhatsApp number configured',
        });
        return {
          success: false,
          error: 'WhatsApp not enabled or no WhatsApp number configured',
          deliveryLogId: logId,
        };
      }

      // Send WhatsApp message
      const messageParams: any = {
        body: message,
        from: `whatsapp:${settings.twilioWhatsappNumber}`,
        to: `whatsapp:${formattedTo}`,
      };

      if (mediaUrl) {
        messageParams.mediaUrl = [mediaUrl];
      }

      const result = await client.messages.create(messageParams);

      console.log(`[TWILIO WHATSAPP] Sent to ${formattedTo}: ${result.sid}`);

      // Update log with success
      await this.updateDeliveryLog(logId, {
        status: DeliveryStatus.SENT,
        sentAt: new Date(),
        externalMessageId: result.sid,
        providerResponse: {
          sid: result.sid,
          status: result.status,
          dateCreated: result.dateCreated,
        },
      });

      return {
        success: true,
        messageId: result.sid,
        status: result.status,
        deliveryLogId: logId,
      };
    } catch (error: any) {
      console.error(`[TWILIO WHATSAPP ERROR] Failed to send to ${formattedTo}:`, error.message);

      await this.updateDeliveryLog(logId, {
        status: DeliveryStatus.FAILED,
        failedAt: new Date(),
        failureReason: error.message,
        providerResponse: {
          code: error.code,
          moreInfo: error.moreInfo,
        },
      });

      return {
        success: false,
        error: error.message,
        deliveryLogId: logId,
      };
    }
  }

  /**
   * Verify Twilio credentials
   */
  async verifyCredentials(accountSid: string, authToken: string): Promise<{
    valid: boolean;
    accountName?: string;
    error?: string;
  }> {
    try {
      const client = twilio(accountSid, authToken);
      const account = await client.api.accounts(accountSid).fetch();
      
      return {
        valid: true,
        accountName: account.friendlyName,
      };
    } catch (error: any) {
      console.error('[TWILIO] Credential verification failed:', error.message);
      return {
        valid: false,
        error: error.message,
      };
    }
  }

  /**
   * Get phone numbers available in the Twilio account
   */
  async getAvailablePhoneNumbers(hospitalId: string): Promise<{
    success: boolean;
    phoneNumbers?: Array<{ phoneNumber: string; capabilities: any }>;
    error?: string;
  }> {
    try {
      const clientData = await this.getClient(hospitalId);
      
      if (!clientData) {
        return { success: false, error: 'Twilio not configured' };
      }

      const { client } = clientData;
      const numbers = await client.incomingPhoneNumbers.list({ limit: 20 });
      
      return {
        success: true,
        phoneNumbers: numbers.map(n => ({
          phoneNumber: n.phoneNumber,
          capabilities: n.capabilities,
        })),
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Send test SMS to verify configuration
   */
  async sendTestSMS(hospitalId: string, testNumber: string): Promise<SendResult> {
    return this.sendSMS({
      hospitalId,
      to: testNumber,
      message: 'This is a test message from Spetaar HMS. If you received this, your SMS notification system is configured correctly!',
    });
  }

  /**
   * Get delivery status from Twilio
   */
  async getMessageStatus(hospitalId: string, messageSid: string): Promise<{
    success: boolean;
    status?: string;
    error?: string;
  }> {
    try {
      const clientData = await this.getClient(hospitalId);
      
      if (!clientData) {
        return { success: false, error: 'Twilio not configured' };
      }

      const { client } = clientData;
      const message = await client.messages(messageSid).fetch();
      
      return {
        success: true,
        status: message.status,
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

export const twilioService = new TwilioService();
