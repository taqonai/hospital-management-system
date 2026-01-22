import { Router, Response } from 'express';
import { doctorService } from '../services/doctorService';
import { authenticate, authorize } from '../middleware/auth';
import { validate, uuidParamSchema, paginationSchema } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated, sendPaginated, calculatePagination } from '../utils/response';
import { AuthenticatedRequest } from '../types';

const router = Router();

// Get all doctors
router.get(
  '/',
  authenticate,
  validate(paginationSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit, search, sortBy, sortOrder, departmentId, specialization } = req.query;
    const { doctors, total } = await doctorService.findAll(req.user!.hospitalId, {
      page: Number(page) || 1,
      limit: Number(limit) || 10,
      search: search as string,
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'asc' | 'desc',
      departmentId: departmentId as string,
      specialization: specialization as string,
    });
    const pagination = calculatePagination(Number(page) || 1, Number(limit) || 10, total);
    sendPaginated(res, doctors, pagination);
  })
);

// Create doctor
router.post(
  '/',
  authenticate,
  authorize('HOSPITAL_ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Convert numeric fields from string to number
    const data = { ...req.body };
    if (data.slotDuration !== undefined) {
      data.slotDuration = Number(data.slotDuration);
      if (isNaN(data.slotDuration) || data.slotDuration < 5 || data.slotDuration > 120) {
        return res.status(400).json({
          success: false,
          message: 'Invalid slot duration. Must be between 5 and 120 minutes.',
        });
      }
    }
    if (data.maxPatientsPerDay !== undefined) {
      data.maxPatientsPerDay = Number(data.maxPatientsPerDay);
      if (isNaN(data.maxPatientsPerDay) || data.maxPatientsPerDay < 1 || data.maxPatientsPerDay > 100) {
        return res.status(400).json({
          success: false,
          message: 'Invalid max patients per day. Must be between 1 and 100.',
        });
      }
    }
    if (data.experience !== undefined) {
      data.experience = Number(data.experience);
      if (isNaN(data.experience) || data.experience < 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid experience. Must be a non-negative number.',
        });
      }
    }
    if (data.consultationFee !== undefined) {
      data.consultationFee = Number(data.consultationFee);
      if (isNaN(data.consultationFee) || data.consultationFee < 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid consultation fee. Must be a non-negative number.',
        });
      }
    }

    const doctor = await doctorService.create(req.user!.hospitalId, data);
    sendCreated(res, doctor, 'Doctor created successfully');
  })
);

// Get current doctor (for logged-in doctor)
router.get(
  '/me',
  authenticate,
  authorize('DOCTOR'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const doctor = await doctorService.findByUserId(req.user!.userId, req.user!.hospitalId);
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor profile not found' });
    }
    sendSuccess(res, doctor);
  })
);

// Get doctor by ID
router.get(
  '/:id',
  authenticate,
  validate(uuidParamSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const doctor = await doctorService.findById(req.params.id, req.user!.hospitalId);
    sendSuccess(res, doctor);
  })
);

// Update doctor
router.put(
  '/:id',
  authenticate,
  authorize('HOSPITAL_ADMIN', 'SUPER_ADMIN', 'DOCTOR'),
  validate(uuidParamSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Convert numeric fields from string to number
    const data = { ...req.body };
    if (data.slotDuration !== undefined) {
      data.slotDuration = Number(data.slotDuration);
      if (isNaN(data.slotDuration) || data.slotDuration < 5 || data.slotDuration > 120) {
        return res.status(400).json({
          success: false,
          message: 'Invalid slot duration. Must be between 5 and 120 minutes.',
        });
      }
    }
    if (data.maxPatientsPerDay !== undefined) {
      data.maxPatientsPerDay = Number(data.maxPatientsPerDay);
      if (isNaN(data.maxPatientsPerDay) || data.maxPatientsPerDay < 1 || data.maxPatientsPerDay > 100) {
        return res.status(400).json({
          success: false,
          message: 'Invalid max patients per day. Must be between 1 and 100.',
        });
      }
    }
    if (data.experience !== undefined) {
      data.experience = Number(data.experience);
      if (isNaN(data.experience) || data.experience < 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid experience. Must be a non-negative number.',
        });
      }
    }
    if (data.consultationFee !== undefined) {
      data.consultationFee = Number(data.consultationFee);
      if (isNaN(data.consultationFee) || data.consultationFee < 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid consultation fee. Must be a non-negative number.',
        });
      }
    }

    const doctor = await doctorService.update(req.params.id, req.user!.hospitalId, data);
    sendSuccess(res, doctor, 'Doctor updated successfully');
  })
);

// Get doctor schedule
router.get(
  '/:id/schedule',
  authenticate,
  validate(uuidParamSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const schedule = await doctorService.getSchedule(req.params.id, req.user!.hospitalId);
    sendSuccess(res, schedule);
  })
);

// Update doctor schedule
router.put(
  '/:id/schedule',
  authenticate,
  authorize('HOSPITAL_ADMIN', 'DOCTOR'),
  validate(uuidParamSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const schedule = await doctorService.updateSchedule(
      req.params.id,
      req.user!.hospitalId,
      req.body.schedules
    );
    sendSuccess(res, schedule, 'Schedule updated');
  })
);

// Toggle doctor availability
router.patch(
  '/:id/availability',
  authenticate,
  authorize('HOSPITAL_ADMIN', 'DOCTOR'),
  validate(uuidParamSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { isAvailable } = req.body;
    const doctor = await doctorService.toggleAvailability(
      req.params.id,
      req.user!.hospitalId,
      isAvailable
    );
    sendSuccess(res, doctor, 'Availability updated');
  })
);

// Get doctor dashboard stats
router.get(
  '/:id/dashboard',
  authenticate,
  authorize('DOCTOR', 'HOSPITAL_ADMIN'),
  validate(uuidParamSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const stats = await doctorService.getDashboardStats(req.params.id);
    sendSuccess(res, stats);
  })
);

// ==================== ABSENCE MANAGEMENT ====================

// Get all absences for a doctor
router.get(
  '/:id/absences',
  authenticate,
  validate(uuidParamSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { upcoming, status } = req.query;
    const absences = await doctorService.getAbsences(
      req.params.id,
      req.user!.hospitalId,
      {
        upcoming: upcoming === 'true',
        status: status as any,
      }
    );
    sendSuccess(res, absences);
  })
);

// Get absence summary for a doctor
router.get(
  '/:id/absences/summary',
  authenticate,
  validate(uuidParamSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const summary = await doctorService.getUpcomingAbsenceSummary(
      req.params.id,
      req.user!.hospitalId
    );
    sendSuccess(res, summary);
  })
);

// Create absence for a doctor
router.post(
  '/:id/absences',
  authenticate,
  authorize('DOCTOR', 'HOSPITAL_ADMIN'),
  validate(uuidParamSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const absence = await doctorService.createAbsence(
      req.params.id,
      req.user!.hospitalId,
      req.user!.userId,
      req.body
    );
    sendCreated(res, absence, 'Absence created successfully');
  })
);

// Update absence
router.patch(
  '/:id/absences/:absenceId',
  authenticate,
  authorize('DOCTOR', 'HOSPITAL_ADMIN'),
  validate(uuidParamSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const absence = await doctorService.updateAbsence(
      req.params.absenceId,
      req.user!.hospitalId,
      req.body
    );
    sendSuccess(res, absence, 'Absence updated successfully');
  })
);

// Cancel (delete) absence
router.delete(
  '/:id/absences/:absenceId',
  authenticate,
  authorize('DOCTOR', 'HOSPITAL_ADMIN'),
  validate(uuidParamSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await doctorService.cancelAbsence(
      req.params.absenceId,
      req.user!.hospitalId
    );
    sendSuccess(res, result, 'Absence cancelled successfully');
  })
);

export default router;
