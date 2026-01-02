import { Router, Response } from 'express';
import { appointmentService } from '../services/appointmentService';
import { authenticate, authorize } from '../middleware/auth';
import { validate, createAppointmentSchema, uuidParamSchema, paginationSchema } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated, sendPaginated, calculatePagination } from '../utils/response';
import { AuthenticatedRequest } from '../types';

const router = Router();

// Get all appointments
router.get(
  '/',
  authenticate,
  validate(paginationSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit, sortBy, sortOrder, doctorId, patientId, status, date, startDate, endDate } = req.query;
    const { appointments, total } = await appointmentService.findAll(req.user!.hospitalId, {
      page: Number(page) || 1,
      limit: Number(limit) || 10,
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'asc' | 'desc',
      doctorId: doctorId as string,
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
  authorize('HOSPITAL_ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST'),
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
  authorize('HOSPITAL_ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST'),
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
  authorize('HOSPITAL_ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST'),
  validate(uuidParamSchema),
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
  authorize('HOSPITAL_ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST', 'PATIENT'),
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
router.get(
  '/stats/dashboard',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { doctorId } = req.query;
    const stats = await appointmentService.getDashboardStats(
      req.user!.hospitalId,
      doctorId as string
    );
    sendSuccess(res, stats);
  })
);

export default router;
