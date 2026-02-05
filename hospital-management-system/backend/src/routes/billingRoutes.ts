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

// Calculate copay for a patient
router.get(
  '/calculate-copay/:patientId',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { appointmentId } = req.query;
    const copayInfo = await billingService.calculateCopay(
      req.params.patientId,
      req.user!.hospitalId,
      appointmentId as string | undefined
    );
    sendSuccess(res, copayInfo);
  })
);

// Get patient deposit balance
router.get(
  '/patients/:patientId/deposit-balance',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { depositService } = require('../services/depositService');
    const balance = await depositService.getPatientDepositBalance(
      req.params.patientId,
      req.user!.hospitalId
    );
    sendSuccess(res, balance);
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

// Convert appointment to self-pay (bypass insurance for this visit)
router.post(
  '/convert-to-self-pay',
  authenticate,
  authorizeWithPermission('billing:write', ['RECEPTIONIST', 'NURSE', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { patientId, appointmentId, reason } = req.body;
    const hospitalId = req.user!.hospitalId;
    const userId = req.user!.userId;

    if (!patientId || !appointmentId) {
      return res.status(400).json({ success: false, message: 'patientId and appointmentId are required' });
    }

    // Mark appointment to use self-pay instead of insurance
    const prisma = (await import('../config/database')).default;
    
    // Update appointment with selfPay flag
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { 
        selfPay: true,
        selfPayConvertedAt: new Date(),
        selfPayConvertedBy: userId,
        selfPayReason: reason || 'Converted to self-pay at check-in',
      },
    });

    // Recalculate copay (will now return self-pay pricing)
    const copayInfo = await billingService.calculateCopay(patientId, hospitalId, appointmentId);

    // Log the conversion for audit
    const { insuranceAuditService } = await import('../services/insuranceAuditService');
    await insuranceAuditService.logAudit({
      hospitalId,
      patientId,
      appointmentId,
      action: 'CONVERT_TO_SELFPAY',
      performedBy: userId,
      previousData: { usingInsurance: true },
      newData: { selfPay: true, reason },
      reason: reason || 'Converted to self-pay at check-in',
    });

    sendSuccess(res, copayInfo, 'Converted to self-pay successfully');
  })
);

// GAP 3: Get copay receipt HTML by receipt number
router.get(
  '/copay-receipt/:receiptNumber',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { receiptNumber } = req.params;
    const hospitalId = req.user!.hospitalId;

    // Look up the copay payment by receipt number
    const payment = await (await import('../config/database')).default.copayPayment.findFirst({
      where: { receiptNumber },
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Receipt not found' });
    }

    // Regenerate receipt HTML
    try {
      const { receiptService } = await import('../services/receiptService');
      const receipt = await receiptService.generateCopayReceipt(payment.id, hospitalId);
      res.setHeader('Content-Type', 'text/html');
      res.send(receipt.receiptHtml);
    } catch (error) {
      console.error('[RECEIPT] Failed to generate receipt:', error);
      return res.status(500).json({ success: false, message: 'Failed to generate receipt' });
    }
  })
);

// ==================== Pharmacy Copay ====================

// Calculate pharmacy copay for a prescription
router.get(
  '/pharmacy-copay/:prescriptionId',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const copayInfo = await billingService.calculatePharmacyCopay(
      req.params.prescriptionId,
      req.user!.hospitalId
    );
    sendSuccess(res, copayInfo);
  })
);

// Collect pharmacy copay before dispensing
router.post(
  '/pharmacy-copay-collect',
  authenticate,
  authorizeWithPermission('billing:write', ['PHARMACIST', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await billingService.collectPharmacyCopay({
      ...req.body,
      hospitalId: req.user!.hospitalId,
      collectedBy: req.user!.userId,
    });
    sendCreated(res, result, 'Pharmacy copay collected successfully');
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

// ==================== CREDIT NOTES ====================

/**
 * POST /api/v1/billing/credit-notes
 * Create a credit note
 */
router.post(
  '/credit-notes',
  authenticate,
  authorizeWithPermission('billing:write', ['ACCOUNTANT', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const creditNote = await billingService.createCreditNote(req.user!.hospitalId, {
      ...req.body,
      createdBy: req.user!.userId,
    });
    sendCreated(res, creditNote, 'Credit note created');
  })
);

/**
 * GET /api/v1/billing/credit-notes
 * List credit notes
 */
router.get(
  '/credit-notes',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit, status, patientId } = req.query;
    const result = await billingService.getCreditNotes(req.user!.hospitalId, {
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      status: status as string,
      patientId: patientId as string,
    });
    sendPaginated(res, result.data, result.pagination);
  })
);

/**
 * PATCH /api/v1/billing/credit-notes/:id/issue
 * Issue a credit note (DRAFT → ISSUED, posts to GL)
 */
router.patch(
  '/credit-notes/:id/issue',
  authenticate,
  authorizeWithPermission('billing:approve', ['ACCOUNTANT', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const creditNote = await billingService.issueCreditNote(
      req.params.id,
      req.user!.hospitalId,
      req.user!.userId
    );
    sendSuccess(res, creditNote, 'Credit note issued successfully');
  })
);

/**
 * PATCH /api/v1/billing/credit-notes/:id/apply
 * Apply credit note to an invoice
 */
router.patch(
  '/credit-notes/:id/apply',
  authenticate,
  authorizeWithPermission('billing:write', ['ACCOUNTANT', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { invoiceId } = req.body;
    if (!invoiceId) {
      return res.status(400).json({
        success: false,
        message: 'invoiceId is required',
      });
    }

    const result = await billingService.applyCreditNoteToInvoice(
      req.params.id,
      invoiceId,
      req.user!.hospitalId,
      req.user!.userId
    );
    sendSuccess(res, result, 'Credit note applied to invoice successfully');
  })
);

// ==================== RECEIPTS ====================

/**
 * GET /api/v1/billing/receipts/:paymentId/pdf
 * Generate payment receipt HTML (ready for PDF printing)
 */
router.get(
  '/receipts/:paymentId/pdf',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const html = await billingService.generateReceiptHTML(
      req.params.paymentId,
      req.user!.hospitalId
    );
    
    // Set content type to HTML (can be printed as PDF from browser)
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  })
);

// ==================== BILINGUAL DOCUMENTS (DHA COMPLIANT) ====================

import { bilingualDocumentService } from '../services/bilingualDocumentService';

/**
 * GET /api/v1/billing/receipts/:paymentId/bilingual
 * Generate DHA-compliant bilingual receipt (Arabic + English)
 */
router.get(
  '/receipts/:paymentId/bilingual',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const html = await bilingualDocumentService.generateBilingualReceipt(
      req.params.paymentId,
      req.user!.hospitalId
    );
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  })
);

/**
 * GET /api/v1/billing/invoices/:invoiceId/bilingual
 * Generate DHA-compliant bilingual tax invoice (Arabic + English)
 */
router.get(
  '/invoices/:invoiceId/bilingual',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const html = await bilingualDocumentService.generateBilingualInvoice(
      req.params.invoiceId,
      req.user!.hospitalId
    );
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  })
);

// ==================== GAP 9: COPAY REFUNDS ====================

import { copayRefundService } from '../services/copayRefundService';

/**
 * POST /api/v1/billing/copay-refund
 * Request a copay refund
 */
router.post(
  '/copay-refund',
  authenticate,
  authorizeWithPermission('billing:write', ['RECEPTIONIST', 'ACCOUNTANT', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const refund = await copayRefundService.requestRefund(req.user!.hospitalId, {
      ...req.body,
      requestedBy: req.user!.userId,
    });
    sendCreated(res, refund, 'Refund request submitted');
  })
);

/**
 * GET /api/v1/billing/copay-refunds
 * List copay refunds with filters
 */
router.get(
  '/copay-refunds',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit, status, patientId, copayPaymentId } = req.query;
    const result = await copayRefundService.listRefunds(req.user!.hospitalId, {
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      status: status as string,
      patientId: patientId as string,
      copayPaymentId: copayPaymentId as string,
    });
    const pagination = calculatePagination(result.page, result.limit, result.total);
    sendPaginated(res, result.refunds, pagination);
  })
);

/**
 * GET /api/v1/billing/copay-refund/:id
 * Get refund details
 */
router.get(
  '/copay-refund/:id',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const refund = await copayRefundService.getRefundById(req.params.id, req.user!.hospitalId);
    sendSuccess(res, refund);
  })
);

/**
 * PATCH /api/v1/billing/copay-refund/:id/approve
 * Approve a pending refund
 */
router.patch(
  '/copay-refund/:id/approve',
  authenticate,
  authorizeWithPermission('billing:approve', ['ACCOUNTANT', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const refund = await copayRefundService.approveRefund(
      req.params.id,
      req.user!.hospitalId,
      req.user!.userId
    );
    sendSuccess(res, refund, 'Refund approved');
  })
);

/**
 * PATCH /api/v1/billing/copay-refund/:id/reject
 * Reject a pending refund
 */
router.patch(
  '/copay-refund/:id/reject',
  authenticate,
  authorizeWithPermission('billing:approve', ['ACCOUNTANT', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { rejectionReason } = req.body;
    const refund = await copayRefundService.rejectRefund(
      req.params.id,
      req.user!.hospitalId,
      req.user!.userId,
      rejectionReason || ''
    );
    sendSuccess(res, refund, 'Refund rejected');
  })
);

/**
 * PATCH /api/v1/billing/copay-refund/:id/process
 * Process an approved refund (disburse payment)
 */
router.patch(
  '/copay-refund/:id/process',
  authenticate,
  authorizeWithPermission('billing:write', ['ACCOUNTANT', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { refundMethod } = req.body;
    const refund = await copayRefundService.processRefund(
      req.params.id,
      req.user!.hospitalId,
      req.user!.userId,
      refundMethod
    );
    sendSuccess(res, refund, 'Refund processed successfully');
  })
);

export default router;
