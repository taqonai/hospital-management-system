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
    const doctor = await doctorService.create(req.user!.hospitalId, req.body);
    sendCreated(res, doctor, 'Doctor created successfully');
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
    const doctor = await doctorService.update(req.params.id, req.user!.hospitalId, req.body);
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

export default router;
