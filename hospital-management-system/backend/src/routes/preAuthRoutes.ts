import { Router, Response } from 'express';
import { preAuthService } from '../services/preAuthService';
import { authenticate, authorizeWithPermission } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated, sendPaginated } from '../utils/response';
import { AuthenticatedRequest } from '../types';

const router = Router();

/**
 * POST /pre-auth
 * Create a new pre-authorization request
 * Permission: MANAGE_PRE_AUTH or MANAGE_INSURANCE
 */
router.post(
  '/',
  authenticate,
  authorizeWithPermission('MANAGE_PRE_AUTH', []),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { user } = req;
    const preAuth = await preAuthService.createPreAuthRequest(
      user!.hospitalId,
      req.body,
      user!.userId
    );

    sendCreated(res, preAuth, 'Pre-authorization request created successfully');
  })
);

/**
 * GET /pre-auth
 * List pre-authorization requests with filters
 * Permission: VIEW_PRE_AUTH or VIEW_INSURANCE
 */
router.get(
  '/',
  authenticate,
  authorizeWithPermission('VIEW_PRE_AUTH', []),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { user } = req;
    const { patientId, status, urgency, page, limit } = req.query;

    const result = await preAuthService.listPreAuthRequests(user!.hospitalId, {
      patientId: patientId as string,
      status: status as string,
      urgency: urgency as string,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    sendPaginated(
      res,
      result.data,
      {
        ...result.pagination,
        hasNext: result.pagination.page < result.pagination.totalPages,
        hasPrev: result.pagination.page > 1,
      },
      'Pre-authorization requests retrieved successfully'
    );
  })
);

/**
 * GET /pre-auth/:id
 * Get pre-authorization request by ID
 * Permission: VIEW_PRE_AUTH
 */
router.get(
  '/:id',
  authenticate,
  authorizeWithPermission('VIEW_PRE_AUTH', []),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { user } = req;
    const preAuth = await preAuthService.getPreAuthById(
      req.params.id,
      user!.hospitalId
    );

    sendSuccess(res, preAuth, 'Pre-authorization request retrieved successfully');
  })
);

/**
 * PATCH /pre-auth/:id/status
 * Update pre-authorization status (approve/deny)
 * Permission: MANAGE_PRE_AUTH
 */
router.patch(
  '/:id/status',
  authenticate,
  authorizeWithPermission('MANAGE_PRE_AUTH', []),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { user } = req;
    const updated = await preAuthService.updatePreAuthStatus(
      req.params.id,
      user!.hospitalId,
      req.body,
      user!.userId
    );

    sendSuccess(res, updated, 'Pre-authorization status updated successfully');
  })
);

/**
 * POST /pre-auth/verify-coverage
 * Verify insurance coverage for a procedure
 * Permission: VIEW_PRE_AUTH or VIEW_INSURANCE
 */
router.post(
  '/verify-coverage',
  authenticate,
  authorizeWithPermission('VIEW_PRE_AUTH', []),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { user } = req;
    const { patientId, procedureCPTCode, diagnosisICDCode } = req.body;

    const coverage = await preAuthService.verifyCoverage(
      user!.hospitalId,
      patientId,
      procedureCPTCode,
      diagnosisICDCode
    );

    sendSuccess(res, coverage, 'Coverage verification completed');
  })
);

/**
 * POST /pre-auth/calculate-copay
 * Calculate copay, deductible, and coinsurance for invoice items
 * Permission: VIEW_PRE_AUTH or VIEW_BILLING
 */
router.post(
  '/calculate-copay',
  authenticate,
  authorizeWithPermission('VIEW_PRE_AUTH', []),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { user } = req;
    const { patientId, items } = req.body;

    const calculation = await preAuthService.calculateCopayDeductible(
      user!.hospitalId,
      patientId,
      items
    );

    sendSuccess(res, calculation, 'Copay/deductible calculation completed');
  })
);

/**
 * POST /pre-auth/check-requirement
 * Check if a procedure requires pre-authorization
 * Permission: VIEW_PRE_AUTH
 */
router.post(
  '/check-requirement',
  authenticate,
  authorizeWithPermission('VIEW_PRE_AUTH', []),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { user } = req;
    const { cptCode, payerId } = req.body;

    const requirement = await preAuthService.checkPreAuthRequirement(
      user!.hospitalId,
      cptCode,
      payerId
    );

    sendSuccess(res, requirement, 'Pre-authorization requirement checked');
  })
);

export default router;
