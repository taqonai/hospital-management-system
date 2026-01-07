import { SNSClient, PublishCommand, SetSMSAttributesCommand, GetSMSAttributesCommand } from '@aws-sdk/client-sns';
import { logger } from '../utils/logger';

// AWS SNS configuration from environment variables
const AWS_REGION = process.env.AWS_SNS_REGION || process.env.AWS_REGION || 'us-east-1';
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const SMS_SENDER_ID = process.env.AWS_SNS_SENDER_ID || 'HMS'; // 11 character alphanumeric sender ID

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_SMS_PER_NUMBER_PER_HOUR = 10;

// In-memory rate limiting store (consider using Redis in production)
const rateLimitStore: Map<string, { count: number; resetTime: number }> = new Map();

// AWS SNS client (lazy initialization)
let snsClient: SNSClient | null = null;

/**
 * Get or initialize the AWS SNS client
 */
function getSNSClient(): SNSClient {
  if (!snsClient) {
    const config: any = {
      region: AWS_REGION,
    };

    // Use explicit credentials if provided, otherwise use default AWS credential chain
    if (AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY) {
      config.credentials = {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
      };
    }

    snsClient = new SNSClient(config);
    logger.info('AWS SNS client initialized', { region: AWS_REGION });
  }
  return snsClient;
}

/**
 * Check if AWS SNS is properly configured
 */
function isSNSConfigured(): boolean {
  // AWS SDK will use instance profile, environment variables, or explicit credentials
  return !!(AWS_REGION);
}

/**
 * Custom error class for SMS service errors
 */
export class SMSServiceError extends Error {
  code: string;
  awsErrorCode?: string;

  constructor(message: string, code: string, awsErrorCode?: string) {
    super(message);
    this.name = 'SMSServiceError';
    this.code = code;
    this.awsErrorCode = awsErrorCode;
  }
}

/**
 * SMS delivery status interface
 */
export interface SMSDeliveryStatus {
  success: boolean;
  messageId?: string;
  status?: string;
  to: string;
  error?: string;
  errorCode?: string;
  timestamp: Date;
}

/**
 * Message template interface
 */
interface MessageTemplateParams {
  patientName?: string;
  doctorName?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  departmentName?: string;
  hospitalName?: string;
  otp?: string;
  expiryMinutes?: number;
  testNames?: string;
  prescriptionId?: string;
  pharmacyLocation?: string;
  alertType?: string;
  alertMessage?: string;
}

// ============================================
// MESSAGE TEMPLATES
// ============================================

/**
 * Message templates for different SMS types
 * All templates are designed to be under 160 characters when possible
 */
const messageTemplates = {
  /**
   * OTP verification template (under 160 chars)
   */
  otp: (params: MessageTemplateParams): string => {
    const { otp, expiryMinutes = 10, hospitalName = 'HMS' } = params;
    return `${hospitalName}: Your verification code is ${otp}. Valid for ${expiryMinutes} min. Do not share this code.`;
  },

  /**
   * Appointment reminder template
   */
  appointmentReminder: (params: MessageTemplateParams): string => {
    const {
      patientName,
      doctorName,
      appointmentDate,
      appointmentTime,
      departmentName,
      hospitalName = 'HMS',
    } = params;
    return `${hospitalName}: Hi ${patientName}, reminder for your appointment with Dr. ${doctorName} (${departmentName}) on ${appointmentDate} at ${appointmentTime}. Reply CONFIRM to confirm or CANCEL to cancel.`;
  },

  /**
   * Lab results ready template
   */
  labResultsReady: (params: MessageTemplateParams): string => {
    const { patientName, testNames, hospitalName = 'HMS' } = params;
    return `${hospitalName}: Hi ${patientName}, your lab results for ${testNames} are now ready. Please log in to the patient portal or visit the hospital to collect your reports.`;
  },

  /**
   * Prescription ready template
   */
  prescriptionReady: (params: MessageTemplateParams): string => {
    const {
      patientName,
      prescriptionId,
      pharmacyLocation,
      hospitalName = 'HMS',
    } = params;
    return `${hospitalName}: Hi ${patientName}, your prescription #${prescriptionId} is ready for pickup at ${pharmacyLocation}. Please bring a valid ID.`;
  },

  /**
   * Emergency alert template
   */
  emergencyAlert: (params: MessageTemplateParams): string => {
    const { alertType, alertMessage, hospitalName = 'HMS' } = params;
    return `${hospitalName} ALERT [${alertType}]: ${alertMessage}`;
  },
};

// ============================================
// RATE LIMITING
// ============================================

/**
 * Check if a phone number has exceeded the rate limit
 */
function isRateLimited(phoneNumber: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(phoneNumber);

  if (!entry) {
    return false;
  }

  // Reset if window has passed
  if (now > entry.resetTime) {
    rateLimitStore.delete(phoneNumber);
    return false;
  }

  return entry.count >= MAX_SMS_PER_NUMBER_PER_HOUR;
}

/**
 * Increment the rate limit counter for a phone number
 */
function incrementRateLimitCounter(phoneNumber: string): void {
  const now = Date.now();
  const entry = rateLimitStore.get(phoneNumber);

  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(phoneNumber, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
    });
  } else {
    entry.count += 1;
  }
}

/**
 * Get remaining SMS quota for a phone number
 */
function getRemainingQuota(phoneNumber: string): number {
  const entry = rateLimitStore.get(phoneNumber);
  const now = Date.now();

  if (!entry || now > entry.resetTime) {
    return MAX_SMS_PER_NUMBER_PER_HOUR;
  }

  return Math.max(0, MAX_SMS_PER_NUMBER_PER_HOUR - entry.count);
}

// ============================================
// PHONE NUMBER VALIDATION
// ============================================

/**
 * Normalize phone number to E.164 format
 * Basic validation - AWS SNS will perform full validation
 */
function normalizePhoneNumber(phoneNumber: string): string {
  // Remove all non-digit characters except leading +
  let normalized = phoneNumber.replace(/[^\d+]/g, '');

  // Ensure it starts with +
  if (!normalized.startsWith('+')) {
    // Assume US number if no country code
    if (normalized.length === 10) {
      normalized = '+1' + normalized;
    } else if (normalized.length === 11 && normalized.startsWith('1')) {
      normalized = '+' + normalized;
    } else {
      // Keep as is, AWS SNS will validate
      normalized = '+' + normalized;
    }
  }

  return normalized;
}

/**
 * Basic phone number validation
 */
function isValidPhoneNumber(phoneNumber: string): boolean {
  const normalized = normalizePhoneNumber(phoneNumber);
  // E.164 format: + followed by 1-15 digits
  return /^\+[1-9]\d{1,14}$/.test(normalized);
}

// ============================================
// CORE SMS FUNCTIONS
// ============================================

/**
 * Send an SMS message via AWS SNS
 * @param to - Recipient phone number
 * @param message - Message content
 * @returns SMS delivery status
 */
export async function sendSMS(
  to: string,
  message: string
): Promise<SMSDeliveryStatus> {
  const timestamp = new Date();

  // Validate configuration
  if (!isSNSConfigured()) {
    logger.warn('SMS not sent: AWS SNS not configured', { to });
    return {
      success: false,
      to,
      error: 'AWS SNS SMS service is not configured',
      errorCode: 'NOT_CONFIGURED',
      timestamp,
    };
  }

  // Validate phone number
  if (!isValidPhoneNumber(to)) {
    logger.warn('SMS not sent: Invalid phone number', { to });
    return {
      success: false,
      to,
      error: 'Invalid phone number format',
      errorCode: 'INVALID_PHONE',
      timestamp,
    };
  }

  const normalizedNumber = normalizePhoneNumber(to);

  // Check rate limiting
  if (isRateLimited(normalizedNumber)) {
    logger.warn('SMS not sent: Rate limit exceeded', { to: normalizedNumber });
    return {
      success: false,
      to: normalizedNumber,
      error: `Rate limit exceeded. Maximum ${MAX_SMS_PER_NUMBER_PER_HOUR} SMS per hour.`,
      errorCode: 'RATE_LIMITED',
      timestamp,
    };
  }

  try {
    const client = getSNSClient();

    const command = new PublishCommand({
      PhoneNumber: normalizedNumber,
      Message: message,
      MessageAttributes: {
        'AWS.SNS.SMS.SenderID': {
          DataType: 'String',
          StringValue: SMS_SENDER_ID,
        },
        'AWS.SNS.SMS.SMSType': {
          DataType: 'String',
          StringValue: 'Transactional', // Transactional for OTPs, Promotional for marketing
        },
      },
    });

    const response = await client.send(command);

    // Increment rate limit counter on successful send
    incrementRateLimitCounter(normalizedNumber);

    logger.info('SMS sent successfully via AWS SNS', {
      to: normalizedNumber,
      messageId: response.MessageId,
    });

    return {
      success: true,
      messageId: response.MessageId,
      status: 'sent',
      to: normalizedNumber,
      timestamp,
    };
  } catch (error: any) {
    const awsErrorCode = error.name || error.code;
    const errorMessage = error.message || 'Unknown error occurred';

    logger.error('Failed to send SMS via AWS SNS', {
      to: normalizedNumber,
      error: errorMessage,
      awsErrorCode,
    });

    // Map common AWS SNS error codes to user-friendly messages
    let friendlyError = errorMessage;
    if (awsErrorCode === 'InvalidParameterValue') {
      friendlyError = 'Invalid phone number format';
    } else if (awsErrorCode === 'AuthorizationErrorException') {
      friendlyError = 'SMS authorization failed';
    } else if (awsErrorCode === 'ThrottlingException') {
      friendlyError = 'SMS sending rate exceeded. Please try again later.';
    } else if (awsErrorCode === 'OptedOutException') {
      friendlyError = 'Recipient has opted out of receiving SMS';
    } else if (awsErrorCode === 'InvalidParameter') {
      friendlyError = 'Invalid SMS parameters';
    }

    return {
      success: false,
      to: normalizedNumber,
      error: friendlyError,
      errorCode: awsErrorCode || 'UNKNOWN',
      timestamp,
    };
  }
}

/**
 * Send OTP verification code
 * @param to - Recipient phone number
 * @param otp - The OTP code to send
 * @param expiryMinutes - OTP expiry time in minutes (default: 10)
 * @param hospitalName - Hospital name for branding
 * @returns SMS delivery status
 */
export async function sendOTP(
  to: string,
  otp: string,
  expiryMinutes: number = 10,
  hospitalName: string = 'HMS'
): Promise<SMSDeliveryStatus> {
  const message = messageTemplates.otp({
    otp,
    expiryMinutes,
    hospitalName,
  });

  logger.debug('Sending OTP via AWS SNS', { to, expiryMinutes });
  return sendSMS(to, message);
}

/**
 * Send appointment reminder
 * @param to - Recipient phone number
 * @param params - Appointment details
 * @returns SMS delivery status
 */
export async function sendAppointmentReminder(
  to: string,
  params: {
    patientName: string;
    doctorName: string;
    appointmentDate: string;
    appointmentTime: string;
    departmentName: string;
    hospitalName?: string;
  }
): Promise<SMSDeliveryStatus> {
  const message = messageTemplates.appointmentReminder(params);

  logger.debug('Sending appointment reminder', {
    to,
    patientName: params.patientName,
    appointmentDate: params.appointmentDate,
  });

  return sendSMS(to, message);
}

/**
 * Send lab results ready notification
 * @param to - Recipient phone number
 * @param params - Lab result details
 * @returns SMS delivery status
 */
export async function sendLabResultsAlert(
  to: string,
  params: {
    patientName: string;
    testNames: string;
    hospitalName?: string;
  }
): Promise<SMSDeliveryStatus> {
  const message = messageTemplates.labResultsReady(params);

  logger.debug('Sending lab results notification', {
    to,
    patientName: params.patientName,
    testNames: params.testNames,
  });

  return sendSMS(to, message);
}

/**
 * Send prescription ready notification
 * @param to - Recipient phone number
 * @param params - Prescription details
 * @returns SMS delivery status
 */
export async function sendPrescriptionReady(
  to: string,
  params: {
    patientName: string;
    prescriptionId: string;
    pharmacyLocation: string;
    hospitalName?: string;
  }
): Promise<SMSDeliveryStatus> {
  const message = messageTemplates.prescriptionReady(params);

  logger.debug('Sending prescription ready notification', {
    to,
    patientName: params.patientName,
    prescriptionId: params.prescriptionId,
  });

  return sendSMS(to, message);
}

/**
 * Send emergency alert
 * @param to - Recipient phone number
 * @param params - Alert details
 * @returns SMS delivery status
 */
export async function sendEmergencyAlert(
  to: string,
  params: {
    alertType: string;
    alertMessage: string;
    hospitalName?: string;
  }
): Promise<SMSDeliveryStatus> {
  const message = messageTemplates.emergencyAlert(params);

  logger.warn('Sending emergency alert', {
    to,
    alertType: params.alertType,
  });

  return sendSMS(to, message);
}

/**
 * Send bulk SMS to multiple recipients
 * @param recipients - Array of phone numbers
 * @param message - Message content
 * @returns Array of SMS delivery statuses
 */
export async function sendBulkSMS(
  recipients: string[],
  message: string
): Promise<SMSDeliveryStatus[]> {
  logger.info('Sending bulk SMS', { recipientCount: recipients.length });

  const results = await Promise.all(
    recipients.map((to) => sendSMS(to, message))
  );

  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.filter((r) => !r.success).length;

  logger.info('Bulk SMS completed', { successCount, failureCount });

  return results;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Check SMS service health and configuration status
 */
export async function checkSMSServiceHealth(): Promise<{
  configured: boolean;
  healthy: boolean;
  message: string;
  provider: string;
}> {
  if (!isSNSConfigured()) {
    return {
      configured: false,
      healthy: false,
      message: 'AWS SNS SMS service is not configured. Missing region configuration.',
      provider: 'AWS SNS',
    };
  }

  try {
    const client = getSNSClient();
    // Check current SMS attributes to verify access
    const command = new GetSMSAttributesCommand({
      attributes: ['DefaultSMSType'],
    });
    await client.send(command);

    return {
      configured: true,
      healthy: true,
      message: 'AWS SNS SMS service is configured and healthy',
      provider: 'AWS SNS',
    };
  } catch (error: any) {
    return {
      configured: true,
      healthy: false,
      message: `AWS SNS connection failed: ${error.message}`,
      provider: 'AWS SNS',
    };
  }
}

/**
 * Set default SMS type (Transactional or Promotional)
 * Transactional: Higher delivery priority, for OTPs and alerts
 * Promotional: Cost-effective, for marketing messages
 */
export async function setDefaultSMSType(type: 'Transactional' | 'Promotional'): Promise<void> {
  const client = getSNSClient();
  const command = new SetSMSAttributesCommand({
    attributes: {
      DefaultSMSType: type,
    },
  });
  await client.send(command);
  logger.info('Set default SMS type', { type });
}

/**
 * Get rate limit status for a phone number
 */
export function getRateLimitStatus(phoneNumber: string): {
  isLimited: boolean;
  remaining: number;
  resetTime?: Date;
} {
  const normalized = normalizePhoneNumber(phoneNumber);
  const entry = rateLimitStore.get(normalized);
  const now = Date.now();

  if (!entry || now > entry.resetTime) {
    return {
      isLimited: false,
      remaining: MAX_SMS_PER_NUMBER_PER_HOUR,
    };
  }

  return {
    isLimited: entry.count >= MAX_SMS_PER_NUMBER_PER_HOUR,
    remaining: Math.max(0, MAX_SMS_PER_NUMBER_PER_HOUR - entry.count),
    resetTime: new Date(entry.resetTime),
  };
}

/**
 * Clear rate limit for a phone number (admin use only)
 */
export function clearRateLimit(phoneNumber: string): void {
  const normalized = normalizePhoneNumber(phoneNumber);
  rateLimitStore.delete(normalized);
  logger.info('Rate limit cleared', { phoneNumber: normalized });
}

/**
 * SMS Service class for dependency injection patterns
 */
export class SMSService {
  sendSMS = sendSMS;
  sendOTP = sendOTP;
  sendAppointmentReminder = sendAppointmentReminder;
  sendLabResultsAlert = sendLabResultsAlert;
  sendPrescriptionReady = sendPrescriptionReady;
  sendEmergencyAlert = sendEmergencyAlert;
  sendBulkSMS = sendBulkSMS;
  checkHealth = checkSMSServiceHealth;
  getRateLimitStatus = getRateLimitStatus;
  clearRateLimit = clearRateLimit;
  setDefaultSMSType = setDefaultSMSType;
}

export const smsService = new SMSService();
export default smsService;
