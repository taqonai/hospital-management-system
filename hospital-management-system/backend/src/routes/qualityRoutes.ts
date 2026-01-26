import { Router, Response } from 'express';
import { qualityService } from '../services/qualityService';
import { authenticate, authorize, authorizeWithPermission } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated, sendPaginated, calculatePagination } from '../utils/response';
import { AuthenticatedRequest } from '../types';

const router = Router();

// ==================== QUALITY INDICATOR MANAGEMENT ====================

// Create indicator
router.post(
  '/indicators',
  authenticate,
  authorizeWithPermission('quality:write', ['HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const indicator = await qualityService.createIndicator(req.user!.hospitalId, req.body);
    sendCreated(res, indicator, 'Quality indicator created');
  })
);

// Get indicators
router.get(
  '/indicators',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await qualityService.getIndicators(req.user!.hospitalId, req.query);
    const pagination = calculatePagination(result.page, result.limit, result.total);
    sendPaginated(res, result.indicators, pagination);
  })
);

// Get indicator by ID
router.get(
  '/indicators/:id',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const indicator = await qualityService.getIndicatorById(req.params.id);
    sendSuccess(res, indicator);
  })
);

// Update indicator
router.put(
  '/indicators/:id',
  authenticate,
  authorizeWithPermission('quality:write', ['HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const indicator = await qualityService.updateIndicator(req.params.id, req.body);
    sendSuccess(res, indicator, 'Indicator updated');
  })
);

// ==================== MEASUREMENT MANAGEMENT ====================

// Record measurement
router.post(
  '/indicators/:indicatorId/measurements',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const measurement = await qualityService.recordMeasurement(req.params.indicatorId, {
      ...req.body,
      recordedBy: req.user!.userId,
    });
    sendCreated(res, measurement, 'Measurement recorded');
  })
);

// Get measurements
router.get(
  '/indicators/:indicatorId/measurements',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await qualityService.getMeasurements(req.params.indicatorId, req.query);
    const pagination = calculatePagination(result.page, result.limit, result.total);
    sendPaginated(res, result.measurements, pagination);
  })
);

// ==================== INCIDENT MANAGEMENT ====================

// Report incident
router.post(
  '/incidents',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const incident = await qualityService.reportIncident(req.user!.hospitalId, {
      ...req.body,
      reportedBy: req.user!.userId,
    });
    sendCreated(res, incident, 'Incident reported');
  })
);

// Get incidents
router.get(
  '/incidents',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await qualityService.getIncidents(req.user!.hospitalId, req.query);
    const pagination = calculatePagination(result.page, result.limit, result.total);
    sendPaginated(res, result.incidents, pagination);
  })
);

// Get incident by ID
router.get(
  '/incidents/:id',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const incident = await qualityService.getIncidentById(req.params.id);
    sendSuccess(res, incident);
  })
);

// Update incident status
router.patch(
  '/incidents/:id/status',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { status, ...data } = req.body;
    const incident = await qualityService.updateIncidentStatus(req.params.id, status, data);
    sendSuccess(res, incident, 'Incident status updated');
  })
);

// Investigate incident
router.post(
  '/incidents/:id/investigate',
  authenticate,
  authorizeWithPermission('quality:incidents', ['HOSPITAL_ADMIN', 'DOCTOR']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const incident = await qualityService.investigateIncident(req.params.id, {
      ...req.body,
      investigator: req.user!.userId,
    });
    sendSuccess(res, incident, 'Investigation recorded');
  })
);

// Close incident
router.post(
  '/incidents/:id/close',
  authenticate,
  authorizeWithPermission('quality:incidents', ['HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const incident = await qualityService.closeIncident(req.params.id, {
      ...req.body,
      closedBy: req.user!.userId,
    });
    sendSuccess(res, incident, 'Incident closed');
  })
);

// ==================== AI FEATURES ====================

// AI: Analyze quality trends
router.post(
  '/ai/analyze-trends',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const analysis = qualityService.analyzeQualityTrends(req.body);
    sendSuccess(res, analysis);
  })
);

// AI: Root cause analysis
router.post(
  '/ai/root-cause',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const analysis = qualityService.performRootCauseAnalysis(req.body);
    sendSuccess(res, analysis);
  })
);

// AI: Generate quality scorecard
router.post(
  '/ai/scorecard',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const scorecard = qualityService.generateQualityScorecard(req.user!.hospitalId, req.body);
    sendSuccess(res, scorecard);
  })
);

// AI: Predict incident risk
router.post(
  '/ai/predict-risk',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const prediction = qualityService.predictIncidentRisk(req.body);
    sendSuccess(res, prediction);
  })
);

// ==================== DASHBOARD ====================

// Get quality dashboard stats
router.get(
  '/stats',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const stats = await qualityService.getDashboardStats(req.user!.hospitalId);
    sendSuccess(res, stats);
  })
);

export default router;
