import { Router, Response } from 'express';
import { bloodBankService } from '../services/bloodBankService';
import { authenticate, authorize, authorizeWithPermission } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated, sendPaginated, calculatePagination } from '../utils/response';
import { AuthenticatedRequest } from '../types';

const router = Router();

// ==================== DONOR MANAGEMENT ====================

// Register new donor
router.post(
  '/donors',
  authenticate,
  authorizeWithPermission('blood_bank:write', ['HOSPITAL_ADMIN', 'NURSE', 'LAB_TECHNICIAN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await bloodBankService.registerDonor(req.user!.hospitalId, req.body);
    sendCreated(res, result, 'Donor registered successfully');
  })
);

// Get all donors
router.get(
  '/donors',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await bloodBankService.getDonors(req.user!.hospitalId, req.query);
    const pagination = calculatePagination(result.page, result.limit, result.total);
    sendPaginated(res, result.donors, pagination);
  })
);

// Get donor by ID
router.get(
  '/donors/:id',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const donor = await bloodBankService.getDonorById(req.params.id);
    sendSuccess(res, donor);
  })
);

// Check donor eligibility (AI)
router.post(
  '/donors/check-eligibility',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const eligibility = bloodBankService.assessDonorEligibility(req.body);
    sendSuccess(res, eligibility);
  })
);

// ==================== DONATION MANAGEMENT ====================

// Record donation
router.post(
  '/donations',
  authenticate,
  authorizeWithPermission('blood_bank:donations', ['HOSPITAL_ADMIN', 'NURSE', 'LAB_TECHNICIAN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const donation = await bloodBankService.recordDonation(req.user!.hospitalId, req.body);
    sendCreated(res, donation, 'Donation recorded successfully');
  })
);

// Get donations
router.get(
  '/donations',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await bloodBankService.getDonations(req.user!.hospitalId, req.query);
    const pagination = calculatePagination(result.page, result.limit, result.total);
    sendPaginated(res, result.donations, pagination);
  })
);

// Update test results
router.patch(
  '/donations/:id/test-results',
  authenticate,
  authorizeWithPermission('blood_bank:donations', ['LAB_TECHNICIAN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const donation = await bloodBankService.updateTestResults(req.params.id, req.body);
    sendSuccess(res, donation, 'Test results updated');
  })
);

// ==================== BLOOD COMPONENTS ====================

// Process blood components
router.post(
  '/donations/:id/process',
  authenticate,
  authorizeWithPermission('blood_bank:donations', ['LAB_TECHNICIAN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const components = await bloodBankService.processBloodComponents(
      req.user!.hospitalId,
      req.params.id,
      req.body
    );
    sendCreated(res, components, 'Blood components processed');
  })
);

// Get inventory
router.get(
  '/inventory',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const inventory = await bloodBankService.getInventory(req.user!.hospitalId, req.query);
    sendSuccess(res, inventory);
  })
);

// ==================== BLOOD REQUESTS ====================

// Create blood request
router.post(
  '/requests',
  authenticate,
  authorizeWithPermission('blood_bank:requests', ['DOCTOR', 'NURSE', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await bloodBankService.createBloodRequest(req.user!.hospitalId, {
      ...req.body,
      requestedBy: req.user!.userId,
    });
    sendCreated(res, result, 'Blood request created');
  })
);

// Get blood requests
router.get(
  '/requests',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await bloodBankService.getBloodRequests(req.user!.hospitalId, req.query);
    const pagination = calculatePagination(result.page, result.limit, result.total);
    sendPaginated(res, result.requests, pagination);
  })
);

// Find compatible units (AI)
router.post(
  '/requests/:id/find-compatible',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { patientBloodGroup, patientRhFactor, componentType, unitsNeeded } = req.body;
    const compatibleUnits = await bloodBankService.findCompatibleUnits(
      req.user!.hospitalId,
      patientBloodGroup,
      patientRhFactor,
      componentType,
      unitsNeeded
    );
    sendSuccess(res, compatibleUnits);
  })
);

// Perform cross-match
router.post(
  '/requests/:requestId/crossmatch/:componentId',
  authenticate,
  authorizeWithPermission('blood_bank:requests', ['LAB_TECHNICIAN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await bloodBankService.performCrossMatch(
      req.params.requestId,
      req.params.componentId,
      { ...req.body, performedBy: req.user!.userId }
    );
    sendSuccess(res, result, 'Cross-match recorded');
  })
);

// Approve request
router.patch(
  '/requests/:id/approve',
  authenticate,
  authorizeWithPermission('blood_bank:requests', ['DOCTOR', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const request = await bloodBankService.approveRequest(req.params.id, req.user!.userId);
    sendSuccess(res, request, 'Request approved');
  })
);

// ==================== TRANSFUSION ====================

// Issue blood
router.post(
  '/requests/:requestId/issue/:componentId',
  authenticate,
  authorizeWithPermission('blood_bank:requests', ['LAB_TECHNICIAN', 'NURSE']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const transfusion = await bloodBankService.issueBlood(
      req.user!.hospitalId,
      req.params.requestId,
      req.params.componentId,
      { ...req.body, issuedBy: req.user!.userId }
    );
    sendCreated(res, transfusion, 'Blood issued');
  })
);

// Complete transfusion
router.patch(
  '/transfusions/:id/complete',
  authenticate,
  authorizeWithPermission('blood_bank:requests', ['NURSE', 'DOCTOR']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const transfusion = await bloodBankService.completeTransfusion(req.params.id, req.body);
    sendSuccess(res, transfusion, 'Transfusion completed');
  })
);

// Record transfusion reaction
router.post(
  '/transfusions/:id/reaction',
  authenticate,
  authorizeWithPermission('blood_bank:requests', ['NURSE', 'DOCTOR']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const transfusion = await bloodBankService.recordReaction(req.params.id, req.body);
    sendSuccess(res, transfusion, 'Reaction recorded');
  })
);

// ==================== AI FEATURES ====================

// Smart blood matching
router.post(
  '/ai/smart-match',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = bloodBankService.smartBloodMatch(req.body);
    sendSuccess(res, result);
  })
);

// Predict blood demand
router.post(
  '/ai/predict-demand',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = bloodBankService.predictBloodDemand(req.user!.hospitalId, req.body);
    sendSuccess(res, result);
  })
);

// Predict transfusion reaction risk
router.post(
  '/ai/predict-reaction',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = bloodBankService.predictTransfusionReaction(req.body);
    sendSuccess(res, result);
  })
);

// ==================== STATISTICS ====================

// Get blood bank stats
router.get(
  '/stats',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const stats = await bloodBankService.getBloodBankStats(req.user!.hospitalId);
    sendSuccess(res, stats);
  })
);

export default router;
