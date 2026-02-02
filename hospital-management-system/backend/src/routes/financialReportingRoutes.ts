import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { authenticate, authorizeWithPermission } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated, sendPaginated } from '../utils/response';
import { financialReportingService } from '../services/financialReportingService';
import { UserRole } from '@prisma/client';

const router = Router();

/**
 * @route   GET /api/v1/financial-reports/ar-aging
 * @desc    Get Accounts Receivable aging report
 * @access  ACCOUNTANT, HOSPITAL_ADMIN
 */
router.get(
  '/ar-aging',
  authenticate,
  authorizeWithPermission('financial-reports:read', [
    UserRole.ACCOUNTANT,
    UserRole.HOSPITAL_ADMIN,
  ]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { asOfDate } = req.query;
    const hospitalId = req.user!.hospitalId;

    const date = asOfDate ? new Date(asOfDate as string) : new Date();

    const report = await financialReportingService.getARAgingReport(hospitalId, date);

    sendSuccess(res, report, 'AR Aging report generated successfully');
  })
);

/**
 * @route   GET /api/v1/financial-reports/revenue/by-department
 * @desc    Get revenue breakdown by department
 * @access  ACCOUNTANT, HOSPITAL_ADMIN
 */
router.get(
  '/revenue/by-department',
  authenticate,
  authorizeWithPermission('financial-reports:read', [
    UserRole.ACCOUNTANT,
    UserRole.HOSPITAL_ADMIN,
  ]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { startDate, endDate } = req.query;
    const hospitalId = req.user!.hospitalId;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate are required',
      });
    }

    const report = await financialReportingService.getRevenueByDepartment(
      hospitalId,
      new Date(startDate as string),
      new Date(endDate as string)
    );

    sendSuccess(res, report, 'Revenue by department report generated successfully');
  })
);

/**
 * @route   GET /api/v1/financial-reports/revenue/by-doctor
 * @desc    Get revenue breakdown by doctor
 * @access  ACCOUNTANT, HOSPITAL_ADMIN
 */
router.get(
  '/revenue/by-doctor',
  authenticate,
  authorizeWithPermission('financial-reports:read', [
    UserRole.ACCOUNTANT,
    UserRole.HOSPITAL_ADMIN,
  ]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { startDate, endDate, limit } = req.query;
    const hospitalId = req.user!.hospitalId;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate are required',
      });
    }

    const report = await financialReportingService.getRevenueByDoctor(
      hospitalId,
      new Date(startDate as string),
      new Date(endDate as string),
      limit ? parseInt(limit as string) : 20
    );

    sendSuccess(res, report, 'Revenue by doctor report generated successfully');
  })
);

/**
 * @route   GET /api/v1/financial-reports/revenue/by-payer
 * @desc    Get revenue breakdown by payer (insurance vs self-pay)
 * @access  ACCOUNTANT, HOSPITAL_ADMIN
 */
router.get(
  '/revenue/by-payer',
  authenticate,
  authorizeWithPermission('financial-reports:read', [
    UserRole.ACCOUNTANT,
    UserRole.HOSPITAL_ADMIN,
  ]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { startDate, endDate } = req.query;
    const hospitalId = req.user!.hospitalId;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate are required',
      });
    }

    const report = await financialReportingService.getRevenueByPayer(
      hospitalId,
      new Date(startDate as string),
      new Date(endDate as string)
    );

    sendSuccess(res, report, 'Revenue by payer report generated successfully');
  })
);

/**
 * @route   GET /api/v1/financial-reports/collection-rate
 * @desc    Get collection rate analytics with trend
 * @access  ACCOUNTANT, HOSPITAL_ADMIN
 */
router.get(
  '/collection-rate',
  authenticate,
  authorizeWithPermission('financial-reports:read', [
    UserRole.ACCOUNTANT,
    UserRole.HOSPITAL_ADMIN,
  ]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { startDate, endDate, groupBy } = req.query;
    const hospitalId = req.user!.hospitalId;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate are required',
      });
    }

    const validGroupBy = ['day', 'week', 'month'];
    const groupByValue = (groupBy as string) || 'month';

    if (!validGroupBy.includes(groupByValue)) {
      return res.status(400).json({
        success: false,
        message: 'groupBy must be one of: day, week, month',
      });
    }

    const report = await financialReportingService.getCollectionRate(
      hospitalId,
      new Date(startDate as string),
      new Date(endDate as string),
      groupByValue as 'day' | 'week' | 'month'
    );

    sendSuccess(res, report, 'Collection rate report generated successfully');
  })
);

/**
 * @route   GET /api/v1/financial-reports/tax-summary
 * @desc    Get tax summary
 * @access  ACCOUNTANT, HOSPITAL_ADMIN
 */
router.get(
  '/tax-summary',
  authenticate,
  authorizeWithPermission('financial-reports:read', [
    UserRole.ACCOUNTANT,
    UserRole.HOSPITAL_ADMIN,
  ]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { startDate, endDate } = req.query;
    const hospitalId = req.user!.hospitalId;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate are required',
      });
    }

    const report = await financialReportingService.getTaxSummary(
      hospitalId,
      new Date(startDate as string),
      new Date(endDate as string)
    );

    sendSuccess(res, report, 'Tax summary generated successfully');
  })
);

/**
 * @route   GET /api/v1/financial-reports/write-offs/summary
 * @desc    Get write-off summary
 * @access  ACCOUNTANT, HOSPITAL_ADMIN
 */
router.get(
  '/write-offs/summary',
  authenticate,
  authorizeWithPermission('financial-reports:read', [
    UserRole.ACCOUNTANT,
    UserRole.HOSPITAL_ADMIN,
  ]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { startDate, endDate } = req.query;
    const hospitalId = req.user!.hospitalId;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate are required',
      });
    }

    const report = await financialReportingService.getWriteOffSummary(
      hospitalId,
      new Date(startDate as string),
      new Date(endDate as string)
    );

    sendSuccess(res, report, 'Write-off summary generated successfully');
  })
);

/**
 * @route   GET /api/v1/financial-reports/write-offs
 * @desc    Get write-offs list
 * @access  ACCOUNTANT, HOSPITAL_ADMIN
 */
router.get(
  '/write-offs',
  authenticate,
  authorizeWithPermission('financial-reports:read', [
    UserRole.ACCOUNTANT,
    UserRole.HOSPITAL_ADMIN,
  ]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit, status, startDate, endDate } = req.query;
    const hospitalId = req.user!.hospitalId;

    const params: any = {
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20,
    };

    if (status) params.status = status as string;
    if (startDate) params.startDate = new Date(startDate as string);
    if (endDate) params.endDate = new Date(endDate as string);

    const result = await financialReportingService.getWriteOffs(hospitalId, params);

    sendPaginated(res, result.data, result.pagination, 'Write-offs retrieved successfully');
  })
);

/**
 * @route   POST /api/v1/financial-reports/write-offs
 * @desc    Create a write-off request
 * @access  ACCOUNTANT, HOSPITAL_ADMIN
 */
router.post(
  '/write-offs',
  authenticate,
  authorizeWithPermission('financial-reports:write', [
    UserRole.ACCOUNTANT,
    UserRole.HOSPITAL_ADMIN,
  ]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user!.hospitalId;
    const { invoiceId, amount, reason, category, notes } = req.body;

    if (!invoiceId || !amount || !reason || !category) {
      return res.status(400).json({
        success: false,
        message: 'invoiceId, amount, reason, and category are required',
      });
    }

    const writeOff = await financialReportingService.createWriteOff(hospitalId, {
      invoiceId,
      amount: parseFloat(amount),
      reason,
      category,
      notes,
      requestedBy: req.user!.userId,
    });

    sendCreated(res, writeOff, 'Write-off request created successfully');
  })
);

/**
 * @route   PATCH /api/v1/financial-reports/write-offs/:id/approve
 * @desc    Approve a write-off
 * @access  HOSPITAL_ADMIN
 */
router.patch(
  '/write-offs/:id/approve',
  authenticate,
  authorizeWithPermission('financial-reports:approve', [UserRole.HOSPITAL_ADMIN]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { notes } = req.body;
    const hospitalId = req.user!.hospitalId;

    const writeOff = await financialReportingService.updateWriteOffStatus(
      id,
      hospitalId,
      'APPROVED',
      req.user!.userId,
      notes
    );

    sendSuccess(res, writeOff, 'Write-off approved successfully');
  })
);

/**
 * @route   PATCH /api/v1/financial-reports/write-offs/:id/reject
 * @desc    Reject a write-off
 * @access  HOSPITAL_ADMIN
 */
router.patch(
  '/write-offs/:id/reject',
  authenticate,
  authorizeWithPermission('financial-reports:approve', [UserRole.HOSPITAL_ADMIN]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { notes } = req.body;
    const hospitalId = req.user!.hospitalId;

    const writeOff = await financialReportingService.updateWriteOffStatus(
      id,
      hospitalId,
      'REJECTED',
      req.user!.userId,
      notes
    );

    sendSuccess(res, writeOff, 'Write-off rejected successfully');
  })
);

/**
 * @route   GET /api/v1/financial-reports/export
 * @desc    Export report data to CSV
 * @access  ACCOUNTANT, HOSPITAL_ADMIN
 */
router.get(
  '/export',
  authenticate,
  authorizeWithPermission('financial-reports:read', [
    UserRole.ACCOUNTANT,
    UserRole.HOSPITAL_ADMIN,
  ]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { reportType, startDate, endDate } = req.query;
    const hospitalId = req.user!.hospitalId;

    if (!reportType || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'reportType, startDate, and endDate are required',
      });
    }

    let data: any[] = [];
    let filename = 'report';

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    switch (reportType) {
      case 'ar-aging': {
        const report = await financialReportingService.getARAgingReport(hospitalId, end);
        data = report.details;
        filename = `ar-aging-${end.toISOString().split('T')[0]}`;
        break;
      }
      case 'revenue-department': {
        data = await financialReportingService.getRevenueByDepartment(hospitalId, start, end);
        filename = `revenue-by-department-${start.toISOString().split('T')[0]}-${end.toISOString().split('T')[0]}`;
        break;
      }
      case 'revenue-doctor': {
        data = await financialReportingService.getRevenueByDoctor(hospitalId, start, end);
        filename = `revenue-by-doctor-${start.toISOString().split('T')[0]}-${end.toISOString().split('T')[0]}`;
        break;
      }
      case 'revenue-payer': {
        data = await financialReportingService.getRevenueByPayer(hospitalId, start, end);
        filename = `revenue-by-payer-${start.toISOString().split('T')[0]}-${end.toISOString().split('T')[0]}`;
        break;
      }
      case 'collection-rate': {
        const report = await financialReportingService.getCollectionRate(hospitalId, start, end);
        data = report.trend;
        filename = `collection-rate-${start.toISOString().split('T')[0]}-${end.toISOString().split('T')[0]}`;
        break;
      }
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid report type',
        });
    }

    const csv = financialReportingService.exportToCSV(data, filename);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    res.send(csv);
  })
);

export default router;
