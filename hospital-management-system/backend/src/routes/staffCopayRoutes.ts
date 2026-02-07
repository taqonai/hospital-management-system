import { Router, Response } from 'express';
import { authenticate, authorizeWithPermission } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess } from '../utils/response';
import { appointmentCopayService, CopayPaymentStatus } from '../services/appointmentCopayService';
import { AuthenticatedRequest } from '../types';
import { body, param, query } from 'express-validator';

const router = Router();

/**
 * Get today's appointments with payment status for check-in view
 * GET /api/v1/staff/checkin/appointments
 */
router.get(
  '/checkin/appointments',
  authenticate,
  authorizeWithPermission('appointments:read', ['HOSPITAL_ADMIN', 'RECEPTIONIST', 'NURSE', 'DOCTOR']),
  query('date').optional().isISO8601(),
  query('doctorId').optional().isUUID(),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user!.hospitalId;
    const date = req.query.date ? new Date(req.query.date as string) : new Date();
    const doctorId = req.query.doctorId as string | undefined;

    const appointments = await appointmentCopayService.getAppointmentsWithPaymentStatus(
      hospitalId,
      date,
      doctorId
    );

    // Group by payment status for easy filtering
    const summary = {
      total: appointments.length,
      paid: appointments.filter(a => 
        a.paymentStatus === CopayPaymentStatus.PAID_ONLINE || 
        a.paymentStatus === CopayPaymentStatus.PAID_CASH
      ).length,
      cashDue: appointments.filter(a => a.paymentStatus === CopayPaymentStatus.PAY_AT_CLINIC).length,
      pending: appointments.filter(a => a.paymentStatus === CopayPaymentStatus.PENDING).length,
    };

    sendSuccess(res, { appointments, summary }, 'Appointments with payment status retrieved');
  })
);

/**
 * Collect cash payment at check-in
 * POST /api/v1/staff/checkin/appointments/:id/collect-payment
 */
router.post(
  '/checkin/appointments/:id/collect-payment',
  authenticate,
  authorizeWithPermission('billing:write', ['HOSPITAL_ADMIN', 'RECEPTIONIST', 'CASHIER']),
  param('id').isUUID(),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('paymentMethod').isIn(['CASH', 'CARD']).withMessage('Payment method must be CASH or CARD'),
  body('notes').optional().isString(),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user!.hospitalId;
    const staffUserId = req.user!.userId;
    const appointmentId = req.params.id;
    const { amount, paymentMethod, notes } = req.body;

    const copayInfo = await appointmentCopayService.collectCashPayment(
      hospitalId,
      appointmentId,
      staffUserId,
      amount,
      paymentMethod,
      notes
    );

    sendSuccess(res, copayInfo, 'Payment collected successfully');
  })
);

/**
 * Get payment status for a specific appointment
 * GET /api/v1/staff/checkin/appointments/:id/payment-status
 */
router.get(
  '/checkin/appointments/:id/payment-status',
  authenticate,
  authorizeWithPermission('appointments:read', ['HOSPITAL_ADMIN', 'RECEPTIONIST', 'NURSE', 'DOCTOR']),
  param('id').isUUID(),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user!.hospitalId;
    const appointmentId = req.params.id;

    // Get appointment with patient info
    const appointments = await appointmentCopayService.getAppointmentsWithPaymentStatus(
      hospitalId,
      new Date(),
      undefined
    );

    const appointment = appointments.find(a => a.appointment.id === appointmentId);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found',
      });
    }

    sendSuccess(res, appointment, 'Payment status retrieved');
  })
);

/**
 * Get pending payment reminders (for notification service)
 * GET /api/v1/staff/payment-reminders
 */
router.get(
  '/payment-reminders',
  authenticate,
  authorizeWithPermission('notifications:read', ['HOSPITAL_ADMIN', 'SYSTEM']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user!.hospitalId;

    const reminders = await appointmentCopayService.getPendingPaymentReminders(hospitalId);

    sendSuccess(res, reminders, 'Pending payment reminders retrieved');
  })
);

/**
 * Get payment collection summary for a date range
 * GET /api/v1/staff/payment-summary
 */
router.get(
  '/payment-summary',
  authenticate,
  authorizeWithPermission('billing:read', ['HOSPITAL_ADMIN', 'ACCOUNTANT', 'RECEPTIONIST']),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user!.hospitalId;
    const startDate = req.query.startDate 
      ? new Date(req.query.startDate as string) 
      : new Date(new Date().setHours(0, 0, 0, 0));
    const endDate = req.query.endDate 
      ? new Date(req.query.endDate as string) 
      : new Date(new Date().setHours(23, 59, 59, 999));

    // Get all appointments in range
    const appointments = await appointmentCopayService.getAppointmentsWithPaymentStatus(
      hospitalId,
      startDate,
      undefined
    );

    // Calculate summary
    const paidOnline = appointments.filter(a => a.paymentStatus === CopayPaymentStatus.PAID_ONLINE);
    const paidCash = appointments.filter(a => a.paymentStatus === CopayPaymentStatus.PAID_CASH);
    const pending = appointments.filter(a => 
      a.paymentStatus === CopayPaymentStatus.PENDING || 
      a.paymentStatus === CopayPaymentStatus.PAY_AT_CLINIC
    );

    const summary = {
      dateRange: { start: startDate, end: endDate },
      totalAppointments: appointments.length,
      payments: {
        online: {
          count: paidOnline.length,
          amount: paidOnline.reduce((sum, a) => sum + a.copayAmount, 0),
        },
        cash: {
          count: paidCash.length,
          amount: paidCash.reduce((sum, a) => sum + a.copayAmount, 0),
        },
        pending: {
          count: pending.length,
          expectedAmount: pending.reduce((sum, a) => sum + a.copayAmount, 0),
        },
      },
      totals: {
        collected: paidOnline.reduce((sum, a) => sum + a.copayAmount, 0) + 
                   paidCash.reduce((sum, a) => sum + a.copayAmount, 0),
        pendingCollection: pending.reduce((sum, a) => sum + a.copayAmount, 0),
      },
    };

    sendSuccess(res, summary, 'Payment summary retrieved');
  })
);

export default router;
