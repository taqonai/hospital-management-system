import { Router, Response } from 'express';
import { billingService } from '../services/billingService';
import { authenticate, authorize, authorizeWithPermission } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated, sendPaginated, calculatePagination } from '../utils/response';
import { AuthenticatedRequest } from '../types';

const router = Router();

// ==================== Invoices ====================

// Get all invoices
router.get(
  '/invoices',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit, status, patientId, startDate, endDate } = req.query;
    const result = await billingService.getInvoices(req.user!.hospitalId, {
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      status: status as string,
      patientId: patientId as string,
      startDate: startDate as string,
      endDate: endDate as string,
    });
    const pagination = calculatePagination(result.page, result.limit, result.total);
    sendPaginated(res, result.invoices, pagination);
  })
);

// Create invoice
router.post(
  '/invoices',
  authenticate,
  authorizeWithPermission('billing:write', ['ACCOUNTANT', 'HOSPITAL_ADMIN', 'RECEPTIONIST']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const invoice = await billingService.createInvoice(req.user!.hospitalId, {
      ...req.body,
      createdBy: req.user!.userId,
    });
    sendCreated(res, invoice, 'Invoice created');
  })
);

// Get invoice by ID
router.get(
  '/invoices/:id',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const invoice = await billingService.getInvoiceById(req.params.id, req.user!.hospitalId);
    sendSuccess(res, invoice);
  })
);

// Cancel invoice
router.delete(
  '/invoices/:id',
  authenticate,
  authorizeWithPermission('billing:write', ['ACCOUNTANT', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const invoice = await billingService.cancelInvoice(req.params.id, req.user!.hospitalId);
    sendSuccess(res, invoice, 'Invoice cancelled');
  })
);

// ==================== Payments ====================

// Add payment
router.post(
  '/invoices/:invoiceId/payments',
  authenticate,
  authorizeWithPermission('billing:write', ['ACCOUNTANT', 'RECEPTIONIST', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const payment = await billingService.addPayment(req.params.invoiceId, {
      ...req.body,
      createdBy: req.user!.userId,
    });
    sendCreated(res, payment, 'Payment recorded');
  })
);

// Collect copay at check-in
router.post(
  '/copay-collect',
  authenticate,
  authorizeWithPermission('billing:write', ['RECEPTIONIST', 'NURSE', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await billingService.collectCopay({
      ...req.body,
      hospitalId: req.user!.hospitalId,
      collectedBy: req.user!.userId,
    });
    sendCreated(res, result, 'Copay collected successfully');
  })
);

// ==================== Insurance Claims ====================

// Get all claims
router.get(
  '/claims',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit, status } = req.query;
    const result = await billingService.getClaims(req.user!.hospitalId, {
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      status: status as string,
    });
    const pagination = calculatePagination(result.page, result.limit, result.total);
    sendPaginated(res, result.claims, pagination);
  })
);

// Submit insurance claim
router.post(
  '/invoices/:invoiceId/claims',
  authenticate,
  authorizeWithPermission('billing:write', ['ACCOUNTANT', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const claim = await billingService.submitInsuranceClaim(req.params.invoiceId, {
      ...req.body,
      createdBy: req.user!.userId,
      submittedBy: req.user!.userId,
    });
    sendCreated(res, claim, 'Insurance claim submitted');
  })
);

// Update claim status
router.patch(
  '/claims/:claimId/status',
  authenticate,
  authorizeWithPermission('billing:write', ['ACCOUNTANT', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const claim = await billingService.updateClaimStatus(
      req.params.claimId,
      req.body.status,
      req.body.approvedAmount,
      req.user!.userId,
      req.body.denialReasonCode
    );
    sendSuccess(res, claim, 'Claim status updated');
  })
);

// ==================== Reports ====================

// Get patient statement
router.get(
  '/patients/:patientId/statement',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const statement = await billingService.generatePatientStatement(
      req.params.patientId,
      req.user!.hospitalId
    );
    sendSuccess(res, statement);
  })
);

// Get billing stats
router.get(
  '/stats',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const stats = await billingService.getBillingStats(req.user!.hospitalId);
    sendSuccess(res, stats);
  })
);

// Get outstanding payments
router.get(
  '/outstanding',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const outstanding = await billingService.getOutstandingPayments(req.user!.hospitalId);
    sendSuccess(res, outstanding);
  })
);

// ==================== AI Auto Charge Capture ====================

// Extract charges from clinical notes (NLP-powered)
router.post(
  '/extract-charges',
  authenticate,
  authorizeWithPermission('billing:write', ['ACCOUNTANT', 'HOSPITAL_ADMIN', 'DOCTOR', 'RECEPTIONIST']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { notes } = req.body;
    const result = await billingService.extractChargesFromNotes(notes, req.user!.hospitalId);
    sendSuccess(res, result);
  })
);

// Suggest billing codes based on diagnosis/procedures
router.post(
  '/suggest-codes',
  authenticate,
  authorizeWithPermission('billing:write', ['ACCOUNTANT', 'HOSPITAL_ADMIN', 'DOCTOR', 'RECEPTIONIST']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await billingService.suggestBillingCodes(req.user!.hospitalId, req.body);
    sendSuccess(res, result);
  })
);

// Estimate procedure cost with insurance
router.post(
  '/estimate-cost',
  authenticate,
  authorizeWithPermission('billing:read', ['ACCOUNTANT', 'HOSPITAL_ADMIN', 'DOCTOR', 'RECEPTIONIST', 'PATIENT']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await billingService.estimateCost(req.user!.hospitalId, req.body);
    sendSuccess(res, result);
  })
);

// ==================== Claim Appeals ====================

// Create claim appeal
router.post(
  '/claims/:claimId/appeal',
  authenticate,
  authorizeWithPermission('billing:write', ['ACCOUNTANT', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const appealClaim = await billingService.createClaimAppeal(
      req.user!.hospitalId,
      req.params.claimId,
      req.body,
      req.user!.userId
    );
    sendCreated(res, appealClaim, 'Claim appeal created successfully');
  })
);

// Submit claim appeal
router.post(
  '/claims/:claimId/appeal/submit',
  authenticate,
  authorizeWithPermission('billing:write', ['ACCOUNTANT', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const submitted = await billingService.submitClaimAppeal(
      req.params.claimId,
      req.user!.hospitalId,
      req.user!.userId
    );
    sendSuccess(res, submitted, 'Claim appeal submitted successfully');
  })
);

// Get claim appeal history
router.get(
  '/claims/:claimId/appeal-history',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const history = await billingService.getClaimAppealHistory(
      req.params.claimId,
      req.user!.hospitalId
    );
    sendSuccess(res, history, 'Claim appeal history retrieved successfully');
  })
);

// ==================== eClaimLink Integration ====================

// Submit claim to DHA eClaimLink
router.post(
  '/claims/:claimId/submit-eclaim',
  authenticate,
  authorizeWithPermission('billing:write', ['ACCOUNTANT', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { eclaimLinkService } = require('../services/eclaimLinkService');
    const result = await eclaimLinkService.submitClaimToDHA(
      req.params.claimId,
      req.user!.hospitalId
    );
    sendSuccess(res, result, 'Claim submission to eClaimLink completed');
  })
);

// Check eClaimLink submission status
router.get(
  '/claims/:claimId/eclaim-status',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { eclaimLinkService } = require('../services/eclaimLinkService');
    const status = await eclaimLinkService.checkClaimStatus(req.params.claimId);
    sendSuccess(res, status, 'eClaimLink status retrieved successfully');
  })
);

export default router;
