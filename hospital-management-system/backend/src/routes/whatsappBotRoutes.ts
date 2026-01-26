import express, { Request, Response } from 'express';
import whatsappBotService from '../services/whatsappBotService';
import whatsappSessionService from '../services/whatsappSessionService';
import { authenticate, authorize } from '../middleware/auth';
import { TwilioWebhookPayload, WhatsAppMessage } from '../types/whatsapp';

const router = express.Router();

/**
 * POST /api/v1/whatsapp-bot/webhook
 * Receive incoming WhatsApp messages from Twilio
 * Public endpoint (no auth) - Twilio webhook
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const payload: TwilioWebhookPayload = req.body;

    // Extract message data from Twilio payload
    const message: WhatsAppMessage = {
      from: payload.From,
      body: payload.Body || '',
      mediaUrl: payload.NumMedia && parseInt(payload.NumMedia) > 0 ? payload.MediaUrl0 : undefined,
      mediaContentType: payload.NumMedia && parseInt(payload.NumMedia) > 0 ? payload.MediaContentType0 : undefined,
      messageId: payload.MessageSid
    };

    // Process message asynchronously (don't wait for response)
    whatsappBotService.handleIncomingMessage(message).catch(error => {
      console.error('Error processing WhatsApp message:', error);
    });

    // Respond to Twilio immediately with 200 OK
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error in WhatsApp webhook:', error);
    // Still return 200 to Twilio to avoid retries
    res.status(200).send('OK');
  }
});

/**
 * GET /api/v1/whatsapp-bot/webhook
 * Twilio webhook verification
 */
router.get('/webhook', (req: Request, res: Response) => {
  // Twilio webhook verification
  res.status(200).send('WhatsApp webhook is active');
});

/**
 * POST /api/v1/whatsapp-bot/send
 * Send outbound WhatsApp message (internal use)
 * Requires authentication
 */
router.post(
  '/send',
  authenticate,
  authorize('HOSPITAL_ADMIN', 'RECEPTIONIST', 'DOCTOR'),
  async (req: Request, res: Response) => {
    try {
      const { to, message } = req.body;

      if (!to || !message) {
        return res.status(400).json({
          success: false,
          error: 'Phone number and message are required'
        });
      }

      // Send via WhatsApp service
      const whatsappService = require('../services/whatsappService').default;
      await whatsappService.sendMessage(to, message);

      res.status(200).json({
        success: true,
        message: 'Message sent successfully'
      });
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send message'
      });
    }
  }
);

/**
 * GET /api/v1/whatsapp-bot/session/:phoneNumber
 * Get session status for a phone number (admin use)
 * Requires authentication
 */
router.get(
  '/session/:phoneNumber',
  authenticate,
  authorize('HOSPITAL_ADMIN', 'RECEPTIONIST'),
  async (req: Request, res: Response) => {
    try {
      const { phoneNumber } = req.params;
      const cleanPhone = phoneNumber.replace('whatsapp:', '');

      const session = await whatsappSessionService.getSessionContext(cleanPhone);

      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'No active session found'
        });
      }

      res.status(200).json({
        success: true,
        data: {
          phoneNumber: session.phoneNumber,
          currentStep: session.currentStep,
          hospitalId: session.hospitalId,
          patientId: session.patientId,
          lastMessageTimestamp: session.lastMessageTimestamp
        }
      });
    } catch (error) {
      console.error('Error fetching session:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch session'
      });
    }
  }
);

/**
 * DELETE /api/v1/whatsapp-bot/session/:phoneNumber
 * Clear/reset session for a phone number (admin use)
 * Requires authentication
 */
router.delete(
  '/session/:phoneNumber',
  authenticate,
  authorize('HOSPITAL_ADMIN', 'RECEPTIONIST'),
  async (req: Request, res: Response) => {
    try {
      const { phoneNumber } = req.params;
      const cleanPhone = phoneNumber.replace('whatsapp:', '');

      await whatsappSessionService.clearSession(cleanPhone);

      res.status(200).json({
        success: true,
        message: 'Session cleared successfully'
      });
    } catch (error) {
      console.error('Error clearing session:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to clear session'
      });
    }
  }
);

/**
 * POST /api/v1/whatsapp-bot/clean-expired
 * Clean expired sessions (can be called by cron job)
 * Requires authentication
 */
router.post(
  '/clean-expired',
  authenticate,
  authorize('HOSPITAL_ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const count = await whatsappSessionService.cleanExpiredSessions();

      res.status(200).json({
        success: true,
        message: `Cleaned ${count} expired sessions`
      });
    } catch (error) {
      console.error('Error cleaning expired sessions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to clean expired sessions'
      });
    }
  }
);

export default router;
