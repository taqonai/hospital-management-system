import { Router, Response } from 'express';
import { assetService } from '../services/assetService';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated, sendPaginated, calculatePagination } from '../utils/response';
import { AuthenticatedRequest } from '../types';

const router = Router();

// ==================== ASSET MANAGEMENT ====================

// Add asset
router.post(
  '/',
  authenticate,
  authorize('HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const asset = await assetService.addAsset(req.user!.hospitalId, req.body);
    sendCreated(res, asset, 'Asset added successfully');
  })
);

// Get assets
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await assetService.getAssets(req.user!.hospitalId, req.query);
    const pagination = calculatePagination(result.page, result.limit, result.total);
    sendPaginated(res, result.assets, pagination);
  })
);

// Get asset by ID
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const asset = await assetService.getAssetById(req.params.id);
    sendSuccess(res, asset);
  })
);

// Update asset
router.put(
  '/:id',
  authenticate,
  authorize('HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const asset = await assetService.updateAsset(req.params.id, req.body);
    sendSuccess(res, asset, 'Asset updated');
  })
);

// Update asset status
router.patch(
  '/:id/status',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { status } = req.body;
    const asset = await assetService.updateAssetStatus(req.params.id, status);
    sendSuccess(res, asset, 'Asset status updated');
  })
);

// ==================== MAINTENANCE MANAGEMENT ====================

// Schedule maintenance
router.post(
  '/:assetId/maintenance',
  authenticate,
  authorize('HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const maintenance = await assetService.scheduleMaintenance(req.params.assetId, req.body);
    sendCreated(res, maintenance, 'Maintenance scheduled');
  })
);

// Get maintenance records
router.get(
  '/maintenance/all',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await assetService.getMaintenanceRecords(req.user!.hospitalId, req.query);
    const pagination = calculatePagination(result.page, result.limit, result.total);
    sendPaginated(res, result.records, pagination);
  })
);

// Start maintenance
router.patch(
  '/maintenance/:id/start',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { technicianId } = req.body;
    const maintenance = await assetService.startMaintenance(req.params.id, technicianId);
    sendSuccess(res, maintenance, 'Maintenance started');
  })
);

// Complete maintenance
router.patch(
  '/maintenance/:id/complete',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const maintenance = await assetService.completeMaintenance(req.params.id, req.body);
    sendSuccess(res, maintenance, 'Maintenance completed');
  })
);

// ==================== AI FEATURES ====================

// AI: Predictive maintenance analysis
router.post(
  '/ai/predict-failure',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const prediction = assetService.predictAssetFailure(req.body);
    sendSuccess(res, prediction);
  })
);

// AI: Optimize maintenance schedule
router.post(
  '/ai/optimize-schedule',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const optimization = assetService.optimizeMaintenanceSchedule(req.body);
    sendSuccess(res, optimization);
  })
);

// AI: Analyze asset lifecycle
router.post(
  '/ai/lifecycle-analysis',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const analysis = assetService.analyzeAssetLifecycle(req.body);
    sendSuccess(res, analysis);
  })
);

// ==================== DASHBOARD ====================

// Get asset dashboard stats
router.get(
  '/stats/dashboard',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const stats = await assetService.getDashboardStats(req.user!.hospitalId);
    sendSuccess(res, stats);
  })
);

// Get assets due for calibration
router.get(
  '/calibration/due',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const days = parseInt(req.query.days as string) || 30;
    const assets = await assetService.getAssetsDueForCalibration(req.user!.hospitalId, days);
    sendSuccess(res, assets);
  })
);

// Get assets under warranty expiring
router.get(
  '/warranty/expiring',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const days = parseInt(req.query.days as string) || 90;
    const assets = await assetService.getWarrantyExpiringAssets(req.user!.hospitalId, days);
    sendSuccess(res, assets);
  })
);

export default router;
