import { Router, Response } from 'express';
import { laboratoryService } from '../services/laboratoryService';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated, sendPaginated, calculatePagination } from '../utils/response';
import { AuthenticatedRequest } from '../types';

const router = Router();

// ==================== Lab Tests ====================

// Get all lab tests
router.get(
  '/tests',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { search, category, isActive } = req.query;
    const tests = await laboratoryService.getAllLabTests({
      search: search as string,
      category: category as string,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
    sendSuccess(res, tests);
  })
);

// Create lab test
router.post(
  '/tests',
  authenticate,
  authorize('HOSPITAL_ADMIN', 'LAB_TECHNICIAN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const test = await laboratoryService.createLabTest(req.body);
    sendCreated(res, test, 'Lab test created successfully');
  })
);

// Get lab test by ID
router.get(
  '/tests/:id',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const test = await laboratoryService.getLabTestById(req.params.id);
    sendSuccess(res, test);
  })
);

// Update lab test
router.put(
  '/tests/:id',
  authenticate,
  authorize('HOSPITAL_ADMIN', 'LAB_TECHNICIAN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const test = await laboratoryService.updateLabTest(req.params.id, req.body);
    sendSuccess(res, test, 'Lab test updated successfully');
  })
);

// ==================== Lab Orders ====================

// Get all lab orders
router.get(
  '/orders',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit, status, priority, patientId, startDate, endDate } = req.query;
    const result = await laboratoryService.getLabOrders(req.user!.hospitalId, {
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      status: status as string,
      priority: priority as string,
      patientId: patientId as string,
      startDate: startDate as string,
      endDate: endDate as string,
    });
    const pagination = calculatePagination(result.page, result.limit, result.total);
    sendPaginated(res, result.orders, pagination);
  })
);

// Create lab order
router.post(
  '/orders',
  authenticate,
  authorize('HOSPITAL_ADMIN', 'DOCTOR', 'NURSE', 'LAB_TECHNICIAN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const order = await laboratoryService.createLabOrder(req.user!.hospitalId, {
      ...req.body,
      orderedBy: req.user!.userId,
    });
    sendCreated(res, order, 'Lab order created successfully');
  })
);

// Get lab order by ID
router.get(
  '/orders/:id',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const order = await laboratoryService.getLabOrderById(req.params.id, req.user!.hospitalId);
    sendSuccess(res, order);
  })
);

// Update lab order status
router.patch(
  '/orders/:id/status',
  authenticate,
  authorize('HOSPITAL_ADMIN', 'LAB_TECHNICIAN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const order = await laboratoryService.updateLabOrderStatus(
      req.params.id,
      req.user!.hospitalId,
      req.body.status
    );
    sendSuccess(res, order, 'Order status updated');
  })
);

// Enter test result
router.post(
  '/results/:testId',
  authenticate,
  authorize('LAB_TECHNICIAN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await laboratoryService.enterTestResult(req.params.testId, {
      ...req.body,
      performedBy: req.user!.userId,
    });
    sendSuccess(res, result, 'Result entered successfully');
  })
);

// Verify test result
router.patch(
  '/results/:testId/verify',
  authenticate,
  authorize('LAB_TECHNICIAN', 'DOCTOR'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await laboratoryService.verifyTestResult(req.params.testId, req.user!.userId);
    sendSuccess(res, result, 'Result verified');
  })
);

// Get critical results
router.get(
  '/critical',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const results = await laboratoryService.getCriticalResults(req.user!.hospitalId);
    sendSuccess(res, results);
  })
);

// Get pending orders
router.get(
  '/pending',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const orders = await laboratoryService.getPendingOrders(req.user!.hospitalId);
    sendSuccess(res, orders);
  })
);

// Get lab stats
router.get(
  '/stats',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const stats = await laboratoryService.getLabStats(req.user!.hospitalId);
    sendSuccess(res, stats);
  })
);

// ==================== AI Smart Lab Features ====================

// Get AI-powered test recommendations
router.post(
  '/smart-order',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = laboratoryService.smartOrderRecommendation(req.body);
    sendSuccess(res, result);
  })
);

// Interpret lab result
router.post(
  '/interpret-result',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = laboratoryService.interpretResult(req.body);
    sendSuccess(res, result);
  })
);

export default router;
