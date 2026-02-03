import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { authenticate, authorizeWithPermission } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated, sendPaginated } from '../utils/response';
import { financialReportingService } from '../services/financialReportingService';
import { generateXLSX, generateMultiSheetXLSX } from '../utils/excelExport';
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
 * @route   GET /api/v1/financial-reports/income-statement
 * @desc    Get Income Statement (Revenue vs Expenses from GL)
 * @access  ACCOUNTANT, HOSPITAL_ADMIN
 */
router.get(
  '/income-statement',
  authenticate,
  authorizeWithPermission('financial-reports:read', [
    UserRole.ACCOUNTANT,
    UserRole.HOSPITAL_ADMIN,
  ]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { startDate, endDate, format } = req.query;
    const hospitalId = req.user!.hospitalId;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate are required',
      });
    }

    const report = await financialReportingService.getIncomeStatement(
      hospitalId,
      new Date(startDate as string),
      new Date(endDate as string)
    );

    if (format === 'xlsx') {
      const xlsxData = [
        ...report.revenue.map((r) => ({ Section: 'Revenue', Account: r.accountCode, Name: r.accountName, Amount: r.amount })),
        { Section: '', Account: '', Name: 'Total Revenue', Amount: report.totalRevenue },
        ...report.expenses.map((e) => ({ Section: 'Expenses', Account: e.accountCode, Name: e.accountName, Amount: e.amount })),
        { Section: '', Account: '', Name: 'Total Expenses', Amount: report.totalExpenses },
        { Section: '', Account: '', Name: 'Net Income', Amount: report.netIncome },
      ];
      const buffer = generateXLSX(xlsxData, 'Income Statement');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="income-statement_${startDate}_${endDate}.xlsx"`);
      return res.send(buffer);
    }

    sendSuccess(res, report, 'Income Statement generated successfully');
  })
);

/**
 * @route   GET /api/v1/financial-reports/balance-sheet
 * @desc    Get Balance Sheet (Assets = Liabilities + Equity from GL)
 * @access  ACCOUNTANT, HOSPITAL_ADMIN
 */
router.get(
  '/balance-sheet',
  authenticate,
  authorizeWithPermission('financial-reports:read', [
    UserRole.ACCOUNTANT,
    UserRole.HOSPITAL_ADMIN,
  ]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { asOfDate, format } = req.query;
    const hospitalId = req.user!.hospitalId;

    const date = asOfDate ? new Date(asOfDate as string) : new Date();

    const report = await financialReportingService.getBalanceSheet(hospitalId, date);

    if (format === 'xlsx') {
      const xlsxData = [
        ...report.assets.map((a) => ({ Section: 'Assets', Account: a.accountCode, Name: a.accountName, Balance: a.balance })),
        { Section: '', Account: '', Name: 'Total Assets', Balance: report.totalAssets },
        ...report.liabilities.map((l) => ({ Section: 'Liabilities', Account: l.accountCode, Name: l.accountName, Balance: l.balance })),
        { Section: '', Account: '', Name: 'Total Liabilities', Balance: report.totalLiabilities },
        ...report.equity.map((e) => ({ Section: 'Equity', Account: e.accountCode, Name: e.accountName, Balance: e.balance })),
        { Section: '', Account: '', Name: 'Total Equity', Balance: report.totalEquity },
        { Section: '', Account: '', Name: 'Balanced', Balance: report.isBalanced ? 'YES' : 'NO' },
      ];
      const buffer = generateXLSX(xlsxData, 'Balance Sheet');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="balance-sheet_${date.toISOString().split('T')[0]}.xlsx"`);
      return res.send(buffer);
    }

    sendSuccess(res, report, 'Balance Sheet generated successfully');
  })
);

/**
 * @route   GET /api/v1/financial-reports/revenue/by-department-gl
 * @desc    Get revenue by department from GL (cost center based)
 * @access  ACCOUNTANT, HOSPITAL_ADMIN
 */
router.get(
  '/revenue/by-department-gl',
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

    const report = await financialReportingService.getRevenueByDepartmentGL(
      hospitalId,
      new Date(startDate as string),
      new Date(endDate as string)
    );

    sendSuccess(res, report, 'Revenue by department (GL) report generated successfully');
  })
);

/**
 * @route   GET /api/v1/financial-reports/ar-aging-detailed
 * @desc    Get detailed AR aging report (Patient vs Insurance)
 * @access  ACCOUNTANT, HOSPITAL_ADMIN
 */
router.get(
  '/ar-aging-detailed',
  authenticate,
  authorizeWithPermission('financial-reports:read', [
    UserRole.ACCOUNTANT,
    UserRole.HOSPITAL_ADMIN,
  ]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { asOfDate } = req.query;
    const hospitalId = req.user!.hospitalId;

    const date = asOfDate ? new Date(asOfDate as string) : new Date();

    const report = await financialReportingService.getARAgingReportDetailed(hospitalId, date);

    sendSuccess(res, report, 'Detailed AR Aging report generated successfully');
  })
);

/**
 * @route   GET /api/v1/financial-reports/claims/analytics
 * @desc    Get claim status analytics report
 * @access  ACCOUNTANT, HOSPITAL_ADMIN
 */
router.get(
  '/claims/analytics',
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

    const report = await financialReportingService.getClaimAnalytics(
      hospitalId,
      new Date(startDate as string),
      new Date(endDate as string)
    );

    sendSuccess(res, report, 'Claim analytics report generated successfully');
  })
);

/**
 * @route   GET /api/v1/financial-reports/export
 * @desc    Export report data to CSV or XLSX
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

    const format = (req.query.format as string) || 'csv';

    if (format === 'xlsx') {
      const buffer = generateXLSX(data, filename);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
      return res.send(buffer);
    }

    const csv = financialReportingService.exportToCSV(data, filename);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    res.send(csv);
  })
);

export default router;
