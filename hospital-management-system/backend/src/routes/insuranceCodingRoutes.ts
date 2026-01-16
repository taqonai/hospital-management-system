import { Router, Response } from 'express';
import axios from 'axios';
import { icdService } from '../services/icdService';
import { cptService } from '../services/cptService';
import { payerService } from '../services/payerService';
import { payerRulesService } from '../services/payerRulesService';
import { medicalNecessityService } from '../services/medicalNecessityService';
import { consultationCodingService } from '../services/consultationCodingService';
import { dischargeCodingService } from '../services/dischargeCodingService';
import { codingAnalyticsService } from '../services/codingAnalyticsService';
import { eclaimLinkService } from '../services/eclaimLinkService';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated, sendPaginated, calculatePagination } from '../utils/response';
import { AuthenticatedRequest } from '../types';
import logger from '../utils/logger';
import { DischargeCodingStatus } from '@prisma/client';

const router = Router();

// AI Service URL for insurance coding
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// ==================== ICD-10 Codes ====================

// Get all ICD-10 codes
router.get(
  '/icd10',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit, search, category, dhaApproved, isActive, isBillable, specificityLevel } = req.query;
    const result = await icdService.getAll(req.user!.hospitalId, {
      page: Number(page) || 1,
      limit: Number(limit) || 50,
      search: search as string,
      category: category as string,
      dhaApproved: dhaApproved === 'true' ? true : dhaApproved === 'false' ? false : undefined,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      isBillable: isBillable === 'true' ? true : isBillable === 'false' ? false : undefined,
      specificityLevel: specificityLevel ? Number(specificityLevel) : undefined,
    });
    const pagination = calculatePagination(result.page, result.limit, result.total);
    sendPaginated(res, result.codes, pagination);
  })
);

// Search ICD-10 codes (autocomplete)
router.get(
  '/icd10/search',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { q, limit } = req.query;
    const results = await icdService.search(
      req.user!.hospitalId,
      q as string,
      limit ? Number(limit) : 20
    );
    sendSuccess(res, results);
  })
);

// Get ICD-10 categories
router.get(
  '/icd10/categories',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const categories = await icdService.getCategories(req.user!.hospitalId);
    sendSuccess(res, categories);
  })
);

// Get single ICD-10 code
router.get(
  '/icd10/:id',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const code = await icdService.getById(req.params.id, req.user!.hospitalId);
    sendSuccess(res, code);
  })
);

// Get more specific codes for an unspecified code
router.get(
  '/icd10/:id/specific-codes',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const code = await icdService.getById(req.params.id, req.user!.hospitalId);
    const specificCodes = await icdService.findMoreSpecificCodes(req.user!.hospitalId, code.code);
    sendSuccess(res, specificCodes);
  })
);

// Get ICD-10 usage stats
router.get(
  '/icd10/:id/stats',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { startDate, endDate } = req.query;
    const stats = await icdService.getUsageStats(
      req.user!.hospitalId,
      req.params.id,
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );
    sendSuccess(res, stats);
  })
);

// Create ICD-10 code (admin only)
router.post(
  '/icd10',
  authenticate,
  authorize('HOSPITAL_ADMIN', 'ACCOUNTANT'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const code = await icdService.create(req.user!.hospitalId, req.body, req.user!.userId);
    sendCreated(res, code, 'ICD-10 code created');
  })
);

// Bulk import ICD-10 codes (admin only)
router.post(
  '/icd10/bulk',
  authenticate,
  authorize('HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { codes } = req.body;
    const result = await icdService.bulkImport(req.user!.hospitalId, codes, req.user!.userId);
    sendSuccess(res, result, `Imported ${result.created} codes, updated ${result.updated} codes`);
  })
);

// Update ICD-10 code (admin only)
router.put(
  '/icd10/:id',
  authenticate,
  authorize('HOSPITAL_ADMIN', 'ACCOUNTANT'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const code = await icdService.update(req.params.id, req.user!.hospitalId, req.body);
    sendSuccess(res, code, 'ICD-10 code updated');
  })
);

// Delete ICD-10 code (soft delete, admin only)
router.delete(
  '/icd10/:id',
  authenticate,
  authorize('HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const code = await icdService.delete(req.params.id, req.user!.hospitalId);
    sendSuccess(res, code, 'ICD-10 code deactivated');
  })
);

// ==================== CPT Codes ====================

// Get all CPT codes
router.get(
  '/cpt',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit, search, category, requiresPreAuth, isActive, minPrice, maxPrice } = req.query;
    const result = await cptService.getAll(req.user!.hospitalId, {
      page: Number(page) || 1,
      limit: Number(limit) || 50,
      search: search as string,
      category: category as string,
      requiresPreAuth: requiresPreAuth === 'true' ? true : requiresPreAuth === 'false' ? false : undefined,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
    });
    const pagination = calculatePagination(result.page, result.limit, result.total);
    sendPaginated(res, result.codes, pagination);
  })
);

// Search CPT codes (autocomplete)
router.get(
  '/cpt/search',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { q, limit } = req.query;
    const results = await cptService.search(
      req.user!.hospitalId,
      q as string,
      limit ? Number(limit) : 20
    );
    sendSuccess(res, results);
  })
);

// Get CPT categories
router.get(
  '/cpt/categories',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const categories = await cptService.getCategories(req.user!.hospitalId);
    sendSuccess(res, categories);
  })
);

// Get single CPT code
router.get(
  '/cpt/:id',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const code = await cptService.getById(req.params.id, req.user!.hospitalId);
    sendSuccess(res, code);
  })
);

// Get CPT codes related to an ICD-10 code
router.get(
  '/cpt/for-icd/:icdCodeId',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const codes = await cptService.getRelatedCPTCodes(req.user!.hospitalId, req.params.icdCodeId);
    sendSuccess(res, codes);
  })
);

// Check CPT bundling conflicts
router.post(
  '/cpt/check-bundling',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { cptCodes } = req.body;
    const conflicts = await cptService.checkBundlingConflicts(req.user!.hospitalId, cptCodes);
    sendSuccess(res, { hasConflicts: conflicts.length > 0, conflicts });
  })
);

// Get CPT usage stats
router.get(
  '/cpt/:id/stats',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { startDate, endDate } = req.query;
    const stats = await cptService.getUsageStats(
      req.user!.hospitalId,
      req.params.id,
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );
    sendSuccess(res, stats);
  })
);

// Create CPT code (admin only)
router.post(
  '/cpt',
  authenticate,
  authorize('HOSPITAL_ADMIN', 'ACCOUNTANT'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const code = await cptService.create(req.user!.hospitalId, req.body, req.user!.userId);
    sendCreated(res, code, 'CPT code created');
  })
);

// Bulk import CPT codes (admin only)
router.post(
  '/cpt/bulk',
  authenticate,
  authorize('HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { codes } = req.body;
    const result = await cptService.bulkImport(req.user!.hospitalId, codes, req.user!.userId);
    sendSuccess(res, result, `Imported ${result.created} codes, updated ${result.updated} codes`);
  })
);

// Update CPT code (admin only)
router.put(
  '/cpt/:id',
  authenticate,
  authorize('HOSPITAL_ADMIN', 'ACCOUNTANT'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const code = await cptService.update(req.params.id, req.user!.hospitalId, req.body);
    sendSuccess(res, code, 'CPT code updated');
  })
);

// Delete CPT code (soft delete, admin only)
router.delete(
  '/cpt/:id',
  authenticate,
  authorize('HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const code = await cptService.delete(req.params.id, req.user!.hospitalId);
    sendSuccess(res, code, 'CPT code deactivated');
  })
);

// ==================== CPT Modifiers ====================

// Get all CPT modifiers
router.get(
  '/modifiers',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const modifiers = await cptService.getModifiers(req.user!.hospitalId);
    sendSuccess(res, modifiers);
  })
);

// Create CPT modifier (admin only)
router.post(
  '/modifiers',
  authenticate,
  authorize('HOSPITAL_ADMIN', 'ACCOUNTANT'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const modifier = await cptService.createModifier(req.user!.hospitalId, req.body);
    sendCreated(res, modifier, 'CPT modifier created');
  })
);

// Bulk import CPT modifiers (admin only)
router.post(
  '/modifiers/bulk',
  authenticate,
  authorize('HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { modifiers } = req.body;
    const result = await cptService.bulkImportModifiers(req.user!.hospitalId, modifiers);
    sendSuccess(res, result, `Imported ${result.created} modifiers, updated ${result.updated} modifiers`);
  })
);

// Update CPT modifier (admin only)
router.put(
  '/modifiers/:id',
  authenticate,
  authorize('HOSPITAL_ADMIN', 'ACCOUNTANT'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const modifier = await cptService.updateModifier(req.params.id, req.user!.hospitalId, req.body);
    sendSuccess(res, modifier, 'CPT modifier updated');
  })
);

// Delete CPT modifier (admin only)
router.delete(
  '/modifiers/:id',
  authenticate,
  authorize('HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await cptService.deleteModifier(req.params.id, req.user!.hospitalId);
    sendSuccess(res, null, 'CPT modifier deleted');
  })
);

// ==================== Insurance Payers ====================

// Get all payers
router.get(
  '/payers',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit, search, regulator, isActive } = req.query;
    const result = await payerService.getAll(req.user!.hospitalId, {
      page: Number(page) || 1,
      limit: Number(limit) || 50,
      search: search as string,
      regulator: regulator as string,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
    const pagination = calculatePagination(result.page, result.limit, result.total);
    sendPaginated(res, result.payers, pagination);
  })
);

// Get distinct regulators
router.get(
  '/payers/regulators',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const regulators = await payerService.getRegulators(req.user!.hospitalId);
    sendSuccess(res, regulators);
  })
);

// Get single payer
router.get(
  '/payers/:id',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const payer = await payerService.getById(req.params.id, req.user!.hospitalId);
    sendSuccess(res, payer);
  })
);

// Create payer (admin only)
router.post(
  '/payers',
  authenticate,
  authorize('HOSPITAL_ADMIN', 'ACCOUNTANT'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const payer = await payerService.create(req.user!.hospitalId, req.body, req.user!.userId);
    sendCreated(res, payer, 'Insurance payer created');
  })
);

// Update payer (admin only)
router.put(
  '/payers/:id',
  authenticate,
  authorize('HOSPITAL_ADMIN', 'ACCOUNTANT'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const payer = await payerService.update(req.params.id, req.user!.hospitalId, req.body);
    sendSuccess(res, payer, 'Insurance payer updated');
  })
);

// Delete payer (soft delete, admin only)
router.delete(
  '/payers/:id',
  authenticate,
  authorize('HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const payer = await payerService.delete(req.params.id, req.user!.hospitalId);
    sendSuccess(res, payer, 'Insurance payer deactivated');
  })
);

// ==================== Payer ICD-10 Rules ====================

// Get ICD rules for a payer
router.get(
  '/payers/:payerId/icd-rules',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { search, isActive } = req.query;
    const rules = await payerRulesService.getICDRulesForPayer(req.params.payerId, {
      search: search as string,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
    sendSuccess(res, rules);
  })
);

// Get specific ICD rule
router.get(
  '/payers/:payerId/icd-rules/:icdCodeId',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const rule = await payerRulesService.getICDRule(req.params.payerId, req.params.icdCodeId);
    sendSuccess(res, rule);
  })
);

// Create ICD rule for a payer
router.post(
  '/payers/:payerId/icd-rules',
  authenticate,
  authorize('HOSPITAL_ADMIN', 'ACCOUNTANT'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const rule = await payerRulesService.createICDRule(req.params.payerId, req.body);
    sendCreated(res, rule, 'ICD-10 payer rule created');
  })
);

// Bulk import ICD rules for a payer
router.post(
  '/payers/:payerId/icd-rules/bulk',
  authenticate,
  authorize('HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { rules } = req.body;
    const result = await payerRulesService.bulkImportICDRules(req.params.payerId, rules);
    sendSuccess(res, result, `Imported ${result.created} rules, updated ${result.updated} rules`);
  })
);

// Update ICD rule
router.put(
  '/payers/:payerId/icd-rules/:ruleId',
  authenticate,
  authorize('HOSPITAL_ADMIN', 'ACCOUNTANT'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const rule = await payerRulesService.updateICDRule(req.params.ruleId, req.body);
    sendSuccess(res, rule, 'ICD-10 payer rule updated');
  })
);

// Delete ICD rule
router.delete(
  '/payers/:payerId/icd-rules/:ruleId',
  authenticate,
  authorize('HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await payerRulesService.deleteICDRule(req.params.ruleId);
    sendSuccess(res, null, 'ICD-10 payer rule deleted');
  })
);

// ==================== Payer CPT Rules ====================

// Get CPT rules for a payer
router.get(
  '/payers/:payerId/cpt-rules',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { search, isActive } = req.query;
    const rules = await payerRulesService.getCPTRulesForPayer(req.params.payerId, {
      search: search as string,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
    sendSuccess(res, rules);
  })
);

// Get specific CPT rule
router.get(
  '/payers/:payerId/cpt-rules/:cptCodeId',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const rule = await payerRulesService.getCPTRule(req.params.payerId, req.params.cptCodeId);
    sendSuccess(res, rule);
  })
);

// Create CPT rule for a payer
router.post(
  '/payers/:payerId/cpt-rules',
  authenticate,
  authorize('HOSPITAL_ADMIN', 'ACCOUNTANT'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const rule = await payerRulesService.createCPTRule(req.params.payerId, req.body);
    sendCreated(res, rule, 'CPT payer rule created');
  })
);

// Bulk import CPT rules for a payer
router.post(
  '/payers/:payerId/cpt-rules/bulk',
  authenticate,
  authorize('HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { rules } = req.body;
    const result = await payerRulesService.bulkImportCPTRules(req.params.payerId, rules);
    sendSuccess(res, result, `Imported ${result.created} rules, updated ${result.updated} rules`);
  })
);

// Update CPT rule
router.put(
  '/payers/:payerId/cpt-rules/:ruleId',
  authenticate,
  authorize('HOSPITAL_ADMIN', 'ACCOUNTANT'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const rule = await payerRulesService.updateCPTRule(req.params.ruleId, req.body);
    sendSuccess(res, rule, 'CPT payer rule updated');
  })
);

// Delete CPT rule
router.delete(
  '/payers/:payerId/cpt-rules/:ruleId',
  authenticate,
  authorize('HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await payerRulesService.deleteCPTRule(req.params.ruleId);
    sendSuccess(res, null, 'CPT payer rule deleted');
  })
);

// ==================== Coverage Checks ====================

// Check ICD coverage for a payer
router.post(
  '/check-icd-coverage',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { payerId, icdCode, patientAge, patientGender } = req.body;
    const coverage = await payerRulesService.checkICDCoverage(payerId, icdCode, patientAge, patientGender);
    sendSuccess(res, coverage);
  })
);

// Check CPT coverage for a payer
router.post(
  '/check-cpt-coverage',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { payerId, cptCode, patientAge, patientGender, placeOfService } = req.body;
    const coverage = await payerRulesService.checkCPTCoverage(
      payerId,
      cptCode,
      patientAge,
      patientGender,
      placeOfService
    );
    sendSuccess(res, coverage);
  })
);

// ==================== Medical Necessity (ICD-CPT Mappings) ====================

// Get all ICD-CPT mappings
router.get(
  '/icd-cpt-mappings',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit, search, icd10CodeId, cptCodeId, isRequired, isCommon, isActive } = req.query;
    const result = await medicalNecessityService.getMappings(req.user!.hospitalId, {
      page: Number(page) || 1,
      limit: Number(limit) || 50,
      search: search as string,
      icd10CodeId: icd10CodeId as string,
      cptCodeId: cptCodeId as string,
      isRequired: isRequired === 'true' ? true : isRequired === 'false' ? false : undefined,
      isCommon: isCommon === 'true' ? true : isCommon === 'false' ? false : undefined,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
    const pagination = calculatePagination(result.page, result.limit, result.total);
    sendPaginated(res, result.mappings, pagination);
  })
);

// Get valid CPT codes for an ICD-10 code
router.get(
  '/icd-cpt-mappings/for-icd/:icdCodeId',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const mappings = await medicalNecessityService.getValidCPTsForICD(
      req.user!.hospitalId,
      req.params.icdCodeId
    );
    sendSuccess(res, mappings);
  })
);

// Get valid ICD-10 codes for a CPT code (reverse lookup)
router.get(
  '/icd-cpt-mappings/for-cpt/:cptCodeId',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const mappings = await medicalNecessityService.getValidICDsForCPT(
      req.user!.hospitalId,
      req.params.cptCodeId
    );
    sendSuccess(res, mappings);
  })
);

// Create ICD-CPT mapping
router.post(
  '/icd-cpt-mappings',
  authenticate,
  authorize('HOSPITAL_ADMIN', 'ACCOUNTANT'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const mapping = await medicalNecessityService.createMapping(
      req.user!.hospitalId,
      req.body,
      req.user!.userId
    );
    sendCreated(res, mapping, 'ICD-CPT mapping created');
  })
);

// Bulk import ICD-CPT mappings
router.post(
  '/icd-cpt-mappings/bulk',
  authenticate,
  authorize('HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { mappings } = req.body;
    const result = await medicalNecessityService.bulkImport(
      req.user!.hospitalId,
      mappings,
      req.user!.userId
    );
    sendSuccess(res, result, `Imported ${result.created} mappings, updated ${result.updated} mappings`);
  })
);

// Update ICD-CPT mapping
router.put(
  '/icd-cpt-mappings/:id',
  authenticate,
  authorize('HOSPITAL_ADMIN', 'ACCOUNTANT'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const mapping = await medicalNecessityService.updateMapping(
      req.params.id,
      req.user!.hospitalId,
      req.body
    );
    sendSuccess(res, mapping, 'ICD-CPT mapping updated');
  })
);

// Delete ICD-CPT mapping
router.delete(
  '/icd-cpt-mappings/:id',
  authenticate,
  authorize('HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await medicalNecessityService.deleteMapping(req.params.id, req.user!.hospitalId);
    sendSuccess(res, null, 'ICD-CPT mapping deleted');
  })
);

// Validate ICD-CPT pair
router.post(
  '/validate-pair',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { icd10Code, cptCode } = req.body;
    const result = await medicalNecessityService.validatePair(
      req.user!.hospitalId,
      icd10Code,
      cptCode
    );
    sendSuccess(res, result);
  })
);

// Get required CPTs for a set of ICD codes
router.post(
  '/required-cpts',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { icd10CodeIds } = req.body;
    const required = await medicalNecessityService.getRequiredCPTsForICDs(
      req.user!.hospitalId,
      icd10CodeIds
    );
    sendSuccess(res, required);
  })
);

// Suggest CPT codes based on diagnoses
router.post(
  '/suggest-cpts',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { icdCodes } = req.body;
    const suggestions = await medicalNecessityService.suggestCPTsForDiagnoses(
      req.user!.hospitalId,
      icdCodes
    );
    sendSuccess(res, suggestions);
  })
);

// ==================== AI Service Proxy Routes ====================

// AI: Suggest codes from clinical text
router.post(
  '/ai/suggest',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { clinicalText, patientContext, encounterType, payerId } = req.body;

      const response = await axios.post(`${AI_SERVICE_URL}/api/insurance-coding/suggest`, {
        clinicalText,
        patientContext,
        encounterType,
        payerId,
      }, {
        timeout: 60000, // 60 second timeout for AI operations
      });

      sendSuccess(res, response.data, 'Code suggestions generated');
    } catch (error: any) {
      logger.error('AI code suggestion error:', error.response?.data || error.message);
      if (error.response) {
        return res.status(error.response.status).json({
          success: false,
          error: error.response.data?.detail || 'AI service error',
        });
      }
      throw error;
    }
  })
);

// AI: Validate code combinations
router.post(
  '/ai/validate',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { icdCodes, cptCodes, payerId } = req.body;

      const response = await axios.post(`${AI_SERVICE_URL}/api/insurance-coding/validate`, {
        icdCodes,
        cptCodes,
        payerId,
      }, {
        timeout: 30000,
      });

      sendSuccess(res, response.data, 'Code validation complete');
    } catch (error: any) {
      logger.error('AI code validation error:', error.response?.data || error.message);
      if (error.response) {
        return res.status(error.response.status).json({
          success: false,
          error: error.response.data?.detail || 'AI service error',
        });
      }
      throw error;
    }
  })
);

// AI: Predict claim acceptance
router.post(
  '/ai/predict-acceptance',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { icdCodes, cptCodes, payerId, documentationScore, patientContext } = req.body;

      const response = await axios.post(`${AI_SERVICE_URL}/api/insurance-coding/predict-acceptance`, {
        icdCodes,
        cptCodes,
        payerId,
        documentationScore,
        patientContext,
      }, {
        timeout: 30000,
      });

      sendSuccess(res, response.data, 'Acceptance prediction complete');
    } catch (error: any) {
      logger.error('AI acceptance prediction error:', error.response?.data || error.message);
      if (error.response) {
        return res.status(error.response.status).json({
          success: false,
          error: error.response.data?.detail || 'AI service error',
        });
      }
      throw error;
    }
  })
);

// AI: Extract diagnoses from clinical text
router.post(
  '/ai/extract-diagnoses',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { clinicalText, extractConditions, extractProcedures } = req.body;

      const response = await axios.post(`${AI_SERVICE_URL}/api/insurance-coding/extract-diagnoses`, {
        clinicalText,
        extractConditions,
        extractProcedures,
      }, {
        timeout: 60000,
      });

      sendSuccess(res, response.data, 'Diagnoses extracted');
    } catch (error: any) {
      logger.error('AI diagnosis extraction error:', error.response?.data || error.message);
      if (error.response) {
        return res.status(error.response.status).json({
          success: false,
          error: error.response.data?.detail || 'AI service error',
        });
      }
      throw error;
    }
  })
);

// AI: Check medical necessity
router.post(
  '/ai/check-necessity',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { icdCodes, cptCodes } = req.body;

      const response = await axios.post(`${AI_SERVICE_URL}/api/insurance-coding/check-necessity`, {
        icdCodes,
        cptCodes,
      }, {
        timeout: 30000,
      });

      sendSuccess(res, response.data, 'Medical necessity check complete');
    } catch (error: any) {
      logger.error('AI medical necessity check error:', error.response?.data || error.message);
      if (error.response) {
        return res.status(error.response.status).json({
          success: false,
          error: error.response.data?.detail || 'AI service error',
        });
      }
      throw error;
    }
  })
);

// AI: Get service status
router.get(
  '/ai/status',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const response = await axios.get(`${AI_SERVICE_URL}/api/insurance-coding/status`, {
        timeout: 5000,
      });

      sendSuccess(res, response.data, 'AI service status');
    } catch (error: any) {
      logger.error('AI status check error:', error.response?.data || error.message);
      sendSuccess(res, {
        service: 'insurance_coding',
        status: 'unavailable',
        error: error.message,
      }, 'AI service unavailable');
    }
  })
);

// ==================== OPD Consultation Coding ====================

// Get consultation coding details
router.get(
  '/consultation/:consultationId/codes',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const coding = await consultationCodingService.getCodingDetails(req.params.consultationId);
    sendSuccess(res, coding);
  })
);

// Get consultation coding summary
router.get(
  '/consultation/:consultationId/summary',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const summary = await consultationCodingService.getCodingSummary(req.params.consultationId);
    sendSuccess(res, summary);
  })
);

// Get consultation diagnoses
router.get(
  '/consultation/:consultationId/diagnoses',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const diagnoses = await consultationCodingService.getDiagnoses(req.params.consultationId);
    sendSuccess(res, diagnoses);
  })
);

// Add diagnosis to consultation
router.post(
  '/consultation/:consultationId/diagnoses',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const diagnosis = await consultationCodingService.addDiagnosis(
      req.params.consultationId,
      req.body,
      req.user?.userId
    );
    sendCreated(res, diagnosis, 'Diagnosis added');
  })
);

// Add multiple diagnoses to consultation
router.post(
  '/consultation/:consultationId/diagnoses/bulk',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { diagnoses } = req.body;
    const results = await consultationCodingService.addDiagnoses(
      req.params.consultationId,
      diagnoses,
      req.user?.userId
    );
    sendSuccess(res, results, 'Diagnoses processed');
  })
);

// Update diagnosis
router.put(
  '/consultation/diagnoses/:diagnosisId',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const diagnosis = await consultationCodingService.updateDiagnosis(
      req.params.diagnosisId,
      req.body
    );
    sendSuccess(res, diagnosis, 'Diagnosis updated');
  })
);

// Remove diagnosis
router.delete(
  '/consultation/diagnoses/:diagnosisId',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await consultationCodingService.removeDiagnosis(req.params.diagnosisId);
    sendSuccess(res, { deleted: true }, 'Diagnosis removed');
  })
);

// Get consultation procedures
router.get(
  '/consultation/:consultationId/procedures',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const procedures = await consultationCodingService.getProcedures(req.params.consultationId);
    sendSuccess(res, procedures);
  })
);

// Add procedure to consultation
router.post(
  '/consultation/:consultationId/procedures',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const procedure = await consultationCodingService.addProcedure(
      req.params.consultationId,
      req.body,
      req.user?.userId
    );
    sendCreated(res, procedure, 'Procedure added');
  })
);

// Add multiple procedures to consultation
router.post(
  '/consultation/:consultationId/procedures/bulk',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { procedures } = req.body;
    const results = await consultationCodingService.addProcedures(
      req.params.consultationId,
      procedures,
      req.user?.userId
    );
    sendSuccess(res, results, 'Procedures processed');
  })
);

// Update procedure
router.put(
  '/consultation/procedures/:procedureId',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const procedure = await consultationCodingService.updateProcedure(
      req.params.procedureId,
      req.body
    );
    sendSuccess(res, procedure, 'Procedure updated');
  })
);

// Remove procedure
router.delete(
  '/consultation/procedures/:procedureId',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await consultationCodingService.removeProcedure(req.params.procedureId);
    sendSuccess(res, { deleted: true }, 'Procedure removed');
  })
);

// Finalize consultation coding
router.post(
  '/consultation/:consultationId/finalize',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { generateInvoice } = req.body;
    const result = await consultationCodingService.finalizeCoding(
      req.params.consultationId,
      { generateInvoice }
    );
    sendSuccess(res, result, 'Coding finalized');
  })
);

// ==================== IPD Discharge Coding ====================

// Get or create discharge coding for admission
router.get(
  '/admission/:admissionId/discharge-coding',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const coding = await dischargeCodingService.getOrCreateDischargeCoding(req.params.admissionId);
    sendSuccess(res, coding);
  })
);

// Get discharge coding summary
router.get(
  '/discharge-coding/:codingId/summary',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const summary = await dischargeCodingService.getCodingSummary(req.params.codingId);
    sendSuccess(res, summary);
  })
);

// Add diagnosis to discharge coding
router.post(
  '/discharge-coding/:codingId/diagnoses',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const diagnosis = await dischargeCodingService.addDiagnosis(
      req.params.codingId,
      req.body,
      req.user?.userId
    );
    sendCreated(res, diagnosis, 'Diagnosis added');
  })
);

// Add multiple diagnoses to discharge coding
router.post(
  '/discharge-coding/:codingId/diagnoses/bulk',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { diagnoses } = req.body;
    const results = await dischargeCodingService.addDiagnoses(
      req.params.codingId,
      diagnoses,
      req.user?.userId
    );
    sendSuccess(res, results, 'Diagnoses processed');
  })
);

// Update discharge diagnosis
router.put(
  '/discharge-coding/diagnoses/:diagnosisId',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const diagnosis = await dischargeCodingService.updateDiagnosis(
      req.params.diagnosisId,
      req.body
    );
    sendSuccess(res, diagnosis, 'Diagnosis updated');
  })
);

// Remove discharge diagnosis
router.delete(
  '/discharge-coding/diagnoses/:diagnosisId',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await dischargeCodingService.removeDiagnosis(req.params.diagnosisId);
    sendSuccess(res, { deleted: true }, 'Diagnosis removed');
  })
);

// Add procedure to discharge coding
router.post(
  '/discharge-coding/:codingId/procedures',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const procedure = await dischargeCodingService.addProcedure(
      req.params.codingId,
      req.body,
      req.user?.userId
    );
    sendCreated(res, procedure, 'Procedure added');
  })
);

// Add multiple procedures to discharge coding
router.post(
  '/discharge-coding/:codingId/procedures/bulk',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { procedures } = req.body;
    const results = await dischargeCodingService.addProcedures(
      req.params.codingId,
      procedures,
      req.user?.userId
    );
    sendSuccess(res, results, 'Procedures processed');
  })
);

// Update discharge procedure
router.put(
  '/discharge-coding/procedures/:procedureId',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const procedure = await dischargeCodingService.updateProcedure(
      req.params.procedureId,
      req.body
    );
    sendSuccess(res, procedure, 'Procedure updated');
  })
);

// Remove discharge procedure
router.delete(
  '/discharge-coding/procedures/:procedureId',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await dischargeCodingService.removeProcedure(req.params.procedureId);
    sendSuccess(res, { deleted: true }, 'Procedure removed');
  })
);

// Update discharge coding status
router.put(
  '/discharge-coding/:codingId/status',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { status } = req.body;
    const coding = await dischargeCodingService.updateStatus(
      req.params.codingId,
      status as DischargeCodingStatus,
      req.user?.userId
    );
    sendSuccess(res, coding, 'Status updated');
  })
);

// Finalize discharge coding
router.post(
  '/discharge-coding/:codingId/finalize',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await dischargeCodingService.finalizeCoding(
      req.params.codingId,
      req.user?.userId
    );
    sendSuccess(res, result, 'Coding finalized');
  })
);

// Generate claim from discharge coding
router.post(
  '/discharge-coding/:codingId/generate-claim',
  authenticate,
  authorize('DOCTOR', 'ACCOUNTANT', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await dischargeCodingService.generateClaim(req.params.codingId);
    sendSuccess(res, result, 'Claim generated');
  })
);

// Update acceptance prediction
router.put(
  '/discharge-coding/:codingId/acceptance-prediction',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { prediction } = req.body;
    await dischargeCodingService.updateAcceptancePrediction(req.params.codingId, prediction);
    sendSuccess(res, { updated: true }, 'Acceptance prediction updated');
  })
);

// Get discharge codings for hospital
router.get(
  '/discharge-codings',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'ACCOUNTANT', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { status, fromDate, toDate, limit, offset } = req.query;

    const result = await dischargeCodingService.getDischargeCodingsForHospital(
      req.user!.hospitalId,
      {
        status: status as DischargeCodingStatus | undefined,
        fromDate: fromDate ? new Date(fromDate as string) : undefined,
        toDate: toDate ? new Date(toDate as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      }
    );

    sendSuccess(res, result);
  })
);

// ==================== Analytics ====================

// Helper to parse date range from query params
const parseDateRange = (startDate?: string, endDate?: string) => {
  if (startDate && endDate) {
    return {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    };
  }
  return undefined;
};

// Get dashboard metrics
router.get(
  '/analytics/dashboard',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'ACCOUNTANT', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { startDate, endDate } = req.query;
    const dateRange = parseDateRange(startDate as string, endDate as string);
    const metrics = await codingAnalyticsService.getDashboardMetrics(
      req.user!.hospitalId,
      dateRange
    );
    sendSuccess(res, metrics);
  })
);

// Get ICD-10 code usage distribution
router.get(
  '/analytics/icd-usage',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'ACCOUNTANT', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { startDate, endDate, limit } = req.query;
    const dateRange = parseDateRange(startDate as string, endDate as string);
    const usage = await codingAnalyticsService.getICD10Usage(
      req.user!.hospitalId,
      dateRange,
      limit ? Number(limit) : 20
    );
    sendSuccess(res, usage);
  })
);

// Get CPT code usage distribution
router.get(
  '/analytics/cpt-usage',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'ACCOUNTANT', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { startDate, endDate, limit } = req.query;
    const dateRange = parseDateRange(startDate as string, endDate as string);
    const usage = await codingAnalyticsService.getCPTUsage(
      req.user!.hospitalId,
      dateRange,
      limit ? Number(limit) : 20
    );
    sendSuccess(res, usage);
  })
);

// Get revenue by category
router.get(
  '/analytics/revenue',
  authenticate,
  authorize('ACCOUNTANT', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { startDate, endDate } = req.query;
    const dateRange = parseDateRange(startDate as string, endDate as string);
    const revenue = await codingAnalyticsService.getRevenueByCategory(
      req.user!.hospitalId,
      dateRange
    );
    sendSuccess(res, revenue);
  })
);

// Get AI adoption metrics
router.get(
  '/analytics/ai-adoption',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'ACCOUNTANT', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { startDate, endDate } = req.query;
    const dateRange = parseDateRange(startDate as string, endDate as string);
    const metrics = await codingAnalyticsService.getAIAdoptionMetrics(
      req.user!.hospitalId,
      dateRange
    );
    sendSuccess(res, metrics);
  })
);

// Get coding trends over time
router.get(
  '/analytics/trends',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'ACCOUNTANT', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { startDate, endDate, granularity } = req.query;

    // Default to last 30 days if no date range provided
    const defaultEndDate = new Date();
    const defaultStartDate = new Date();
    defaultStartDate.setDate(defaultStartDate.getDate() - 30);

    const dateRange = {
      startDate: startDate ? new Date(startDate as string) : defaultStartDate,
      endDate: endDate ? new Date(endDate as string) : defaultEndDate,
    };

    const trends = await codingAnalyticsService.getCodingTrends(
      req.user!.hospitalId,
      dateRange,
      (granularity as 'day' | 'week' | 'month') || 'day'
    );
    sendSuccess(res, trends);
  })
);

// Get top ICD-CPT code pairs
router.get(
  '/analytics/code-pairs',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'ACCOUNTANT', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { startDate, endDate, limit } = req.query;
    const dateRange = parseDateRange(startDate as string, endDate as string);
    const pairs = await codingAnalyticsService.getTopCodePairs(
      req.user!.hospitalId,
      dateRange,
      limit ? Number(limit) : 10
    );
    sendSuccess(res, pairs);
  })
);

// Get ICD code specificity analysis
router.get(
  '/analytics/specificity',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'ACCOUNTANT', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { startDate, endDate } = req.query;
    const dateRange = parseDateRange(startDate as string, endDate as string);
    const analysis = await codingAnalyticsService.getSpecificityAnalysis(
      req.user!.hospitalId,
      dateRange
    );
    sendSuccess(res, analysis);
  })
);

// Get discharge coding analytics
router.get(
  '/analytics/discharge',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'ACCOUNTANT', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { startDate, endDate } = req.query;
    const dateRange = parseDateRange(startDate as string, endDate as string);
    const analytics = await codingAnalyticsService.getDischargeCodingAnalytics(
      req.user!.hospitalId,
      dateRange
    );
    sendSuccess(res, analytics);
  })
);

// ==================== eClaimLink Preparation ====================

// Preview claim data for consultation (OPD)
router.get(
  '/eclaim/preview/consultation/:consultationId',
  authenticate,
  authorize('DOCTOR', 'ACCOUNTANT', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { claimData, validation } = await eclaimLinkService.previewClaim(
      'consultation',
      req.params.consultationId
    );
    sendSuccess(res, { claimData, validation });
  })
);

// Preview claim data for discharge coding (IPD)
router.get(
  '/eclaim/preview/discharge/:dischargeCodingId',
  authenticate,
  authorize('DOCTOR', 'ACCOUNTANT', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { claimData, validation } = await eclaimLinkService.previewClaim(
      'discharge',
      req.params.dischargeCodingId
    );
    sendSuccess(res, { claimData, validation });
  })
);

// Preview claim data for invoice
router.get(
  '/eclaim/preview/invoice/:invoiceId',
  authenticate,
  authorize('DOCTOR', 'ACCOUNTANT', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { claimData, validation } = await eclaimLinkService.previewClaim(
      'invoice',
      req.params.invoiceId
    );
    sendSuccess(res, { claimData, validation });
  })
);

// Generate claim XML for consultation (OPD)
router.post(
  '/eclaim/generate/consultation/:consultationId',
  authenticate,
  authorize('DOCTOR', 'ACCOUNTANT', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const xml = await eclaimLinkService.generateConsultationClaimXML(req.params.consultationId);
    res.set('Content-Type', 'application/xml');
    res.send(xml);
  })
);

// Generate claim XML for discharge coding (IPD)
router.post(
  '/eclaim/generate/discharge/:dischargeCodingId',
  authenticate,
  authorize('DOCTOR', 'ACCOUNTANT', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const xml = await eclaimLinkService.generateDischargeCodingClaimXML(req.params.dischargeCodingId);
    res.set('Content-Type', 'application/xml');
    res.send(xml);
  })
);

// Generate claim XML for invoice
router.post(
  '/eclaim/generate/invoice/:invoiceId',
  authenticate,
  authorize('DOCTOR', 'ACCOUNTANT', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const xml = await eclaimLinkService.generateInvoiceClaimXML(req.params.invoiceId);
    res.set('Content-Type', 'application/xml');
    res.send(xml);
  })
);

// Batch generate claims for multiple consultations
router.post(
  '/eclaim/generate/batch',
  authenticate,
  authorize('ACCOUNTANT', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { consultationIds } = req.body;
    if (!Array.isArray(consultationIds) || consultationIds.length === 0) {
      return res.status(400).json({ success: false, error: 'consultationIds array is required' });
    }
    if (consultationIds.length > 50) {
      return res.status(400).json({ success: false, error: 'Maximum 50 consultations per batch' });
    }
    const results = await eclaimLinkService.batchGenerateConsultationClaims(consultationIds);
    const successCount = results.filter((r) => r.success).length;
    sendSuccess(
      res,
      { results, summary: { total: consultationIds.length, success: successCount, failed: consultationIds.length - successCount } },
      `Generated ${successCount} of ${consultationIds.length} claims`
    );
  })
);

// Get pending consultations for claim generation
router.get(
  '/eclaim/pending',
  authenticate,
  authorize('DOCTOR', 'ACCOUNTANT', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { fromDate, toDate, limit } = req.query;
    const consultations = await eclaimLinkService.getPendingConsultationsForClaims(
      req.user!.hospitalId,
      {
        fromDate: fromDate ? new Date(fromDate as string) : undefined,
        toDate: toDate ? new Date(toDate as string) : undefined,
        limit: limit ? parseInt(limit as string) : 50,
      }
    );
    sendSuccess(res, consultations);
  })
);

export default router;
