import { Router, Response } from 'express';
import { noShowService } from '../services/noShowService';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler, ValidationError } from '../middleware/errorHandler';
import { sendSuccess } from '../utils/response';
import { AuthenticatedRequest } from '../types';
import { triggerNoShowCheck, externalTriggerNoShowCheck, getCronHealth } from '../jobs';

const router = Router();

// Validation helpers
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const validateUUID = (id: string, field: string) => {
  if (!UUID_REGEX.test(id)) {
    throw new ValidationError(`Invalid ${field} format`);
  }
};

/**
 * POST /no-show/:appointmentId
 * Manually mark an appointment as NO_SHOW
 */
router.post(
  '/:appointmentId',
  authenticate,
  authorize('HOSPITAL_ADMIN', 'DOCTOR', 'RECEPTIONIST', 'NURSE'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    validateUUID(req.params.appointmentId, 'appointmentId');

    const { reason, notes } = req.body;

    // Validate reason
    const validReasons = ['MANUAL_STAFF', 'MANUAL_DOCTOR', 'PATIENT_CALLED'];
    if (!reason || !validReasons.includes(reason)) {
      throw new ValidationError(`reason must be one of: ${validReasons.join(', ')}`);
    }

    const result = await noShowService.manualNoShow(
      req.params.appointmentId,
      req.user!.hospitalId,
      req.user!.userId,
      reason,
      notes
    );

    sendSuccess(res, result, 'Appointment marked as NO_SHOW');
  })
);

/**
 * GET /no-show/logs
 * Get NO_SHOW logs for reporting
 */
router.get(
  '/logs',
  authenticate,
  authorize('HOSPITAL_ADMIN', 'DOCTOR', 'RECEPTIONIST'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { startDate, endDate, doctorId, patientId, reason, limit, offset } = req.query;

    const params: any = {};
    if (startDate) params.startDate = new Date(startDate as string);
    if (endDate) params.endDate = new Date(endDate as string);
    if (doctorId) {
      validateUUID(doctorId as string, 'doctorId');
      params.doctorId = doctorId;
    }
    if (patientId) {
      validateUUID(patientId as string, 'patientId');
      params.patientId = patientId;
    }
    if (reason) params.reason = reason;
    if (limit) params.limit = parseInt(limit as string, 10);
    if (offset) params.offset = parseInt(offset as string, 10);

    const result = await noShowService.getNoShowLogs(req.user!.hospitalId, params);
    sendSuccess(res, result);
  })
);

/**
 * GET /no-show/stats
 * Get NO_SHOW statistics
 */
router.get(
  '/stats',
  authenticate,
  authorize('HOSPITAL_ADMIN', 'DOCTOR'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      throw new ValidationError('startDate and endDate are required');
    }

    const stats = await noShowService.getNoShowStats(
      req.user!.hospitalId,
      new Date(startDate as string),
      new Date(endDate as string)
    );

    sendSuccess(res, stats);
  })
);

/**
 * GET /no-show/alerts
 * Get active stage alerts
 */
router.get(
  '/alerts',
  authenticate,
  authorize('HOSPITAL_ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const alerts = await noShowService.getActiveAlerts(req.user!.hospitalId);
    sendSuccess(res, alerts);
  })
);

/**
 * PUT /no-show/alerts/:alertId/acknowledge
 * Acknowledge a stage alert
 */
router.put(
  '/alerts/:alertId/acknowledge',
  authenticate,
  authorize('HOSPITAL_ADMIN', 'DOCTOR', 'NURSE'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    validateUUID(req.params.alertId, 'alertId');

    await noShowService.acknowledgeAlert(req.params.alertId, req.user!.userId);
    sendSuccess(res, null, 'Alert acknowledged');
  })
);

/**
 * PUT /no-show/alerts/:alertId/resolve
 * Resolve a stage alert
 */
router.put(
  '/alerts/:alertId/resolve',
  authenticate,
  authorize('HOSPITAL_ADMIN', 'DOCTOR', 'NURSE'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    validateUUID(req.params.alertId, 'alertId');

    await noShowService.resolveAlert(req.params.alertId, req.user!.userId);
    sendSuccess(res, null, 'Alert resolved');
  })
);

/**
 * POST /no-show/trigger
 * Manually trigger NO_SHOW check (Admin only, for testing)
 */
router.post(
  '/trigger',
  authenticate,
  authorize('HOSPITAL_ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await triggerNoShowCheck();
    sendSuccess(res, result, 'NO_SHOW check triggered');
  })
);

/**
 * GET /no-show/cron-health
 * Get cron job health status (Admin only)
 */
router.get(
  '/cron-health',
  authenticate,
  authorize('HOSPITAL_ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const health = await getCronHealth();
    sendSuccess(res, health);
  })
);

/**
 * POST /no-show/external-trigger
 * External trigger for backup cron (CloudWatch, system cron)
 * Uses API key authentication instead of JWT
 */
router.post(
  '/external-trigger',
  asyncHandler(async (req, res: Response) => {
    // Validate API key for external systems
    const apiKey = req.headers['x-cron-api-key'];
    const expectedKey = process.env.CRON_API_KEY;

    if (!expectedKey) {
      throw new ValidationError('External cron trigger not configured');
    }

    if (apiKey !== expectedKey) {
      res.status(401).json({ success: false, message: 'Invalid API key' });
      return;
    }

    const result = await externalTriggerNoShowCheck();
    sendSuccess(res, result, 'External NO_SHOW check triggered');
  })
);

export default router;
