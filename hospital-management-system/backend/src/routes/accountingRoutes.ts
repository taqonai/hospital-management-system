import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { authenticate, authorizeWithPermission } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated } from '../utils/response';
import { accountingService } from '../services/accountingService';
import { UserRole, AccountType, GLReferenceType } from '@prisma/client';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================================================
// Chart of Accounts
// ============================================================================

/**
 * @route   GET /api/v1/accounting/chart-of-accounts
 * @desc    List Chart of Accounts
 */
router.get(
  '/chart-of-accounts',
  authorizeWithPermission('billing:read', [
    UserRole.ACCOUNTANT,
    UserRole.HOSPITAL_ADMIN,
  ]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user!.hospitalId;
    const { accountType, isActive } = req.query;

    const accounts = await accountingService.listAccounts(hospitalId, {
      accountType: accountType as AccountType | undefined,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });

    sendSuccess(res, accounts, 'Chart of Accounts retrieved successfully');
  })
);

/**
 * @route   POST /api/v1/accounting/chart-of-accounts
 * @desc    Create a GL Account
 */
router.post(
  '/chart-of-accounts',
  authorizeWithPermission('billing:write', [
    UserRole.ACCOUNTANT,
    UserRole.HOSPITAL_ADMIN,
  ]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user!.hospitalId;
    const { accountCode, accountName, accountType, parentId, description } = req.body;

    const account = await accountingService.createAccount({
      hospitalId,
      accountCode,
      accountName,
      accountType,
      parentId,
      description,
    });

    sendCreated(res, account, 'GL Account created successfully');
  })
);

/**
 * @route   PUT /api/v1/accounting/chart-of-accounts/:id
 * @desc    Update a GL Account
 */
router.put(
  '/chart-of-accounts/:id',
  authorizeWithPermission('billing:write', [
    UserRole.ACCOUNTANT,
    UserRole.HOSPITAL_ADMIN,
  ]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user!.hospitalId;
    const { id } = req.params;
    const { accountName, description, isActive, parentId } = req.body;

    const account = await accountingService.updateAccount(id, hospitalId, {
      accountName,
      description,
      isActive,
      parentId,
    });

    sendSuccess(res, account, 'GL Account updated successfully');
  })
);

/**
 * @route   POST /api/v1/accounting/chart-of-accounts/seed
 * @desc    Seed default healthcare CoA
 */
router.post(
  '/chart-of-accounts/seed',
  authorizeWithPermission('billing:write', [
    UserRole.HOSPITAL_ADMIN,
  ]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user!.hospitalId;
    const result = await accountingService.seedDefaultCoA(hospitalId);
    sendCreated(res, result, 'Default Chart of Accounts seeded successfully');
  })
);

// ============================================================================
// GL Entries
// ============================================================================

/**
 * @route   GET /api/v1/accounting/gl-entries
 * @desc    Query GL entries with filters
 */
router.get(
  '/gl-entries',
  authorizeWithPermission('billing:read', [
    UserRole.ACCOUNTANT,
    UserRole.HOSPITAL_ADMIN,
  ]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user!.hospitalId;
    const { startDate, endDate, accountId, referenceType, costCenter, fiscalPeriodId, page, limit } = req.query;

    const result = await accountingService.queryGLEntries(hospitalId, {
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      accountId: accountId as string,
      referenceType: referenceType as GLReferenceType | undefined,
      costCenter: costCenter as string,
      fiscalPeriodId: fiscalPeriodId as string,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    sendSuccess(res, result, 'GL entries retrieved successfully');
  })
);

/**
 * @route   GET /api/v1/accounting/journal/:referenceId
 * @desc    Get journal entries for a transaction
 */
router.get(
  '/journal/:referenceId',
  authorizeWithPermission('billing:read', [
    UserRole.ACCOUNTANT,
    UserRole.HOSPITAL_ADMIN,
  ]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user!.hospitalId;
    const { referenceId } = req.params;

    const journal = await accountingService.getJournalByReference(hospitalId, referenceId);
    sendSuccess(res, journal, 'Journal entries retrieved successfully');
  })
);

/**
 * @route   POST /api/v1/accounting/gl-entries/reverse/:id
 * @desc    Reverse a GL entry (creates opposing entries)
 */
router.post(
  '/gl-entries/reverse/:id',
  authorizeWithPermission('billing:write', [
    UserRole.ACCOUNTANT,
    UserRole.HOSPITAL_ADMIN,
  ]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user!.hospitalId;
    const { id } = req.params;
    const { reason } = req.body;
    const createdBy = req.user!.userId;

    const reversals = await accountingService.reverseEntry(id, hospitalId, createdBy, reason);
    sendCreated(res, reversals, 'GL entry reversed successfully');
  })
);

// ============================================================================
// Trial Balance
// ============================================================================

/**
 * @route   GET /api/v1/accounting/trial-balance
 * @desc    Generate trial balance
 */
router.get(
  '/trial-balance',
  authorizeWithPermission('billing:read', [
    UserRole.ACCOUNTANT,
    UserRole.HOSPITAL_ADMIN,
  ]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user!.hospitalId;
    const { asOfDate, fiscalPeriodId } = req.query;

    const trialBalance = await accountingService.getTrialBalance(hospitalId, {
      asOfDate: asOfDate ? new Date(asOfDate as string) : undefined,
      fiscalPeriodId: fiscalPeriodId as string,
    });

    sendSuccess(res, trialBalance, 'Trial balance generated successfully');
  })
);

// ============================================================================
// Fiscal Periods
// ============================================================================

/**
 * @route   GET /api/v1/accounting/fiscal-periods
 * @desc    List fiscal periods
 */
router.get(
  '/fiscal-periods',
  authorizeWithPermission('billing:read', [
    UserRole.ACCOUNTANT,
    UserRole.HOSPITAL_ADMIN,
  ]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user!.hospitalId;
    const periods = await accountingService.listFiscalPeriods(hospitalId);
    sendSuccess(res, periods, 'Fiscal periods retrieved successfully');
  })
);

/**
 * @route   POST /api/v1/accounting/fiscal-periods
 * @desc    Create a fiscal period
 */
router.post(
  '/fiscal-periods',
  authorizeWithPermission('billing:write', [
    UserRole.ACCOUNTANT,
    UserRole.HOSPITAL_ADMIN,
  ]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user!.hospitalId;
    const { name, startDate, endDate } = req.body;

    const period = await accountingService.createFiscalPeriod({
      hospitalId,
      name,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });

    sendCreated(res, period, 'Fiscal period created successfully');
  })
);

/**
 * @route   PUT /api/v1/accounting/fiscal-periods/:id/close
 * @desc    Close a fiscal period
 */
router.put(
  '/fiscal-periods/:id/close',
  authorizeWithPermission('billing:write', [
    UserRole.HOSPITAL_ADMIN,
  ]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user!.hospitalId;
    const { id } = req.params;
    const closedBy = req.user!.userId;

    const period = await accountingService.closeFiscalPeriod(id, hospitalId, closedBy);
    sendSuccess(res, period, 'Fiscal period closed successfully');
  })
);

export default router;
