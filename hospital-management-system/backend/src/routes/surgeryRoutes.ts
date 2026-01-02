import { Router, Response } from 'express';
import { surgeryService } from '../services/surgeryService';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated, sendPaginated, calculatePagination } from '../utils/response';
import { AuthenticatedRequest } from '../types';

const router = Router();

// Get all surgeries
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit, status, surgeonId, operationTheatre, startDate, endDate } = req.query;
    const result = await surgeryService.getSurgeries(req.user!.hospitalId, {
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      status: status as string,
      surgeonId: surgeonId as string,
      operationTheatre: operationTheatre as string,
      startDate: startDate as string,
      endDate: endDate as string,
    });
    const pagination = calculatePagination(result.page, result.limit, result.total);
    sendPaginated(res, result.surgeries, pagination);
  })
);

// Schedule surgery
router.post(
  '/',
  authenticate,
  authorize('DOCTOR', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const surgery = await surgeryService.scheduleSurgery(req.body);
    sendCreated(res, surgery, 'Surgery scheduled');
  })
);

// Get surgery by ID
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const surgery = await surgeryService.getSurgeryById(req.params.id);
    sendSuccess(res, surgery);
  })
);

// Update surgery status
router.patch(
  '/:id/status',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { status, ...data } = req.body;
    const surgery = await surgeryService.updateSurgeryStatus(req.params.id, status, data);
    sendSuccess(res, surgery, 'Surgery status updated');
  })
);

// Start surgery
router.post(
  '/:id/start',
  authenticate,
  authorize('DOCTOR'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const surgery = await surgeryService.startSurgery(req.params.id);
    sendSuccess(res, surgery, 'Surgery started');
  })
);

// Complete surgery
router.post(
  '/:id/complete',
  authenticate,
  authorize('DOCTOR'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const surgery = await surgeryService.completeSurgery(req.params.id, req.body);
    sendSuccess(res, surgery, 'Surgery completed');
  })
);

// Cancel surgery
router.post(
  '/:id/cancel',
  authenticate,
  authorize('DOCTOR', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const surgery = await surgeryService.cancelSurgery(req.params.id, req.body.reason);
    sendSuccess(res, surgery, 'Surgery cancelled');
  })
);

// Postpone surgery
router.post(
  '/:id/postpone',
  authenticate,
  authorize('DOCTOR', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const surgery = await surgeryService.postponeSurgery(
      req.params.id,
      new Date(req.body.newDate),
      req.body.reason
    );
    sendSuccess(res, surgery, 'Surgery postponed');
  })
);

// Get today's schedule
router.get(
  '/schedule/today',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const schedule = await surgeryService.getTodaySchedule(req.user!.hospitalId);
    sendSuccess(res, schedule);
  })
);

// Get OT status
router.get(
  '/ot/status',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const status = await surgeryService.getOTStatus(req.user!.hospitalId);
    sendSuccess(res, status);
  })
);

// Get pre-op checklist
router.get(
  '/:id/pre-op-checklist',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const checklist = await surgeryService.getPreOpChecklist(req.params.id);
    sendSuccess(res, checklist);
  })
);

// Get surgery stats
router.get(
  '/stats/overview',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const stats = await surgeryService.getSurgeryStats(req.user!.hospitalId);
    sendSuccess(res, stats);
  })
);

// ==================== AI Surgery Features ====================

// Predict surgery duration
router.post(
  '/predict-duration',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = surgeryService.predictSurgeryDuration(req.body);
    sendSuccess(res, result);
  })
);

// Assess surgical risk
router.post(
  '/assess-risk',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = surgeryService.assessSurgicalRisk(req.body);
    sendSuccess(res, result);
  })
);

export default router;
