import { Router, Response } from 'express';
import { patientAuthenticate, PatientAuthenticatedRequest } from '../middleware/patientAuth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendError } from '../utils/response';
import { appointmentCopayService } from '../services/appointmentCopayService';

const router = Router();

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

    const copayInfo = await appointmentCopayService.getCopayInfo(hospitalId, patientId, appointmentId);

    if (!copayInfo.transactionId) {
      return res.status(404).json({
        success: false,
        message: 'No payment found for this appointment',
      });
    }

    // For now return receipt info - PDF generation can be added
    sendSuccess(res, {
      receiptNumber: copayInfo.transactionId,
      appointmentId,
      amount: copayInfo.copayAmount,
      paymentMethod: copayInfo.paymentMethod,
      paidAt: copayInfo.paidAt,
      receiptUrl: copayInfo.receiptUrl,
    }, 'Receipt retrieved');
  })
);

export default router;
