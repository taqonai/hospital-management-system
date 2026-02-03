import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorizeRoles } from '../middleware/auth';
import { sendSuccess, sendError } from '../utils/response';
import axios from 'axios';
import Stripe from 'stripe';

const router = express.Router();
const prisma = new PrismaClient();

// All settings routes require admin access
router.use(authenticate);
router.use(authorizeRoles(['HOSPITAL_ADMIN', 'SUPER_ADMIN']));

/**
 * GET /api/settings/hospital
 * Get all hospital settings
 */
router.get('/hospital', async (req, res) => {
  try {
    const hospitalId = (req as any).user?.hospitalId;
    
    if (!hospitalId) {
      return sendError(res, 'Hospital ID required', 400);
    }

    // Get settings from database
    const settings = await prisma.hospitalSettings.findUnique({
      where: { hospitalId },
    });

    if (!settings) {
      // Return defaults if no settings exist
      return sendSuccess(res, {
        dha: {
          enabled: false,
          baseUrl: 'https://eclaimlink.dha.gov.ae/api/v1',
          facilityId: '',
          licenseNumber: '',
          apiKey: '',
          testMode: true,
        },
        payment: {
          provider: 'none',
          enabled: false,
          testMode: true,
          stripePublicKey: '',
          stripeSecretKey: '',
          payfortMerchantId: '',
          payfortAccessCode: '',
          payfortShaRequestPhrase: '',
          payfortShaResponsePhrase: '',
          niOutletId: '',
          niApiKey: '',
        },
        notifications: {
          emailEnabled: true,
          smsEnabled: false,
          whatsappEnabled: false,
          pushEnabled: true,
          appointmentReminders: true,
          reminderHoursBefore: 24,
          labResultsNotify: true,
          prescriptionReadyNotify: true,
        },
      });
    }

    // Mask sensitive fields before returning
    const maskedSettings = {
      dha: settings.dhaSettings ? {
        ...settings.dhaSettings as any,
        apiKey: settings.dhaSettings ? maskSecret((settings.dhaSettings as any).apiKey) : '',
      } : null,
      payment: settings.paymentSettings ? {
        ...settings.paymentSettings as any,
        stripeSecretKey: maskSecret((settings.paymentSettings as any).stripeSecretKey),
        payfortAccessCode: maskSecret((settings.paymentSettings as any).payfortAccessCode),
        payfortShaRequestPhrase: maskSecret((settings.paymentSettings as any).payfortShaRequestPhrase),
        payfortShaResponsePhrase: maskSecret((settings.paymentSettings as any).payfortShaResponsePhrase),
        niApiKey: maskSecret((settings.paymentSettings as any).niApiKey),
      } : null,
      notifications: settings.notificationSettings,
    };

    sendSuccess(res, maskedSettings);
  } catch (error: any) {
    console.error('Error fetching settings:', error);
    sendError(res, error.message || 'Failed to fetch settings', 500);
  }
});

/**
 * PUT /api/settings/hospital
 * Update hospital settings
 */
router.put('/hospital', async (req, res) => {
  try {
    const hospitalId = (req as any).user?.hospitalId;
    const { dha, payment, notifications } = req.body;

    if (!hospitalId) {
      return sendError(res, 'Hospital ID required', 400);
    }

    // Get existing settings to preserve masked values
    const existing = await prisma.hospitalSettings.findUnique({
      where: { hospitalId },
    });

    // Restore full secrets if masked values sent
    const processedDha = dha ? {
      ...dha,
      apiKey: isFullSecret(dha.apiKey) ? dha.apiKey : (existing?.dhaSettings as any)?.apiKey || '',
    } : null;

    const processedPayment = payment ? {
      ...payment,
      stripeSecretKey: isFullSecret(payment.stripeSecretKey) ? payment.stripeSecretKey : (existing?.paymentSettings as any)?.stripeSecretKey || '',
      payfortAccessCode: isFullSecret(payment.payfortAccessCode) ? payment.payfortAccessCode : (existing?.paymentSettings as any)?.payfortAccessCode || '',
      payfortShaRequestPhrase: isFullSecret(payment.payfortShaRequestPhrase) ? payment.payfortShaRequestPhrase : (existing?.paymentSettings as any)?.payfortShaRequestPhrase || '',
      payfortShaResponsePhrase: isFullSecret(payment.payfortShaResponsePhrase) ? payment.payfortShaResponsePhrase : (existing?.paymentSettings as any)?.payfortShaResponsePhrase || '',
      niApiKey: isFullSecret(payment.niApiKey) ? payment.niApiKey : (existing?.paymentSettings as any)?.niApiKey || '',
    } : null;

    // Upsert settings
    const settings = await prisma.hospitalSettings.upsert({
      where: { hospitalId },
      update: {
        dhaSettings: processedDha,
        paymentSettings: processedPayment,
        notificationSettings: notifications,
        updatedAt: new Date(),
      },
      create: {
        hospitalId,
        dhaSettings: processedDha,
        paymentSettings: processedPayment,
        notificationSettings: notifications,
      },
    });

    // Also update environment variables in memory for immediate effect
    if (processedDha?.enabled) {
      process.env.DHA_ECLAIM_ENABLED = 'true';
      process.env.DHA_ECLAIM_URL = processedDha.baseUrl;
      process.env.DHA_FACILITY_ID = processedDha.facilityId;
      process.env.DHA_LICENSE_NUMBER = processedDha.licenseNumber;
      process.env.DHA_API_KEY = processedDha.apiKey;
    }

    sendSuccess(res, { message: 'Settings saved successfully' });
  } catch (error: any) {
    console.error('Error saving settings:', error);
    sendError(res, error.message || 'Failed to save settings', 500);
  }
});

/**
 * POST /api/settings/test-dha
 * Test DHA eClaimLink connection
 */
router.post('/test-dha', async (req, res) => {
  try {
    const { baseUrl, facilityId, licenseNumber, apiKey, testMode } = req.body;

    if (!baseUrl || !facilityId || !apiKey) {
      return sendError(res, 'Missing required DHA configuration', 400);
    }

    // Build test SOAP request
    const testRequest = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:ecl="http://dha.gov.ae/eclaimlink">
  <soap:Header>
    <ecl:Authentication>
      <ecl:FacilityID>${facilityId}</ecl:FacilityID>
      <ecl:LicenseNumber>${licenseNumber}</ecl:LicenseNumber>
      <ecl:APIKey>${apiKey}</ecl:APIKey>
    </ecl:Authentication>
  </soap:Header>
  <soap:Body>
    <ecl:PingRequest>
      <ecl:TestMode>${testMode ? 'true' : 'false'}</ecl:TestMode>
    </ecl:PingRequest>
  </soap:Body>
</soap:Envelope>`;

    const response = await axios.post(
      `${baseUrl}/ping`,
      testRequest,
      {
        headers: {
          'Content-Type': 'application/xml',
          'Accept': 'application/xml',
        },
        timeout: 15000,
        validateStatus: () => true, // Accept any status
      }
    );

    if (response.status >= 200 && response.status < 300) {
      sendSuccess(res, { message: 'DHA connection successful' });
    } else {
      sendError(res, `DHA returned status ${response.status}: ${response.data}`, 400);
    }
  } catch (error: any) {
    console.error('DHA connection test failed:', error);
    sendError(res, `Connection failed: ${error.message}`, 500);
  }
});

/**
 * POST /api/settings/test-payment
 * Test payment gateway connection
 */
router.post('/test-payment', async (req, res) => {
  try {
    const { provider, testMode, stripeSecretKey, payfortMerchantId, payfortAccessCode, niOutletId, niApiKey } = req.body;

    if (provider === 'stripe') {
      if (!stripeSecretKey) {
        return sendError(res, 'Stripe secret key required', 400);
      }
      
      const stripe = new Stripe(stripeSecretKey, {
        apiVersion: '2023-10-16',
      });
      
      // Test connection by fetching account
      const account = await stripe.accounts.retrieve();
      sendSuccess(res, { 
        message: 'Stripe connection successful',
        accountId: account.id,
      });
      
    } else if (provider === 'payfort') {
      if (!payfortMerchantId || !payfortAccessCode) {
        return sendError(res, 'PayFort merchant ID and access code required', 400);
      }
      
      // PayFort doesn't have a ping endpoint, just validate format
      if (payfortMerchantId.length < 5) {
        return sendError(res, 'Invalid PayFort merchant ID format', 400);
      }
      sendSuccess(res, { message: 'PayFort credentials validated (live test requires transaction)' });
      
    } else if (provider === 'network_international') {
      if (!niOutletId || !niApiKey) {
        return sendError(res, 'Network International outlet ID and API key required', 400);
      }
      
      // Test N-Genius gateway
      const baseUrl = testMode 
        ? 'https://api-gateway.sandbox.ngenius-payments.com'
        : 'https://api-gateway.ngenius-payments.com';
        
      const response = await axios.post(
        `${baseUrl}/identity/auth/access-token`,
        {},
        {
          headers: {
            'Authorization': `Basic ${Buffer.from(niApiKey).toString('base64')}`,
            'Content-Type': 'application/vnd.ni-identity.v1+json',
          },
          timeout: 10000,
          validateStatus: () => true,
        }
      );
      
      if (response.status === 200) {
        sendSuccess(res, { message: 'Network International connection successful' });
      } else {
        sendError(res, `Gateway returned status ${response.status}`, 400);
      }
      
    } else {
      sendError(res, 'Unknown payment provider', 400);
    }
  } catch (error: any) {
    console.error('Payment gateway test failed:', error);
    sendError(res, `Connection failed: ${error.message}`, 500);
  }
});

// Helper functions
function maskSecret(value: string | undefined): string {
  if (!value || value.length < 8) return value || '';
  return value.substring(0, 4) + '****' + value.substring(value.length - 4);
}

function isFullSecret(value: string | undefined): boolean {
  // If it contains ****, it's a masked value
  return !!value && !value.includes('****');
}

export default router;
