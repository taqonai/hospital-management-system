import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated } from '../utils/response';
import { patientAuthService } from '../services/patientAuthService';
import { patientAuthenticate, PatientAuthenticatedRequest } from '../middleware/patientAuth';
import { Gender } from '@prisma/client';

const router = Router();

// =============================================================================
// Validation Schemas
// =============================================================================

const patientRegisterSchema = z.object({
  body: z.object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    email: z.string().email('Invalid email address').optional(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    mobile: z.string().min(10, 'Valid mobile number required'),
    dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}.*)?$/, 'Date format should be YYYY-MM-DD'),
    gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
    address: z.string().min(1, 'Address is required'),
    city: z.string().min(1, 'City is required'),
    state: z.string().min(1, 'State is required'),
    zipCode: z.string().min(1, 'Zip code is required'),
    hospitalId: z.string().uuid('Invalid hospital ID'),
  }),
});

const patientLoginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
    hospitalId: z.string().uuid('Invalid hospital ID').optional(),
  }),
});

const sendOtpSchema = z.object({
  body: z.object({
    mobile: z.string().min(10, 'Valid mobile number required'),
    hospitalId: z.string().uuid('Invalid hospital ID').optional(),
  }),
});

const verifyOtpSchema = z.object({
  body: z.object({
    mobile: z.string().min(10, 'Valid mobile number required'),
    otp: z.string().length(6, 'OTP must be 6 digits'),
    hospitalId: z.string().uuid('Invalid hospital ID').optional(),
  }),
});

const sendWhatsappOtpSchema = z.object({
  body: z.object({
    mobile: z.string().min(10, 'Valid mobile number required'),
    hospitalId: z.string().uuid('Invalid hospital ID').optional(),
  }),
});

const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  }),
});

const updateProfileSchema = z.object({
  body: z.object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    phone: z.string().min(10).optional(),
    email: z.string().email().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipCode: z.string().optional(),
    emergencyContact: z.string().optional(),
    emergencyPhone: z.string().optional(),
    occupation: z.string().optional(),
    nationality: z.string().optional(),
    photo: z.string().optional(),
  }),
});

const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
  }),
});

// =============================================================================
// Public Routes (No Authentication Required)
// =============================================================================

/**
 * Register new patient
 * POST /api/v1/patient-auth/register
 * Body: { firstName, lastName, email, password, mobile, dateOfBirth, gender, address, city, state, zipCode, hospitalId }
 * Returns: { patient, tokens: { accessToken, refreshToken, expiresIn } }
 */
router.post(
  '/register',
  validate(patientRegisterSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { mobile, ...rest } = req.body;
    const result = await patientAuthService.registerPatient({
      ...rest,
      phone: mobile,
      dateOfBirth: new Date(rest.dateOfBirth),
      gender: rest.gender as Gender,
    });
    // Transform response to match expected format
    sendCreated(res, {
      patient: result.patient,
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
    }, 'Patient registration successful');
  })
);

/**
 * Patient login with email/password
 * POST /api/v1/patient-auth/login
 * Body: { email, password, hospitalId? }
 * Returns: { patient, accessToken, refreshToken }
 */
router.post(
  '/login',
  validate(patientLoginSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password, hospitalId } = req.body;
    const result = await patientAuthService.loginWithEmail(email, password, hospitalId);
    // Transform response to match expected format
    sendSuccess(res, {
      patient: result.patient,
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
    }, 'Login successful');
  })
);

/**
 * Send OTP to mobile number via SMS
 * POST /api/v1/patient-auth/send-otp
 * Body: { mobile, hospitalId? }
 * Returns: { success, message, expiresIn }
 */
router.post(
  '/send-otp',
  validate(sendOtpSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { mobile, hospitalId } = req.body;
    const result = await patientAuthService.sendOTP(mobile, hospitalId);
    sendSuccess(res, {
      success: true,
      message: result.message,
      expiresIn: result.expiresIn,
    }, 'OTP sent successfully');
  })
);

/**
 * Verify OTP and login
 * POST /api/v1/patient-auth/verify-otp
 * Body: { mobile, otp, hospitalId? }
 * Returns: { patient, accessToken, refreshToken }
 */
router.post(
  '/verify-otp',
  validate(verifyOtpSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { mobile, otp, hospitalId } = req.body;
    const result = await patientAuthService.verifyOTP(mobile, otp, hospitalId);
    // Transform response to match expected format
    sendSuccess(res, {
      patient: result.patient,
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
    }, 'OTP verified successfully');
  })
);

/**
 * Send OTP via WhatsApp
 * POST /api/v1/patient-auth/send-whatsapp-otp
 * Body: { mobile, hospitalId? }
 * Returns: { success, message }
 */
router.post(
  '/send-whatsapp-otp',
  validate(sendWhatsappOtpSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { mobile, hospitalId } = req.body;
    const result = await patientAuthService.sendWhatsAppOTP(mobile, hospitalId);
    sendSuccess(res, {
      success: true,
      message: result.message,
    }, 'WhatsApp OTP sent successfully');
  })
);

/**
 * Refresh access token
 * POST /api/v1/patient-auth/refresh-token
 * Body: { refreshToken }
 * Returns: { accessToken }
 */
router.post(
  '/refresh-token',
  validate(refreshTokenSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;
    const tokens = await patientAuthService.refreshToken(refreshToken);
    sendSuccess(res, {
      accessToken: tokens.accessToken,
    }, 'Token refreshed successfully');
  })
);

/**
 * Claim existing patient account (for patients created by staff/booking)
 * POST /api/v1/patient-auth/claim-account
 * Body: { patientId, email, password }
 * Returns: { patient, accessToken, refreshToken, claimed: true }
 */
const claimAccountSchema = z.object({
  body: z.object({
    patientId: z.string().uuid('Invalid patient ID'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
  }),
});

router.post(
  '/claim-account',
  validate(claimAccountSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { patientId, email, password } = req.body;
    const result = await patientAuthService.claimExistingAccount(patientId, email, password);
    sendCreated(res, {
      patient: result.patient,
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
      claimed: result.claimed,
    }, 'Account claimed successfully. You can now login with your email and password.');
  })
);

/**
 * Check if a patient can be claimed
 * POST /api/v1/patient-auth/can-claim
 * Body: { email?, phone? }
 * Returns: { canClaim, patient?, reason? }
 */
const canClaimSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address').optional(),
    phone: z.string().min(10, 'Valid phone number required').optional(),
    hospitalId: z.string().uuid('Invalid hospital ID').optional(),
  }).refine(data => data.email || data.phone, {
    message: 'Either email or phone is required',
  }),
});

router.post(
  '/can-claim',
  validate(canClaimSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { email, phone, hospitalId } = req.body;
    const result = await patientAuthService.checkCanClaim(email, phone, hospitalId);
    sendSuccess(res, result, result.canClaim ? 'Patient can be claimed' : 'Patient cannot be claimed');
  })
);

// =============================================================================
// Protected Routes (Patient Authentication Required)
// =============================================================================

/**
 * Get patient profile
 * GET /api/v1/patient-auth/profile
 * Headers: Authorization: Bearer <accessToken>
 * Returns: { patient profile data }
 */
router.get(
  '/profile',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const profile = await patientAuthService.getPatientProfile(req.patient!.patientId);
    sendSuccess(res, profile, 'Profile retrieved successfully');
  })
);

/**
 * Update patient profile
 * PUT /api/v1/patient-auth/profile
 * Headers: Authorization: Bearer <accessToken>
 * Body: { firstName?, lastName?, phone?, email?, address?, city?, state?, zipCode?, ... }
 * Returns: { updated patient profile }
 */
router.put(
  '/profile',
  patientAuthenticate,
  validate(updateProfileSchema),
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const profile = await patientAuthService.updatePatientProfile(req.patient!.patientId, req.body);
    sendSuccess(res, profile, 'Profile updated successfully');
  })
);

/**
 * Change password
 * POST /api/v1/patient-auth/change-password
 * Headers: Authorization: Bearer <accessToken>
 * Body: { currentPassword, newPassword }
 * Returns: { message }
 */
router.post(
  '/change-password',
  patientAuthenticate,
  validate(changePasswordSchema),
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    const result = await patientAuthService.changePassword(
      req.patient!.patientId,
      currentPassword,
      newPassword
    );
    sendSuccess(res, result, 'Password changed successfully');
  })
);

/**
 * Logout (invalidate current session)
 * POST /api/v1/patient-auth/logout
 * Headers: Authorization: Bearer <accessToken>
 * Returns: { message }
 */
router.post(
  '/logout',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    await patientAuthService.logout(req.patient!.patientId);
    sendSuccess(res, null, 'Logged out successfully');
  })
);

export default router;
