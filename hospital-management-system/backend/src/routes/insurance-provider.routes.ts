import { Router, Response } from 'express';
import { authenticate, authorizeWithPermission } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess } from '../utils/response';
import { AuthenticatedRequest } from '../types';
import { insuranceProviderService } from '../services/insurance-provider.service';
import { body, param, query, validationResult } from 'express-validator';

const router = Router();

// Validation middleware
const validate = (req: any, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

// ==================== STAFF ROUTES (Authenticated) ====================

/**
 * GET /api/v1/staff/insurance-providers
 * List all insurance providers (staff view with pagination)
 */
router.get(
  '/staff/insurance-providers',
  authenticate,
  authorizeWithPermission('insurance:read', ['HOSPITAL_ADMIN', 'RECEPTIONIST', 'ACCOUNTANT']),
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('search').optional().trim(),
    query('includeInactive').optional().isBoolean(),
  ],
  validate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const search = req.query.search as string;
    const includeInactive = req.query.includeInactive === 'true';

    const result = await insuranceProviderService.getAllProviders(
      req.user!.hospitalId,
      page,
      limit,
      search,
      includeInactive
    );

    sendSuccess(res, result);
  })
);

/**
 * GET /api/v1/staff/insurance-providers/:id
 * Get insurance provider by ID
 */
router.get(
  '/staff/insurance-providers/:id',
  authenticate,
  authorizeWithPermission('insurance:read', ['HOSPITAL_ADMIN', 'RECEPTIONIST', 'ACCOUNTANT']),
  param('id').isUUID().withMessage('Invalid provider ID'),
  validate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const provider = await insuranceProviderService.getProviderById(
      req.user!.hospitalId,
      req.params.id
    );
    sendSuccess(res, provider);
  })
);

/**
 * POST /api/v1/staff/insurance-providers
 * Create insurance provider
 */
router.post(
  '/staff/insurance-providers',
  authenticate,
  authorizeWithPermission('insurance:write', ['HOSPITAL_ADMIN', 'RECEPTIONIST']),
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('licenseNumber').trim().notEmpty().withMessage('License number is required'),
    body('tpaName').optional().trim(),
    body('contactPhone').optional().trim(),
    body('email').optional().isEmail().withMessage('Invalid email'),
    body('emirate')
      .optional()
      .isIn(['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah'])
      .withMessage('Invalid emirate'),
  ],
  validate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const provider = await insuranceProviderService.createProvider(
      req.user!.hospitalId,
      req.user!.id,
      req.body
    );
    sendSuccess(res, provider, 'Insurance provider created successfully', 201);
  })
);

/**
 * PUT /api/v1/staff/insurance-providers/:id
 * Update insurance provider
 */
router.put(
  '/staff/insurance-providers/:id',
  authenticate,
  authorizeWithPermission('insurance:write', ['HOSPITAL_ADMIN', 'RECEPTIONIST']),
  [
    param('id').isUUID().withMessage('Invalid provider ID'),
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('licenseNumber').optional().trim().notEmpty().withMessage('License number cannot be empty'),
    body('tpaName').optional().trim(),
    body('contactPhone').optional().trim(),
    body('email').optional().isEmail().withMessage('Invalid email'),
    body('emirate')
      .optional()
      .isIn(['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah'])
      .withMessage('Invalid emirate'),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  ],
  validate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const provider = await insuranceProviderService.updateProvider(
      req.user!.hospitalId,
      req.params.id,
      req.user!.id,
      req.body
    );
    sendSuccess(res, provider, 'Insurance provider updated successfully');
  })
);

/**
 * DELETE /api/v1/staff/insurance-providers/:id
 * Soft delete insurance provider
 */
router.delete(
  '/staff/insurance-providers/:id',
  authenticate,
  authorizeWithPermission('insurance:write', ['HOSPITAL_ADMIN']),
  param('id').isUUID().withMessage('Invalid provider ID'),
  validate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await insuranceProviderService.deleteProvider(
      req.user!.hospitalId,
      req.params.id
    );
    sendSuccess(res, result);
  })
);

// ==================== PUBLIC/PATIENT ROUTES ====================

/**
 * GET /api/v1/insurance-providers/active
 * Get active insurance providers (minimal fields for dropdowns)
 */
router.get(
  '/insurance-providers/active',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const providers = await insuranceProviderService.getActiveProviders(req.user!.hospitalId);
    sendSuccess(res, providers);
  })
);

export default router;
