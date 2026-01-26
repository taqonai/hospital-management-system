import { Router, Response } from 'express';
import { mortuaryService } from '../services/mortuaryService';
import { authenticate, authorize, authorizeWithPermission } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated, sendPaginated, calculatePagination } from '../utils/response';
import { AuthenticatedRequest } from '../types';

const router = Router();

// ==================== MORTUARY RECORD MANAGEMENT ====================

// Register death
router.post(
  '/records',
  authenticate,
  authorizeWithPermission('mortuary:write', ['HOSPITAL_ADMIN', 'DOCTOR']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const record = await mortuaryService.registerDeath(req.user!.hospitalId, req.body);
    sendCreated(res, record, 'Death registered');
  })
);

// Get records
router.get(
  '/records',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await mortuaryService.getRecords(req.user!.hospitalId, req.query);
    const pagination = calculatePagination(result.page, result.limit, result.total);
    sendPaginated(res, result.records, pagination);
  })
);

// Get record by ID
router.get(
  '/records/:id',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const record = await mortuaryService.getRecordById(req.params.id);
    sendSuccess(res, record);
  })
);

// Update record
router.put(
  '/records/:id',
  authenticate,
  authorizeWithPermission('mortuary:write', ['HOSPITAL_ADMIN', 'DOCTOR']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const record = await mortuaryService.updateRecord(req.params.id, req.body);
    sendSuccess(res, record, 'Record updated');
  })
);

// Update status
router.patch(
  '/records/:id/status',
  authenticate,
  authorizeWithPermission('mortuary:write', ['HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { status, ...data } = req.body;
    const record = await mortuaryService.updateStatus(req.params.id, status, data);
    sendSuccess(res, record, 'Status updated');
  })
);

// ==================== DEATH CERTIFICATE ====================

// Issue death certificate
router.post(
  '/records/:id/certificate',
  authenticate,
  authorizeWithPermission('mortuary:write', ['HOSPITAL_ADMIN', 'DOCTOR']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const record = await mortuaryService.issueDeathCertificate(req.params.id, {
      ...req.body,
      issuedBy: req.user!.userId,
    });
    sendSuccess(res, record, 'Death certificate issued');
  })
);

// ==================== AUTOPSY MANAGEMENT ====================

// Schedule autopsy
router.post(
  '/records/:id/autopsy/schedule',
  authenticate,
  authorizeWithPermission('mortuary:write', ['HOSPITAL_ADMIN', 'DOCTOR']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const record = await mortuaryService.scheduleAutopsy(req.params.id, req.body);
    sendSuccess(res, record, 'Autopsy scheduled');
  })
);

// Complete autopsy
router.patch(
  '/records/:id/autopsy/complete',
  authenticate,
  authorizeWithPermission('mortuary:write', ['DOCTOR']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const record = await mortuaryService.completeAutopsy(req.params.id, {
      ...req.body,
      performedBy: req.user!.userId,
    });
    sendSuccess(res, record, 'Autopsy completed');
  })
);

// ==================== BODY RELEASE ====================

// Release body
router.post(
  '/records/:id/release',
  authenticate,
  authorizeWithPermission('mortuary:release', ['HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const record = await mortuaryService.releaseBody(req.params.id, {
      ...req.body,
      authorizedBy: req.user!.userId,
    });
    sendSuccess(res, record, 'Body released');
  })
);

// ==================== ORGAN DONATION ====================

// Register organ donation
router.post(
  '/records/:id/organ-donation',
  authenticate,
  authorizeWithPermission('mortuary:write', ['HOSPITAL_ADMIN', 'DOCTOR']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const record = await mortuaryService.registerOrganDonation(req.params.id, req.body);
    sendSuccess(res, record, 'Organ donation registered');
  })
);

// ==================== AI FEATURES ====================

// AI: Analyze mortality patterns
router.post(
  '/ai/mortality-analysis',
  authenticate,
  authorizeWithPermission('mortuary:write', ['HOSPITAL_ADMIN', 'DOCTOR']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const analysis = mortuaryService.analyzeMortalityPatterns(req.body);
    sendSuccess(res, analysis);
  })
);

// AI: Generate death summary
router.post(
  '/ai/death-summary',
  authenticate,
  authorizeWithPermission('mortuary:write', ['DOCTOR']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const summary = mortuaryService.generateDeathSummary(req.body);
    sendSuccess(res, summary);
  })
);

// AI: Check documentation completeness
router.post(
  '/ai/check-documentation',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = mortuaryService.checkDocumentationCompleteness(req.body);
    sendSuccess(res, result);
  })
);

// ==================== DASHBOARD ====================

// Get mortuary dashboard stats
router.get(
  '/stats',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const stats = await mortuaryService.getDashboardStats(req.user!.hospitalId);
    sendSuccess(res, stats);
  })
);

export default router;
