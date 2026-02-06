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
 * Permission: MANAGE_PRE_AUTH or allowed roles
 */
router.post(
  '/',
  authenticate,
  authorizeWithPermission('MANAGE_PRE_AUTH', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'ACCOUNTANT', 'RECEPTIONIST']),
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
 * Permission: VIEW_PRE_AUTH or allowed roles
 */
router.get(
  '/',
  authenticate,
  authorizeWithPermission('VIEW_PRE_AUTH', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'ACCOUNTANT', 'RECEPTIONIST', 'DOCTOR', 'NURSE']),
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

/**
 * POST /pre-auth/submit-to-dha
 * Submit pre-auth request to DHA eClaimLink
 * Permission: MANAGE_PRE_AUTH
 */
router.post(
  '/submit-to-dha',
  authenticate,
  authorizeWithPermission('MANAGE_PRE_AUTH', []),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { user } = req;
    const { patientId, procedureCPTCode, diagnosisICDCode, urgency, notes, appointmentId } = req.body;

    if (!patientId || !procedureCPTCode) {
      return res.status(400).json({ success: false, message: 'patientId and procedureCPTCode are required' });
    }

    // First create the pre-auth request
    const preAuth = await preAuthService.createPreAuthRequest(
      user!.hospitalId,
      {
        patientId,
        procedureCPTCode,
        diagnosisICDCode,
        urgency: urgency || 'ROUTINE',
        notes,
        appointmentId,
      },
      user!.userId
    );

    // Try to submit to DHA
    try {
      const { dhaEClaimService } = await import('../services/dhaEClaimService');
      const isConfigured = await dhaEClaimService.isConfigured(user!.hospitalId);
      
      if (!isConfigured) {
        // DHA not configured - return the saved request as PENDING
        sendCreated(res, preAuth, 'Pre-auth saved. DHA not configured - follow up manually.');
        return;
      }

      // Submit to DHA
      const dhaResult = await dhaEClaimService.submitPreAuth(
        user!.hospitalId,
        preAuth.id,
        {
          patientId,
          procedureCPTCode,
          diagnosisICDCode,
          urgency,
        }
      );

      // Update pre-auth with DHA response
      const updated = await preAuthService.updatePreAuthStatus(
        preAuth.id,
        user!.hospitalId,
        {
          status: dhaResult.approved ? 'APPROVED' : (dhaResult.pending ? 'SUBMITTED' : 'DENIED'),
          authorizationNumber: dhaResult.authorizationNumber,
          denialReason: dhaResult.denialReason,
          dhaTransactionId: dhaResult.transactionId,
        },
        user!.userId
      );

      sendCreated(res, updated, dhaResult.approved ? 'Pre-auth approved by DHA' : 'Pre-auth submitted to DHA');
    } catch (dhaError: any) {
      // DHA submission failed - keep request as PENDING for manual follow-up
      console.error('[PRE-AUTH] DHA submission error:', dhaError.message);
      sendCreated(res, {
        ...preAuth,
        dhaError: dhaError.message,
      }, 'Pre-auth saved but DHA submission failed. Please follow up manually.');
    }
  })
);

export default router;
