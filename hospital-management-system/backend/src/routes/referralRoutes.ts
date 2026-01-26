import { Router, Response } from 'express';
import { referralService } from '../services/referralService';
import { authenticate, authorize, authorizeWithPermission } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess } from '../utils/response';
import { AuthenticatedRequest } from '../types';
import { ReferralUrgency, ReferralStatus } from '@prisma/client';
import { prisma } from '../config/database';

const router = Router();

/**
 * Create a new consultant referral
 * POST /api/v1/referrals
 * Auth: DOCTOR
 */
router.post(
  '/',
  authenticate,
  authorizeWithPermission('referrals:write', ['DOCTOR', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const {
      sourceConsultationId,
      sourceAppointmentId,
      patientId,
      targetDepartmentId,
      targetDoctorId,
      reason,
      urgency,
      clinicalNotes,
    } = req.body;

    // Get the doctor ID from the authenticated user
    let referringDoctorId = req.body.referringDoctorId;

    if (!referringDoctorId && req.user!.role === 'DOCTOR') {
      const doctor = await prisma.doctor.findFirst({
        where: { userId: req.user!.userId },
        select: { id: true },
      });
      referringDoctorId = doctor?.id;
    }

    if (!referringDoctorId) {
      return res.status(400).json({ message: 'Referring doctor ID is required' });
    }

    const referral = await referralService.create(req.user!.hospitalId, {
      sourceConsultationId,
      sourceAppointmentId,
      referringDoctorId,
      patientId,
      targetDepartmentId,
      targetDoctorId,
      reason,
      urgency: urgency as ReferralUrgency,
      clinicalNotes,
    });

    sendSuccess(res, referral, 'Referral created successfully', 201);
  })
);

/**
 * Get referrals created by the logged-in doctor
 * GET /api/v1/referrals
 * Auth: DOCTOR, HOSPITAL_ADMIN
 */
router.get(
  '/',
  authenticate,
  authorizeWithPermission('referrals:read', ['DOCTOR', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { page = '1', limit = '20' } = req.query;

    // Get doctor ID from the authenticated user
    const doctor = await prisma.doctor.findFirst({
      where: { userId: req.user!.userId },
      select: { id: true },
    });

    if (!doctor) {
      return res.status(400).json({ message: 'Doctor profile not found' });
    }

    const referrals = await referralService.getDoctorReferrals(
      doctor.id,
      req.user!.hospitalId,
      parseInt(page as string),
      parseInt(limit as string)
    );

    sendSuccess(res, referrals);
  })
);

/**
 * Get referral queue for receptionists
 * GET /api/v1/referrals/queue
 * Auth: RECEPTIONIST, HOSPITAL_ADMIN
 */
router.get(
  '/queue',
  authenticate,
  authorizeWithPermission('referrals:read', ['RECEPTIONIST', 'HOSPITAL_ADMIN', 'NURSE']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { urgency, departmentId, status, page = '1', limit = '20' } = req.query;

    const referrals = await referralService.getQueue(req.user!.hospitalId, {
      urgency: urgency as ReferralUrgency | undefined,
      departmentId: departmentId as string | undefined,
      status: (status as ReferralStatus) || 'PENDING',
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    });

    sendSuccess(res, referrals);
  })
);

/**
 * Get referral statistics
 * GET /api/v1/referrals/statistics
 * Auth: HOSPITAL_ADMIN
 */
router.get(
  '/statistics',
  authenticate,
  authorizeWithPermission('referrals:read', ['HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { startDate, endDate } = req.query;

    const statistics = await referralService.getStatistics(
      req.user!.hospitalId,
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );

    sendSuccess(res, statistics);
  })
);

/**
 * Get referrals for a specific patient
 * GET /api/v1/referrals/patient/:patientId
 * Auth: PATIENT, DOCTOR, HOSPITAL_ADMIN
 */
router.get(
  '/patient/:patientId',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { patientId } = req.params;

    // Patients can only view their own referrals
    if (req.user!.role === 'PATIENT') {
      const userPatient = await prisma.patient.findFirst({
        where: { oderId: req.user!.userId },
        select: { id: true },
      });
      if (!userPatient || userPatient.id !== patientId) {
        return res.status(403).json({ message: 'Unauthorized to view these referrals' });
      }
    }

    const referrals = await referralService.getPatientReferrals(
      patientId,
      req.user!.hospitalId
    );

    sendSuccess(res, referrals);
  })
);

/**
 * Get a specific referral by ID
 * GET /api/v1/referrals/:id
 * Auth: Authenticated
 */
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const referral = await referralService.findById(
      req.params.id,
      req.user!.hospitalId
    );

    // Patients can only view their own referrals
    if (req.user!.role === 'PATIENT') {
      const userPatient = await prisma.patient.findFirst({
        where: { oderId: req.user!.userId },
        select: { id: true },
      });
      if (!userPatient || userPatient.id !== referral.patientId) {
        return res.status(403).json({ message: 'Unauthorized to view this referral' });
      }
    }

    sendSuccess(res, referral);
  })
);

/**
 * Get available slots for a referral (EMERGENCY flow)
 * GET /api/v1/referrals/:id/slots
 * Auth: DOCTOR, RECEPTIONIST, HOSPITAL_ADMIN
 */
router.get(
  '/:id/slots',
  authenticate,
  authorizeWithPermission('referrals:read', ['DOCTOR', 'RECEPTIONIST', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { date } = req.query;

    const slots = await referralService.getAvailableSlots(
      req.params.id,
      req.user!.hospitalId,
      date as string | undefined
    );

    sendSuccess(res, slots);
  })
);

/**
 * Schedule appointment for a referral (URGENT flow - receptionist)
 * POST /api/v1/referrals/:id/schedule
 * Auth: RECEPTIONIST, HOSPITAL_ADMIN, DOCTOR (for EMERGENCY)
 */
router.post(
  '/:id/schedule',
  authenticate,
  authorizeWithPermission('referrals:write', ['RECEPTIONIST', 'HOSPITAL_ADMIN', 'DOCTOR']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { appointmentDate, startTime, endTime, notes } = req.body;

    const result = await referralService.scheduleAppointment(
      req.params.id,
      req.user!.hospitalId,
      {
        appointmentDate: new Date(appointmentDate),
        startTime,
        endTime,
        notes,
      },
      req.user!.userId
    );

    sendSuccess(res, result, 'Referral appointment scheduled successfully');
  })
);

/**
 * Book appointment from patient portal (ROUTINE flow)
 * POST /api/v1/referrals/:id/book
 * Auth: PATIENT
 */
router.post(
  '/:id/book',
  authenticate,
  authorizeWithPermission('referrals:write', ['PATIENT']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { appointmentDate, startTime, endTime } = req.body;

    // Get patient ID from the authenticated user
    const patient = await prisma.patient.findFirst({
      where: { oderId: req.user!.userId },
      select: { id: true },
    });

    if (!patient) {
      return res.status(400).json({ message: 'Patient profile not found' });
    }

    const result = await referralService.bookFromPortal(
      req.params.id,
      req.user!.hospitalId,
      {
        appointmentDate: new Date(appointmentDate),
        startTime,
        endTime,
      },
      patient.id
    );

    sendSuccess(res, result, 'Appointment booked successfully');
  })
);

/**
 * Mark referral as completed
 * PATCH /api/v1/referrals/:id/complete
 * Auth: DOCTOR, HOSPITAL_ADMIN
 */
router.patch(
  '/:id/complete',
  authenticate,
  authorizeWithPermission('referrals:write', ['DOCTOR', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { notes } = req.body;

    const referral = await referralService.markCompleted(
      req.params.id,
      req.user!.hospitalId,
      notes
    );

    sendSuccess(res, referral, 'Referral marked as completed');
  })
);

/**
 * Cancel a referral
 * PATCH /api/v1/referrals/:id/cancel
 * Auth: DOCTOR, HOSPITAL_ADMIN
 */
router.patch(
  '/:id/cancel',
  authenticate,
  authorizeWithPermission('referrals:write', ['DOCTOR', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ message: 'Cancellation reason is required' });
    }

    const referral = await referralService.cancel(
      req.params.id,
      req.user!.hospitalId,
      reason,
      req.user!.userId
    );

    sendSuccess(res, referral, 'Referral cancelled');
  })
);

/**
 * Manually expire old referrals (admin job)
 * POST /api/v1/referrals/expire
 * Auth: HOSPITAL_ADMIN
 */
router.post(
  '/expire',
  authenticate,
  authorizeWithPermission('referrals:write', ['HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const count = await referralService.expireOldReferrals();
    sendSuccess(res, { expiredCount: count }, `Expired ${count} referrals`);
  })
);

export default router;
