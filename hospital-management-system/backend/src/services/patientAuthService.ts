import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Redis from 'ioredis';
import prisma from '../config/database';
import { config } from '../config';
import { AppError, UnauthorizedError, ConflictError, NotFoundError, ValidationError } from '../middleware/errorHandler';
import { Gender, BloodGroup, MaritalStatus } from '@prisma/client';
import { patientLookupService } from './patientLookupService';
import { sendOTP as sendSMSOTP } from './smsService';
import { sendWhatsAppOTP as sendWhatsAppOTPMessage } from './whatsappService';
import { sendOTPEmail, sendPasswordResetEmail } from './emailService';
import { logger } from '../utils/logger';

// Redis client for OTP storage
const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  retryStrategy: (times) => {
    if (times > 3) {
      console.warn('Redis connection failed, OTP features will be unavailable');
      return null;
    }
    return Math.min(times * 100, 3000);
  },
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err.message);
});

// ==================== Types ====================

interface PatientJwtPayload {
  patientId: string;
  hospitalId: string;
  email: string | null;
  mobile: string;
  type: 'patient';
}

interface PatientTokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface PatientAuthResponse {
  patient: {
    id: string;
    mrn: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string;
    hospitalId: string;
    photo: string | null;
  };
  tokens: PatientTokenPair;
  claimed?: boolean; // True if an existing patient record was claimed
}

interface PatientRegisterData {
  hospitalId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  gender: Gender;
  phone: string;
  email?: string;
  password: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  bloodGroup?: BloodGroup;
  emergencyContact?: string;
  emergencyPhone?: string;
  occupation?: string;
  maritalStatus?: MaritalStatus;
  nationality?: string;
}

interface PatientProfileUpdateData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  occupation?: string;
  maritalStatus?: MaritalStatus;
  nationality?: string;
  photo?: string;
}

interface OTPData {
  otp: string;
  attempts: number;
  createdAt: number;
}

// ==================== Constants ====================

const OTP_EXPIRY_SECONDS = 5 * 60; // 5 minutes
const OTP_MAX_ATTEMPTS = 3;
const ACCESS_TOKEN_EXPIRY = '1h';
const REFRESH_TOKEN_EXPIRY = '30d';
const ACCESS_TOKEN_EXPIRY_SECONDS = 3600; // 1 hour
const SALT_ROUNDS = 12;

// ==================== Service Class ====================

export class PatientAuthService {
  // ==================== Token Generation ====================

  /**
   * Generate JWT access and refresh tokens for patient
   */
  private generateTokens(payload: PatientJwtPayload): PatientTokenPair {
    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    });

    const refreshToken = jwt.sign(payload, config.jwt.refreshSecret, {
      expiresIn: REFRESH_TOKEN_EXPIRY,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
    };
  }

  /**
   * Verify and decode a JWT token
   */
  private verifyToken(token: string, secret: string): PatientJwtPayload {
    try {
      const decoded = jwt.verify(token, secret) as PatientJwtPayload;
      if (decoded.type !== 'patient') {
        throw new UnauthorizedError('Invalid token type');
      }
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError('Invalid token');
      }
      throw error;
    }
  }

  // ==================== OTP Utilities ====================

  /**
   * Generate a 6-digit OTP
   */
  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Get Redis key for OTP storage
   */
  private getOTPKey(mobile: string, channel: 'sms' | 'whatsapp' = 'sms'): string {
    return `patient:otp:${channel}:${mobile}`;
  }

  /**
   * Store OTP in Redis
   */
  private async storeOTP(mobile: string, otp: string, channel: 'sms' | 'whatsapp' = 'sms'): Promise<void> {
    const key = this.getOTPKey(mobile, channel);
    const data: OTPData = {
      otp,
      attempts: 0,
      createdAt: Date.now(),
    };
    await redis.setex(key, OTP_EXPIRY_SECONDS, JSON.stringify(data));
  }

  /**
   * Retrieve OTP data from Redis
   */
  private async getOTPData(mobile: string, channel: 'sms' | 'whatsapp' = 'sms'): Promise<OTPData | null> {
    const key = this.getOTPKey(mobile, channel);
    const data = await redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as OTPData;
  }

  /**
   * Increment OTP attempt count
   */
  private async incrementOTPAttempts(mobile: string, channel: 'sms' | 'whatsapp' = 'sms'): Promise<void> {
    const key = this.getOTPKey(mobile, channel);
    const data = await this.getOTPData(mobile, channel);
    if (data) {
      data.attempts += 1;
      const ttl = await redis.ttl(key);
      if (ttl > 0) {
        await redis.setex(key, ttl, JSON.stringify(data));
      }
    }
  }

  /**
   * Delete OTP from Redis
   */
  private async deleteOTP(mobile: string, channel: 'sms' | 'whatsapp' = 'sms'): Promise<void> {
    const key = this.getOTPKey(mobile, channel);
    await redis.del(key);
  }

  // ==================== MRN Generation ====================

  /**
   * Generate unique Medical Record Number
   */
  private generateMRN(hospitalCode: string): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${hospitalCode}-${timestamp}${random}`;
  }

  // ==================== Password Hashing ====================

  /**
   * Hash password using bcrypt
   */
  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  /**
   * Verify password against hash
   */
  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  // ==================== Email/Password Authentication ====================

  /**
   * Register a new patient account
   */
  async registerPatient(data: PatientRegisterData): Promise<PatientAuthResponse> {
    // Verify hospital exists
    const hospital = await prisma.hospital.findUnique({
      where: { id: data.hospitalId },
    });

    if (!hospital) {
      throw new NotFoundError('Hospital not found');
    }

    // Validate password strength
    if (data.password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long');
    }

    // Check for existing patient using the lookup service
    const existingPatientResult = await patientLookupService.findExistingPatient(data.hospitalId, {
      email: data.email,
      phone: data.phone,
    });

    if (existingPatientResult) {
      const existingPatient = existingPatientResult.patient;

      // Check if the existing patient already has a user account linked
      const existingUser = await prisma.user.findFirst({
        where: { email: data.email || `patient_${data.phone}@patient.local` }
      });

      if (existingUser) {
        throw new ConflictError('An account with this email already exists. Please login instead.');
      }

      // Patient exists but no user account - this is a "claim account" scenario
      // Create user and link to existing patient
      const hashedPassword = await this.hashPassword(data.password);

      const user = await prisma.user.create({
        data: {
          email: data.email || `patient_${data.phone}@patient.local`,
          password: hashedPassword,
          firstName: existingPatient.firstName,
          lastName: existingPatient.lastName,
          phone: existingPatient.phone,
          hospitalId: data.hospitalId,
          role: 'PATIENT',
          isActive: true,
        },
      });

      // Link the user to the existing patient
      await patientLookupService.linkUserToPatient(existingPatient.id, user.id);

      // Generate tokens
      const tokenPayload: PatientJwtPayload = {
        patientId: existingPatient.id,
        hospitalId: existingPatient.hospitalId,
        email: existingPatient.email,
        mobile: existingPatient.phone,
        type: 'patient',
      };

      const tokens = this.generateTokens(tokenPayload);

      return {
        patient: {
          id: existingPatient.id,
          mrn: existingPatient.mrn,
          firstName: existingPatient.firstName,
          lastName: existingPatient.lastName,
          email: existingPatient.email,
          phone: existingPatient.phone,
          hospitalId: existingPatient.hospitalId,
          photo: existingPatient.photo || null,
        },
        tokens,
        claimed: true,
      };
    }

    // No existing patient - create new patient and user
    const hashedPassword = await this.hashPassword(data.password);
    const mrn = this.generateMRN(hospital.code);

    // Create patient with linked user account for authentication
    const user = await prisma.user.create({
      data: {
        email: data.email || `patient_${data.phone}@patient.local`,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        hospitalId: data.hospitalId,
        role: 'PATIENT',
        isActive: true,
      },
    });

    // Create patient record linked to user
    const patient = await prisma.patient.create({
      data: {
        hospitalId: data.hospitalId,
        oderId: user.id,
        mrn,
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: new Date(data.dateOfBirth),
        gender: data.gender,
        bloodGroup: data.bloodGroup,
        phone: data.phone,
        email: data.email,
        address: data.address,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
        emergencyContact: data.emergencyContact,
        emergencyPhone: data.emergencyPhone,
        occupation: data.occupation,
        maritalStatus: data.maritalStatus,
        nationality: data.nationality,
      },
      include: {
        hospital: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    // Create empty medical history
    await prisma.medicalHistory.create({
      data: {
        patientId: patient.id,
        chronicConditions: [],
        pastSurgeries: [],
        familyHistory: [],
        currentMedications: [],
        immunizations: [],
      },
    });

    // Generate tokens
    const tokenPayload: PatientJwtPayload = {
      patientId: patient.id,
      hospitalId: patient.hospitalId,
      email: patient.email,
      mobile: patient.phone,
      type: 'patient',
    };

    const tokens = this.generateTokens(tokenPayload);

    return {
      patient: {
        id: patient.id,
        mrn: patient.mrn,
        firstName: patient.firstName,
        lastName: patient.lastName,
        email: patient.email,
        phone: patient.phone,
        hospitalId: patient.hospitalId,
        photo: patient.photo,
      },
      tokens,
    };
  }

  /**
   * Claim an existing patient account by creating a user account and linking it
   * This is used when a patient record exists (e.g., from a booking) but has no login credentials
   *
   * @param patientId - The patient record to claim
   * @param email - Email address for the new account
   * @param password - Password for the new account
   * @returns Authentication response with tokens
   */
  async claimExistingAccount(
    patientId: string,
    email: string,
    password: string
  ): Promise<PatientAuthResponse> {
    // Verify patient exists and can be claimed
    const patient = await prisma.patient.findFirst({
      where: {
        id: patientId,
        isActive: true,
      },
      include: {
        hospital: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    // Check if patient already has a linked user account
    if (patient.oderId) {
      throw new ConflictError('This patient account already has login credentials. Please login instead.');
    }

    // Check if email is already in use
    const existingUser = await prisma.user.findFirst({
      where: { email }
    });

    if (existingUser) {
      throw new ConflictError('An account with this email already exists.');
    }

    // Validate password strength
    if (password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long');
    }

    // Hash password
    const hashedPassword = await this.hashPassword(password);

    // Create user account
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName: patient.firstName,
        lastName: patient.lastName,
        phone: patient.phone,
        hospitalId: patient.hospitalId,
        role: 'PATIENT',
        isActive: true,
      },
    });

    // Link the user to the patient
    await patientLookupService.linkUserToPatient(patientId, user.id);

    // Update patient email if different
    if (patient.email !== email) {
      await prisma.patient.update({
        where: { id: patientId },
        data: { email },
      });
    }

    // Generate tokens
    const tokenPayload: PatientJwtPayload = {
      patientId: patient.id,
      hospitalId: patient.hospitalId,
      email: email,
      mobile: patient.phone,
      type: 'patient',
    };

    const tokens = this.generateTokens(tokenPayload);

    return {
      patient: {
        id: patient.id,
        mrn: patient.mrn,
        firstName: patient.firstName,
        lastName: patient.lastName,
        email: email,
        phone: patient.phone,
        hospitalId: patient.hospitalId,
        photo: patient.photo,
      },
      tokens,
      claimed: true,
    };
  }

  /**
   * Login patient with email and password
   */
  async loginWithEmail(email: string, password: string, hospitalId?: string): Promise<PatientAuthResponse> {
    // Find patient by email
    let patient;

    if (hospitalId) {
      patient = await prisma.patient.findFirst({
        where: {
          email,
          hospitalId,
          isActive: true,
        },
        include: {
          user: true,
        },
      });
    } else {
      patient = await prisma.patient.findFirst({
        where: {
          email,
          isActive: true,
        },
        include: {
          user: true,
        },
      });
    }

    if (!patient) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Check if patient has a linked user account
    if (!patient.user) {
      throw new UnauthorizedError('Account not set up for login. Please register first.');
    }

    if (!patient.user.isActive) {
      throw new UnauthorizedError('Account is disabled');
    }

    // Verify password
    const isPasswordValid = await this.verifyPassword(password, patient.user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Update last login
    await prisma.user.update({
      where: { id: patient.user.id },
      data: { lastLogin: new Date() },
    });

    // Generate tokens
    const tokenPayload: PatientJwtPayload = {
      patientId: patient.id,
      hospitalId: patient.hospitalId,
      email: patient.email,
      mobile: patient.phone,
      type: 'patient',
    };

    const tokens = this.generateTokens(tokenPayload);

    return {
      patient: {
        id: patient.id,
        mrn: patient.mrn,
        firstName: patient.firstName,
        lastName: patient.lastName,
        email: patient.email,
        phone: patient.phone,
        hospitalId: patient.hospitalId,
        photo: patient.photo,
      },
      tokens,
    };
  }

  // ==================== Mobile OTP Authentication ====================

  /**
   * Send OTP to mobile number via SMS
   */
  async sendOTP(mobile: string, hospitalId?: string): Promise<{ message: string; expiresIn: number }> {
    // Validate mobile number format
    if (!mobile || mobile.length < 10) {
      throw new ValidationError('Invalid mobile number');
    }

    // Check if patient exists with this mobile
    const whereClause: any = { phone: mobile, isActive: true };
    if (hospitalId) {
      whereClause.hospitalId = hospitalId;
    }

    const patient = await prisma.patient.findFirst({
      where: whereClause,
    });

    if (!patient) {
      throw new NotFoundError('No patient account found with this mobile number');
    }

    // Check for existing OTP to prevent spam
    const existingOTP = await this.getOTPData(mobile, 'sms');
    if (existingOTP) {
      const timeSinceCreation = (Date.now() - existingOTP.createdAt) / 1000;
      if (timeSinceCreation < 60) {
        throw new AppError(
          `Please wait ${Math.ceil(60 - timeSinceCreation)} seconds before requesting a new OTP`,
          429
        );
      }
    }

    // Generate and store OTP
    const otp = this.generateOTP();
    await this.storeOTP(mobile, otp, 'sms');

    // Send OTP via SMS service
    try {
      const result = await sendSMSOTP(mobile, otp, Math.floor(OTP_EXPIRY_SECONDS / 60));
      if (!result.success) {
        logger.warn(`SMS OTP delivery failed for ${mobile}: ${result.error}`, { errorCode: result.errorCode });
        // Still return success to avoid revealing whether the account exists
      } else {
        logger.info(`SMS OTP sent successfully to ${mobile}`, { messageId: result.messageId });
      }
    } catch (error) {
      logger.error(`Failed to send SMS OTP to ${mobile}:`, error);
      // Still return success to avoid revealing whether the account exists
    }

    return {
      message: 'OTP sent successfully',
      expiresIn: OTP_EXPIRY_SECONDS,
    };
  }

  /**
   * Verify OTP and return JWT tokens
   */
  async verifyOTP(mobile: string, otp: string, hospitalId?: string): Promise<PatientAuthResponse> {
    // Validate inputs
    if (!mobile || !otp) {
      throw new ValidationError('Mobile number and OTP are required');
    }

    if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      throw new ValidationError('OTP must be a 6-digit number');
    }

    // Get stored OTP data
    const otpData = await this.getOTPData(mobile, 'sms');

    if (!otpData) {
      throw new UnauthorizedError('OTP expired or not found. Please request a new OTP.');
    }

    // Check attempt limit
    if (otpData.attempts >= OTP_MAX_ATTEMPTS) {
      await this.deleteOTP(mobile, 'sms');
      throw new UnauthorizedError('Maximum OTP attempts exceeded. Please request a new OTP.');
    }

    // Verify OTP
    if (otpData.otp !== otp) {
      await this.incrementOTPAttempts(mobile, 'sms');
      const remainingAttempts = OTP_MAX_ATTEMPTS - otpData.attempts - 1;
      throw new UnauthorizedError(
        `Invalid OTP. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.`
      );
    }

    // OTP verified - delete it
    await this.deleteOTP(mobile, 'sms');

    // Find patient
    const whereClause: any = { phone: mobile, isActive: true };
    if (hospitalId) {
      whereClause.hospitalId = hospitalId;
    }

    const patient = await prisma.patient.findFirst({
      where: whereClause,
    });

    if (!patient) {
      throw new NotFoundError('Patient account not found');
    }

    // Update last login if user exists
    if (patient.oderId) {
      await prisma.user.update({
        where: { id: patient.oderId },
        data: { lastLogin: new Date() },
      });
    }

    // Generate tokens
    const tokenPayload: PatientJwtPayload = {
      patientId: patient.id,
      hospitalId: patient.hospitalId,
      email: patient.email,
      mobile: patient.phone,
      type: 'patient',
    };

    const tokens = this.generateTokens(tokenPayload);

    return {
      patient: {
        id: patient.id,
        mrn: patient.mrn,
        firstName: patient.firstName,
        lastName: patient.lastName,
        email: patient.email,
        phone: patient.phone,
        hospitalId: patient.hospitalId,
        photo: patient.photo,
      },
      tokens,
    };
  }

  // ==================== WhatsApp OTP Authentication ====================

  /**
   * Send OTP via WhatsApp
   */
  async sendWhatsAppOTP(mobile: string, hospitalId?: string): Promise<{ message: string; expiresIn: number }> {
    // Validate mobile number format
    if (!mobile || mobile.length < 10) {
      throw new ValidationError('Invalid mobile number');
    }

    // Check if patient exists with this mobile
    const whereClause: any = { phone: mobile, isActive: true };
    if (hospitalId) {
      whereClause.hospitalId = hospitalId;
    }

    const patient = await prisma.patient.findFirst({
      where: whereClause,
    });

    if (!patient) {
      throw new NotFoundError('No patient account found with this mobile number');
    }

    // Check for existing OTP to prevent spam
    const existingOTP = await this.getOTPData(mobile, 'whatsapp');
    if (existingOTP) {
      const timeSinceCreation = (Date.now() - existingOTP.createdAt) / 1000;
      if (timeSinceCreation < 60) {
        throw new AppError(
          `Please wait ${Math.ceil(60 - timeSinceCreation)} seconds before requesting a new OTP`,
          429
        );
      }
    }

    // Generate and store OTP
    const otp = this.generateOTP();
    await this.storeOTP(mobile, otp, 'whatsapp');

    // Send OTP via WhatsApp service
    try {
      const result = await sendWhatsAppOTPMessage(mobile, otp, Math.floor(OTP_EXPIRY_SECONDS / 60));
      if (!result.success) {
        logger.warn(`WhatsApp OTP delivery failed for ${mobile}: ${result.error}`);
        // Still return success to avoid revealing whether the account exists
      } else {
        logger.info(`WhatsApp OTP sent successfully to ${mobile}`, { messageSid: result.messageSid });
      }
    } catch (error) {
      logger.error(`Failed to send WhatsApp OTP to ${mobile}:`, error);
      // Still return success to avoid revealing whether the account exists
    }

    return {
      message: 'OTP sent via WhatsApp successfully',
      expiresIn: OTP_EXPIRY_SECONDS,
    };
  }

  /**
   * Verify WhatsApp OTP and return JWT tokens
   */
  async verifyWhatsAppOTP(mobile: string, otp: string, hospitalId?: string): Promise<PatientAuthResponse> {
    // Validate inputs
    if (!mobile || !otp) {
      throw new ValidationError('Mobile number and OTP are required');
    }

    if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      throw new ValidationError('OTP must be a 6-digit number');
    }

    // Get stored OTP data
    const otpData = await this.getOTPData(mobile, 'whatsapp');

    if (!otpData) {
      throw new UnauthorizedError('OTP expired or not found. Please request a new OTP.');
    }

    // Check attempt limit
    if (otpData.attempts >= OTP_MAX_ATTEMPTS) {
      await this.deleteOTP(mobile, 'whatsapp');
      throw new UnauthorizedError('Maximum OTP attempts exceeded. Please request a new OTP.');
    }

    // Verify OTP
    if (otpData.otp !== otp) {
      await this.incrementOTPAttempts(mobile, 'whatsapp');
      const remainingAttempts = OTP_MAX_ATTEMPTS - otpData.attempts - 1;
      throw new UnauthorizedError(
        `Invalid OTP. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.`
      );
    }

    // OTP verified - delete it
    await this.deleteOTP(mobile, 'whatsapp');

    // Find patient
    const whereClause: any = { phone: mobile, isActive: true };
    if (hospitalId) {
      whereClause.hospitalId = hospitalId;
    }

    const patient = await prisma.patient.findFirst({
      where: whereClause,
    });

    if (!patient) {
      throw new NotFoundError('Patient account not found');
    }

    // Update last login if user exists
    if (patient.oderId) {
      await prisma.user.update({
        where: { id: patient.oderId },
        data: { lastLogin: new Date() },
      });
    }

    // Generate tokens
    const tokenPayload: PatientJwtPayload = {
      patientId: patient.id,
      hospitalId: patient.hospitalId,
      email: patient.email,
      mobile: patient.phone,
      type: 'patient',
    };

    const tokens = this.generateTokens(tokenPayload);

    return {
      patient: {
        id: patient.id,
        mrn: patient.mrn,
        firstName: patient.firstName,
        lastName: patient.lastName,
        email: patient.email,
        phone: patient.phone,
        hospitalId: patient.hospitalId,
        photo: patient.photo,
      },
      tokens,
    };
  }

  // ==================== Token Management ====================

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<PatientTokenPair> {
    // Verify refresh token
    const decoded = this.verifyToken(refreshToken, config.jwt.refreshSecret);

    // Verify patient still exists and is active
    const patient = await prisma.patient.findFirst({
      where: {
        id: decoded.patientId,
        isActive: true,
      },
    });

    if (!patient) {
      throw new UnauthorizedError('Patient account not found or inactive');
    }

    // Generate new tokens
    const tokenPayload: PatientJwtPayload = {
      patientId: patient.id,
      hospitalId: patient.hospitalId,
      email: patient.email,
      mobile: patient.phone,
      type: 'patient',
    };

    return this.generateTokens(tokenPayload);
  }

  /**
   * Validate access token
   */
  async validateToken(accessToken: string): Promise<PatientJwtPayload> {
    const decoded = this.verifyToken(accessToken, config.jwt.secret);

    // Verify patient still exists and is active
    const patient = await prisma.patient.findFirst({
      where: {
        id: decoded.patientId,
        isActive: true,
      },
    });

    if (!patient) {
      throw new UnauthorizedError('Patient account not found or inactive');
    }

    return decoded;
  }

  /**
   * Logout - invalidate tokens (for stateful implementation)
   * Note: With stateless JWT, client should discard tokens
   */
  async logout(patientId: string): Promise<void> {
    // For stateless JWT, we just return success
    // In a stateful implementation, we would blacklist the token in Redis

    // Optional: Store logout timestamp to invalidate tokens issued before
    const key = `patient:logout:${patientId}`;
    await redis.set(key, Date.now().toString());
  }

  // ==================== Patient Profile ====================

  /**
   * Get patient profile by ID
   */
  async getPatientProfile(patientId: string): Promise<any> {
    const patient = await prisma.patient.findFirst({
      where: {
        id: patientId,
        isActive: true,
      },
      include: {
        hospital: {
          select: {
            id: true,
            name: true,
            code: true,
            logo: true,
          },
        },
        medicalHistory: true,
        allergies: true,
        insurances: {
          where: { isActive: true },
        },
        _count: {
          select: {
            appointments: true,
            admissions: true,
            prescriptions: true,
            labOrders: true,
          },
        },
      },
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    // Remove sensitive fields
    const { oderId, ...patientData } = patient;

    return patientData;
  }

  /**
   * Update patient profile
   */
  async updatePatientProfile(patientId: string, data: PatientProfileUpdateData): Promise<any> {
    // Verify patient exists
    const existingPatient = await prisma.patient.findFirst({
      where: {
        id: patientId,
        isActive: true,
      },
    });

    if (!existingPatient) {
      throw new NotFoundError('Patient not found');
    }

    // Check email uniqueness if being updated
    if (data.email && data.email !== existingPatient.email) {
      const emailExists = await prisma.patient.findFirst({
        where: {
          hospitalId: existingPatient.hospitalId,
          email: data.email,
          id: { not: patientId },
        },
      });

      if (emailExists) {
        throw new ConflictError('A patient with this email already exists');
      }
    }

    // Check phone uniqueness if being updated
    if (data.phone && data.phone !== existingPatient.phone) {
      const phoneExists = await prisma.patient.findFirst({
        where: {
          hospitalId: existingPatient.hospitalId,
          phone: data.phone,
          id: { not: patientId },
        },
      });

      if (phoneExists) {
        throw new ConflictError('A patient with this phone number already exists');
      }
    }

    // Update patient
    const updatedPatient = await prisma.patient.update({
      where: { id: patientId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        mrn: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        emergencyContact: true,
        emergencyPhone: true,
        occupation: true,
        maritalStatus: true,
        nationality: true,
        photo: true,
        hospitalId: true,
        updatedAt: true,
      },
    });

    // Also update linked user if exists
    if (existingPatient.oderId) {
      const userUpdateData: any = {};
      if (data.firstName) userUpdateData.firstName = data.firstName;
      if (data.lastName) userUpdateData.lastName = data.lastName;
      if (data.phone) userUpdateData.phone = data.phone;

      if (Object.keys(userUpdateData).length > 0) {
        await prisma.user.update({
          where: { id: existingPatient.oderId },
          data: userUpdateData,
        });
      }
    }

    return updatedPatient;
  }

  /**
   * Change patient password
   */
  async changePassword(
    patientId: string,
    oldPassword: string,
    newPassword: string
  ): Promise<{ message: string }> {
    // Find patient with linked user
    const patient = await prisma.patient.findFirst({
      where: {
        id: patientId,
        isActive: true,
      },
      include: {
        user: true,
      },
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    if (!patient.user) {
      throw new AppError('Account not set up for password authentication', 400);
    }

    // Verify old password
    const isOldPasswordValid = await this.verifyPassword(oldPassword, patient.user.password);

    if (!isOldPasswordValid) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    // Validate new password
    if (newPassword.length < 8) {
      throw new ValidationError('New password must be at least 8 characters long');
    }

    if (oldPassword === newPassword) {
      throw new ValidationError('New password must be different from current password');
    }

    // Hash new password
    const hashedNewPassword = await this.hashPassword(newPassword);

    // Update password
    await prisma.user.update({
      where: { id: patient.user.id },
      data: { password: hashedNewPassword },
    });

    // Store password change timestamp for token invalidation
    const key = `patient:pwd-change:${patientId}`;
    await redis.set(key, Date.now().toString());

    return { message: 'Password changed successfully' };
  }

  /**
   * Request password reset via email/mobile
   */
  async requestPasswordReset(identifier: string, hospitalId?: string): Promise<{ message: string }> {
    // Find patient by email or phone
    const whereClause: any = {
      isActive: true,
      OR: [
        { email: identifier },
        { phone: identifier },
      ],
    };

    if (hospitalId) {
      whereClause.hospitalId = hospitalId;
    }

    const patient = await prisma.patient.findFirst({
      where: whereClause,
    });

    if (!patient) {
      // Return success even if not found (security best practice)
      return { message: 'If an account exists, a reset link/OTP has been sent' };
    }

    // Generate reset token/OTP
    const otp = this.generateOTP();
    const key = `patient:pwd-reset:${patient.id}`;
    await redis.setex(key, OTP_EXPIRY_SECONDS, otp);

    // Send via appropriate channel
    try {
      if (patient.email && identifier.includes('@')) {
        // Send password reset email
        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const result = await sendPasswordResetEmail(
          patient.email,
          `${patient.firstName} ${patient.lastName}`,
          otp,
          baseUrl,
          Math.floor(OTP_EXPIRY_SECONDS / 60)
        );
        if (!result.success) {
          logger.warn(`Password reset email delivery failed for ${patient.email}: ${result.error}`);
        } else {
          logger.info(`Password reset email sent successfully to ${patient.email}`, { messageId: result.messageId });
        }
      } else {
        // Send SMS OTP for password reset
        const result = await sendSMSOTP(patient.phone, otp, Math.floor(OTP_EXPIRY_SECONDS / 60));
        if (!result.success) {
          logger.warn(`Password reset SMS delivery failed for ${patient.phone}: ${result.error}`);
        } else {
          logger.info(`Password reset SMS sent successfully to ${patient.phone}`, { messageId: result.messageId });
        }
      }
    } catch (error) {
      logger.error('Failed to send password reset notification:', error);
      // Still return success to avoid revealing whether the account exists
    }

    return { message: 'If an account exists, a reset link/OTP has been sent' };
  }

  /**
   * Reset password with OTP
   */
  async resetPassword(
    patientId: string,
    otp: string,
    newPassword: string
  ): Promise<{ message: string }> {
    // Verify OTP
    const key = `patient:pwd-reset:${patientId}`;
    const storedOTP = await redis.get(key);

    if (!storedOTP || storedOTP !== otp) {
      throw new UnauthorizedError('Invalid or expired reset code');
    }

    // Find patient
    const patient = await prisma.patient.findFirst({
      where: {
        id: patientId,
        isActive: true,
      },
      include: {
        user: true,
      },
    });

    if (!patient || !patient.user) {
      throw new NotFoundError('Patient account not found');
    }

    // Validate new password
    if (newPassword.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long');
    }

    // Hash and update password
    const hashedPassword = await this.hashPassword(newPassword);

    await prisma.user.update({
      where: { id: patient.user.id },
      data: { password: hashedPassword },
    });

    // Delete reset OTP
    await redis.del(key);

    return { message: 'Password reset successfully' };
  }

  // ==================== Utility Methods ====================

  /**
   * Check if a patient account can be claimed
   * A patient can be claimed if they exist but don't have a linked user account
   * This is useful for patients created via online booking or by staff
   */
  async checkCanClaim(
    email?: string,
    phone?: string,
    hospitalId?: string
  ): Promise<{
    canClaim: boolean;
    patient?: {
      id: string;
      firstName: string;
      lastName: string;
      phone: string;
      email: string | null;
    };
    reason?: string;
  }> {
    if (!email && !phone) {
      return { canClaim: false, reason: 'Either email or phone is required' };
    }

    // Build query conditions
    const orConditions: any[] = [];
    if (email) orConditions.push({ email });
    if (phone) orConditions.push({ phone });

    const whereClause: any = {
      isActive: true,
      OR: orConditions,
    };

    if (hospitalId) {
      whereClause.hospitalId = hospitalId;
    }

    // Find patient
    const patient = await prisma.patient.findFirst({
      where: whereClause,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        oderId: true, // Check if user account exists
      },
    });

    if (!patient) {
      return { canClaim: false, reason: 'No patient found with this email or phone number' };
    }

    // Check if patient already has a linked user account
    if (patient.oderId) {
      return {
        canClaim: false,
        reason: 'This patient account already has login credentials. Please use login instead.',
        patient: {
          id: patient.id,
          firstName: patient.firstName,
          lastName: patient.lastName,
          phone: patient.phone,
          email: patient.email,
        },
      };
    }

    // Patient exists and can be claimed
    return {
      canClaim: true,
      patient: {
        id: patient.id,
        firstName: patient.firstName,
        lastName: patient.lastName,
        phone: patient.phone,
        email: patient.email,
      },
    };
  }

  /**
   * Check if mobile number is registered
   */
  async isMobileRegistered(mobile: string, hospitalId?: string): Promise<boolean> {
    const whereClause: any = { phone: mobile, isActive: true };
    if (hospitalId) {
      whereClause.hospitalId = hospitalId;
    }

    const patient = await prisma.patient.findFirst({
      where: whereClause,
      select: { id: true },
    });

    return !!patient;
  }

  /**
   * Check if email is registered
   */
  async isEmailRegistered(email: string, hospitalId?: string): Promise<boolean> {
    const whereClause: any = { email, isActive: true };
    if (hospitalId) {
      whereClause.hospitalId = hospitalId;
    }

    const patient = await prisma.patient.findFirst({
      where: whereClause,
      select: { id: true },
    });

    return !!patient;
  }

  /**
   * Get patient by ID (for middleware)
   */
  async getPatientById(patientId: string): Promise<any> {
    return prisma.patient.findFirst({
      where: {
        id: patientId,
        isActive: true,
      },
      select: {
        id: true,
        mrn: true,
        hospitalId: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
      },
    });
  }
}

// Export singleton instance
export const patientAuthService = new PatientAuthService();
