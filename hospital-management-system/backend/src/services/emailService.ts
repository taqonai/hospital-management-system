import { SESClient, SendEmailCommand, SendEmailCommandInput } from '@aws-sdk/client-ses';
import nodemailer, { Transporter } from 'nodemailer';
import { config } from '../config';
import logger from '../utils/logger';

// Email configuration from environment variables
const sesConfig = {
  region: process.env.AWS_SES_REGION || process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || '',
  fromEmail: process.env.AWS_SES_FROM_EMAIL || process.env.EMAIL_FROM || 'noreply@hospital.com',
};

// Check if SES is configured
const isSESConfigured = (): boolean => {
  return !!(sesConfig.accessKeyId && sesConfig.secretAccessKey && sesConfig.region);
};

// Initialize SES client
let sesClient: SESClient | null = null;
if (isSESConfigured()) {
  sesClient = new SESClient({
    region: sesConfig.region,
    credentials: {
      accessKeyId: sesConfig.accessKeyId,
      secretAccessKey: sesConfig.secretAccessKey,
    },
  });
  logger.info('AWS SES email service initialized');
}

// Initialize Nodemailer transporter as fallback
let smtpTransporter: Transporter | null = null;
const initSMTPTransporter = (): Transporter | null => {
  if (config.email.host && config.email.user && config.email.pass) {
    return nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.port === 465,
      auth: {
        user: config.email.user,
        pass: config.email.pass,
      },
    });
  }
  return null;
};

if (!isSESConfigured()) {
  smtpTransporter = initSMTPTransporter();
  if (smtpTransporter) {
    logger.info('SMTP email service initialized as fallback');
  } else {
    logger.warn('No email service configured. Emails will not be sent.');
  }
}

// Email interfaces
interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Hospital branding styles for email templates
const emailStyles = `
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
    .header .logo { font-size: 32px; margin-bottom: 10px; }
    .content { padding: 40px 30px; }
    .content h2 { color: #1e40af; margin-top: 0; }
    .otp-box { background-color: #eff6ff; border: 2px solid #2563eb; border-radius: 8px; padding: 20px; text-align: center; margin: 25px 0; }
    .otp-code { font-size: 36px; font-weight: bold; color: #1d4ed8; letter-spacing: 8px; font-family: 'Courier New', monospace; }
    .info-box { background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 15px 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
    .info-row { display: flex; margin: 8px 0; }
    .info-label { font-weight: 600; color: #64748b; min-width: 140px; }
    .info-value { color: #1e293b; }
    .button { display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .button:hover { background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%); }
    .footer { background-color: #f1f5f9; padding: 25px 20px; text-align: center; font-size: 12px; color: #64748b; }
    .footer a { color: #2563eb; text-decoration: none; }
    .divider { height: 1px; background-color: #e2e8f0; margin: 25px 0; }
    .warning { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 15px; margin: 15px 0; border-radius: 0 8px 8px 0; font-size: 13px; }
    .success { background-color: #d1fae5; border-left: 4px solid #10b981; padding: 12px 15px; margin: 15px 0; border-radius: 0 8px 8px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 8px 0; }
  </style>
`;

// Base email template wrapper
const wrapEmailTemplate = (content: string, hospitalName: string = 'Hospital Management System'): string => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${emailStyles}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">&#9764;</div>
          <h1>${hospitalName}</h1>
        </div>
        <div class="content">
          ${content}
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} ${hospitalName}. All rights reserved.</p>
          <p>This is an automated message. Please do not reply directly to this email.</p>
          <p>
            <a href="#">Privacy Policy</a> |
            <a href="#">Terms of Service</a> |
            <a href="#">Contact Us</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Email Templates

/**
 * OTP Verification Email Template
 */
const otpVerificationTemplate = (
  recipientName: string,
  otpCode: string,
  expiryMinutes: number = 10,
  hospitalName?: string
): string => {
  const content = `
    <h2>Verification Code</h2>
    <p>Hello ${recipientName},</p>
    <p>Your verification code for ${hospitalName || 'HMS'} is:</p>
    <div class="otp-box">
      <div class="otp-code">${otpCode}</div>
    </div>
    <p>This code will expire in <strong>${expiryMinutes} minutes</strong>.</p>
    <div class="warning">
      <strong>Security Notice:</strong> Never share this code with anyone. Our staff will never ask for your verification code.
    </div>
    <p>If you didn't request this code, please ignore this email or contact our support team if you have concerns.</p>
  `;
  return wrapEmailTemplate(content, hospitalName);
};

/**
 * Appointment Confirmation Email Template
 */
const appointmentConfirmationTemplate = (
  patientName: string,
  appointmentDetails: {
    doctorName: string;
    department: string;
    date: string;
    time: string;
    location?: string;
    appointmentId: string;
    notes?: string;
  },
  hospitalName?: string
): string => {
  const content = `
    <h2>Appointment Confirmed</h2>
    <p>Dear ${patientName},</p>
    <p>Your appointment has been successfully scheduled. Here are the details:</p>
    <div class="info-box">
      <table>
        <tr>
          <td class="info-label">Appointment ID:</td>
          <td class="info-value"><strong>${appointmentDetails.appointmentId}</strong></td>
        </tr>
        <tr>
          <td class="info-label">Doctor:</td>
          <td class="info-value">Dr. ${appointmentDetails.doctorName}</td>
        </tr>
        <tr>
          <td class="info-label">Department:</td>
          <td class="info-value">${appointmentDetails.department}</td>
        </tr>
        <tr>
          <td class="info-label">Date:</td>
          <td class="info-value">${appointmentDetails.date}</td>
        </tr>
        <tr>
          <td class="info-label">Time:</td>
          <td class="info-value">${appointmentDetails.time}</td>
        </tr>
        ${appointmentDetails.location ? `
        <tr>
          <td class="info-label">Location:</td>
          <td class="info-value">${appointmentDetails.location}</td>
        </tr>
        ` : ''}
      </table>
    </div>
    ${appointmentDetails.notes ? `
    <div class="warning">
      <strong>Note:</strong> ${appointmentDetails.notes}
    </div>
    ` : ''}
    <h3>Important Reminders</h3>
    <ul>
      <li>Please arrive 15 minutes before your scheduled time</li>
      <li>Bring your identification and insurance card</li>
      <li>Bring any relevant medical records or test results</li>
      <li>If you need to reschedule, please contact us at least 24 hours in advance</li>
    </ul>
    <p style="text-align: center;">
      <a href="#" class="button">View Appointment Details</a>
    </p>
  `;
  return wrapEmailTemplate(content, hospitalName);
};

/**
 * Appointment Reminder Email Template
 */
const appointmentReminderTemplate = (
  patientName: string,
  appointmentDetails: {
    doctorName: string;
    department: string;
    date: string;
    time: string;
    location?: string;
    appointmentId: string;
  },
  reminderHours: number = 24,
  hospitalName?: string
): string => {
  const content = `
    <h2>Appointment Reminder</h2>
    <p>Dear ${patientName},</p>
    <p>This is a friendly reminder that you have an upcoming appointment in <strong>${reminderHours} hours</strong>.</p>
    <div class="info-box">
      <table>
        <tr>
          <td class="info-label">Appointment ID:</td>
          <td class="info-value"><strong>${appointmentDetails.appointmentId}</strong></td>
        </tr>
        <tr>
          <td class="info-label">Doctor:</td>
          <td class="info-value">Dr. ${appointmentDetails.doctorName}</td>
        </tr>
        <tr>
          <td class="info-label">Department:</td>
          <td class="info-value">${appointmentDetails.department}</td>
        </tr>
        <tr>
          <td class="info-label">Date:</td>
          <td class="info-value">${appointmentDetails.date}</td>
        </tr>
        <tr>
          <td class="info-label">Time:</td>
          <td class="info-value">${appointmentDetails.time}</td>
        </tr>
        ${appointmentDetails.location ? `
        <tr>
          <td class="info-label">Location:</td>
          <td class="info-value">${appointmentDetails.location}</td>
        </tr>
        ` : ''}
      </table>
    </div>
    <div class="warning">
      <strong>Reminder:</strong> Please arrive 15 minutes early and bring your ID and insurance information.
    </div>
    <p>Need to reschedule? Please contact us as soon as possible.</p>
    <p style="text-align: center;">
      <a href="#" class="button">Manage Appointment</a>
    </p>
  `;
  return wrapEmailTemplate(content, hospitalName);
};

/**
 * Lab Results Ready Email Template
 */
const labResultsReadyTemplate = (
  patientName: string,
  labDetails: {
    testName: string;
    orderedBy: string;
    collectionDate: string;
    resultDate: string;
    labOrderId: string;
  },
  hospitalName?: string
): string => {
  const content = `
    <h2>Lab Results Available</h2>
    <p>Dear ${patientName},</p>
    <p>Your laboratory test results are now available for review.</p>
    <div class="success">
      <strong>Good news!</strong> Your lab results have been processed and are ready for viewing.
    </div>
    <div class="info-box">
      <table>
        <tr>
          <td class="info-label">Lab Order ID:</td>
          <td class="info-value"><strong>${labDetails.labOrderId}</strong></td>
        </tr>
        <tr>
          <td class="info-label">Test Name:</td>
          <td class="info-value">${labDetails.testName}</td>
        </tr>
        <tr>
          <td class="info-label">Ordered By:</td>
          <td class="info-value">Dr. ${labDetails.orderedBy}</td>
        </tr>
        <tr>
          <td class="info-label">Collection Date:</td>
          <td class="info-value">${labDetails.collectionDate}</td>
        </tr>
        <tr>
          <td class="info-label">Result Date:</td>
          <td class="info-value">${labDetails.resultDate}</td>
        </tr>
      </table>
    </div>
    <p>You can view your detailed results through the patient portal or by visiting our facility.</p>
    <p style="text-align: center;">
      <a href="#" class="button">View Lab Results</a>
    </p>
    <div class="warning">
      <strong>Important:</strong> For questions about your results, please contact your healthcare provider. Do not make any medical decisions based solely on these results without consulting your doctor.
    </div>
  `;
  return wrapEmailTemplate(content, hospitalName);
};

/**
 * Password Reset Email Template
 */
const passwordResetTemplate = (
  recipientName: string,
  resetToken: string,
  resetLink: string,
  expiryMinutes: number = 30,
  hospitalName?: string
): string => {
  const content = `
    <h2>Password Reset Request</h2>
    <p>Hello ${recipientName},</p>
    <p>We received a request to reset your password for your ${hospitalName || 'HMS'} account.</p>
    <p>Click the button below to reset your password:</p>
    <p style="text-align: center;">
      <a href="${resetLink}" class="button">Reset Password</a>
    </p>
    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break: break-all; font-size: 13px; color: #64748b; background-color: #f1f5f9; padding: 10px; border-radius: 4px;">
      ${resetLink}
    </p>
    <p>This link will expire in <strong>${expiryMinutes} minutes</strong>.</p>
    <div class="divider"></div>
    <div class="warning">
      <strong>Security Notice:</strong> If you didn't request this password reset, please ignore this email. Your password will remain unchanged.
    </div>
    <p>For security reasons, this link can only be used once. If you need to reset your password again, please submit a new request.</p>
  `;
  return wrapEmailTemplate(content, hospitalName);
};

/**
 * Welcome Email Template
 */
const welcomeEmailTemplate = (
  recipientName: string,
  accountDetails: {
    email: string;
    role?: string;
    loginUrl?: string;
  },
  hospitalName?: string
): string => {
  const content = `
    <h2>Welcome to ${hospitalName || 'Hospital Management System'}!</h2>
    <p>Dear ${recipientName},</p>
    <p>Your account has been successfully created. We're excited to have you on board!</p>
    <div class="success">
      <strong>Account Created Successfully!</strong> You can now access all the features available to you.
    </div>
    <div class="info-box">
      <table>
        <tr>
          <td class="info-label">Email:</td>
          <td class="info-value">${accountDetails.email}</td>
        </tr>
        ${accountDetails.role ? `
        <tr>
          <td class="info-label">Account Type:</td>
          <td class="info-value">${accountDetails.role}</td>
        </tr>
        ` : ''}
      </table>
    </div>
    <h3>Getting Started</h3>
    <ul>
      <li>Log in to your account using your registered email</li>
      <li>Complete your profile information</li>
      <li>Explore the dashboard and available features</li>
      <li>Contact support if you need any assistance</li>
    </ul>
    <p style="text-align: center;">
      <a href="${accountDetails.loginUrl || '#'}" class="button">Log In to Your Account</a>
    </p>
    <div class="divider"></div>
    <p>If you have any questions or need assistance, our support team is here to help.</p>
  `;
  return wrapEmailTemplate(content, hospitalName);
};

// Main email sending function
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  const toAddresses = Array.isArray(options.to) ? options.to : [options.to];

  // Try SES first
  if (sesClient && isSESConfigured()) {
    try {
      const params: SendEmailCommandInput = {
        Source: sesConfig.fromEmail,
        Destination: {
          ToAddresses: toAddresses,
          CcAddresses: options.cc ? (Array.isArray(options.cc) ? options.cc : [options.cc]) : undefined,
          BccAddresses: options.bcc ? (Array.isArray(options.bcc) ? options.bcc : [options.bcc]) : undefined,
        },
        Message: {
          Subject: {
            Charset: 'UTF-8',
            Data: options.subject,
          },
          Body: {
            Html: {
              Charset: 'UTF-8',
              Data: options.html,
            },
            ...(options.text && {
              Text: {
                Charset: 'UTF-8',
                Data: options.text,
              },
            }),
          },
        },
        ReplyToAddresses: options.replyTo ? [options.replyTo] : undefined,
      };

      const command = new SendEmailCommand(params);
      const response = await sesClient.send(command);

      logger.info(`Email sent via SES: ${options.subject} to ${toAddresses.join(', ')}`);

      return {
        success: true,
        messageId: response.MessageId,
      };
    } catch (error) {
      logger.error(`SES email failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Fall through to SMTP fallback
    }
  }

  // Try SMTP fallback
  if (!smtpTransporter) {
    smtpTransporter = initSMTPTransporter();
  }

  if (smtpTransporter) {
    try {
      const mailOptions = {
        from: config.email.from,
        to: toAddresses.join(', '),
        cc: options.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc) : undefined,
        bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc) : undefined,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo,
      };

      const info = await smtpTransporter.sendMail(mailOptions);

      logger.info(`Email sent via SMTP: ${options.subject} to ${toAddresses.join(', ')}`);

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      logger.error(`SMTP email failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'SMTP email sending failed',
      };
    }
  }

  // No email service configured
  logger.warn(`No email service available. Would have sent: ${options.subject} to ${toAddresses.join(', ')}`);
  return {
    success: false,
    error: 'No email service configured',
  };
}

// Convenience functions for specific email types

/**
 * Send OTP verification email
 */
export async function sendOTPEmail(
  to: string,
  recipientName: string,
  otpCode: string,
  expiryMinutes: number = 10,
  hospitalName?: string
): Promise<EmailResult> {
  const html = otpVerificationTemplate(recipientName, otpCode, expiryMinutes, hospitalName);
  const text = `Your ${hospitalName || 'HMS'} verification code is: ${otpCode}. This code expires in ${expiryMinutes} minutes. Never share this code with anyone.`;

  return sendEmail({
    to,
    subject: 'Your HMS Verification Code',
    html,
    text,
  });
}

/**
 * Send appointment confirmation email
 */
export async function sendAppointmentConfirmation(
  to: string,
  patientName: string,
  appointmentDetails: {
    doctorName: string;
    department: string;
    date: string;
    time: string;
    location?: string;
    appointmentId: string;
    notes?: string;
  },
  hospitalName?: string
): Promise<EmailResult> {
  const html = appointmentConfirmationTemplate(patientName, appointmentDetails, hospitalName);
  const text = `Appointment Confirmed!\n\nDear ${patientName},\n\nYour appointment has been scheduled:\n- Doctor: Dr. ${appointmentDetails.doctorName}\n- Department: ${appointmentDetails.department}\n- Date: ${appointmentDetails.date}\n- Time: ${appointmentDetails.time}\n- Appointment ID: ${appointmentDetails.appointmentId}\n\nPlease arrive 15 minutes early.`;

  return sendEmail({
    to,
    subject: `Appointment Confirmed - ${appointmentDetails.date} at ${appointmentDetails.time}`,
    html,
    text,
  });
}

/**
 * Send appointment reminder email
 */
export async function sendAppointmentReminder(
  to: string,
  patientName: string,
  appointmentDetails: {
    doctorName: string;
    department: string;
    date: string;
    time: string;
    location?: string;
    appointmentId: string;
  },
  reminderHours: number = 24,
  hospitalName?: string
): Promise<EmailResult> {
  const html = appointmentReminderTemplate(patientName, appointmentDetails, reminderHours, hospitalName);
  const text = `Appointment Reminder\n\nDear ${patientName},\n\nReminder: You have an appointment in ${reminderHours} hours.\n- Doctor: Dr. ${appointmentDetails.doctorName}\n- Department: ${appointmentDetails.department}\n- Date: ${appointmentDetails.date}\n- Time: ${appointmentDetails.time}\n\nPlease arrive 15 minutes early.`;

  return sendEmail({
    to,
    subject: `Appointment Reminder - ${appointmentDetails.date} at ${appointmentDetails.time}`,
    html,
    text,
  });
}

/**
 * Send lab results notification email
 */
export async function sendLabResultsNotification(
  to: string,
  patientName: string,
  labDetails: {
    testName: string;
    orderedBy: string;
    collectionDate: string;
    resultDate: string;
    labOrderId: string;
  },
  hospitalName?: string
): Promise<EmailResult> {
  const html = labResultsReadyTemplate(patientName, labDetails, hospitalName);
  const text = `Lab Results Available\n\nDear ${patientName},\n\nYour lab results are now available:\n- Test: ${labDetails.testName}\n- Ordered By: Dr. ${labDetails.orderedBy}\n- Lab Order ID: ${labDetails.labOrderId}\n\nPlease log in to the patient portal to view your results.`;

  return sendEmail({
    to,
    subject: `Lab Results Ready - ${labDetails.testName}`,
    html,
    text,
  });
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  to: string,
  recipientName: string,
  resetToken: string,
  baseUrl: string,
  expiryMinutes: number = 30,
  hospitalName?: string
): Promise<EmailResult> {
  const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;
  const html = passwordResetTemplate(recipientName, resetToken, resetLink, expiryMinutes, hospitalName);
  const text = `Password Reset Request\n\nHello ${recipientName},\n\nWe received a request to reset your password. Click the link below to reset it:\n\n${resetLink}\n\nThis link expires in ${expiryMinutes} minutes.\n\nIf you didn't request this, please ignore this email.`;

  return sendEmail({
    to,
    subject: 'Password Reset Request',
    html,
    text,
  });
}

/**
 * Send welcome email to new users
 */
export async function sendWelcomeEmail(
  to: string,
  recipientName: string,
  accountDetails: {
    email: string;
    role?: string;
    loginUrl?: string;
  },
  hospitalName?: string
): Promise<EmailResult> {
  const html = welcomeEmailTemplate(recipientName, accountDetails, hospitalName);
  const text = `Welcome to ${hospitalName || 'Hospital Management System'}!\n\nDear ${recipientName},\n\nYour account has been successfully created.\n\nEmail: ${accountDetails.email}\n${accountDetails.role ? `Account Type: ${accountDetails.role}\n` : ''}\n\nYou can now log in and explore the available features.`;

  return sendEmail({
    to,
    subject: `Welcome to ${hospitalName || 'Hospital Management System'}`,
    html,
    text,
  });
}

// Email service class for dependency injection patterns
export class EmailService {
  async send(options: EmailOptions): Promise<EmailResult> {
    return sendEmail(options);
  }

  async sendOTP(
    to: string,
    recipientName: string,
    otpCode: string,
    expiryMinutes?: number,
    hospitalName?: string
  ): Promise<EmailResult> {
    return sendOTPEmail(to, recipientName, otpCode, expiryMinutes, hospitalName);
  }

  async sendAppointmentConfirmation(
    to: string,
    patientName: string,
    appointmentDetails: {
      doctorName: string;
      department: string;
      date: string;
      time: string;
      location?: string;
      appointmentId: string;
      notes?: string;
    },
    hospitalName?: string
  ): Promise<EmailResult> {
    return sendAppointmentConfirmation(to, patientName, appointmentDetails, hospitalName);
  }

  async sendAppointmentReminder(
    to: string,
    patientName: string,
    appointmentDetails: {
      doctorName: string;
      department: string;
      date: string;
      time: string;
      location?: string;
      appointmentId: string;
    },
    reminderHours?: number,
    hospitalName?: string
  ): Promise<EmailResult> {
    return sendAppointmentReminder(to, patientName, appointmentDetails, reminderHours, hospitalName);
  }

  async sendLabResults(
    to: string,
    patientName: string,
    labDetails: {
      testName: string;
      orderedBy: string;
      collectionDate: string;
      resultDate: string;
      labOrderId: string;
    },
    hospitalName?: string
  ): Promise<EmailResult> {
    return sendLabResultsNotification(to, patientName, labDetails, hospitalName);
  }

  async sendPasswordReset(
    to: string,
    recipientName: string,
    resetToken: string,
    baseUrl: string,
    expiryMinutes?: number,
    hospitalName?: string
  ): Promise<EmailResult> {
    return sendPasswordResetEmail(to, recipientName, resetToken, baseUrl, expiryMinutes, hospitalName);
  }

  async sendWelcome(
    to: string,
    recipientName: string,
    accountDetails: {
      email: string;
      role?: string;
      loginUrl?: string;
    },
    hospitalName?: string
  ): Promise<EmailResult> {
    return sendWelcomeEmail(to, recipientName, accountDetails, hospitalName);
  }

  // Utility method to check if email service is configured
  isConfigured(): boolean {
    return isSESConfigured() || !!smtpTransporter || !!initSMTPTransporter();
  }

  // Get the current email provider type
  getProvider(): 'ses' | 'smtp' | 'none' {
    if (isSESConfigured()) return 'ses';
    if (smtpTransporter || initSMTPTransporter()) return 'smtp';
    return 'none';
  }
}

// Export singleton instance
export const emailService = new EmailService();

export default emailService;
