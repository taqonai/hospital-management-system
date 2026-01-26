import { Router, Response } from 'express';
import { medSafetyService } from '../services/medSafetyService';
import { authenticate, authorize, authorizeWithPermission } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated } from '../utils/response';
import { AuthenticatedRequest } from '../types';

const router = Router();

// ==================== 5 Rights Verification ====================

/**
 * POST /api/med-safety/verify
 * Verify medication administration (5 Rights)
 */
router.post(
  '/verify',
  authenticate,
  authorizeWithPermission('ai:med_safety', ['NURSE', 'DOCTOR', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await medSafetyService.verifyFiveRights(req.body);
    sendSuccess(res, result);
  })
);

// ==================== Barcode Scanning ====================

/**
 * POST /api/med-safety/scan
 * Process barcode scan (patient wristband or medication)
 */
router.post(
  '/scan',
  authenticate,
  authorizeWithPermission('ai:med_safety', ['NURSE', 'DOCTOR', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { barcode, expectedType } = req.body;
    const result = await medSafetyService.processBarcodeScan(barcode, expectedType);
    sendSuccess(res, result);
  })
);

// ==================== Patient Medications ====================

/**
 * GET /api/med-safety/patient/:id/medications
 * Get patient's due medications with schedule
 */
router.get(
  '/patient/:id/medications',
  authenticate,
  authorizeWithPermission('ai:med_safety', ['NURSE', 'DOCTOR', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await medSafetyService.getPatientDueMedications(req.params.id);
    sendSuccess(res, result);
  })
);

// ==================== Medication Administration ====================

/**
 * POST /api/med-safety/administer
 * Record medication administration
 */
router.post(
  '/administer',
  authenticate,
  authorizeWithPermission('ai:med_safety', ['NURSE', 'DOCTOR']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const administrationData = {
      ...req.body,
      administeredBy: req.user!.userId,
    };
    const result = await medSafetyService.recordAdministration(administrationData);
    sendCreated(res, result, 'Medication administration recorded');
  })
);

// ==================== Alerts ====================

/**
 * GET /api/med-safety/alerts/:patientId
 * Get active medication alerts for a patient
 */
router.get(
  '/alerts/:patientId',
  authenticate,
  authorizeWithPermission('ai:med_safety', ['NURSE', 'DOCTOR', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await medSafetyService.getPatientAlerts(req.params.patientId);
    sendSuccess(res, result);
  })
);

// ==================== Override ====================

/**
 * POST /api/med-safety/override
 * Override alert with mandatory reason
 */
router.post(
  '/override',
  authenticate,
  authorizeWithPermission('ai:med_safety', ['NURSE', 'DOCTOR']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const overrideData = {
      ...req.body,
      overriddenBy: req.user!.userId,
    };
    const result = await medSafetyService.recordOverride(overrideData);
    sendSuccess(res, result, 'Override recorded');
  })
);

// ==================== High-Alert Drugs ====================

/**
 * GET /api/med-safety/high-alert-drugs
 * Get list of high-alert medications
 */
router.get(
  '/high-alert-drugs',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await medSafetyService.getHighAlertDrugs();
    sendSuccess(res, result);
  })
);

// ==================== IV Compatibility ====================

/**
 * POST /api/med-safety/iv-compatibility
 * Check IV compatibility between two drugs
 */
router.post(
  '/iv-compatibility',
  authenticate,
  authorizeWithPermission('ai:med_safety', ['NURSE', 'DOCTOR', 'PHARMACIST']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { drug1, drug2 } = req.body;
    const result = await medSafetyService.checkIVCompatibility(drug1, drug2);
    sendSuccess(res, result);
  })
);

// ==================== Dose Calculator ====================

/**
 * POST /api/med-safety/calculate-dose
 * Calculate appropriate medication dose
 */
router.post(
  '/calculate-dose',
  authenticate,
  authorizeWithPermission('ai:med_safety', ['NURSE', 'DOCTOR', 'PHARMACIST']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await medSafetyService.calculateDose(req.body);
    sendSuccess(res, result);
  })
);

// ==================== Due Medications (Shift-based) ====================

/**
 * GET /api/med-safety/due
 * Get medications due for administration (shift-based)
 */
router.get(
  '/due',
  authenticate,
  authorizeWithPermission('ai:med_safety', ['NURSE', 'DOCTOR', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { shift, wardId, nurseId } = req.query;
    const result = await medSafetyService.getDueMedications({
      shift: shift as string,
      wardId: wardId as string,
      nurseId: (nurseId as string) || req.user!.userId,
    });
    sendSuccess(res, result);
  })
);

/**
 * POST /api/medication-safety/verify
 * AI-powered safety verification
 */
router.post(
  '/safety-verify',
  authenticate,
  authorizeWithPermission('ai:med_safety', ['NURSE', 'DOCTOR']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await medSafetyService.performSafetyVerification({
      ...req.body,
      verifiedBy: req.user!.userId,
    });
    sendSuccess(res, result);
  })
);

export default router;
