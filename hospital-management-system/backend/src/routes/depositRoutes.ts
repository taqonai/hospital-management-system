import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { depositService } from '../services/depositService';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * POST /api/v1/billing/deposits
 * Record a new deposit
 */
router.post('/deposits', async (req, res, next) => {
  try {
    const { hospitalId } = req.user;
    const { patientId, amount, currency, paymentMethod, referenceNumber, reason } = req.body;

    if (!patientId || !amount || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID, amount, and payment method are required',
      });
    }

    const deposit = await depositService.recordDeposit(
      hospitalId,
      patientId,
      { amount, currency, paymentMethod, referenceNumber, reason },
      req.user.id
    );

    res.status(201).json({
      success: true,
      message: 'Deposit recorded successfully',
      data: deposit,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/billing/deposits
 * List deposits with filtering
 */
router.get('/deposits', async (req, res, next) => {
  try {
    const { hospitalId } = req.user;
    const { patientId, status, startDate, endDate, page, limit } = req.query;

    const result = await depositService.getDeposits(hospitalId, {
      patientId: patientId as string,
      status: status as string,
      startDate: startDate as string,
      endDate: endDate as string,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json({
      success: true,
      data: result.deposits,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/billing/patients/:patientId/deposit-balance
 * Get patient deposit balance
 */
router.get('/patients/:patientId/deposit-balance', async (req, res, next) => {
  try {
    const { hospitalId } = req.user;
    const { patientId } = req.params;

    const balance = await depositService.getDepositBalance(hospitalId, patientId);

    res.json({
      success: true,
      data: balance,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/billing/deposits/:id/ledger
 * Get deposit ledger entries
 */
router.get('/deposits/:id/ledger', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await depositService.getDepositLedger(id);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/billing/deposits/apply
 * Apply deposit to an invoice
 */
router.post('/deposits/apply', async (req, res, next) => {
  try {
    const { hospitalId } = req.user;
    const { patientId, invoiceId, amount, auto } = req.body;

    if (!patientId || !invoiceId) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID and invoice ID are required',
      });
    }

    let result;

    if (auto) {
      // Auto-apply available deposits
      result = await depositService.autoApplyDeposits(
        hospitalId,
        patientId,
        invoiceId,
        req.user.id
      );
    } else {
      // Manual amount specified
      if (!amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Amount must be greater than zero',
        });
      }

      result = await depositService.applyDepositToInvoice(
        hospitalId,
        patientId,
        invoiceId,
        amount,
        req.user.id
      );
    }

    res.json({
      success: true,
      message: 'Deposit applied successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/billing/credit-notes
 * Create a credit note
 */
router.post('/credit-notes', requirePermission('billing:write'), async (req, res, next) => {
  try {
    const { hospitalId } = req.user;
    const { invoiceId, patientId, amount, reason } = req.body;

    if (!patientId || !amount || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID, amount, and reason are required',
      });
    }

    const creditNote = await depositService.createCreditNote(
      hospitalId,
      { invoiceId, patientId, amount, reason },
      req.user.id
    );

    res.status(201).json({
      success: true,
      message: 'Credit note created successfully',
      data: creditNote,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/billing/credit-notes/:id/apply
 * Apply credit note to an invoice
 */
router.post('/credit-notes/:id/apply', requirePermission('billing:write'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { invoiceId } = req.body;

    if (!invoiceId) {
      return res.status(400).json({
        success: false,
        message: 'Invoice ID is required',
      });
    }

    const result = await depositService.applyCreditNote(id, invoiceId, req.user.id);

    res.json({
      success: true,
      message: 'Credit note applied successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/billing/credit-notes
 * List credit notes
 */
router.get('/credit-notes', async (req, res, next) => {
  try {
    const { hospitalId } = req.user;
    const { patientId, status, page, limit } = req.query;

    const result = await depositService.getCreditNotes(hospitalId, {
      patientId: patientId as string,
      status: status as string,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json({
      success: true,
      data: result.creditNotes,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/billing/refunds
 * Request a refund
 */
router.post('/refunds', async (req, res, next) => {
  try {
    const { hospitalId } = req.user;
    const {
      patientId,
      depositId,
      creditNoteId,
      paymentId,
      amount,
      refundMethod,
      requestReason,
      bankDetails,
      notes,
    } = req.body;

    if (!patientId || !amount || !refundMethod || !requestReason) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID, amount, refund method, and request reason are required',
      });
    }

    const refund = await depositService.requestRefund(
      hospitalId,
      {
        patientId,
        depositId,
        creditNoteId,
        paymentId,
        amount,
        refundMethod,
        requestReason,
        bankDetails,
        notes,
      },
      req.user.id
    );

    res.status(201).json({
      success: true,
      message: 'Refund request submitted successfully',
      data: refund,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/billing/refunds
 * List refunds
 */
router.get('/refunds', async (req, res, next) => {
  try {
    const { hospitalId } = req.user;
    const { patientId, status, page, limit } = req.query;

    const result = await depositService.getRefunds(hospitalId, {
      patientId: patientId as string,
      status: status as string,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json({
      success: true,
      data: result.refunds,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/billing/refunds/:id/approve
 * Approve a refund (requires billing:approve permission)
 */
router.patch('/refunds/:id/approve', requirePermission('billing:approve'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const refund = await depositService.approveRefund(id, req.user.id);

    res.json({
      success: true,
      message: 'Refund approved successfully',
      data: refund,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/billing/refunds/:id/process
 * Process an approved refund
 */
router.patch('/refunds/:id/process', requirePermission('billing:approve'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const refund = await depositService.processRefund(id, req.user.id);

    res.json({
      success: true,
      message: 'Refund processed successfully',
      data: refund,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/billing/refunds/:id/reject
 * Reject a refund request
 */
router.patch('/refunds/:id/reject', requirePermission('billing:approve'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required',
      });
    }

    const refund = await depositService.rejectRefund(id, reason, req.user.id);

    res.json({
      success: true,
      message: 'Refund rejected',
      data: refund,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
