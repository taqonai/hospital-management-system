import { Router, Response } from 'express';
import { medicalRecordsService } from '../services/medicalRecordsService';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated, sendPaginated, calculatePagination } from '../utils/response';
import { AuthenticatedRequest } from '../types';

const router = Router();

// ==================== DOCUMENT MANAGEMENT ====================

// Upload document
router.post(
  '/documents',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await medicalRecordsService.uploadDocument(req.user!.hospitalId, {
      ...req.body,
      uploadedBy: req.user!.userId,
    });
    sendCreated(res, result, 'Document uploaded successfully');
  })
);

// Get documents
router.get(
  '/documents',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await medicalRecordsService.getDocuments(req.user!.hospitalId, req.query);
    const pagination = calculatePagination(result.page, result.limit, result.total);
    sendPaginated(res, result.documents, pagination);
  })
);

// Get document by ID
router.get(
  '/documents/:id',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const document = await medicalRecordsService.getDocumentById(req.params.id);
    sendSuccess(res, document);
  })
);

// Verify document
router.patch(
  '/documents/:id/verify',
  authenticate,
  authorize('DOCTOR', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const document = await medicalRecordsService.verifyDocument(req.params.id, req.user!.userId);
    sendSuccess(res, document, 'Document verified');
  })
);

// AI Smart search
router.post(
  '/documents/search',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { query, patientId } = req.body;
    const results = await medicalRecordsService.smartSearch(req.user!.hospitalId, query, patientId);
    sendSuccess(res, results);
  })
);

// ==================== CONSENT MANAGEMENT ====================

// Create consent
router.post(
  '/consents',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const consent = await medicalRecordsService.createConsent(req.user!.hospitalId, req.body);
    sendCreated(res, consent, 'Consent form created');
  })
);

// Get patient consents
router.get(
  '/consents/patient/:patientId',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const consents = await medicalRecordsService.getConsents(req.user!.hospitalId, req.params.patientId);
    sendSuccess(res, consents);
  })
);

// Sign consent
router.patch(
  '/consents/:id/sign',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const consent = await medicalRecordsService.signConsent(req.params.id, req.body);
    sendSuccess(res, consent, 'Consent signed');
  })
);

// Revoke consent
router.patch(
  '/consents/:id/revoke',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { reason } = req.body;
    const consent = await medicalRecordsService.revokeConsent(req.params.id, reason);
    sendSuccess(res, consent, 'Consent revoked');
  })
);

// ==================== PATIENT TIMELINE ====================

// Get patient timeline
router.get(
  '/timeline/:patientId',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const timeline = await medicalRecordsService.getPatientTimeline(
      req.user!.hospitalId,
      req.params.patientId
    );
    sendSuccess(res, timeline);
  })
);

// Generate AI patient summary
router.get(
  '/summary/:patientId',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const summary = await medicalRecordsService.generatePatientSummary(
      req.user!.hospitalId,
      req.params.patientId
    );
    sendSuccess(res, summary);
  })
);

export default router;
