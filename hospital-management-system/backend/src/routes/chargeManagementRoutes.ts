import { Router, Response } from 'express';
import { chargeManagementService } from '../services/chargeManagementService';
import { authenticate, authorizeWithPermission } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated, sendPaginated, calculatePagination } from '../utils/response';
import { AuthenticatedRequest } from '../types';

const router = Router();

// ==================== Charge Master ====================

// List all charges with filters
router.get(
  '/charge-master',
  authenticate,
  authorizeWithPermission('billing:read', ['ACCOUNTANT', 'HOSPITAL_ADMIN', 'RECEPTIONIST', 'DOCTOR']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit, category, isActive, search } = req.query;
    const result = await chargeManagementService.listCharges(req.user!.hospitalId, {
      page: Number(page) || 1,
      limit: Number(limit) || 50,
      category: category as string,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      search: search as string,
    });
    const pagination = calculatePagination(result.page, result.limit, result.total);
    sendPaginated(res, result.charges, pagination);
  })
);

// Get charge by ID
router.get(
  '/charge-master/:id',
  authenticate,
  authorizeWithPermission('billing:read', ['ACCOUNTANT', 'HOSPITAL_ADMIN', 'RECEPTIONIST', 'DOCTOR']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const charge = await chargeManagementService.getChargeById(req.params.id, req.user!.hospitalId);
    sendSuccess(res, charge);
  })
);

// Create new charge
router.post(
  '/charge-master',
  authenticate,
  authorizeWithPermission('billing:write', ['ACCOUNTANT', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const charge = await chargeManagementService.createCharge(req.user!.hospitalId, {
      ...req.body,
      createdBy: req.user!.userId,
    });
    sendCreated(res, charge, 'Charge created successfully');
  })
);

// Update charge
router.put(
  '/charge-master/:id',
  authenticate,
  authorizeWithPermission('billing:write', ['ACCOUNTANT', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const charge = await chargeManagementService.updateCharge(
      req.params.id,
      req.user!.hospitalId,
      req.body
    );
    sendSuccess(res, charge, 'Charge updated successfully');
  })
);

// Deactivate charge
router.delete(
  '/charge-master/:id',
  authenticate,
  authorizeWithPermission('billing:write', ['ACCOUNTANT', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const charge = await chargeManagementService.deactivateCharge(req.params.id, req.user!.hospitalId);
    sendSuccess(res, charge, 'Charge deactivated successfully');
  })
);

// ==================== Fee Schedules ====================

// List all fee schedules
router.get(
  '/fee-schedules',
  authenticate,
  authorizeWithPermission('billing:read', ['ACCOUNTANT', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit, chargeId, payerId } = req.query;
    const result = await chargeManagementService.listFeeSchedules(req.user!.hospitalId, {
      page: Number(page) || 1,
      limit: Number(limit) || 50,
      chargeId: chargeId as string,
      payerId: payerId as string,
    });
    const pagination = calculatePagination(result.page, result.limit, result.total);
    sendPaginated(res, result.schedules, pagination);
  })
);

// Create fee schedule
router.post(
  '/fee-schedules',
  authenticate,
  authorizeWithPermission('billing:write', ['ACCOUNTANT', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const schedule = await chargeManagementService.createFeeSchedule(req.user!.hospitalId, {
      ...req.body,
      createdBy: req.user!.userId,
    });
    sendCreated(res, schedule, 'Fee schedule created successfully');
  })
);

// Update fee schedule
router.put(
  '/fee-schedules/:id',
  authenticate,
  authorizeWithPermission('billing:write', ['ACCOUNTANT', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const schedule = await chargeManagementService.updateFeeSchedule(
      req.params.id,
      req.user!.hospitalId,
      req.body
    );
    sendSuccess(res, schedule, 'Fee schedule updated successfully');
  })
);

// ==================== Utilities ====================

// Lookup price for a charge code (optionally for specific payer)
router.post(
  '/lookup-price',
  authenticate,
  authorizeWithPermission('billing:read', ['ACCOUNTANT', 'HOSPITAL_ADMIN', 'RECEPTIONIST', 'DOCTOR']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { chargeCode, payerId } = req.body;
    const priceInfo = await chargeManagementService.lookupPrice(
      req.user!.hospitalId,
      chargeCode,
      payerId
    );
    sendSuccess(res, priceInfo);
  })
);

// Get charge categories
router.get(
  '/categories',
  authenticate,
  authorizeWithPermission('billing:read', ['ACCOUNTANT', 'HOSPITAL_ADMIN', 'RECEPTIONIST', 'DOCTOR']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const categories = await chargeManagementService.getCategories(req.user!.hospitalId);
    sendSuccess(res, categories);
  })
);

// Seed hardcoded charges (migration helper)
router.post(
  '/seed-charges',
  authenticate,
  authorizeWithPermission('billing:write', ['HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await chargeManagementService.seedHardcodedCharges(
      req.user!.hospitalId,
      req.user!.userId
    );
    sendSuccess(res, result, 'Charge seeding completed');
  })
);

export default router;
