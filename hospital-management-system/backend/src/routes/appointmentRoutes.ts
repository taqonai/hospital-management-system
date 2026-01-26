import { Router, Response } from 'express';
import { appointmentService } from '../services/appointmentService';
import { authenticate, authorize, authorizeWithPermission } from '../middleware/auth';
import { validate, createAppointmentSchema, uuidParamSchema, paginationSchema, updateAppointmentStatusSchema } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated, sendPaginated, calculatePagination } from '../utils/response';
import { AuthenticatedRequest } from '../types';
import prisma from '../config/database';

const router = Router();

// Helper function to get doctorId for DOCTOR users
async function getDoctorIdForUser(userId: string): Promise<string | null> {
  const doctor = await prisma.doctor.findUnique({
    where: { userId },
    select: { id: true },
  });
  return doctor?.id || null;
}

// Get all appointments
// DOCTOR role: automatically filtered to only their own appointments
// Other roles: see all appointments (can optionally filter by doctorId)
router.get(
  '/',
  authenticate,
  validate(paginationSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit, sortBy, sortOrder, doctorId, patientId, status, date, startDate, endDate } = req.query;

    // For DOCTOR role, auto-filter to their own appointments
    let effectiveDoctorId = doctorId as string;
    if (req.user!.role === 'DOCTOR') {
      const userDoctorId = await getDoctorIdForUser(req.user!.userId);
      if (userDoctorId) {
        effectiveDoctorId = userDoctorId;
      }
    }

    const { appointments, total } = await appointmentService.findAll(req.user!.hospitalId, {
      page: Number(page) || 1,
      limit: Number(limit) || 10,
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'asc' | 'desc',
      doctorId: effectiveDoctorId,
      patientId: patientId as string,
      status: status as any,
      date: date ? new Date(date as string) : undefined,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    });
    const pagination = calculatePagination(Number(page) || 1, Number(limit) || 10, total);
    sendPaginated(res, appointments, pagination);
  })
);

// Create appointment
router.post(
  '/',
  authenticate,
  authorizeWithPermission('appointments:write', ['HOSPITAL_ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST']),
  validate(createAppointmentSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const appointment = await appointmentService.create(req.user!.hospitalId, req.body);
    sendCreated(res, appointment, 'Appointment scheduled successfully');
  })
);

// Get appointment by ID
router.get(
  '/:id',
  authenticate,
  validate(uuidParamSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const appointment = await appointmentService.findById(req.params.id, req.user!.hospitalId);
    sendSuccess(res, appointment);
  })
);

// Update appointment
router.put(
  '/:id',
  authenticate,
  authorizeWithPermission('appointments:write', ['HOSPITAL_ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST']),
  validate(uuidParamSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const appointment = await appointmentService.update(
      req.params.id,
      req.user!.hospitalId,
      req.body
    );
    sendSuccess(res, appointment, 'Appointment updated successfully');
  })
);

// Update appointment status
router.patch(
  '/:id/status',
  authenticate,
  authorizeWithPermission('appointments:write', ['HOSPITAL_ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST']),
  validate(uuidParamSchema),
  validate(updateAppointmentStatusSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { status } = req.body;
    const appointment = await appointmentService.updateStatus(
      req.params.id,
      req.user!.hospitalId,
      status
    );
    sendSuccess(res, appointment, 'Status updated');
  })
);

// Cancel appointment
router.post(
  '/:id/cancel',
  authenticate,
  authorizeWithPermission('appointments:write', ['HOSPITAL_ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST', 'PATIENT']),
  validate(uuidParamSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { reason } = req.body;
    const appointment = await appointmentService.cancel(
      req.params.id,
      req.user!.hospitalId,
      reason
    );
    sendSuccess(res, appointment, 'Appointment cancelled');
  })
);

// Get available slots
router.get(
  '/slots/:doctorId',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { date } = req.query;
    const slots = await appointmentService.getAvailableSlots(
      req.user!.hospitalId,
      req.params.doctorId,
      new Date(date as string)
    );
    sendSuccess(res, slots);
  })
);

// Get today's queue for a doctor
router.get(
  '/queue/:doctorId',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const queue = await appointmentService.getTodayQueue(
      req.user!.hospitalId,
      req.params.doctorId
    );
    sendSuccess(res, queue);
  })
);

// Get dashboard stats
// DOCTOR role: automatically filtered to their own stats
router.get(
  '/stats/dashboard',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { doctorId } = req.query;

    // For DOCTOR role, auto-filter to their own stats
    let effectiveDoctorId = doctorId as string;
    if (req.user!.role === 'DOCTOR') {
      const userDoctorId = await getDoctorIdForUser(req.user!.userId);
      if (userDoctorId) {
        effectiveDoctorId = userDoctorId;
      }
    }

    const stats = await appointmentService.getDashboardStats(
      req.user!.hospitalId,
      effectiveDoctorId
    );
    sendSuccess(res, stats);
  })
);

export default router;
