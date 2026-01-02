import { Router, Response } from 'express';
import { radiologyService } from '../services/radiologyService';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated, sendPaginated, calculatePagination } from '../utils/response';
import { AuthenticatedRequest } from '../types';

const router = Router();

// Get all imaging orders
router.get(
  '/orders',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit, status, modalityType, priority, patientId, startDate, endDate } = req.query;
    const result = await radiologyService.getImagingOrders(req.user!.hospitalId, {
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      status: status as string,
      modalityType: modalityType as string,
      priority: priority as string,
      patientId: patientId as string,
      startDate: startDate as string,
      endDate: endDate as string,
    });
    const pagination = calculatePagination(result.page, result.limit, result.total);
    sendPaginated(res, result.orders, pagination);
  })
);

// Create imaging order
router.post(
  '/orders',
  authenticate,
  authorize('DOCTOR', 'RADIOLOGIST', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const order = await radiologyService.createImagingOrder(req.user!.hospitalId, {
      ...req.body,
      orderedBy: req.user!.userId,
    });
    sendCreated(res, order, 'Imaging order created');
  })
);

// Get imaging order by ID
router.get(
  '/orders/:id',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const order = await radiologyService.getImagingOrderById(req.params.id, req.user!.hospitalId);
    sendSuccess(res, order);
  })
);

// Update order status
router.patch(
  '/orders/:id/status',
  authenticate,
  authorize('RADIOLOGIST', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const order = await radiologyService.updateOrderStatus(req.params.id, req.user!.hospitalId, req.body.status);
    sendSuccess(res, order, 'Status updated');
  })
);

// Schedule study
router.patch(
  '/orders/:id/schedule',
  authenticate,
  authorize('RADIOLOGIST', 'RECEPTIONIST', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const order = await radiologyService.scheduleStudy(
      req.params.id,
      req.user!.hospitalId,
      new Date(req.body.scheduledDate)
    );
    sendSuccess(res, order, 'Study scheduled');
  })
);

// Create study (after performing imaging)
router.post(
  '/orders/:orderId/study',
  authenticate,
  authorize('RADIOLOGIST'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const study = await radiologyService.createStudy(req.params.orderId, req.body);
    sendCreated(res, study, 'Study created');
  })
);

// Add report
router.post(
  '/studies/:studyId/report',
  authenticate,
  authorize('RADIOLOGIST'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const study = await radiologyService.addReport(req.params.studyId, {
      ...req.body,
      radiologistId: req.user!.userId,
    });
    sendSuccess(res, study, 'Report added');
  })
);

// Add AI analysis
router.post(
  '/orders/:orderId/ai-analysis',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const analysis = await radiologyService.addAIAnalysis(req.params.orderId, req.body);
    sendCreated(res, analysis, 'AI analysis added');
  })
);

// Review AI analysis
router.patch(
  '/ai-analysis/:analysisId/review',
  authenticate,
  authorize('RADIOLOGIST', 'DOCTOR'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const analysis = await radiologyService.reviewAIAnalysis(
      req.params.analysisId,
      req.user!.userId,
      req.body.feedback
    );
    sendSuccess(res, analysis, 'AI analysis reviewed');
  })
);

// Get worklist
router.get(
  '/worklist',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { modalityType } = req.query;
    const worklist = await radiologyService.getWorklist(req.user!.hospitalId, modalityType as string);
    sendSuccess(res, worklist);
  })
);

// Get pending reports
router.get(
  '/pending-reports',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const reports = await radiologyService.getPendingReports(req.user!.hospitalId);
    sendSuccess(res, reports);
  })
);

// Get radiology stats
router.get(
  '/stats',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const stats = await radiologyService.getRadiologyStats(req.user!.hospitalId);
    sendSuccess(res, stats);
  })
);

export default router;
