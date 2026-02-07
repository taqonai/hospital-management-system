import { Router, Response } from 'express';
import { authenticate, authorizeWithPermission } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess } from '../utils/response';
import { appointmentCopayService, CopayPaymentStatus } from '../services/appointmentCopayService';
import { AuthenticatedRequest } from '../types';
import { body, param, query } from 'express-validator';
import prisma from '../config/database';

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

    const summary = {
      total: appointments.length,
      paid: appointments.filter(a => 
        a.paymentStatus === CopayPaymentStatus.PAID_ONLINE || 
        a.paymentStatus === CopayPaymentStatus.PAID_CASH
      ).length,
      cashDue: appointments.filter(a => a.paymentStatus === CopayPaymentStatus.PAY_AT_CLINIC).length,
      pending: appointments.filter(a => a.paymentStatus === CopayPaymentStatus.PENDING).length,
      // Phase 3: Add verification stats
      pendingVerification: appointments.filter(a => 
        (a.paymentStatus === CopayPaymentStatus.PAID_ONLINE || a.paymentStatus === CopayPaymentStatus.PAID_CASH) &&
        (!a.verificationStatus || a.verificationStatus === 'pending')
      ).length,
      flagged: appointments.filter(a => a.verificationFlag).length,
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
  authorizeWithPermission('billing:write', ['HOSPITAL_ADMIN', 'RECEPTIONIST', 'ACCOUNTANT']),
  param('id').isUUID(),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('paymentMethod').isIn(['CASH', 'CREDIT_CARD']).withMessage('Payment method must be CASH or CREDIT_CARD'),
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
 * Phase 3 Feature #7: Check if appointment can be checked in
 * GET /api/v1/staff/checkin/appointments/:id/can-checkin
 */
router.get(
  '/checkin/appointments/:id/can-checkin',
  authenticate,
  authorizeWithPermission('appointments:read', ['HOSPITAL_ADMIN', 'RECEPTIONIST', 'NURSE', 'DOCTOR']),
  param('id').isUUID(),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user!.hospitalId;
    const appointmentId = req.params.id;

    const result = await appointmentCopayService.canCheckIn(hospitalId, appointmentId);
    sendSuccess(res, result, 'Check-in eligibility retrieved');
  })
);

/**
 * Phase 3 Feature #7: Waive copay
 * POST /api/v1/staff/checkin/appointments/:id/waive-copay
 */
router.post(
  '/checkin/appointments/:id/waive-copay',
  authenticate,
  authorizeWithPermission('billing:write', ['HOSPITAL_ADMIN', 'ACCOUNTANT']), // Manager-level only
  param('id').isUUID(),
  body('reason').isString().isLength({ min: 5 }).withMessage('Reason must be at least 5 characters'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user!.hospitalId;
    const staffUserId = req.user!.userId;
    const appointmentId = req.params.id;
    const { reason } = req.body;

    await appointmentCopayService.waiveCopay(hospitalId, appointmentId, staffUserId, reason);
    sendSuccess(res, { success: true }, 'Copay waived successfully');
  })
);

/**
 * Phase 3 Feature #2: Quick verify payment (for exact matches)
 * POST /api/v1/staff/checkin/appointments/:id/quick-verify
 */
router.post(
  '/checkin/appointments/:id/quick-verify',
  authenticate,
  authorizeWithPermission('billing:write', ['HOSPITAL_ADMIN', 'RECEPTIONIST', 'ACCOUNTANT']),
  param('id').isUUID(),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user!.hospitalId;
    const staffUserId = req.user!.userId;
    const appointmentId = req.params.id;

    await appointmentCopayService.quickVerify(hospitalId, appointmentId, staffUserId);
    sendSuccess(res, { success: true }, 'Payment quick verified successfully');
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
 * Get pending payment reminders
 * GET /api/v1/staff/payment-reminders
 */
router.get(
  '/payment-reminders',
  authenticate,
  authorizeWithPermission('notifications:read', ['HOSPITAL_ADMIN', 'SUPER_ADMIN']),
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

    const appointments = await appointmentCopayService.getAppointmentsWithPaymentStatus(
      hospitalId,
      startDate,
      undefined
    );

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

/**
 * Verify payment
 * POST /api/v1/staff/checkin/appointments/:id/verify
 */
router.post(
  '/checkin/appointments/:id/verify',
  authenticate,
  authorizeWithPermission('billing:write', ['HOSPITAL_ADMIN', 'RECEPTIONIST', 'ACCOUNTANT']),
  param('id').isUUID(),
  body('action').isIn(['verify', 'mark_incorrect', 'convert_selfpay', 'flag_fraud', 'request_refund']),
  body('reason').optional().isString(),
  body('notes').optional().isString(),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user!.hospitalId;
    const staffUserId = req.user!.userId;
    const appointmentId = req.params.id;
    const { action, reason, notes } = req.body;

    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, hospitalId },
      include: {
        copayPayments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        patient: {
          select: { id: true, firstName: true, lastName: true, mrn: true },
        },
      },
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found',
      });
    }

    const auditLogEntry = {
      action,
      reason: reason || null,
      notes: notes || null,
      performedBy: staffUserId,
      performedAt: new Date().toISOString(),
      appointmentId,
      patientId: appointment.patientId,
      patientName: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
      copayAmount: appointment.copayAmount ? Number(appointment.copayAmount) : 0,
    };

    const existingNotes = appointment.notes ? JSON.parse(appointment.notes) : {};
    const verificationLog = existingNotes.verificationLog || [];
    verificationLog.push(auditLogEntry);

    let verificationStatus = 'pending';
    let verificationFlag: string | null = null;
    
    switch (action) {
      case 'verify':
        verificationStatus = 'verified';
        break;
      case 'mark_incorrect':
      case 'convert_selfpay':
        verificationStatus = 'mismatch';
        break;
      case 'flag_fraud':
        verificationStatus = 'fraud_alert';
        verificationFlag = 'Fraud Alert';
        console.warn(`[FRAUD ALERT] Payment flagged for patient MRN: ${appointment.patient.mrn}, Reason: ${reason || 'Not specified'}`);
        break;
      case 'request_refund':
        verificationStatus = 'refund_pending';
        verificationFlag = 'Refund Requested';
        console.warn(`[REFUND REQUEST] Refund requested for patient MRN: ${appointment.patient.mrn}, Reason: ${reason || 'Overpayment'}`);
        break;
    }

    await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        copayVerificationStatus: verificationStatus,
        copayVerificationFlag: verificationFlag,
        notes: JSON.stringify({
          ...existingNotes,
          lastVerifiedBy: staffUserId,
          lastVerifiedAt: new Date().toISOString(),
          verificationLog,
        }),
      },
    });

    if (action === 'convert_selfpay') {
      const appointmentWithDoctor = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: { doctor: true },
      });
      const fullAmount = appointmentWithDoctor?.doctor?.consultationFee 
        ? Number(appointmentWithDoctor.doctor.consultationFee) 
        : 150;
      
      await prisma.appointment.update({
        where: { id: appointmentId },
        data: {
          copayAmount: fullAmount,
          selfPay: true,
        },
      });
    }

    sendSuccess(res, { 
      verificationStatus,
      verificationFlag,
      auditLogEntry,
    }, 'Payment verification recorded');
  })
);

/**
 * Get audit log for appointment
 * GET /api/v1/staff/checkin/appointments/:id/audit-log
 */
router.get(
  '/checkin/appointments/:id/audit-log',
  authenticate,
  authorizeWithPermission('billing:read', ['HOSPITAL_ADMIN', 'RECEPTIONIST', 'ACCOUNTANT']),
  param('id').isUUID(),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user!.hospitalId;
    const appointmentId = req.params.id;

    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, hospitalId },
      include: {
        copayPayments: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found',
      });
    }

    const notes = appointment.notes ? JSON.parse(appointment.notes) : {};
    const verificationLog = notes.verificationLog || [];

    const paymentLog = appointment.copayPayments.map(p => ({
      action: 'payment_collected',
      amount: Number(p.amount),
      paymentMethod: p.paymentMethod,
      performedBy: p.collectedBy,
      performedAt: p.createdAt,
      receiptNumber: p.receiptNumber,
    }));

    const fullAuditLog = [...verificationLog, ...paymentLog].sort((a, b) => 
      new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime()
    );

    sendSuccess(res, {
      appointmentId,
      verificationStatus: (appointment as any).copayVerificationStatus || notes.verificationStatus || 'pending',
      auditLog: fullAuditLog,
    }, 'Audit log retrieved');
  })
);

/**
 * Phase 3 Feature #1: Get pending verifications with filters
 * GET /api/v1/staff/copay/pending-verifications
 */
router.get(
  '/copay/pending-verifications',
  authenticate,
  authorizeWithPermission('billing:read', ['HOSPITAL_ADMIN', 'RECEPTIONIST', 'ACCOUNTANT']),
  query('filter').optional().isIn(['all', 'pending', 'flagged']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user!.hospitalId;
    const filter = (req.query.filter as 'all' | 'pending' | 'flagged') || 'pending';

    const pendingVerifications = await appointmentCopayService.getPendingVerifications(hospitalId, filter);
    sendSuccess(res, pendingVerifications, 'Pending verifications retrieved');
  })
);

/**
 * Get mismatch alerts
 * GET /api/v1/staff/copay/mismatch-alerts
 */
router.get(
  '/copay/mismatch-alerts',
  authenticate,
  authorizeWithPermission('billing:read', ['HOSPITAL_ADMIN', 'RECEPTIONIST', 'ACCOUNTANT']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user!.hospitalId;

    const appointments = await prisma.appointment.findMany({
      where: {
        hospitalId,
        copayCollected: true,
        appointmentDate: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      include: {
        copayPayments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        patient: {
          select: { id: true, firstName: true, lastName: true, mrn: true },
        },
        doctor: {
          select: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    const mismatches = appointments
      .filter(apt => {
        const payment = apt.copayPayments[0];
        if (!payment) return false;
        const expectedAmount = apt.copayAmount ? Number(apt.copayAmount) : 0;
        const paidAmount = Number(payment.amount);
        return Math.abs(expectedAmount - paidAmount) > 0.01;
      })
      .map(apt => {
        const payment = apt.copayPayments[0];
        const expectedAmount = apt.copayAmount ? Number(apt.copayAmount) : 0;
        const paidAmount = Number(payment.amount);
        return {
          appointmentId: apt.id,
          patientId: apt.patientId,
          patientName: `${apt.patient.firstName} ${apt.patient.lastName}`,
          mrn: apt.patient.mrn,
          doctorName: apt.doctor ? `Dr. ${apt.doctor.user.firstName} ${apt.doctor.user.lastName}` : 'Unknown',
          appointmentDate: apt.appointmentDate,
          expectedAmount,
          paidAmount,
          difference: paidAmount - expectedAmount,
          type: paidAmount < expectedAmount ? 'underpayment' : 'overpayment',
          paymentMethod: payment.paymentMethod,
          paidAt: payment.paymentDate,
          verificationStatus: (apt as any).copayVerificationStatus,
          verificationFlag: (apt as any).copayVerificationFlag,
        };
      });

    sendSuccess(res, mismatches, 'Mismatch alerts retrieved');
  })
);

/**
 * Phase 3 Feature #3: Get reconciliation report
 * GET /api/v1/staff/copay/reconciliation
 */
router.get(
  '/copay/reconciliation',
  authenticate,
  authorizeWithPermission('billing:read', ['HOSPITAL_ADMIN', 'ACCOUNTANT']),
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

    const report = await appointmentCopayService.getReconciliationReport(hospitalId, startDate, endDate);
    sendSuccess(res, report, 'Reconciliation report generated');
  })
);

/**
 * Daily reconciliation report (legacy - redirects to new endpoint)
 * GET /api/v1/staff/copay/daily-reconciliation
 */
router.get(
  '/copay/daily-reconciliation',
  authenticate,
  authorizeWithPermission('billing:read', ['HOSPITAL_ADMIN', 'ACCOUNTANT']),
  query('date').optional().isISO8601(),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user!.hospitalId;
    const dateStr = req.query.date as string || new Date().toISOString().split('T')[0];
    const date = new Date(dateStr);
    
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const payments = await prisma.copayPayment.findMany({
      where: {
        paymentDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
        appointment: {
          hospitalId,
        },
      },
      include: {
        appointment: {
          include: {
            patient: {
              select: { firstName: true, lastName: true, mrn: true },
            },
          },
        },
      },
    });

    const byMethod = {
      CASH: payments.filter(p => p.paymentMethod === 'CASH'),
      CARD: payments.filter(p => ['CREDIT_CARD', 'DEBIT_CARD'].includes(p.paymentMethod)),
      ONLINE: payments.filter(p => ['ONLINE', 'APPLE_PAY', 'GOOGLE_PAY'].includes(p.paymentMethod)),
    };

    const verified = payments.filter(p => {
      return (p.appointment as any).copayVerificationStatus === 'verified' || 
             (p.appointment as any).copayAutoVerified === true;
    });

    const report = {
      date: dateStr,
      totalTransactions: payments.length,
      totalAmount: payments.reduce((sum, p) => sum + Number(p.amount), 0),
      byMethod: {
        cash: {
          count: byMethod.CASH.length,
          amount: byMethod.CASH.reduce((sum, p) => sum + Number(p.amount), 0),
        },
        card: {
          count: byMethod.CARD.length,
          amount: byMethod.CARD.reduce((sum, p) => sum + Number(p.amount), 0),
        },
        online: {
          count: byMethod.ONLINE.length,
          amount: byMethod.ONLINE.reduce((sum, p) => sum + Number(p.amount), 0),
        },
      },
      verification: {
        verified: verified.length,
        pending: payments.length - verified.length,
        verifiedAmount: verified.reduce((sum, p) => sum + Number(p.amount), 0),
        pendingAmount: payments.filter(p => !verified.includes(p)).reduce((sum, p) => sum + Number(p.amount), 0),
      },
      transactions: payments.map(p => ({
        id: p.id,
        patientName: `${p.appointment.patient.firstName} ${p.appointment.patient.lastName}`,
        mrn: p.appointment.patient.mrn,
        amount: Number(p.amount),
        paymentMethod: p.paymentMethod,
        receiptNumber: p.receiptNumber,
        collectedBy: p.collectedBy,
        time: p.paymentDate,
        verificationStatus: (p.appointment as any).copayVerificationStatus,
        autoVerified: (p.appointment as any).copayAutoVerified,
      })),
    };

    sendSuccess(res, report, 'Daily reconciliation report generated');
  })
);

export default router;
