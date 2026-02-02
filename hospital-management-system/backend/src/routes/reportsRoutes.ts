import { Router, Response } from 'express';
import { reportsService } from '../services/reportsService';
import { authenticate, authorize, authorizeWithPermission } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess } from '../utils/response';
import { AuthenticatedRequest } from '../types';

const router = Router();

// Helper to parse date range from query
const parseDateRange = (query: any) => {
  const from = query.from ? new Date(query.from) : new Date(new Date().setMonth(new Date().getMonth() - 1));
  const to = query.to ? new Date(query.to) : new Date();
  return { from, to };
};

// ==================== EXECUTIVE REPORTS ====================

// Get executive summary
router.get(
  '/executive-summary',
  authenticate,
  authorizeWithPermission('reports:view', ['HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const dateRange = parseDateRange(req.query);
    const summary = await reportsService.getExecutiveSummary(req.user!.hospitalId, dateRange);
    sendSuccess(res, summary);
  })
);

// Get comprehensive report
router.get(
  '/comprehensive',
  authenticate,
  authorizeWithPermission('reports:view', ['HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const dateRange = parseDateRange(req.query);
    const report = await reportsService.getComprehensiveReport(req.user!.hospitalId, dateRange);
    sendSuccess(res, report);
  })
);

// ==================== PATIENT ANALYTICS ====================

// Get patient demographics
router.get(
  '/patients/demographics',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const demographics = await reportsService.getPatientDemographics(req.user!.hospitalId);
    sendSuccess(res, demographics);
  })
);

// Get patient visit trends
router.get(
  '/patients/trends',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const period = (req.query.period as 'daily' | 'weekly' | 'monthly') || 'monthly';
    const months = parseInt(req.query.months as string) || 6;
    const days = req.query.days ? parseInt(req.query.days as string) : undefined;
    const trends = await reportsService.getPatientVisitTrends(req.user!.hospitalId, period, months, days);
    // Wrap response for frontend compatibility
    sendSuccess(res, { trends });
  })
);

// ==================== FINANCIAL ANALYTICS ====================

// Get revenue analysis
router.get(
  '/financial/revenue',
  authenticate,
  authorizeWithPermission('reports:financial', ['HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const dateRange = parseDateRange(req.query);
    const analysis = await reportsService.getRevenueAnalysis(req.user!.hospitalId, dateRange);
    sendSuccess(res, analysis);
  })
);

// Get revenue trends
router.get(
  '/financial/trends',
  authenticate,
  authorizeWithPermission('reports:financial', ['HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const months = parseInt(req.query.months as string) || 12;
    const trends = await reportsService.getRevenueTrends(req.user!.hospitalId, months);
    // Wrap response for frontend compatibility
    sendSuccess(res, { trends });
  })
);

// ==================== OPERATIONAL ANALYTICS ====================

// Get department performance
router.get(
  '/operations/departments',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const dateRange = parseDateRange(req.query);
    const departments = await reportsService.getDepartmentPerformance(req.user!.hospitalId, dateRange);
    // Wrap response for frontend compatibility
    sendSuccess(res, { departments });
  })
);

// Get doctor productivity
router.get(
  '/operations/doctors',
  authenticate,
  authorizeWithPermission('reports:view', ['HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const dateRange = parseDateRange(req.query);
    const productivity = await reportsService.getDoctorProductivity(req.user!.hospitalId, dateRange);
    sendSuccess(res, productivity);
  })
);

// Get bed occupancy
router.get(
  '/operations/beds',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const occupancy = await reportsService.calculateBedOccupancy(req.user!.hospitalId);
    sendSuccess(res, occupancy);
  })
);

// ==================== CLINICAL ANALYTICS ====================

// Get diagnosis distribution
router.get(
  '/clinical/diagnoses',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const dateRange = parseDateRange(req.query);
    const distribution = await reportsService.getDiagnosisDistribution(req.user!.hospitalId, dateRange);
    sendSuccess(res, distribution);
  })
);

// Get prescription analytics
router.get(
  '/clinical/prescriptions',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const dateRange = parseDateRange(req.query);
    const analytics = await reportsService.getPrescriptionAnalytics(req.user!.hospitalId, dateRange);
    sendSuccess(res, analytics);
  })
);

// ==================== AI ANALYTICS ====================

// AI: Predict patient volume
router.post(
  '/ai/predict-volume',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const prediction = reportsService.predictPatientVolume(req.body);
    sendSuccess(res, prediction);
  })
);

// AI: Identify bottlenecks
router.post(
  '/ai/bottlenecks',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const analysis = reportsService.identifyBottlenecks(req.body);
    sendSuccess(res, analysis);
  })
);

// AI: Generate executive insights
router.post(
  '/ai/insights',
  authenticate,
  authorizeWithPermission('reports:view', ['HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const insights = reportsService.generateExecutiveInsights(req.body);
    sendSuccess(res, insights);
  })
);

export default router;
