import { Router, Response } from 'express';
import multer from 'multer';
import { laboratoryService } from '../services/laboratoryService';
import { authenticate, authorize, authorizeWithPermission } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated, sendPaginated, calculatePagination } from '../utils/response';
import { AuthenticatedRequest } from '../types';

const router = Router();

// Configure multer for lab result file upload (PDF and images)
const uploadLabResult = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and image files (JPEG, PNG) are allowed'));
    }
  },
});

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
  authorizeWithPermission('lab:tests:manage', ['HOSPITAL_ADMIN', 'LAB_TECHNICIAN']),
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
  authorizeWithPermission('lab:tests:manage', ['HOSPITAL_ADMIN', 'LAB_TECHNICIAN']),
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
  authorizeWithPermission('lab:orders:write', ['HOSPITAL_ADMIN', 'DOCTOR', 'NURSE', 'LAB_TECHNICIAN']),
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
  authorizeWithPermission('lab:orders:write', ['HOSPITAL_ADMIN', 'LAB_TECHNICIAN']),
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
  authorizeWithPermission('lab:results:write', ['LAB_TECHNICIAN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await laboratoryService.enterTestResult(req.params.testId, {
      ...req.body,
      performedBy: req.user!.userId,
    });
    sendSuccess(res, result, 'Result entered successfully');
  })
);

// Upload and extract lab result from file
router.post(
  '/results/:testId/upload',
  authenticate,
  authorizeWithPermission('lab:results:write', ['LAB_TECHNICIAN']),
  uploadLabResult.single('file'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
      });
    }

    const result = await laboratoryService.uploadAndExtractLabResult(
      req.params.testId,
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      req.user!.userId,
      req.user!.hospitalId
    );

    sendSuccess(res, result, 'Lab result uploaded and extracted successfully');
  })
);

// Verify test result
router.patch(
  '/results/:testId/verify',
  authenticate,
  authorizeWithPermission('lab:results:verify', ['LAB_TECHNICIAN', 'DOCTOR']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await laboratoryService.verifyTestResult(req.params.testId, req.user!.userId);
    sendSuccess(res, result, 'Result verified');
  })
);

// Generate AI clinical context for test result
router.post(
  '/results/:testId/clinical-context',
  authenticate,
  authorize(['DOCTOR', 'NURSE', 'LAB_TECHNICIAN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const context = await laboratoryService.generateClinicalContext(req.params.testId);
    sendSuccess(res, context, 'Clinical context generated');
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

// Acknowledge critical result
router.post(
  '/critical/:testId/acknowledge',
  authenticate,
  authorizeWithPermission('lab:tests:manage', ['DOCTOR', 'PATHOLOGIST', 'LAB_TECHNICIAN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await laboratoryService.verifyTestResult(req.params.testId, req.user!.userId);
    sendSuccess(res, result, 'Critical result acknowledged successfully');
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

// ==================== Sample Tracking ====================

// Collect sample (phlebotomy)
router.post(
  '/samples/collect',
  authenticate,
  authorizeWithPermission('lab:orders:write', ['HOSPITAL_ADMIN', 'LAB_TECHNICIAN', 'NURSE']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await laboratoryService.collectSample(req.user!.hospitalId, {
      ...req.body,
      collectedBy: req.user!.userId,
      collectionTime: req.body.collectionTime || new Date()
    });
    sendCreated(res, result, 'Sample collected successfully');
  })
);

// Get pending samples (for lab dashboard)
router.get(
  '/samples/pending',
  authenticate,
  authorizeWithPermission('lab:orders:read', ['HOSPITAL_ADMIN', 'LAB_TECHNICIAN', 'NURSE']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const samples = await laboratoryService.getPendingSamples(req.user!.hospitalId);
    sendSuccess(res, samples);
  })
);

// Get cold chain samples
router.get(
  '/samples/cold-chain',
  authenticate,
  authorizeWithPermission('lab:orders:read', ['HOSPITAL_ADMIN', 'LAB_TECHNICIAN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const samples = await laboratoryService.getColdChainSamples(req.user!.hospitalId);
    sendSuccess(res, samples);
  })
);

// Get sample details by barcode
router.get(
  '/samples/:barcode',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const sample = await laboratoryService.getSampleByBarcode(req.params.barcode);
    sendSuccess(res, sample);
  })
);

// Get sample chain of custody history
router.get(
  '/samples/:barcode/history',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const history = await laboratoryService.getSampleHistory(req.params.barcode);
    sendSuccess(res, history);
  })
);

// Update sample status (chain of custody)
router.patch(
  '/samples/:barcode/status',
  authenticate,
  authorizeWithPermission('lab:orders:write', ['HOSPITAL_ADMIN', 'LAB_TECHNICIAN', 'NURSE']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const sample = await laboratoryService.updateSampleStatus(req.params.barcode, {
      ...req.body,
      handledBy: req.user!.userId
    });
    sendSuccess(res, sample, 'Sample status updated');
  })
);

// Verify sample (quality check)
router.post(
  '/samples/:barcode/verify',
  authenticate,
  authorizeWithPermission('lab:orders:write', ['HOSPITAL_ADMIN', 'LAB_TECHNICIAN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const sample = await laboratoryService.verifySample(req.params.barcode, {
      ...req.body,
      verifiedBy: req.user!.userId
    });
    sendSuccess(res, sample, req.body.isAcceptable ? 'Sample verified successfully' : 'Sample rejected');
  })
);

// Get samples by order ID
router.get(
  '/orders/:orderId/samples',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const samples = await laboratoryService.getOrderSamples(req.params.orderId, req.user!.hospitalId);
    sendSuccess(res, samples);
  })
);

export default router;
