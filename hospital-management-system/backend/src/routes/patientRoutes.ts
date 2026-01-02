import { Router, Response } from 'express';
import { patientService } from '../services/patientService';
import { authenticate, authorize, authorizeHospital } from '../middleware/auth';
import { validate, createPatientSchema, uuidParamSchema, paginationSchema } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated, sendPaginated, calculatePagination } from '../utils/response';
import { AuthenticatedRequest } from '../types';

const router = Router();

// Get all patients
router.get(
  '/',
  authenticate,
  validate(paginationSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit, search, sortBy, sortOrder } = req.query;
    const { patients, total } = await patientService.findAll(req.user!.hospitalId, {
      page: Number(page) || 1,
      limit: Number(limit) || 10,
      search: search as string,
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'asc' | 'desc',
    });
    const pagination = calculatePagination(Number(page) || 1, Number(limit) || 10, total);
    sendPaginated(res, patients, pagination);
  })
);

// Create patient
router.post(
  '/',
  authenticate,
  authorize('HOSPITAL_ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST'),
  validate(createPatientSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const patient = await patientService.create(req.user!.hospitalId, req.body);
    sendCreated(res, patient, 'Patient registered successfully');
  })
);

// Get patient by ID
router.get(
  '/:id',
  authenticate,
  validate(uuidParamSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const patient = await patientService.findById(req.params.id, req.user!.hospitalId);
    sendSuccess(res, patient);
  })
);

// Get patient by MRN
router.get(
  '/mrn/:mrn',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const patient = await patientService.findByMRN(req.params.mrn, req.user!.hospitalId);
    sendSuccess(res, patient);
  })
);

// Update patient
router.put(
  '/:id',
  authenticate,
  authorize('HOSPITAL_ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST'),
  validate(uuidParamSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const patient = await patientService.update(req.params.id, req.user!.hospitalId, req.body);
    sendSuccess(res, patient, 'Patient updated successfully');
  })
);

// Delete patient (soft delete)
router.delete(
  '/:id',
  authenticate,
  authorize('HOSPITAL_ADMIN'),
  validate(uuidParamSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await patientService.delete(req.params.id, req.user!.hospitalId);
    sendSuccess(res, null, 'Patient deleted successfully');
  })
);

// Get patient medical history
router.get(
  '/:id/medical-history',
  authenticate,
  validate(uuidParamSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const patient = await patientService.findById(req.params.id, req.user!.hospitalId);
    sendSuccess(res, patient.medicalHistory);
  })
);

// Update medical history
router.put(
  '/:id/medical-history',
  authenticate,
  authorize('DOCTOR', 'NURSE'),
  validate(uuidParamSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const history = await patientService.updateMedicalHistory(
      req.params.id,
      req.user!.hospitalId,
      req.body
    );
    sendSuccess(res, history, 'Medical history updated');
  })
);

// Add allergy
router.post(
  '/:id/allergies',
  authenticate,
  authorize('DOCTOR', 'NURSE'),
  validate(uuidParamSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const allergy = await patientService.addAllergy(
      req.params.id,
      req.user!.hospitalId,
      req.body
    );
    sendCreated(res, allergy, 'Allergy added');
  })
);

// Remove allergy
router.delete(
  '/:id/allergies/:allergyId',
  authenticate,
  authorize('DOCTOR', 'NURSE'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await patientService.removeAllergy(req.params.id, req.params.allergyId);
    sendSuccess(res, null, 'Allergy removed');
  })
);

// Record vitals
router.post(
  '/:id/vitals',
  authenticate,
  authorize('DOCTOR', 'NURSE'),
  validate(uuidParamSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const vitals = await patientService.recordVitals(
      req.params.id,
      req.user!.hospitalId,
      { ...req.body, recordedBy: req.user!.userId }
    );
    sendCreated(res, vitals, 'Vitals recorded');
  })
);

// Get vitals history
router.get(
  '/:id/vitals',
  authenticate,
  validate(uuidParamSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const limit = Number(req.query.limit) || 20;
    const vitals = await patientService.getVitalsHistory(
      req.params.id,
      req.user!.hospitalId,
      limit
    );
    sendSuccess(res, vitals);
  })
);

// Add insurance
router.post(
  '/:id/insurance',
  authenticate,
  authorize('HOSPITAL_ADMIN', 'RECEPTIONIST'),
  validate(uuidParamSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const insurance = await patientService.addInsurance(
      req.params.id,
      req.user!.hospitalId,
      req.body
    );
    sendCreated(res, insurance, 'Insurance added');
  })
);

// Get patient timeline
router.get(
  '/:id/timeline',
  authenticate,
  validate(uuidParamSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const timeline = await patientService.getPatientTimeline(
      req.params.id,
      req.user!.hospitalId
    );
    sendSuccess(res, timeline);
  })
);

export default router;
