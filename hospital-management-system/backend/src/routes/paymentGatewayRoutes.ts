import { Router, Request, Response, NextFunction } from 'express';
import { body, param } from 'express-validator';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { paymentGatewayService } from '../services/paymentGatewayService';
import { checkPermission } from '../middleware/rbac';

const router = Router();

/**
 * POST /api/v1/payments/create-intent
 * Create a payment intent for an invoice
 * Requires authentication
 */
router.post(
  '/create-intent',
  authenticate,
  validate([
    body('invoiceId').isString().notEmpty().withMessage('Invoice ID is required'),
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
    body('currency').optional().isString().isLength({ min: 3, max: 3 }),
  ]),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { invoiceId, amount, currency = 'AED' } = req.body;
      const hospitalId = req.user!.hospitalId;

      const result = await paymentGatewayService.createPaymentIntent(
        hospitalId,
        invoiceId,
        amount,
        currency
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/payments/confirm
 * Confirm payment after frontend completes the payment
 * Requires authentication
 */
router.post(
  '/confirm',
  authenticate,
  validate([
    body('transactionId').isString().notEmpty().withMessage('Transaction ID is required'),
  ]),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { transactionId } = req.body;
      const userId = req.user!.id;

      const result = await paymentGatewayService.confirmPayment(transactionId, userId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/payments/webhook
 * Stripe webhook endpoint
 * NO authentication - uses webhook signature verification
 */
router.post(
  '/webhook',
  // Use raw body for signature verification
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const signature = req.headers['stripe-signature'] as string;

      if (!signature) {
        return res.status(400).json({ error: 'Missing stripe-signature header' });
      }

      // Get raw body (should be configured in express setup)
      const payload = (req as any).rawBody || req.body;

      const result = await paymentGatewayService.handleWebhook(payload, signature);

      res.json(result);
    } catch (error: any) {
      console.error('[PaymentGateway] Webhook error:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * GET /api/v1/payments/:id/receipt
 * Download PDF receipt for a payment
 * Requires authentication
 */
router.get(
  '/:id/receipt',
  authenticate,
  validate([param('id').isString().notEmpty()]),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const pdfBuffer = await paymentGatewayService.generateReceipt(id);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="receipt-${id}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/payments/:id/refund
 * Initiate a refund for a payment
 * Requires ACCOUNTANT role or specific permission
 */
router.post(
  '/:id/refund',
  authenticate,
  checkPermission('billing:refund'),
  validate([
    param('id').isString().notEmpty(),
    body('amount').optional().isFloat({ min: 0.01 }),
    body('reason').optional().isString(),
  ]),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { amount, reason } = req.body;
      const userId = req.user!.id;

      const result = await paymentGatewayService.initiateRefund(id, amount, reason, userId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/payments/transactions/:invoiceId
 * Get all transactions for an invoice
 * Requires authentication
 */
router.get(
  '/transactions/:invoiceId',
  authenticate,
  validate([param('invoiceId').isString().notEmpty()]),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { invoiceId } = req.params;

      const transactions = await paymentGatewayService.getTransactionsByInvoice(invoiceId);

      res.json({
        success: true,
        data: transactions,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
