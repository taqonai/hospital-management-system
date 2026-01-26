import { Router, Response } from 'express';
import { ipdService } from '../services/ipdService';
import { authenticate, authorize, authorizeWithPermission } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated, sendPaginated, calculatePagination } from '../utils/response';
import { AuthenticatedRequest } from '../types';

const router = Router();

// ==================== Wards ====================

// Get all wards
router.get(
  '/wards',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const wards = await ipdService.getAllWards();
    sendSuccess(res, wards);
  })
);

// Create ward
router.post(
  '/wards',
  authenticate,
  authorizeWithPermission('ipd:admissions:write', ['HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const ward = await ipdService.createWard(req.body);
    sendCreated(res, ward, 'Ward created successfully');
  })
);

// ==================== Beds ====================

// Get all beds
router.get(
  '/beds',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { wardId, status, bedType } = req.query;
    const beds = await ipdService.getAllBeds(req.user!.hospitalId, {
      wardId: wardId as string,
      status: status as string,
      bedType: bedType as string,
    });
    sendSuccess(res, beds);
  })
);

// Create bed
router.post(
  '/beds',
  authenticate,
  authorizeWithPermission('ipd:beds:manage', ['HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const bed = await ipdService.createBed(req.user!.hospitalId, req.body);
    sendCreated(res, bed, 'Bed created successfully');
  })
);

// Update bed status
router.patch(
  '/beds/:id/status',
  authenticate,
  authorizeWithPermission('ipd:beds:manage', ['HOSPITAL_ADMIN', 'NURSE']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const bed = await ipdService.updateBedStatus(req.params.id, req.body.status);
    sendSuccess(res, bed, 'Bed status updated');
  })
);

// Get available beds
router.get(
  '/beds/available',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { wardType } = req.query;
    const beds = await ipdService.getAvailableBeds(req.user!.hospitalId, wardType as string);
    sendSuccess(res, beds);
  })
);

// ==================== Admissions ====================

// Get all admissions
router.get(
  '/admissions',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit, status, wardId, patientId } = req.query;
    const result = await ipdService.getAdmissions(req.user!.hospitalId, {
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      status: status as string,
      wardId: wardId as string,
      patientId: patientId as string,
    });
    const pagination = calculatePagination(result.page, result.limit, result.total);
    sendPaginated(res, result.admissions, pagination);
  })
);

// Create admission
router.post(
  '/admissions',
  authenticate,
  authorizeWithPermission('ipd:admissions:write', ['HOSPITAL_ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const admission = await ipdService.createAdmission(req.user!.hospitalId, req.body);
    sendCreated(res, admission, 'Patient admitted successfully');
  })
);

// Get admission by ID
router.get(
  '/admissions/:id',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const admission = await ipdService.getAdmissionById(req.params.id, req.user!.hospitalId);
    sendSuccess(res, admission);
  })
);

// Update admission
router.put(
  '/admissions/:id',
  authenticate,
  authorizeWithPermission('ipd:admissions:write', ['HOSPITAL_ADMIN', 'DOCTOR', 'NURSE']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const admission = await ipdService.updateAdmission(req.params.id, req.user!.hospitalId, req.body);
    sendSuccess(res, admission, 'Admission updated');
  })
);

// Transfer bed
router.post(
  '/admissions/:id/transfer',
  authenticate,
  authorizeWithPermission('ipd:admissions:write', ['HOSPITAL_ADMIN', 'NURSE']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const admission = await ipdService.transferBed(req.params.id, req.body.newBedId);
    sendSuccess(res, admission, 'Patient transferred');
  })
);

// Add nursing note
router.post(
  '/admissions/:id/nursing-notes',
  authenticate,
  authorizeWithPermission('ipd:nursing:notes', ['NURSE']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const note = await ipdService.addNursingNote(req.params.id, req.user!.userId, req.body);
    sendCreated(res, note, 'Nursing note added');
  })
);

// Create discharge summary
router.post(
  '/admissions/:id/discharge',
  authenticate,
  authorizeWithPermission('ipd:discharge', ['DOCTOR']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const summary = await ipdService.createDischargeSummary(req.params.id, {
      ...req.body,
      preparedBy: req.user!.userId,
    });
    sendCreated(res, summary, 'Patient discharged successfully');
  })
);

// Get IPD stats
router.get(
  '/stats',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const stats = await ipdService.getIPDStats(req.user!.hospitalId);
    sendSuccess(res, stats);
  })
);

// Get high-risk patients
router.get(
  '/high-risk',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const patients = await ipdService.getHighRiskPatients(req.user!.hospitalId);
    sendSuccess(res, patients);
  })
);

// ==================== Deterioration Monitoring (NEWS2) ====================

// Get deterioration monitoring dashboard
router.get(
  '/deterioration-dashboard',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const dashboard = await ipdService.getDeteriorationDashboard(req.user!.hospitalId);
    sendSuccess(res, dashboard);
  })
);

// Record vitals for an admission (with automatic NEWS2 calculation)
router.post(
  '/admissions/:id/vitals',
  authenticate,
  authorizeWithPermission('ipd:admissions:write', ['NURSE', 'DOCTOR']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await ipdService.recordVitals(
      req.params.id,
      req.user!.userId,
      req.body
    );
    sendCreated(res, result, 'Vitals recorded and NEWS2 score calculated');
  })
);

// Calculate NEWS2 score (without saving - for preview/calculation)
router.post(
  '/calculate-news2',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = ipdService.calculateNEWS2Score(req.body);
    sendSuccess(res, result);
  })
);

export default router;
