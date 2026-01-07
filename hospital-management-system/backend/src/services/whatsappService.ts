import twilio from 'twilio';
import { logger } from '../utils/logger';

// Twilio configuration from environment variables
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

// Initialize Twilio client (lazy initialization to handle missing credentials gracefully)
let twilioClient: twilio.Twilio | null = null;

const getTwilioClient = (): twilio.Twilio => {
  if (!twilioClient) {
    if (!accountSid || !authToken) {
      throw new Error('Twilio credentials not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables.');
    }
    twilioClient = twilio(accountSid, authToken);
  }
  return twilioClient;
};

// Types for WhatsApp message options
interface WhatsAppMessageOptions {
  to: string;
  body: string;
  mediaUrl?: string[];
}

interface WhatsAppMessageResult {
  success: boolean;
  messageSid?: string;
  error?: string;
  status?: string;
}

// Appointment details interface
interface AppointmentDetails {
  patientName: string;
  doctorName: string;
  department?: string;
  date: string;
  time: string;
  location?: string;
  appointmentId?: string;
  tokenNumber?: number;
}

// Lab results notification interface
interface LabResultsDetails {
  patientName: string;
  testName: string;
  testDate?: string;
  collectionDate?: string;
  portalUrl?: string;
  hospitalName?: string;
}

// Prescription ready notification interface
interface PrescriptionDetails {
  patientName: string;
  prescriptionId?: string;
  medicationCount?: number;
  pharmacyLocation?: string;
  pharmacyPhone?: string;
  pickupDeadline?: string;
  hospitalName?: string;
}

// Payment/billing notification interface
interface BillingDetails {
  patientName: string;
  invoiceNumber?: string;
  amount: number;
  currency?: string;
  dueDate?: string;
  paymentUrl?: string;
  hospitalName?: string;
  description?: string;
}

/**
 * Format phone number to WhatsApp format
 * Ensures the number starts with 'whatsapp:' and includes country code
 */
const formatWhatsAppNumber = (phoneNumber: string): string => {
  // Remove any existing 'whatsapp:' prefix
  let cleanNumber = phoneNumber.replace(/^whatsapp:/, '').trim();

  // Remove spaces, dashes, and parentheses
  cleanNumber = cleanNumber.replace(/[\s\-\(\)]/g, '');

  // Ensure it starts with '+'
  if (!cleanNumber.startsWith('+')) {
    // If number doesn't have country code, assume it's missing (you may want to add default country code)
    cleanNumber = `+${cleanNumber}`;
  }

  return `whatsapp:${cleanNumber}`;
};

/**
 * Format currency amount
 */
const formatCurrency = (amount: number, currency: string = 'INR'): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

/**
 * Send a WhatsApp message using Twilio
 * @param options - Message options including recipient and body
 * @returns Promise with message result
 */
export const sendWhatsApp = async (options: WhatsAppMessageOptions): Promise<WhatsAppMessageResult> => {
  try {
    const client = getTwilioClient();

    const formattedTo = formatWhatsAppNumber(options.to);

    logger.info(`Sending WhatsApp message to ${formattedTo}`);

    const messageParams: any = {
      from: whatsappNumber,
      to: formattedTo,
      body: options.body,
    };

    // Add media URL if provided (for sending images, documents, etc.)
    if (options.mediaUrl && options.mediaUrl.length > 0) {
      messageParams.mediaUrl = options.mediaUrl;
    }

    const message = await client.messages.create(messageParams);

    logger.info(`WhatsApp message sent successfully. SID: ${message.sid}, Status: ${message.status}`);

    return {
      success: true,
      messageSid: message.sid,
      status: message.status,
    };
  } catch (error: any) {
    logger.error(`Failed to send WhatsApp message: ${error.message}`);

    // Handle specific Twilio errors
    if (error.code === 21211) {
      return {
        success: false,
        error: 'Invalid phone number format',
      };
    }
    if (error.code === 21608) {
      return {
        success: false,
        error: 'WhatsApp number not registered or user has not opted in',
      };
    }
    if (error.code === 63016) {
      return {
        success: false,
        error: 'WhatsApp template not approved. Please use an approved template.',
      };
    }

    return {
      success: false,
      error: error.message || 'Failed to send WhatsApp message',
    };
  }
};

/**
 * Send OTP verification code via WhatsApp
 * Uses a simple format that works with Twilio's pre-approved templates
 * @param to - Recipient phone number
 * @param otp - The OTP code to send
 * @param expiryMinutes - OTP expiry time in minutes (default: 10)
 * @param hospitalName - Optional hospital name for branding
 */
export const sendWhatsAppOTP = async (
  to: string,
  otp: string,
  expiryMinutes: number = 10,
  hospitalName?: string
): Promise<WhatsAppMessageResult> => {
  // Format OTP with spaces for readability (e.g., "1 2 3 4 5 6")
  const formattedOTP = otp.split('').join(' ');

  // Using a format compatible with Twilio's pre-approved OTP template
  // Note: For production, use your own approved WhatsApp Business template
  const body = hospitalName
    ? `*${hospitalName}*\n\nYour verification code is:\n\n*${formattedOTP}*\n\nThis code expires in ${expiryMinutes} minutes.\n\n_Do not share this code with anyone. Our staff will never ask for your OTP._`
    : `Your verification code is:\n\n*${formattedOTP}*\n\nThis code expires in ${expiryMinutes} minutes.\n\n_Do not share this code with anyone._`;

  logger.info(`Sending OTP to ${to}`);

  return sendWhatsApp({ to, body });
};

/**
 * Send appointment confirmation via WhatsApp
 * @param to - Recipient phone number
 * @param details - Appointment details
 * @param hospitalName - Hospital name for branding
 */
export const sendAppointmentWhatsApp = async (
  to: string,
  details: AppointmentDetails,
  hospitalName?: string
): Promise<WhatsAppMessageResult> => {
  const hospitalHeader = hospitalName ? `*${hospitalName}*\n\n` : '';

  let body = `${hospitalHeader}*Appointment Confirmed*\n\n`;
  body += `Hello *${details.patientName}*,\n\n`;
  body += `Your appointment has been confirmed:\n\n`;
  body += `*Doctor:* ${details.doctorName}\n`;

  if (details.department) {
    body += `*Department:* ${details.department}\n`;
  }

  body += `*Date:* ${details.date}\n`;
  body += `*Time:* ${details.time}\n`;

  if (details.tokenNumber) {
    body += `*Token Number:* ${details.tokenNumber}\n`;
  }

  if (details.location) {
    body += `*Location:* ${details.location}\n`;
  }

  if (details.appointmentId) {
    body += `\n_Appointment ID: ${details.appointmentId}_\n`;
  }

  body += `\n*Please arrive 15 minutes early* for registration.\n`;
  body += `\n_To reschedule or cancel, please contact us or visit our patient portal._`;

  logger.info(`Sending appointment confirmation to ${to} for appointment on ${details.date}`);

  return sendWhatsApp({ to, body });
};

/**
 * Send appointment reminder via WhatsApp
 * @param to - Recipient phone number
 * @param details - Appointment details
 * @param reminderType - Type of reminder ('day_before' | 'hours_before' | 'same_day')
 * @param hospitalName - Hospital name for branding
 */
export const sendAppointmentReminder = async (
  to: string,
  details: AppointmentDetails,
  reminderType: 'day_before' | 'hours_before' | 'same_day' = 'day_before',
  hospitalName?: string
): Promise<WhatsAppMessageResult> => {
  const hospitalHeader = hospitalName ? `*${hospitalName}*\n\n` : '';

  let reminderText = '';
  switch (reminderType) {
    case 'day_before':
      reminderText = 'This is a reminder for your appointment *tomorrow*:';
      break;
    case 'hours_before':
      reminderText = 'This is a reminder for your appointment in a *few hours*:';
      break;
    case 'same_day':
      reminderText = 'This is a reminder for your appointment *today*:';
      break;
  }

  let body = `${hospitalHeader}*Appointment Reminder*\n\n`;
  body += `Hello *${details.patientName}*,\n\n`;
  body += `${reminderText}\n\n`;
  body += `*Doctor:* ${details.doctorName}\n`;

  if (details.department) {
    body += `*Department:* ${details.department}\n`;
  }

  body += `*Date:* ${details.date}\n`;
  body += `*Time:* ${details.time}\n`;

  if (details.tokenNumber) {
    body += `*Token Number:* ${details.tokenNumber}\n`;
  }

  if (details.location) {
    body += `*Location:* ${details.location}\n`;
  }

  body += `\n*Please arrive 15 minutes early* for registration.\n`;
  body += `\n_Reply CONFIRM to confirm or CANCEL to cancel your appointment._`;

  logger.info(`Sending appointment reminder (${reminderType}) to ${to}`);

  return sendWhatsApp({ to, body });
};

/**
 * Send lab results ready notification via WhatsApp
 * @param to - Recipient phone number
 * @param details - Lab results details
 */
export const sendLabResultsWhatsApp = async (
  to: string,
  details: LabResultsDetails
): Promise<WhatsAppMessageResult> => {
  const hospitalHeader = details.hospitalName ? `*${details.hospitalName}*\n\n` : '';

  let body = `${hospitalHeader}*Lab Results Ready*\n\n`;
  body += `Hello *${details.patientName}*,\n\n`;
  body += `Your lab results are now available:\n\n`;
  body += `*Test:* ${details.testName}\n`;

  if (details.testDate) {
    body += `*Test Date:* ${details.testDate}\n`;
  }

  if (details.collectionDate) {
    body += `*Sample Collection:* ${details.collectionDate}\n`;
  }

  body += `\n*How to access your results:*\n`;
  body += `1. Log in to the patient portal\n`;
  body += `2. Go to "My Lab Results"\n`;
  body += `3. View or download your report\n`;

  if (details.portalUrl) {
    body += `\n*Portal:* ${details.portalUrl}\n`;
  }

  body += `\n_For any questions about your results, please consult your doctor._`;

  logger.info(`Sending lab results notification to ${to} for test: ${details.testName}`);

  return sendWhatsApp({ to, body });
};

/**
 * Send prescription ready for pickup notification via WhatsApp
 * @param to - Recipient phone number
 * @param details - Prescription details
 */
export const sendPrescriptionReadyWhatsApp = async (
  to: string,
  details: PrescriptionDetails
): Promise<WhatsAppMessageResult> => {
  const hospitalHeader = details.hospitalName ? `*${details.hospitalName}*\n\n` : '';

  let body = `${hospitalHeader}*Prescription Ready for Pickup*\n\n`;
  body += `Hello *${details.patientName}*,\n\n`;
  body += `Your prescription is ready for pickup at our pharmacy.\n\n`;

  if (details.prescriptionId) {
    body += `*Prescription ID:* ${details.prescriptionId}\n`;
  }

  if (details.medicationCount) {
    body += `*Medications:* ${details.medicationCount} item(s)\n`;
  }

  if (details.pharmacyLocation) {
    body += `\n*Pharmacy Location:*\n${details.pharmacyLocation}\n`;
  }

  if (details.pharmacyPhone) {
    body += `*Pharmacy Phone:* ${details.pharmacyPhone}\n`;
  }

  if (details.pickupDeadline) {
    body += `\n*Please pick up by:* ${details.pickupDeadline}\n`;
  }

  body += `\n*What to bring:*\n`;
  body += `- Valid ID\n`;
  body += `- This message or prescription ID\n`;

  body += `\n_If you have questions about your medications, our pharmacist is happy to help._`;

  logger.info(`Sending prescription ready notification to ${to}`);

  return sendWhatsApp({ to, body });
};

/**
 * Send payment/billing notification via WhatsApp
 * @param to - Recipient phone number
 * @param details - Billing details
 * @param notificationType - Type of billing notification
 */
export const sendBillingWhatsApp = async (
  to: string,
  details: BillingDetails,
  notificationType: 'invoice' | 'payment_due' | 'payment_received' | 'payment_reminder' = 'invoice'
): Promise<WhatsAppMessageResult> => {
  const hospitalHeader = details.hospitalName ? `*${details.hospitalName}*\n\n` : '';
  const formattedAmount = formatCurrency(details.amount, details.currency);

  let body = hospitalHeader;

  switch (notificationType) {
    case 'invoice':
      body += `*New Invoice*\n\n`;
      body += `Hello *${details.patientName}*,\n\n`;
      body += `A new invoice has been generated for your recent visit.\n\n`;
      break;
    case 'payment_due':
      body += `*Payment Due*\n\n`;
      body += `Hello *${details.patientName}*,\n\n`;
      body += `This is a reminder that your payment is due.\n\n`;
      break;
    case 'payment_received':
      body += `*Payment Confirmation*\n\n`;
      body += `Hello *${details.patientName}*,\n\n`;
      body += `Thank you! We have received your payment.\n\n`;
      break;
    case 'payment_reminder':
      body += `*Payment Reminder*\n\n`;
      body += `Hello *${details.patientName}*,\n\n`;
      body += `This is a friendly reminder about your pending payment.\n\n`;
      break;
  }

  if (details.invoiceNumber) {
    body += `*Invoice Number:* ${details.invoiceNumber}\n`;
  }

  body += `*Amount:* ${formattedAmount}\n`;

  if (details.description) {
    body += `*Description:* ${details.description}\n`;
  }

  if (details.dueDate && notificationType !== 'payment_received') {
    body += `*Due Date:* ${details.dueDate}\n`;
  }

  if (details.paymentUrl && notificationType !== 'payment_received') {
    body += `\n*Pay Online:* ${details.paymentUrl}\n`;
  }

  if (notificationType === 'payment_received') {
    body += `\n_A receipt has been sent to your registered email address._`;
  } else {
    body += `\n*Payment Options:*\n`;
    body += `- Online payment portal\n`;
    body += `- Cash/Card at hospital billing counter\n`;
    body += `\n_For billing queries, contact our billing department._`;
  }

  logger.info(`Sending billing notification (${notificationType}) to ${to}, amount: ${formattedAmount}`);

  return sendWhatsApp({ to, body });
};

/**
 * Send a custom templated message via WhatsApp
 * Useful for creating custom notifications
 * @param to - Recipient phone number
 * @param templateName - Template identifier
 * @param variables - Variables to replace in template
 * @param hospitalName - Hospital name for branding
 */
export const sendTemplatedWhatsApp = async (
  to: string,
  templateName: string,
  variables: Record<string, string>,
  hospitalName?: string
): Promise<WhatsAppMessageResult> => {
  // Define message templates
  // Note: In production, these should match your approved WhatsApp Business templates
  const templates: Record<string, string> = {
    welcome: `*Welcome to {hospitalName}!*\n\nHello *{patientName}*,\n\nThank you for registering with us. Your patient ID is *{patientId}*.\n\n_Download our app or visit the patient portal to manage your appointments and health records._`,

    discharge: `*Discharge Summary*\n\nHello *{patientName}*,\n\nYou have been discharged from {hospitalName}.\n\n*Discharge Date:* {dischargeDate}\n*Follow-up:* {followUpDate}\n\n_Please follow the prescribed medications and instructions. Contact us if you have any concerns._`,

    feedback: `*We Value Your Feedback*\n\nHello *{patientName}*,\n\nThank you for visiting {hospitalName}.\n\nWe would appreciate your feedback on your recent visit.\n\n*Rate your experience:* {feedbackUrl}\n\n_Your feedback helps us serve you better._`,

    emergency_contact: `*Emergency Alert - {hospitalName}*\n\nThis is an urgent message regarding *{patientName}*.\n\n{emergencyMessage}\n\n*Please contact us immediately:* {emergencyPhone}`,
  };

  const template = templates[templateName];

  if (!template) {
    logger.error(`WhatsApp template not found: ${templateName}`);
    return {
      success: false,
      error: `Template '${templateName}' not found`,
    };
  }

  // Replace variables in template
  let body = template;

  // Add hospital name variable
  if (hospitalName) {
    variables.hospitalName = hospitalName;
  }

  for (const [key, value] of Object.entries(variables)) {
    body = body.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }

  // Check for unreplaced variables
  const unreplacedVars = body.match(/\{[^}]+\}/g);
  if (unreplacedVars) {
    logger.warn(`WhatsApp template has unreplaced variables: ${unreplacedVars.join(', ')}`);
  }

  logger.info(`Sending templated WhatsApp message (${templateName}) to ${to}`);

  return sendWhatsApp({ to, body });
};

/**
 * Check if Twilio WhatsApp service is configured
 * @returns boolean indicating if service is ready
 */
export const isWhatsAppConfigured = (): boolean => {
  return !!(accountSid && authToken && whatsappNumber);
};

/**
 * Get WhatsApp service status
 * @returns Service status information
 */
export const getWhatsAppServiceStatus = async (): Promise<{
  configured: boolean;
  whatsappNumber: string | null;
  accountSid: string | null;
}> => {
  return {
    configured: isWhatsAppConfigured(),
    whatsappNumber: whatsappNumber ? whatsappNumber.replace(/^whatsapp:/, '') : null,
    accountSid: accountSid ? `${accountSid.substring(0, 8)}...` : null,
  };
};

// Export the WhatsApp service as a class for dependency injection patterns
export class WhatsAppService {
  sendMessage = sendWhatsApp;
  sendOTP = sendWhatsAppOTP;
  sendAppointmentConfirmation = sendAppointmentWhatsApp;
  sendAppointmentReminder = sendAppointmentReminder;
  sendLabResultsNotification = sendLabResultsWhatsApp;
  sendPrescriptionReady = sendPrescriptionReadyWhatsApp;
  sendBillingNotification = sendBillingWhatsApp;
  sendTemplated = sendTemplatedWhatsApp;
  isConfigured = isWhatsAppConfigured;
  getStatus = getWhatsAppServiceStatus;
}

export const whatsAppService = new WhatsAppService();

export default whatsAppService;
