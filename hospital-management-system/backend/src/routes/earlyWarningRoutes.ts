import { Router, Response } from 'express';
import { earlyWarningService } from '../services/earlyWarningService';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated } from '../utils/response';
import { AuthenticatedRequest } from '../types';

const router = Router();

// ==================== NEWS2 Calculation ====================

/**
 * POST /api/v1/early-warning/calculate
 * Calculate NEWS2 score from vitals (without saving)
 */
router.post(
  '/calculate',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { vitals } = req.body;
    const result = await earlyWarningService.calculateNEWS2(vitals || req.body);
    sendSuccess(res, result, 'NEWS2 score calculated');
  })
);

// ==================== qSOFA / Sepsis Screening ====================

/**
 * POST /api/v1/early-warning/qsofa
 * Calculate qSOFA score for sepsis screening
 */
router.post(
  '/qsofa',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { vitals } = req.body;
    const result = await earlyWarningService.calculateQSOFA(vitals || req.body);
    sendSuccess(res, result, 'qSOFA score calculated');
  })
);

// ==================== Fall Risk Assessment ====================

/**
 * POST /api/v1/early-warning/fall-risk
 * Calculate fall risk score
 */
router.post(
  '/fall-risk',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { vitals, patientData } = req.body;
    const result = await earlyWarningService.calculateFallRisk(vitals || req.body, patientData);
    sendSuccess(res, result, 'Fall risk score calculated');
  })
);

// ==================== Comprehensive Assessment ====================

/**
 * POST /api/v1/early-warning/assess
 * Comprehensive EWS assessment (NEWS2 + qSOFA + Fall Risk)
 */
router.post(
  '/assess',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { vitals, vitalsHistory, patientData } = req.body;
    const result = await earlyWarningService.comprehensiveAssessment(
      vitals || req.body,
      vitalsHistory,
      patientData
    );
    sendSuccess(res, result, 'Comprehensive EWS assessment completed');
  })
);

// ==================== Real-time Monitoring ====================

/**
 * POST /api/v1/early-warning/monitor
 * Submit vitals for real-time monitoring with alert generation
 */
router.post(
  '/monitor',
  authenticate,
  authorize('NURSE', 'DOCTOR', 'ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { patientId, vitals, vitalsHistory, patientData } = req.body;
    const result = await earlyWarningService.monitorVitals(
      patientId,
      vitals,
      vitalsHistory,
      patientData
    );
    sendSuccess(res, result, 'Vitals monitored successfully');
  })
);

// ==================== Vitals Recording ====================

/**
 * POST /api/v1/early-warning/vitals
 * Record new vitals and auto-calculate NEWS2
 */
router.post(
  '/vitals',
  authenticate,
  authorize('NURSE', 'DOCTOR'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { patientId, ...vitalsData } = req.body;
    const result = await earlyWarningService.recordVitalsWithEWS(
      req.user!.hospitalId,
      patientId,
      req.user!.userId,
      vitalsData
    );
    sendCreated(res, result, 'Vitals recorded and NEWS2 calculated');
  })
);

/**
 * POST /api/v1/early-warning/record
 * Alias for vitals recording with EWS calculation
 */
router.post(
  '/record',
  authenticate,
  authorize('NURSE', 'DOCTOR'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { patientId, vitals } = req.body;
    const result = await earlyWarningService.recordVitalsWithEWS(
      req.user!.hospitalId,
      patientId,
      req.user!.userId,
      vitals || req.body
    );
    sendCreated(res, result, 'Vitals recorded and EWS calculated');
  })
);

// ==================== Patient EWS History ====================

/**
 * GET /api/v1/early-warning/patient/:patientId
 * Get patient's EWS history
 */
router.get(
  '/patient/:patientId',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { limit } = req.query;
    const result = await earlyWarningService.getPatientEWSHistory(
      req.params.patientId,
      Number(limit) || 20
    );
    sendSuccess(res, result);
  })
);

/**
 * GET /api/v1/early-warning/patient/:patientId/history
 * Alias for patient EWS history
 */
router.get(
  '/patient/:patientId/history',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { limit } = req.query;
    const result = await earlyWarningService.getPatientEWSHistory(
      req.params.patientId,
      Number(limit) || 20
    );
    sendSuccess(res, result);
  })
);

/**
 * GET /api/v1/early-warning/patient/:patientId/trends
 * Get vital signs trend data for charts
 */
router.get(
  '/patient/:patientId/trends',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { hours } = req.query;
    const result = await earlyWarningService.getVitalsTrend(
      req.params.patientId,
      Number(hours) || 24
    );
    sendSuccess(res, result);
  })
);

// ==================== Alerts ====================

/**
 * GET /api/v1/early-warning/alerts
 * Get all active EWS alerts
 */
router.get(
  '/alerts',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { ward, severity, status } = req.query;
    const alerts = await earlyWarningService.getActiveAlerts(
      req.user!.hospitalId,
      {
        ward: ward as string,
        severity: severity as string,
        status: status as string,
      }
    );
    sendSuccess(res, alerts);
  })
);

/**
 * GET /api/v1/early-warning/alerts/:patientId
 * Get EWS alerts for a specific patient
 */
router.get(
  '/alerts/:patientId',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const alerts = await earlyWarningService.getPatientAlerts(req.params.patientId);
    sendSuccess(res, alerts);
  })
);

/**
 * PUT /api/v1/early-warning/alerts/:alertId/acknowledge
 * Acknowledge an alert
 */
router.put(
  '/alerts/:alertId/acknowledge',
  authenticate,
  authorize('NURSE', 'DOCTOR', 'ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { notes } = req.body;
    const result = await earlyWarningService.acknowledgeAlert(
      req.params.alertId,
      req.user!.userId,
      notes
    );
    sendSuccess(res, result, 'Alert acknowledged');
  })
);

/**
 * POST /api/v1/early-warning/acknowledge/:alertId
 * Legacy endpoint - Acknowledge an alert
 */
router.post(
  '/acknowledge/:alertId',
  authenticate,
  authorize('NURSE', 'DOCTOR'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { notes } = req.body;
    const result = await earlyWarningService.acknowledgeAlert(
      req.params.alertId,
      req.user!.userId,
      notes
    );
    sendSuccess(res, result, 'Alert acknowledged');
  })
);

// ==================== Dashboard ====================

/**
 * GET /api/v1/early-warning/dashboard
 * Get ward-level EWS overview
 */
router.get(
  '/dashboard',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { wardId } = req.query;
    const dashboard = await earlyWarningService.getWardDashboard(
      req.user!.hospitalId,
      wardId as string
    );
    sendSuccess(res, dashboard);
  })
);

// ==================== Health Check ====================

/**
 * GET /api/v1/early-warning/health
 * Health check for EWS service
 */
router.get(
  '/health',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, {
      service: 'early-warning',
      status: 'healthy',
      version: '2.0.0',
      features: [
        'news2',
        'qsofa',
        'fall_risk',
        'deterioration_prediction',
        'alerts',
        'dashboard',
      ],
      timestamp: new Date().toISOString(),
    });
  })
);

export default router;
