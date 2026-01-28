import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  apiVersion: process.env.API_VERSION || 'v1',

  database: {
    url: process.env.DATABASE_URL || '',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-me',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    region: process.env.AWS_REGION || 'us-east-1',
    s3Bucket: process.env.AWS_S3_BUCKET || 'hospital-medical-images',
    ses: {
      region: process.env.AWS_SES_REGION || process.env.AWS_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || '',
      fromEmail: process.env.AWS_SES_FROM_EMAIL || 'noreply@spetaar.ai',
    },
  },

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
    whatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886',
  },

  notifications: {
    emailEnabled: process.env.NOTIFICATIONS_EMAIL_ENABLED === 'true',
    smsEnabled: process.env.NOTIFICATIONS_SMS_ENABLED === 'true',
    whatsappEnabled: process.env.NOTIFICATIONS_WHATSAPP_ENABLED === 'true',
  },

  email: {
    // SendGrid (primary)
    sendgridApiKey: process.env.SENDGRID_API_KEY || '',
    sendgridFromEmail: process.env.SENDGRID_FROM_EMAIL || process.env.EMAIL_FROM || 'noreply@spetaar.ai',
    // SMTP (fallback)
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || 'noreply@spetaar.ai',
  },

  ai: {
    serviceUrl: process.env.AI_SERVICE_URL || 'http://localhost:8000',
    apiKey: process.env.AI_API_KEY || '',
    symptomCheckerUrl: process.env.SYMPTOM_CHECKER_URL || 'http://localhost:8010',
  },

  rbac: {
    mode: (process.env.RBAC_MODE || 'hybrid') as 'legacy' | 'dynamic' | 'hybrid',
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },

  encryption: {
    key: process.env.ENCRYPTION_KEY || 'default-32-char-encryption-key!',
  },
};

export default config;
