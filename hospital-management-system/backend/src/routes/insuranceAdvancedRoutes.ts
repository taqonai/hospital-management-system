/**
 * Advanced Insurance Routes
 * 
 * Handles:
 * - Coordination of Benefits (COB) for multiple insurance
 * - IPD Insurance Expiry Monitoring
 * - Insurance Underpayment Processing
 */

import { Router, Response } from 'express';
import { authenticate, authorize, authorizeWithPermission } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendError, sendCreated } from '../utils/response';
import { AuthenticatedRequest } from '../types';
import { cobService } from '../services/coordinationOfBenefitsService';
import { ipdInsuranceMonitorService } from '../services/ipdInsuranceMonitorService';
import { insuranceUnderpaymentService } from '../services/insuranceUnderpaymentService';
import { patientService } from '../services/patientService';

const router = Router();

// ==================== COORDINATION OF BENEFITS ====================

/**
 * POST /api/v1/insurance-advanced/cob/calculate
 * Calculate insurance split for multiple policies
 */
router.post(
  '/cob/calculate',
  authenticate,
  authorize('RECEPTIONIST', 'ACCOUNTANT', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { patientId, totalAmount, serviceCategory } = req.body;

    if (!patientId || !totalAmount) {
      return sendError(res, 'Patient ID and total amount are required', 400);
    }

    const result = await cobService.calculateCOBSplit(patientId, totalAmount, serviceCategory);
    sendSuccess(res, result);
  })
);

/**
 * GET /api/v1/insurance-advanced/cob/patient/:patientId
 * Get patient's active insurance policies for COB
 */
router.get(
  '/cob/patient/:patientId',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const insurances = await cobService.getPatientInsurances(req.params.patientId);
    sendSuccess(res, { 
      count: insurances.length,
      hasCOB: insurances.length > 1,
      insurances,
    });
  })
);

/**
 * GET /api/v1/insurance-advanced/cob/invoice/:invoiceId
 * Get COB summary for an invoice
 */
router.get(
  '/cob/invoice/:invoiceId',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const summary = await cobService.getInvoiceCOBSummary(req.params.invoiceId);
    sendSuccess(res, summary);
  })
);

// ==================== IPD INSURANCE MONITORING ====================

/**
 * GET /api/v1/insurance-advanced/ipd/expiry-alerts
 * Get all insurance expiry alerts for admitted patients
 */
router.get(
  '/ipd/expiry-alerts',
  authenticate,
  authorize('RECEPTIONIST', 'ACCOUNTANT', 'HOSPITAL_ADMIN', 'NURSE'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const alerts = await ipdInsuranceMonitorService.checkAllAdmittedPatients(req.user!.hospitalId);
    
    sendSuccess(res, {
      total: alerts.length,
      expired: alerts.filter(a => a.status === 'EXPIRED_DURING_STAY').length,
      expiringSoon: alerts.filter(a => a.status === 'EXPIRING_SOON').length,
      alerts,
    });
  })
);

/**
 * GET /api/v1/insurance-advanced/ipd/:admissionId/balance
 * Get outstanding balance for an IPD admission
 */
router.get(
  '/ipd/:admissionId/balance',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const balance = await ipdInsuranceMonitorService.getOutstandingBalance(req.params.admissionId);
    sendSuccess(res, balance);
  })
);

/**
 * POST /api/v1/insurance-advanced/ipd/:admissionId/add-insurance
 * Add new insurance to patient mid-stay
 */
router.post(
  '/ipd/:admissionId/add-insurance',
  authenticate,
  authorize('RECEPTIONIST', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { admissionId } = req.params;
    const insuranceData = req.body;

    const result = await ipdInsuranceMonitorService.addMidStayInsurance(admissionId, insuranceData);
    
    if (result.success) {
      sendCreated(res, result);
    } else {
      sendError(res, result.message, 400);
    }
  })
);

// ==================== INSURANCE UNDERPAYMENT ====================

/**
 * POST /api/v1/insurance-advanced/underpayment/process
 * Process insurance remittance and handle underpayment
 */
router.post(
  '/underpayment/process',
  authenticate,
  authorizeWithPermission('billing:claims:manage', ['ACCOUNTANT', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { claimId, approvedAmount, denialCodes, denialReasons, adjustmentCodes } = req.body;

    if (!claimId || approvedAmount === undefined) {
      return sendError(res, 'Claim ID and approved amount are required', 400);
    }

    const result = await insuranceUnderpaymentService.processRemittance(claimId, {
      approvedAmount,
      denialCodes,
      denialReasons,
      adjustmentCodes,
    });

    sendSuccess(res, result);
  })
);

/**
 * GET /api/v1/insurance-advanced/underpayment/report
 * Generate underpayment report for a period
 */
router.get(
  '/underpayment/report',
  authenticate,
  authorizeWithPermission('reports:financial:view', ['ACCOUNTANT', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(new Date().setMonth(new Date().getMonth() - 1));
    const end = endDate ? new Date(endDate as string) : new Date();

    const report = await insuranceUnderpaymentService.generateUnderpaymentReport(
      req.user!.hospitalId,
      start,
      end
    );

    sendSuccess(res, report);
  })
);

/**
 * GET /api/v1/insurance-advanced/underpayment/analysis
 * Quick underpayment analysis summary
 */
router.get(
  '/underpayment/analysis',
  authenticate,
  authorizeWithPermission('reports:financial:view', ['ACCOUNTANT', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Default to last 30 days
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);

    const report = await insuranceUnderpaymentService.generateUnderpaymentReport(
      req.user!.hospitalId,
      start,
      end
    );

    // Return a summary view
    sendSuccess(res, {
      summary: {
        totalClaimsAnalyzed: report.totalClaims,
        totalClaimedAmount: report.totalClaimedAmount,
        totalApprovedAmount: report.totalApprovedAmount,
        totalShortfall: report.totalShortfall,
        shortfallPercentage: report.shortfallPercentage.toFixed(2) + '%',
        patientBillsGenerated: report.patientBillsGenerated,
      },
      topDenialReasons: report.byDenialReason.slice(0, 5),
      topPayerShortfalls: report.byPayer.sort((a, b) => b.shortfall - a.shortfall).slice(0, 5),
    });
  })
);

// ==================== INSURANCE VERIFICATION ====================

/**
 * GET /api/v1/insurance-advanced/verifications/pending
 * Get all pending insurance verifications for staff review
 */
router.get(
  '/verifications/pending',
  authenticate,
  authorize('RECEPTIONIST', 'ACCOUNTANT', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const pendingVerifications = await patientService.getPendingVerifications(req.user!.hospitalId);
    
    sendSuccess(res, {
      total: pendingVerifications.length,
      verifications: pendingVerifications.map(ins => ({
        id: ins.id,
        patientId: ins.patientId,
        patient: ins.patient,
        providerName: ins.providerName,
        policyNumber: ins.policyNumber,
        groupNumber: ins.groupNumber,
        subscriberName: ins.subscriberName,
        subscriberId: ins.subscriberId,
        relationship: ins.relationship,
        effectiveDate: ins.effectiveDate,
        expiryDate: ins.expiryDate,
        coverageType: ins.coverageType,
        isPrimary: ins.isPrimary,
        createdAt: ins.createdAt,
        verificationStatus: ins.verificationStatus,
      })),
    });
  })
);

export default router;
