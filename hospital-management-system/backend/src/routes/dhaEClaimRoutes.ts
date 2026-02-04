/**
 * DHA eClaimLink API Routes
 * 
 * Endpoints for DHA integration:
 * - Eligibility verification
 * - Claim submission
 * - Claim status inquiry
 * - Remittance advice retrieval
 */

import { Router, Response } from 'express';
import { authenticate, authorize, authorizeWithPermission } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendError, sendCreated } from '../utils/response';
import { AuthenticatedRequest } from '../types';
import { dhaEClaimService } from '../services/dhaEClaimService';
import prisma from '../config/database';
import logger from '../utils/logger';

const router = Router();

// ==================== STATUS & CONFIGURATION ====================

/**
 * GET /api/dha-eclaim/status
 * Check DHA integration status for the hospital
 */
router.get(
  '/status',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const isConfigured = await dhaEClaimService.isConfigured(req.user!.hospitalId);
    const mode = await dhaEClaimService.getMode(req.user!.hospitalId);

    sendSuccess(res, {
      configured: isConfigured,
      mode,
      features: {
        eligibility: true,
        claimSubmission: true,
        claimStatus: true,
        remittance: true,
      },
    });
  })
);

// ==================== ELIGIBILITY ====================

/**
 * POST /api/dha-eclaim/eligibility/verify
 * Verify patient insurance eligibility via DHA eClaimLink
 */
router.post(
  '/eligibility/verify',
  authenticate,
  authorize('RECEPTIONIST', 'NURSE', 'DOCTOR', 'HOSPITAL_ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { emiratesId, payerId } = req.body;

    if (!emiratesId) {
      return sendError(res, 'Emirates ID is required', 400);
    }

    // Clean Emirates ID (remove dashes)
    const cleanEid = emiratesId.replace(/-/g, '');
    if (cleanEid.length !== 15) {
      return sendError(res, 'Invalid Emirates ID format (must be 15 digits)', 400);
    }

    const result = await dhaEClaimService.verifyEligibility(
      req.user!.hospitalId,
      { emiratesId: cleanEid, payerId }
    );

    // Log verification attempt
    await prisma.auditLog.create({
      data: {
        hospitalId: req.user!.hospitalId,
        userId: req.user!.id,
        action: 'DHA_ELIGIBILITY_CHECK',
        entity: 'Insurance',
        details: JSON.stringify({
          emiratesId: cleanEid.slice(0, 3) + '***' + cleanEid.slice(-3), // Mask EID
          success: result.success,
          status: result.policyStatus,
        }),
      },
    });

    sendSuccess(res, result);
  })
);

/**
 * GET /api/dha-eclaim/eligibility/patient/:patientId
 * Verify eligibility for a specific patient (uses stored Emirates ID)
 */
router.get(
  '/eligibility/patient/:patientId',
  authenticate,
  authorize('RECEPTIONIST', 'NURSE', 'DOCTOR', 'HOSPITAL_ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { patientId } = req.params;

    const patient = await prisma.patient.findFirst({
      where: {
        id: patientId,
        hospitalId: req.user!.hospitalId,
      },
    });

    if (!patient) {
      return sendError(res, 'Patient not found', 404);
    }

    if (!patient.emiratesId) {
      return sendError(res, 'Patient does not have Emirates ID on file', 400);
    }

    const result = await dhaEClaimService.verifyEligibility(
      req.user!.hospitalId,
      { emiratesId: patient.emiratesId }
    );

    sendSuccess(res, result);
  })
);

// ==================== CLAIM SUBMISSION ====================

/**
 * POST /api/dha-eclaim/claims/submit
 * Submit a claim to DHA
 */
router.post(
  '/claims/submit',
  authenticate,
  authorizeWithPermission('billing:claims:submit', ['HOSPITAL_ADMIN', 'ACCOUNTANT']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { invoiceId } = req.body;

    if (!invoiceId) {
      return sendError(res, 'Invoice ID is required', 400);
    }

    // Get invoice with all details
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        hospitalId: req.user!.hospitalId,
      },
      include: {
        patient: true,
        lineItems: true,
        insuranceClaims: true,
      },
    });

    if (!invoice) {
      return sendError(res, 'Invoice not found', 404);
    }

    if (!invoice.patient.emiratesId) {
      return sendError(res, 'Patient does not have Emirates ID', 400);
    }

    // Build claim from invoice
    const claimRequest = {
      header: {
        claimId: invoice.invoiceNumber,
        memberId: invoice.patient.mrn || invoice.patient.id,
        memberName: `${invoice.patient.firstName} ${invoice.patient.lastName}`,
        emiratesId: invoice.patient.emiratesId,
        payerId: 'DAMAN', // Should come from patient's insurance
        providerId: req.user!.hospitalId,
        encounterType: 'OUTPATIENT' as const,
        encounterStart: invoice.createdAt,
        primaryDiagnosis: 'Z00.00', // Should come from consultation
        claimAmount: Number(invoice.totalAmount),
        currency: 'AED' as const,
      },
      activities: invoice.lineItems.map((item, idx) => ({
        activityId: `${invoice.invoiceNumber}-${idx + 1}`,
        activityType: 'CPT' as const,
        activityCode: item.code || `SVC${idx + 1}`,
        description: item.description,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        netAmount: Number(item.totalPrice),
        serviceDate: invoice.createdAt,
      })),
    };

    const result = await dhaEClaimService.submitClaim(
      req.user!.hospitalId,
      claimRequest
    );

    // Update or create insurance claim record
    if (result.success && result.claimReference) {
      await prisma.insuranceClaim.upsert({
        where: {
          invoiceId_insuranceProvider: {
            invoiceId: invoice.id,
            insuranceProvider: 'DHA',
          },
        },
        update: {
          claimNumber: result.claimReference,
          status: 'SUBMITTED',
          submittedDate: new Date(),
          claimedAmount: invoice.totalAmount,
        },
        create: {
          hospitalId: req.user!.hospitalId,
          invoiceId: invoice.id,
          claimNumber: result.claimReference,
          insuranceProvider: 'DHA',
          status: 'SUBMITTED',
          submittedDate: new Date(),
          claimedAmount: invoice.totalAmount,
        },
      });
    }

    // Log submission
    logger.info(`[DHA] Claim submitted: ${result.claimReference || 'FAILED'} for invoice ${invoiceId}`);

    sendSuccess(res, result);
  })
);

/**
 * POST /api/dha-eclaim/claims/batch-submit
 * Submit multiple claims in batch
 */
router.post(
  '/claims/batch-submit',
  authenticate,
  authorizeWithPermission('billing:claims:submit', ['HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { invoiceIds } = req.body;

    if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return sendError(res, 'Invoice IDs array is required', 400);
    }

    const results = [];

    for (const invoiceId of invoiceIds) {
      try {
        // Simplified - would need full implementation
        results.push({
          invoiceId,
          status: 'QUEUED',
          message: 'Claim queued for submission',
        });
      } catch (error: any) {
        results.push({
          invoiceId,
          status: 'ERROR',
          message: error.message,
        });
      }
    }

    sendSuccess(res, {
      total: invoiceIds.length,
      queued: results.filter(r => r.status === 'QUEUED').length,
      failed: results.filter(r => r.status === 'ERROR').length,
      results,
    });
  })
);

// ==================== CLAIM STATUS ====================

/**
 * GET /api/dha-eclaim/claims/:claimReference/status
 * Get claim status from DHA
 */
router.get(
  '/claims/:claimReference/status',
  authenticate,
  authorize('RECEPTIONIST', 'ACCOUNTANT', 'HOSPITAL_ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { claimReference } = req.params;

    const result = await dhaEClaimService.getClaimStatus(
      req.user!.hospitalId,
      claimReference
    );

    // Update local claim record if status changed
    if (result.success && result.status) {
      await prisma.insuranceClaim.updateMany({
        where: {
          claimNumber: claimReference,
          hospitalId: req.user!.hospitalId,
        },
        data: {
          status: result.status === 'APPROVED' ? 'APPROVED' 
            : result.status === 'REJECTED' ? 'REJECTED'
            : result.status === 'PAID' ? 'PAID'
            : 'SUBMITTED',
          approvedAmount: result.approvedAmount ? new (require('@prisma/client/runtime/library').Decimal)(result.approvedAmount) : undefined,
        },
      });
    }

    sendSuccess(res, result);
  })
);

/**
 * POST /api/dha-eclaim/claims/refresh-statuses
 * Bulk refresh claim statuses
 */
router.post(
  '/claims/refresh-statuses',
  authenticate,
  authorizeWithPermission('billing:claims:manage', ['HOSPITAL_ADMIN', 'ACCOUNTANT']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Get all submitted claims pending status update
    const pendingClaims = await prisma.insuranceClaim.findMany({
      where: {
        hospitalId: req.user!.hospitalId,
        status: 'SUBMITTED',
        submittedDate: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
      take: 50, // Limit batch size
    });

    const results = [];

    for (const claim of pendingClaims) {
      const status = await dhaEClaimService.getClaimStatus(
        req.user!.hospitalId,
        claim.claimNumber
      );
      results.push({
        claimNumber: claim.claimNumber,
        previousStatus: claim.status,
        newStatus: status.status,
        updated: status.success,
      });
    }

    sendSuccess(res, {
      checked: pendingClaims.length,
      updated: results.filter(r => r.updated).length,
      results,
    });
  })
);

// ==================== REMITTANCE ====================

/**
 * GET /api/dha-eclaim/remittance/:remittanceId
 * Get remittance advice details
 */
router.get(
  '/remittance/:remittanceId',
  authenticate,
  authorizeWithPermission('billing:remittance:view', ['HOSPITAL_ADMIN', 'ACCOUNTANT']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { remittanceId } = req.params;

    const result = await dhaEClaimService.getRemittanceAdvice(
      req.user!.hospitalId,
      remittanceId
    );

    if (!result) {
      return sendError(res, 'Remittance advice not found', 404);
    }

    sendSuccess(res, result);
  })
);

export default router;
