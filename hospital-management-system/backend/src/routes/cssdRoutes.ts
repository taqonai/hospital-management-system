import { Router, Response } from 'express';
import { cssdService } from '../services/cssdService';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated, sendPaginated, calculatePagination } from '../utils/response';
import { AuthenticatedRequest } from '../types';

const router = Router();

// ==================== STERILIZATION ITEM MANAGEMENT ====================

// Add item
router.post(
  '/items',
  authenticate,
  authorize('HOSPITAL_ADMIN', 'NURSE'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const item = await cssdService.addItem(req.user!.hospitalId, req.body);
    sendCreated(res, item, 'Item added successfully');
  })
);

// Get items
router.get(
  '/items',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await cssdService.getItems(req.user!.hospitalId, req.query);
    const pagination = calculatePagination(result.page, result.limit, result.total);
    sendPaginated(res, result.items, pagination);
  })
);

// Get item by ID
router.get(
  '/items/:id',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const item = await cssdService.getItemById(req.params.id);
    sendSuccess(res, item);
  })
);

// Update item status
router.patch(
  '/items/:id/status',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { status } = req.body;
    const item = await cssdService.updateItemStatus(req.params.id, status);
    sendSuccess(res, item, 'Item status updated');
  })
);

// Track item by barcode
router.get(
  '/items/track/:barcode',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tracking = await cssdService.trackItem(req.params.barcode);
    sendSuccess(res, tracking);
  })
);

// ==================== STERILIZATION CYCLES ====================

// Create cycle
router.post(
  '/cycles',
  authenticate,
  authorize('HOSPITAL_ADMIN', 'NURSE'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const cycle = await cssdService.createCycle(req.user!.hospitalId, {
      ...req.body,
      operatorId: req.user!.userId,
    });
    sendCreated(res, cycle, 'Sterilization cycle created');
  })
);

// Get cycles
router.get(
  '/cycles',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await cssdService.getCycles(req.user!.hospitalId, req.query);
    const pagination = calculatePagination(result.page, result.limit, result.total);
    sendPaginated(res, result.cycles, pagination);
  })
);

// Get cycle by ID
router.get(
  '/cycles/:id',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const cycle = await cssdService.getCycleById(req.params.id);
    sendSuccess(res, cycle);
  })
);

// Start cycle
router.patch(
  '/cycles/:id/start',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const cycle = await cssdService.startCycle(req.params.id);
    sendSuccess(res, cycle, 'Cycle started');
  })
);

// Complete cycle
router.patch(
  '/cycles/:id/complete',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const cycle = await cssdService.completeCycle(req.params.id, req.body);
    sendSuccess(res, cycle, 'Cycle completed');
  })
);

// ==================== TRACKING & ALERTS ====================

// Get expiring items
router.get(
  '/expiring',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const days = parseInt(req.query.days as string) || 7;
    const items = await cssdService.getExpiringItems(req.user!.hospitalId, days);
    sendSuccess(res, items);
  })
);

// ==================== AI FEATURES ====================

// AI: Predict cycle outcome
router.post(
  '/ai/predict-outcome',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const prediction = cssdService.predictCycleOutcome(req.body);
    sendSuccess(res, prediction);
  })
);

// AI: Optimize schedule
router.post(
  '/ai/optimize-schedule',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const optimization = cssdService.optimizeSterilizationSchedule(req.body);
    sendSuccess(res, optimization);
  })
);

// AI: Quality analysis
router.post(
  '/ai/quality-analysis',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const analysis = cssdService.analyzeQualityMetrics(req.user!.hospitalId, req.body);
    sendSuccess(res, analysis);
  })
);

// ==================== DASHBOARD ====================

// Get CSSD dashboard stats
router.get(
  '/stats',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const stats = await cssdService.getDashboardStats(req.user!.hospitalId);
    sendSuccess(res, stats);
  })
);

export default router;
