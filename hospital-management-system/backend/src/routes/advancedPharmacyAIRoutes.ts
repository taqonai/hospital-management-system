import { Router, Response } from 'express';
import { advancedPharmacyAIService } from '../services/advancedPharmacyAIService';
import { authenticate, authorize, authorizeWithPermission, authorizeHospital } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess } from '../utils/response';
import { AuthenticatedRequest } from '../types';

const router = Router();

// ==================== TDM (Therapeutic Drug Monitoring) ====================

/**
 * POST /api/v1/advanced-pharmacy-ai/tdm/guidance
 * Get TDM guidance for a drug
 */
router.post(
  '/tdm/guidance',
  authenticate,
  authorizeWithPermission('ai:med_safety', ['DOCTOR', 'PHARMACIST', 'NURSE', 'HOSPITAL_ADMIN']),
  authorizeHospital,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { drugName, patientData } = req.body;
    const result = advancedPharmacyAIService.getTDMGuidance(drugName, patientData);
    sendSuccess(res, result);
  })
);

/**
 * GET /api/v1/advanced-pharmacy-ai/tdm/drugs
 * Get list of drugs that require TDM
 */
router.get(
  '/tdm/drugs',
  authenticate,
  authorizeWithPermission('ai:med_safety', ['DOCTOR', 'PHARMACIST', 'NURSE', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = advancedPharmacyAIService.getTDMDrugList();
    sendSuccess(res, { drugs: result });
  })
);

// ==================== CYP450 Interactions ====================

/**
 * POST /api/v1/advanced-pharmacy-ai/cyp450/check
 * Check CYP450 enzyme interactions between medications
 */
router.post(
  '/cyp450/check',
  authenticate,
  authorizeWithPermission('ai:med_safety', ['DOCTOR', 'PHARMACIST', 'NURSE', 'HOSPITAL_ADMIN']),
  authorizeHospital,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { medications } = req.body;
    const result = advancedPharmacyAIService.getCYP450Interactions(medications);
    sendSuccess(res, result);
  })
);

/**
 * GET /api/v1/advanced-pharmacy-ai/cyp450/profile/:drugName
 * Get CYP450 profile for a specific drug
 */
router.get(
  '/cyp450/profile/:drugName',
  authenticate,
  authorizeWithPermission('ai:med_safety', ['DOCTOR', 'PHARMACIST', 'NURSE', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { drugName } = req.params;
    const result = advancedPharmacyAIService.getDrugCYP450Profile(drugName);
    sendSuccess(res, result);
  })
);

// ==================== Cost-Effective Alternatives ====================

/**
 * POST /api/v1/advanced-pharmacy-ai/alternatives
 * Get cost-effective alternatives for a drug
 */
router.post(
  '/alternatives',
  authenticate,
  authorizeWithPermission('ai:med_safety', ['DOCTOR', 'PHARMACIST', 'NURSE', 'HOSPITAL_ADMIN']),
  authorizeHospital,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { drugName, indication } = req.body;
    const result = advancedPharmacyAIService.suggestAlternatives(drugName, indication);
    sendSuccess(res, result);
  })
);

// ==================== Renal Dosing ====================

/**
 * POST /api/v1/advanced-pharmacy-ai/renal-dosing
 * Calculate renal-adjusted dosing using Cockcroft-Gault equation
 */
router.post(
  '/renal-dosing',
  authenticate,
  authorizeWithPermission('ai:med_safety', ['DOCTOR', 'PHARMACIST', 'NURSE', 'HOSPITAL_ADMIN']),
  authorizeHospital,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { drugName, creatinine, age, weight, gender } = req.body;
    const result = advancedPharmacyAIService.calculateRenalDose(
      drugName,
      creatinine,
      age,
      weight,
      gender
    );
    sendSuccess(res, result);
  })
);

// ==================== IV Compatibility ====================

/**
 * POST /api/v1/advanced-pharmacy-ai/iv-compatibility
 * Check IV compatibility between drugs
 */
router.post(
  '/iv-compatibility',
  authenticate,
  authorizeWithPermission('ai:med_safety', ['DOCTOR', 'PHARMACIST', 'NURSE', 'HOSPITAL_ADMIN']),
  authorizeHospital,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { drug1, drug2, solution } = req.body;
    const result = advancedPharmacyAIService.checkIVCompatibility(drug1, drug2, solution);
    sendSuccess(res, result);
  })
);

// ==================== Drug-Lab Interactions ====================

/**
 * POST /api/v1/advanced-pharmacy-ai/lab-interactions
 * Check drug-lab interactions
 */
router.post(
  '/lab-interactions',
  authenticate,
  authorizeWithPermission('ai:med_safety', ['DOCTOR', 'PHARMACIST', 'NURSE', 'HOSPITAL_ADMIN']),
  authorizeHospital,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { medications, labTests } = req.body;
    const result = advancedPharmacyAIService.checkLabInteractions(medications, labTests);
    sendSuccess(res, result);
  })
);

// ==================== Polypharmacy Risk Assessment ====================

/**
 * POST /api/v1/advanced-pharmacy-ai/polypharmacy-risk
 * Assess polypharmacy risk for a patient
 */
router.post(
  '/polypharmacy-risk',
  authenticate,
  authorizeWithPermission('ai:med_safety', ['DOCTOR', 'PHARMACIST', 'NURSE', 'HOSPITAL_ADMIN']),
  authorizeHospital,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { medications, patientAge } = req.body;
    const result = advancedPharmacyAIService.assessPolypharmacyRisk(medications, patientAge);
    sendSuccess(res, result);
  })
);

// ==================== Enhanced Drug Information ====================

/**
 * GET /api/v1/advanced-pharmacy-ai/drug-info/:drugName
 * Get enhanced drug information including TDM, renal dosing, CYP450, etc.
 */
router.get(
  '/drug-info/:drugName',
  authenticate,
  authorizeWithPermission('ai:med_safety', ['DOCTOR', 'PHARMACIST', 'NURSE', 'HOSPITAL_ADMIN']),
  authorizeHospital,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { drugName } = req.params;

    // Compile comprehensive drug information
    const tdmGuidance = advancedPharmacyAIService.getTDMGuidance(drugName);
    const cyp450Profile = advancedPharmacyAIService.getDrugCYP450Profile(drugName);
    const alternatives = advancedPharmacyAIService.suggestAlternatives(drugName);

    const result = {
      drugName,
      tdmGuidance,
      cyp450Profile,
      alternatives,
      timestamp: new Date().toISOString()
    };

    sendSuccess(res, result);
  })
);

export default router;
