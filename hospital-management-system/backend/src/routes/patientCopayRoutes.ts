import { Router, Response } from 'express';
import { patientAuthenticate, PatientAuthenticatedRequest } from '../middleware/patientAuth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendError } from '../utils/response';
import { appointmentCopayService } from '../services/appointmentCopayService';
import { copayFinanceService } from '../services/copayFinanceService';

const router = Router();

// ============================================================================
// Phase 4: Outstanding Balance & Payment History
// ============================================================================

/**
 * Get patient's outstanding copay balance across all appointments
 * GET /api/v1/patient-portal/copay/outstanding-balance
 */
router.get(
  '/copay/outstanding-balance',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const hospitalId = req.patient?.hospitalId || '';
    const patientId = req.patient?.patientId || '';

    const outstandingBalance = await copayFinanceService.getPatientOutstandingBalance(hospitalId, patientId);
    sendSuccess(res, outstandingBalance, 'Outstanding balance retrieved');
  })
);

/**
 * Get patient's copay payment history
 * GET /api/v1/patient-portal/copay/payment-history
 */
router.get(
  '/copay/payment-history',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const hospitalId = req.patient?.hospitalId || '';
    const patientId = req.patient?.patientId || '';
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const history = await copayFinanceService.getPatientPaymentHistory(hospitalId, patientId, { limit, offset });
    sendSuccess(res, history, 'Payment history retrieved');
  })
);

/**
 * Pay outstanding balance (bulk payment)
 * POST /api/v1/patient-portal/copay/pay-outstanding
 */
router.post(
  '/copay/pay-outstanding',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const hospitalId = req.patient?.hospitalId || '';
    const patientId = req.patient?.patientId || '';
    const { amount, paymentMethod } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid payment amount is required',
      });
    }

    // For online payments, this would typically initiate a payment gateway flow
    // For now, we'll create a pending payment that needs confirmation
    const outstandingBalance = await copayFinanceService.getPatientOutstandingBalance(hospitalId, patientId);

    if (outstandingBalance.totalOutstanding <= 0.01) {
      return res.status(400).json({
        success: false,
        message: 'No outstanding balance to pay',
      });
    }

    // Return the outstanding appointments and amount for the payment flow
    sendSuccess(res, {
      outstandingBalance: outstandingBalance.totalOutstanding,
      requestedAmount: amount,
      appointments: outstandingBalance.appointments,
      message: 'Proceed to payment confirmation',
    }, 'Outstanding balance payment initiated');
  })
);

// ============================================================================
// Existing Routes
// ============================================================================

/**
 * Get copay information for an appointment
 * GET /api/v1/patient-portal/appointments/:id/copay
 */
router.get(
  '/appointments/:id/copay',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const hospitalId = req.patient?.hospitalId || '';
    const patientId = req.patient?.patientId || '';
    const appointmentId = req.params.id;

    const copayInfo = await appointmentCopayService.getCopayInfo(hospitalId, patientId, appointmentId);
    sendSuccess(res, copayInfo, 'Copay information retrieved');
  })
);

/**
 * Patient selects "Pay Now" - Initiate online payment
 * POST /api/v1/patient-portal/appointments/:id/copay/pay-online
 */
router.post(
  '/appointments/:id/copay/pay-online',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const hospitalId = req.patient?.hospitalId || '';
    const patientId = req.patient?.patientId || '';
    const appointmentId = req.params.id;

    const result = await appointmentCopayService.initiateOnlinePayment(
      hospitalId,
      patientId,
      appointmentId
    );

    sendSuccess(res, result, 'Payment initiated');
  })
);

/**
 * Confirm online payment (called after successful payment)
 * POST /api/v1/patient-portal/appointments/:id/copay/confirm
 */
router.post(
  '/appointments/:id/copay/confirm',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const hospitalId = req.patient?.hospitalId || '';
    const patientId = req.patient?.patientId || '';
    const appointmentId = req.params.id;
    const { transactionId } = req.body;

    if (!transactionId) {
      return res.status(400).json({
        success: false,
        message: 'Transaction ID is required',
      });
    }

    const copayInfo = await appointmentCopayService.confirmOnlinePayment(
      transactionId,
      hospitalId
    );

    sendSuccess(res, copayInfo, 'Payment confirmed');
  })
);

/**
 * Patient selects "Pay at Clinic"
 * POST /api/v1/patient-portal/appointments/:id/copay/pay-at-clinic
 */
router.post(
  '/appointments/:id/copay/pay-at-clinic',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const hospitalId = req.patient?.hospitalId || '';
    const patientId = req.patient?.patientId || '';
    const appointmentId = req.params.id;

    const copayInfo = await appointmentCopayService.selectPayAtClinic(
      hospitalId,
      patientId,
      appointmentId
    );

    sendSuccess(res, copayInfo, 'Selected to pay at clinic');
  })
);

/**
 * Patient selects "Decide Later"
 * POST /api/v1/patient-portal/appointments/:id/copay/decide-later
 */
router.post(
  '/appointments/:id/copay/decide-later',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const hospitalId = req.patient?.hospitalId || '';
    const patientId = req.patient?.patientId || '';
    const appointmentId = req.params.id;

    const copayInfo = await appointmentCopayService.selectDecideLater(
      hospitalId,
      patientId,
      appointmentId
    );

    sendSuccess(res, {
      ...copayInfo,
      reminderNote: 'You will receive a payment reminder 24 hours before your appointment.',
    }, 'Selection saved. Reminder will be sent before appointment.');
  })
);

/**
 * Get payment receipt
 * GET /api/v1/patient-portal/appointments/:id/copay/receipt
 */
router.get(
  '/appointments/:id/copay/receipt',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const hospitalId = req.patient?.hospitalId || '';
    const patientId = req.patient?.patientId || '';
    const appointmentId = req.params.id;

    // Phase 2: Get full receipt data
    const receiptData = await appointmentCopayService.getReceiptData(hospitalId, patientId, appointmentId);

    if (!receiptData) {
      return res.status(404).json({
        success: false,
        message: 'No payment found for this appointment',
      });
    }

    sendSuccess(res, receiptData, 'Receipt retrieved');
  })
);

/**
 * Phase 2 Feature #5: Email payment receipt
 * POST /api/v1/patient-portal/appointments/:id/copay/email-receipt
 */
router.post(
  '/appointments/:id/copay/email-receipt',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const hospitalId = req.patient?.hospitalId || '';
    const patientId = req.patient?.patientId || '';
    const appointmentId = req.params.id;

    await appointmentCopayService.resendReceiptEmail(hospitalId, patientId, appointmentId);

    sendSuccess(res, { sent: true }, 'Receipt sent to your email');
  })
);

export default router;
