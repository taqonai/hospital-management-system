import { Router, Response } from 'express';
import { authService } from '../services/authService';
import { authenticate } from '../middleware/auth';
import { validate, loginSchema, registerSchema } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated } from '../utils/response';
import { AuthenticatedRequest } from '../types';

const router = Router();

// Login
router.post(
  '/login',
  validate(loginSchema),
  asyncHandler(async (req, res: Response) => {
    const result = await authService.login(req.body);
    sendSuccess(res, result, 'Login successful');
  })
);

// Register
router.post(
  '/register',
  validate(registerSchema),
  asyncHandler(async (req, res: Response) => {
    const result = await authService.register(req.body);
    sendCreated(res, result, 'Registration successful');
  })
);

// Refresh token
router.post(
  '/refresh',
  asyncHandler(async (req, res: Response) => {
    const { refreshToken } = req.body;
    const tokens = await authService.refreshToken(refreshToken);
    sendSuccess(res, tokens, 'Token refreshed');
  })
);

// Logout
router.post(
  '/logout',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const token = req.headers.authorization?.split(' ')[1] || '';
    await authService.logout(req.user!.userId, token);
    sendSuccess(res, null, 'Logged out successfully');
  })
);

// Logout all sessions
router.post(
  '/logout-all',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await authService.logoutAll(req.user!.userId);
    sendSuccess(res, null, 'Logged out from all devices');
  })
);

// Get profile
router.get(
  '/profile',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const profile = await authService.getProfile(req.user!.userId);
    sendSuccess(res, profile);
  })
);

// Update profile
router.put(
  '/profile',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const profile = await authService.updateProfile(req.user!.userId, req.body);
    sendSuccess(res, profile, 'Profile updated');
  })
);

// Change password
router.post(
  '/change-password',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    await authService.changePassword(req.user!.userId, currentPassword, newPassword);
    sendSuccess(res, null, 'Password changed successfully');
  })
);

export default router;
