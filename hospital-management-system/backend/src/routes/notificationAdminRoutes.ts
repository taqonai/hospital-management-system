/**
 * Notification Admin Routes
 * 
 * Admin endpoints for managing notification settings, team contacts,
 * templates, and delivery logs.
 */

import { Router, Response } from 'express';
import prisma from '../config/database';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler, NotFoundError, ValidationError } from '../middleware/errorHandler';
import { sendSuccess } from '../utils/response';
import { AuthenticatedRequest } from '../types';
import { twilioService } from '../services/twilioService';
import { notificationService } from '../services/notificationService';
import { DeliveryStatus } from '@prisma/client';

const router = Router();

// All routes require authentication and admin role
const requireAdmin = [authenticate, authorize('SUPER_ADMIN', 'HOSPITAL_ADMIN')];

// =============================================================================
// NOTIFICATION SETTINGS
// =============================================================================

/**
 * Get notification settings for hospital
 * GET /api/v1/admin/notifications/settings
 */
router.get(
  '/settings',
  ...requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user?.hospitalId || '';

    let settings = await prisma.notificationSettings.findUnique({
      where: { hospitalId },
    });

    // Create default settings if not exists
    if (!settings) {
      settings = await prisma.notificationSettings.create({
        data: { hospitalId },
      });
    }

    // Mask sensitive fields
    const maskedSettings = {
      ...settings,
      twilioAuthToken: settings.twilioAuthToken ? '••••••••' : null,
      smtpPassword: settings.smtpPassword ? '••••••••' : null,
      pagerApiKey: settings.pagerApiKey ? '••••••••' : null,
    };

    sendSuccess(res, maskedSettings, 'Notification settings retrieved');
  })
);

/**
 * Update notification settings
 * PUT /api/v1/admin/notifications/settings
 */
router.put(
  '/settings',
  ...requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user?.hospitalId || '';
    const {
      // Twilio SMS
      twilioAccountSid,
      twilioAuthToken,
      twilioPhoneNumber,
      twilioEnabled,
      // Twilio WhatsApp
      twilioWhatsappNumber,
      twilioWhatsappEnabled,
      // Email SMTP
      smtpHost,
      smtpPort,
      smtpSecure,
      smtpUser,
      smtpPassword,
      smtpFrom,
      emailEnabled,
      // Pager
      pagerProvider,
      pagerApiKey,
      pagerApiEndpoint,
      pagerEnabled,
      // General
      defaultChannels,
      quietHoursEnabled,
      quietHoursStart,
      quietHoursEnd,
    } = req.body;

    // Build update data, only including provided fields
    const updateData: any = {};

    // Twilio SMS fields
    if (twilioAccountSid !== undefined) updateData.twilioAccountSid = twilioAccountSid;
    if (twilioAuthToken !== undefined && twilioAuthToken !== '••••••••') {
      updateData.twilioAuthToken = twilioAuthToken;
    }
    if (twilioPhoneNumber !== undefined) updateData.twilioPhoneNumber = twilioPhoneNumber;
    if (twilioEnabled !== undefined) updateData.twilioEnabled = twilioEnabled;

    // Twilio WhatsApp fields
    if (twilioWhatsappNumber !== undefined) updateData.twilioWhatsappNumber = twilioWhatsappNumber;
    if (twilioWhatsappEnabled !== undefined) updateData.twilioWhatsappEnabled = twilioWhatsappEnabled;

    // Email SMTP fields
    if (smtpHost !== undefined) updateData.smtpHost = smtpHost;
    if (smtpPort !== undefined) updateData.smtpPort = smtpPort;
    if (smtpSecure !== undefined) updateData.smtpSecure = smtpSecure;
    if (smtpUser !== undefined) updateData.smtpUser = smtpUser;
    if (smtpPassword !== undefined && smtpPassword !== '••••••••') {
      updateData.smtpPassword = smtpPassword;
    }
    if (smtpFrom !== undefined) updateData.smtpFrom = smtpFrom;
    if (emailEnabled !== undefined) updateData.emailEnabled = emailEnabled;

    // Pager fields
    if (pagerProvider !== undefined) updateData.pagerProvider = pagerProvider;
    if (pagerApiKey !== undefined && pagerApiKey !== '••••••••') {
      updateData.pagerApiKey = pagerApiKey;
    }
    if (pagerApiEndpoint !== undefined) updateData.pagerApiEndpoint = pagerApiEndpoint;
    if (pagerEnabled !== undefined) updateData.pagerEnabled = pagerEnabled;

    // General settings
    if (defaultChannels !== undefined) updateData.defaultChannels = defaultChannels;
    if (quietHoursEnabled !== undefined) updateData.quietHoursEnabled = quietHoursEnabled;
    if (quietHoursStart !== undefined) updateData.quietHoursStart = quietHoursStart;
    if (quietHoursEnd !== undefined) updateData.quietHoursEnd = quietHoursEnd;

    const settings = await prisma.notificationSettings.upsert({
      where: { hospitalId },
      create: { hospitalId, ...updateData },
      update: updateData,
    });

    // Clear Twilio client cache if credentials changed
    if (twilioAccountSid || twilioAuthToken || twilioPhoneNumber) {
      twilioService.clearClientCache(hospitalId);
    }

    // Mask sensitive fields in response
    const maskedSettings = {
      ...settings,
      twilioAuthToken: settings.twilioAuthToken ? '••••••••' : null,
      smtpPassword: settings.smtpPassword ? '••••••••' : null,
      pagerApiKey: settings.pagerApiKey ? '••••••••' : null,
    };

    sendSuccess(res, maskedSettings, 'Notification settings updated');
  })
);

/**
 * Verify Twilio credentials
 * POST /api/v1/admin/notifications/settings/verify-twilio
 */
router.post(
  '/settings/verify-twilio',
  ...requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user?.hospitalId || '';
    const { accountSid, authToken } = req.body;

    // If not provided, use stored credentials
    let sid = accountSid;
    let token = authToken;

    if (!sid || !token || token === '••••••••') {
      const settings = await prisma.notificationSettings.findUnique({
        where: { hospitalId },
        select: { twilioAccountSid: true, twilioAuthToken: true },
      });

      if (!settings?.twilioAccountSid || !settings?.twilioAuthToken) {
        throw new ValidationError('No Twilio credentials configured');
      }

      sid = settings.twilioAccountSid;
      token = token === '••••••••' ? settings.twilioAuthToken : token;
    }

    const result = await twilioService.verifyCredentials(sid, token);

    if (result.valid) {
      sendSuccess(res, { accountName: result.accountName }, 'Twilio credentials verified');
    } else {
      throw new ValidationError(`Invalid credentials: ${result.error}`);
    }
  })
);

/**
 * Send test SMS
 * POST /api/v1/admin/notifications/settings/test-sms
 */
router.post(
  '/settings/test-sms',
  ...requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user?.hospitalId || '';
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      throw new ValidationError('Phone number is required');
    }

    const result = await twilioService.sendTestSMS(hospitalId, phoneNumber);

    if (result.success) {
      sendSuccess(res, { 
        messageId: result.messageId,
        deliveryLogId: result.deliveryLogId,
      }, 'Test SMS sent successfully');
    } else {
      throw new ValidationError(`Failed to send test SMS: ${result.error}`);
    }
  })
);

/**
 * Get available Twilio phone numbers
 * GET /api/v1/admin/notifications/settings/twilio-numbers
 */
router.get(
  '/settings/twilio-numbers',
  ...requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user?.hospitalId || '';

    const result = await twilioService.getAvailablePhoneNumbers(hospitalId);

    if (result.success) {
      sendSuccess(res, result.phoneNumbers, 'Phone numbers retrieved');
    } else {
      throw new ValidationError(result.error || 'Failed to get phone numbers');
    }
  })
);

// =============================================================================
// TEAM CONTACTS
// =============================================================================

/**
 * Get all team contacts
 * GET /api/v1/admin/notifications/team-contacts
 */
router.get(
  '/team-contacts',
  ...requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user?.hospitalId || '';
    const { isActive, isEmergencyContact, department, role } = req.query;

    const where: any = { hospitalId };
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (isEmergencyContact !== undefined) where.isEmergencyContact = isEmergencyContact === 'true';
    if (department) where.department = department as string;
    if (role) where.role = { contains: role as string, mode: 'insensitive' };

    const contacts = await prisma.teamContact.findMany({
      where,
      orderBy: [{ isEmergencyContact: 'desc' }, { name: 'asc' }],
    });

    sendSuccess(res, contacts, 'Team contacts retrieved');
  })
);

/**
 * Create team contact
 * POST /api/v1/admin/notifications/team-contacts
 */
router.post(
  '/team-contacts',
  ...requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user?.hospitalId || '';
    const {
      name,
      role,
      department,
      email,
      phone,
      pagerNumber,
      whatsappNumber,
      enabledChannels,
      enabledAlertTypes,
      isEmergencyContact,
      isActive,
      onCallSchedule,
    } = req.body;

    if (!name || !role) {
      throw new ValidationError('Name and role are required');
    }

    // At least one contact method required
    if (!email && !phone && !pagerNumber && !whatsappNumber) {
      throw new ValidationError('At least one contact method (email, phone, pager, or WhatsApp) is required');
    }

    const contact = await prisma.teamContact.create({
      data: {
        hospitalId,
        name,
        role,
        department,
        email,
        phone,
        pagerNumber,
        whatsappNumber,
        enabledChannels: enabledChannels || ['sms', 'email'],
        enabledAlertTypes: enabledAlertTypes || [],
        isEmergencyContact: isEmergencyContact || false,
        isActive: isActive !== false,
        onCallSchedule,
      },
    });

    sendSuccess(res, contact, 'Team contact created', 201);
  })
);

/**
 * Get single team contact
 * GET /api/v1/admin/notifications/team-contacts/:id
 */
router.get(
  '/team-contacts/:id',
  ...requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user?.hospitalId || '';
    const contactId = req.params.id;

    const contact = await prisma.teamContact.findFirst({
      where: { id: contactId, hospitalId },
      include: {
        deliveryLogs: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!contact) {
      throw new NotFoundError('Team contact not found');
    }

    sendSuccess(res, contact, 'Team contact retrieved');
  })
);

/**
 * Update team contact
 * PUT /api/v1/admin/notifications/team-contacts/:id
 */
router.put(
  '/team-contacts/:id',
  ...requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user?.hospitalId || '';
    const contactId = req.params.id;

    const existing = await prisma.teamContact.findFirst({
      where: { id: contactId, hospitalId },
    });

    if (!existing) {
      throw new NotFoundError('Team contact not found');
    }

    const {
      name,
      role,
      department,
      email,
      phone,
      pagerNumber,
      whatsappNumber,
      enabledChannels,
      enabledAlertTypes,
      isEmergencyContact,
      isActive,
      onCallSchedule,
    } = req.body;

    const contact = await prisma.teamContact.update({
      where: { id: contactId },
      data: {
        name,
        role,
        department,
        email,
        phone,
        pagerNumber,
        whatsappNumber,
        enabledChannels,
        enabledAlertTypes,
        isEmergencyContact,
        isActive,
        onCallSchedule,
      },
    });

    sendSuccess(res, contact, 'Team contact updated');
  })
);

/**
 * Delete team contact
 * DELETE /api/v1/admin/notifications/team-contacts/:id
 */
router.delete(
  '/team-contacts/:id',
  ...requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user?.hospitalId || '';
    const contactId = req.params.id;

    const existing = await prisma.teamContact.findFirst({
      where: { id: contactId, hospitalId },
    });

    if (!existing) {
      throw new NotFoundError('Team contact not found');
    }

    await prisma.teamContact.delete({
      where: { id: contactId },
    });

    sendSuccess(res, null, 'Team contact deleted');
  })
);

/**
 * Send test notification to team contact
 * POST /api/v1/admin/notifications/team-contacts/:id/test
 */
router.post(
  '/team-contacts/:id/test',
  ...requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user?.hospitalId || '';
    const contactId = req.params.id;
    const { channel, message } = req.body;

    const contact = await prisma.teamContact.findFirst({
      where: { id: contactId, hospitalId },
    });

    if (!contact) {
      throw new NotFoundError('Team contact not found');
    }

    const testMessage = message || `This is a test notification for ${contact.name}. If you received this, notifications are working correctly!`;
    const results: any[] = [];

    // Determine which channel to test
    const channelToTest = channel || (contact.enabledChannels as string[])[0];

    if (channelToTest === 'sms' && contact.phone) {
      const result = await twilioService.sendSMS({
        hospitalId,
        to: contact.phone,
        message: testMessage,
        teamContactId: contact.id,
      });
      results.push({ channel: 'sms', ...result });
    } else if (channelToTest === 'whatsapp' && contact.whatsappNumber) {
      const result = await twilioService.sendWhatsApp({
        hospitalId,
        to: contact.whatsappNumber,
        message: testMessage,
        teamContactId: contact.id,
      });
      results.push({ channel: 'whatsapp', ...result });
    } else if (channelToTest === 'email' && contact.email) {
      // TODO: Implement email test when email service is ready
      results.push({ channel: 'email', success: false, error: 'Email service not yet implemented' });
    } else {
      throw new ValidationError(`Channel ${channelToTest} not available for this contact`);
    }

    sendSuccess(res, results, 'Test notification sent');
  })
);

/**
 * Broadcast notification to all emergency contacts
 * POST /api/v1/admin/notifications/team-contacts/broadcast
 */
router.post(
  '/team-contacts/broadcast',
  ...requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user?.hospitalId || '';
    const { message, title, channels, emergencyOnly } = req.body;

    if (!message) {
      throw new ValidationError('Message is required');
    }

    const where: any = { hospitalId, isActive: true };
    if (emergencyOnly !== false) {
      where.isEmergencyContact = true;
    }

    const contacts = await prisma.teamContact.findMany({ where });

    if (contacts.length === 0) {
      throw new ValidationError('No active contacts found');
    }

    const results: any[] = [];
    const channelsToUse = channels || ['sms'];
    const fullMessage = title ? `${title}\n\n${message}` : message;

    for (const contact of contacts) {
      for (const channel of channelsToUse) {
        if (channel === 'sms' && contact.phone) {
          const result = await twilioService.sendSMS({
            hospitalId,
            to: contact.phone,
            message: fullMessage,
            teamContactId: contact.id,
          });
          results.push({ contact: contact.name, channel: 'sms', ...result });
        } else if (channel === 'whatsapp' && contact.whatsappNumber) {
          const result = await twilioService.sendWhatsApp({
            hospitalId,
            to: contact.whatsappNumber,
            message: fullMessage,
            teamContactId: contact.id,
          });
          results.push({ contact: contact.name, channel: 'whatsapp', ...result });
        }
      }
    }

    sendSuccess(res, {
      totalContacts: contacts.length,
      totalMessages: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    }, 'Broadcast sent');
  })
);

// =============================================================================
// NOTIFICATION TEMPLATES
// =============================================================================

/**
 * Get all notification templates
 * GET /api/v1/admin/notifications/templates
 */
router.get(
  '/templates',
  ...requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user?.hospitalId || '';
    const { category, isActive } = req.query;

    const where: any = { hospitalId };
    if (category) where.category = category as string;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const templates = await prisma.notificationTemplate.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    sendSuccess(res, templates, 'Templates retrieved');
  })
);

/**
 * Create notification template
 * POST /api/v1/admin/notifications/templates
 */
router.post(
  '/templates',
  ...requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user?.hospitalId || '';
    const {
      name,
      code,
      description,
      category,
      smsTemplate,
      emailSubject,
      emailBodyHtml,
      emailBodyText,
      whatsappTemplate,
      pushTitle,
      pushBody,
      variables,
    } = req.body;

    if (!name || !code || !category) {
      throw new ValidationError('Name, code, and category are required');
    }

    const template = await prisma.notificationTemplate.create({
      data: {
        hospitalId,
        name,
        code,
        description,
        category,
        smsTemplate,
        emailSubject,
        emailBodyHtml,
        emailBodyText,
        whatsappTemplate,
        pushTitle,
        pushBody,
        variables,
      },
    });

    sendSuccess(res, template, 'Template created', 201);
  })
);

/**
 * Update notification template
 * PUT /api/v1/admin/notifications/templates/:id
 */
router.put(
  '/templates/:id',
  ...requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user?.hospitalId || '';
    const templateId = req.params.id;

    const existing = await prisma.notificationTemplate.findFirst({
      where: { id: templateId, hospitalId },
    });

    if (!existing) {
      throw new NotFoundError('Template not found');
    }

    if (existing.isSystem) {
      throw new ValidationError('System templates cannot be modified');
    }

    const template = await prisma.notificationTemplate.update({
      where: { id: templateId },
      data: req.body,
    });

    sendSuccess(res, template, 'Template updated');
  })
);

/**
 * Delete notification template
 * DELETE /api/v1/admin/notifications/templates/:id
 */
router.delete(
  '/templates/:id',
  ...requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user?.hospitalId || '';
    const templateId = req.params.id;

    const existing = await prisma.notificationTemplate.findFirst({
      where: { id: templateId, hospitalId },
    });

    if (!existing) {
      throw new NotFoundError('Template not found');
    }

    if (existing.isSystem) {
      throw new ValidationError('System templates cannot be deleted');
    }

    await prisma.notificationTemplate.delete({
      where: { id: templateId },
    });

    sendSuccess(res, null, 'Template deleted');
  })
);

// =============================================================================
// DELIVERY LOGS
// =============================================================================

/**
 * Get notification delivery logs
 * GET /api/v1/admin/notifications/delivery-logs
 */
router.get(
  '/delivery-logs',
  ...requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user?.hospitalId || '';
    const { 
      channel, 
      status, 
      teamContactId, 
      startDate, 
      endDate,
      page = '1',
      limit = '50',
    } = req.query;

    const where: any = { hospitalId };
    if (channel) where.channel = channel as string;
    if (status) where.status = status as DeliveryStatus;
    if (teamContactId) where.teamContactId = teamContactId as string;
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [logs, total] = await Promise.all([
      prisma.notificationDeliveryLog.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
        include: {
          teamContact: {
            select: { name: true, role: true },
          },
        },
      }),
      prisma.notificationDeliveryLog.count({ where }),
    ]);

    sendSuccess(res, {
      logs,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
    }, 'Delivery logs retrieved');
  })
);

/**
 * Get delivery statistics
 * GET /api/v1/admin/notifications/delivery-logs/stats
 */
router.get(
  '/delivery-logs/stats',
  ...requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user?.hospitalId || '';
    const { startDate, endDate } = req.query;

    const where: any = { hospitalId };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const [
      totalLogs,
      byStatus,
      byChannel,
    ] = await Promise.all([
      prisma.notificationDeliveryLog.count({ where }),
      prisma.notificationDeliveryLog.groupBy({
        by: ['status'],
        where,
        _count: { status: true },
      }),
      prisma.notificationDeliveryLog.groupBy({
        by: ['channel'],
        where,
        _count: { channel: true },
      }),
    ]);

    const statusStats = byStatus.reduce((acc: any, item) => {
      acc[item.status] = item._count.status;
      return acc;
    }, {});

    const channelStats = byChannel.reduce((acc: any, item) => {
      acc[item.channel] = item._count.channel;
      return acc;
    }, {});

    sendSuccess(res, {
      total: totalLogs,
      byStatus: statusStats,
      byChannel: channelStats,
      successRate: totalLogs > 0 
        ? ((statusStats.SENT || 0) + (statusStats.DELIVERED || 0)) / totalLogs * 100 
        : 0,
    }, 'Delivery statistics retrieved');
  })
);

/**
 * Retry failed delivery
 * POST /api/v1/admin/notifications/delivery-logs/:id/retry
 */
router.post(
  '/delivery-logs/:id/retry',
  ...requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user?.hospitalId || '';
    const logId = req.params.id;

    const log = await prisma.notificationDeliveryLog.findFirst({
      where: { id: logId, hospitalId, status: DeliveryStatus.FAILED },
    });

    if (!log) {
      throw new NotFoundError('Failed delivery log not found');
    }

    // Retry based on channel
    let result: any;
    if (log.channel === 'sms') {
      result = await twilioService.sendSMS({
        hospitalId,
        to: log.recipient,
        message: log.message,
        teamContactId: log.teamContactId || undefined,
        notificationId: log.notificationId || undefined,
      });
    } else if (log.channel === 'whatsapp') {
      result = await twilioService.sendWhatsApp({
        hospitalId,
        to: log.recipient,
        message: log.message,
        teamContactId: log.teamContactId || undefined,
        notificationId: log.notificationId || undefined,
      });
    } else {
      throw new ValidationError(`Retry not supported for channel: ${log.channel}`);
    }

    // Update original log retry count
    await prisma.notificationDeliveryLog.update({
      where: { id: logId },
      data: { retryCount: { increment: 1 } },
    });

    sendSuccess(res, {
      originalLogId: logId,
      newLogId: result.deliveryLogId,
      success: result.success,
      error: result.error,
    }, result.success ? 'Retry successful' : 'Retry failed');
  })
);

export default router;
