import { Router, Response } from 'express';
import { telemedicineService } from '../services/telemedicineService';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated, sendPaginated, calculatePagination } from '../utils/response';
import { AuthenticatedRequest } from '../types';

const router = Router();

// ==================== SESSION MANAGEMENT ====================

// Create session
router.post(
  '/sessions',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const session = await telemedicineService.createSession(req.user!.hospitalId, req.body);
    sendCreated(res, session, 'Teleconsultation session scheduled');
  })
);

// Get sessions
router.get(
  '/sessions',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await telemedicineService.getSessions(req.user!.hospitalId, req.query);
    const pagination = calculatePagination(result.page, result.limit, result.total);
    sendPaginated(res, result.sessions, pagination);
  })
);

// Get session by ID
router.get(
  '/sessions/:id',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const session = await telemedicineService.getSessionById(req.params.id);
    sendSuccess(res, session);
  })
);

// Start session
router.patch(
  '/sessions/:id/start',
  authenticate,
  authorize('DOCTOR'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const session = await telemedicineService.startSession(req.params.id);
    sendSuccess(res, session, 'Session started');
  })
);

// End session
router.patch(
  '/sessions/:id/end',
  authenticate,
  authorize('DOCTOR'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const session = await telemedicineService.endSession(req.params.id, req.body);
    sendSuccess(res, session, 'Session completed');
  })
);

// Cancel session
router.patch(
  '/sessions/:id/cancel',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { reason } = req.body;
    const session = await telemedicineService.cancelSession(req.params.id, reason);
    sendSuccess(res, session, 'Session cancelled');
  })
);

// Mark no-show
router.patch(
  '/sessions/:id/no-show',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { party } = req.body;
    const session = await telemedicineService.markNoShow(req.params.id, party);
    sendSuccess(res, session, 'Marked as no-show');
  })
);

// Update notes
router.patch(
  '/sessions/:id/notes',
  authenticate,
  authorize('DOCTOR'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { notes } = req.body;
    const session = await telemedicineService.updateNotes(req.params.id, notes);
    sendSuccess(res, session, 'Notes updated');
  })
);

// Record patient vitals
router.patch(
  '/sessions/:id/vitals',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const session = await telemedicineService.recordVitals(req.params.id, req.body);
    sendSuccess(res, session, 'Vitals recorded');
  })
);

// ==================== AI FEATURES ====================

// AI: Pre-consultation triage
router.post(
  '/ai/triage',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const triage = telemedicineService.performAITriage(req.body);
    sendSuccess(res, triage);
  })
);

// AI: Generate consultation summary
router.post(
  '/ai/summary',
  authenticate,
  authorize('DOCTOR'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const summary = telemedicineService.generateConsultationSummary(req.body);
    sendSuccess(res, summary);
  })
);

// AI: Recommend follow-up
router.post(
  '/ai/recommend-followup',
  authenticate,
  authorize('DOCTOR'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const recommendation = telemedicineService.recommendFollowUp(req.body);
    sendSuccess(res, recommendation);
  })
);

// ==================== DASHBOARD ====================

// Get telemedicine dashboard stats
router.get(
  '/stats',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const doctorId = req.query.doctorId as string;
    const stats = await telemedicineService.getDashboardStats(req.user!.hospitalId, doctorId);
    sendSuccess(res, stats);
  })
);

export default router;
