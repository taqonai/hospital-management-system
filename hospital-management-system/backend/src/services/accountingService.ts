import prisma from '../config/database';
import { NotFoundError, AppError } from '../middleware/errorHandler';
import { Prisma, AccountType, GLReferenceType } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

interface CreateAccountInput {
  hospitalId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  parentId?: string;
  description?: string;
}

interface UpdateAccountInput {
  accountName?: string;
  description?: string;
  isActive?: boolean;
  parentId?: string | null;
}

interface JournalLineInput {
  glAccountId: string;
  debitAmount: number;
  creditAmount: number;
  description?: string;
  costCenter?: string;
}

interface CreateJournalEntryInput {
  hospitalId: string;
  transactionDate: Date;
  referenceType: GLReferenceType;
  referenceId: string;
  description: string;
  lines: JournalLineInput[];
  createdBy: string;
  fiscalPeriodId?: string;
}

interface TrialBalanceRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  totalDebits: number;
  totalCredits: number;
  balance: number;
}

interface TrialBalanceResult {
  asOfDate: Date;
  periodId?: string;
  rows: TrialBalanceRow[];
  totalDebits: number;
  totalCredits: number;
}

// Default healthcare Chart of Accounts
const DEFAULT_COA: Array<{ code: string; name: string; type: AccountType; description: string }> = [
  { code: '1000', name: 'Cash/Bank', type: 'ASSET', description: 'Cash and bank accounts' },
  { code: '1100', name: 'Accounts Receivable', type: 'ASSET', description: 'Patient and insurance receivables' },
  { code: '1200', name: 'Deposits Held', type: 'ASSET', description: 'Patient deposits held' },
  { code: '2000', name: 'Accounts Payable', type: 'LIABILITY', description: 'Vendor payables' },
  { code: '2100', name: 'Patient Deposits', type: 'LIABILITY', description: 'Patient deposit liabilities' },
  { code: '2200', name: 'Unearned Revenue', type: 'LIABILITY', description: 'Revenue not yet earned' },
  { code: '3000', name: 'Retained Earnings', type: 'EQUITY', description: 'Accumulated earnings' },
  { code: '4000', name: 'Patient Service Revenue', type: 'REVENUE', description: 'Revenue from patient services' },
  { code: '4100', name: 'Laboratory Revenue', type: 'REVENUE', description: 'Revenue from laboratory services' },
  { code: '4200', name: 'Pharmacy Revenue', type: 'REVENUE', description: 'Revenue from pharmacy sales' },
  { code: '4300', name: 'Imaging Revenue', type: 'REVENUE', description: 'Revenue from imaging services' },
  { code: '4400', name: 'Insurance Revenue', type: 'REVENUE', description: 'Revenue from insurance claims' },
  { code: '5000', name: 'Cost of Services', type: 'EXPENSE', description: 'Direct cost of services provided' },
  { code: '5100', name: 'Bad Debt Expense', type: 'EXPENSE', description: 'Uncollectible receivables' },
];

// ============================================================================
// Service
// ============================================================================

class AccountingService {
  // --------------------------------------------------------------------------
  // Chart of Accounts
  // --------------------------------------------------------------------------

  async listAccounts(hospitalId: string, filters?: { accountType?: AccountType; isActive?: boolean }) {
    const where: Prisma.GLAccountWhereInput = { hospitalId };
    if (filters?.accountType) where.accountType = filters.accountType;
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;

    return prisma.gLAccount.findMany({
      where,
      include: { children: true },
      orderBy: { accountCode: 'asc' },
    });
  }

  async getAccount(id: string, hospitalId: string) {
    const account = await prisma.gLAccount.findFirst({
      where: { id, hospitalId },
      include: { children: true, parent: true },
    });
    if (!account) throw new NotFoundError('GL Account not found');
    return account;
  }

  async createAccount(input: CreateAccountInput) {
    // Check for duplicate code
    const existing = await prisma.gLAccount.findFirst({
      where: { hospitalId: input.hospitalId, accountCode: input.accountCode },
    });
    if (existing) {
      throw new AppError('Account code already exists');
    }

    return prisma.gLAccount.create({
      data: {
        hospitalId: input.hospitalId,
        accountCode: input.accountCode,
        accountName: input.accountName,
        accountType: input.accountType,
        parentId: input.parentId,
        description: input.description,
      },
    });
  }

  async updateAccount(id: string, hospitalId: string, input: UpdateAccountInput) {
    const account = await prisma.gLAccount.findFirst({ where: { id, hospitalId } });
    if (!account) throw new NotFoundError('GL Account not found');

    return prisma.gLAccount.update({
      where: { id },
      data: input,
    });
  }

  async seedDefaultCoA(hospitalId: string) {
    const existing = await prisma.gLAccount.count({ where: { hospitalId } });
    if (existing > 0) {
      throw new AppError('Chart of Accounts already exists for this hospital. Delete existing accounts first or use createAccount to add individual accounts.');
    }

    const accounts = await prisma.gLAccount.createMany({
      data: DEFAULT_COA.map((a) => ({
        hospitalId,
        accountCode: a.code,
        accountName: a.name,
        accountType: a.type,
        description: a.description,
      })),
    });

    return { created: accounts.count };
  }

  // --------------------------------------------------------------------------
  // GL Entries (Journal Entries)
  // --------------------------------------------------------------------------

  async createJournalEntry(input: CreateJournalEntryInput) {
    // Validate double-entry: total debits must equal total credits
    const totalDebits = input.lines.reduce((sum, l) => sum + (l.debitAmount || 0), 0);
    const totalCredits = input.lines.reduce((sum, l) => sum + (l.creditAmount || 0), 0);

    if (Math.abs(totalDebits - totalCredits) > 0.001) {
      throw new AppError(`Journal entry is not balanced. Debits: ${totalDebits.toFixed(2)}, Credits: ${totalCredits.toFixed(2)}`);
    }

    if (totalDebits === 0) {
      throw new AppError('Journal entry must have non-zero amounts');
    }

    // Validate each line has either debit or credit, not both
    for (const line of input.lines) {
      if ((line.debitAmount || 0) > 0 && (line.creditAmount || 0) > 0) {
        throw new AppError('A journal line cannot have both debit and credit amounts');
      }
      if ((line.debitAmount || 0) === 0 && (line.creditAmount || 0) === 0) {
        throw new AppError('A journal line must have a debit or credit amount');
      }
    }

    // Check fiscal period if specified
    if (input.fiscalPeriodId) {
      const period = await prisma.fiscalPeriod.findFirst({
        where: { id: input.fiscalPeriodId, hospitalId: input.hospitalId },
      });
      if (!period) throw new NotFoundError('Fiscal period not found');
      if (period.isClosed) throw new AppError('Cannot post entries to a closed fiscal period');
    } else {
      // Auto-assign fiscal period based on transaction date
      const period = await prisma.fiscalPeriod.findFirst({
        where: {
          hospitalId: input.hospitalId,
          startDate: { lte: input.transactionDate },
          endDate: { gte: input.transactionDate },
          isClosed: false,
        },
      });
      if (period) {
        input.fiscalPeriodId = period.id;
      }
    }

    // Create all GL entries in a transaction
    const entries = await prisma.$transaction(
      input.lines.map((line) =>
        prisma.gLEntry.create({
          data: {
            hospitalId: input.hospitalId,
            transactionDate: input.transactionDate,
            glAccountId: line.glAccountId,
            debitAmount: new Prisma.Decimal(line.debitAmount || 0),
            creditAmount: new Prisma.Decimal(line.creditAmount || 0),
            description: line.description || input.description,
            referenceType: input.referenceType,
            referenceId: input.referenceId,
            costCenter: line.costCenter,
            fiscalPeriodId: input.fiscalPeriodId,
            createdBy: input.createdBy,
          },
          include: { glAccount: true },
        })
      )
    );

    return entries;
  }

  async queryGLEntries(
    hospitalId: string,
    filters?: {
      startDate?: Date;
      endDate?: Date;
      accountId?: string;
      referenceType?: GLReferenceType;
      costCenter?: string;
      fiscalPeriodId?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const where: Prisma.GLEntryWhereInput = { hospitalId };
    if (filters?.startDate || filters?.endDate) {
      where.transactionDate = {};
      if (filters.startDate) where.transactionDate.gte = filters.startDate;
      if (filters.endDate) where.transactionDate.lte = filters.endDate;
    }
    if (filters?.accountId) where.glAccountId = filters.accountId;
    if (filters?.referenceType) where.referenceType = filters.referenceType;
    if (filters?.costCenter) where.costCenter = filters.costCenter;
    if (filters?.fiscalPeriodId) where.fiscalPeriodId = filters.fiscalPeriodId;

    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const skip = (page - 1) * limit;

    const [entries, total] = await Promise.all([
      prisma.gLEntry.findMany({
        where,
        include: { glAccount: true, fiscalPeriod: true },
        orderBy: { transactionDate: 'desc' },
        skip,
        take: limit,
      }),
      prisma.gLEntry.count({ where }),
    ]);

    return { entries, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getJournalByReference(hospitalId: string, referenceId: string) {
    const entries = await prisma.gLEntry.findMany({
      where: { hospitalId, referenceId },
      include: { glAccount: true },
      orderBy: { createdAt: 'asc' },
    });

    if (entries.length === 0) {
      throw new NotFoundError('No journal entries found for this reference');
    }

    const totalDebits = entries.reduce((s, e) => s + Number(e.debitAmount), 0);
    const totalCredits = entries.reduce((s, e) => s + Number(e.creditAmount), 0);

    return { entries, totalDebits, totalCredits, isBalanced: Math.abs(totalDebits - totalCredits) < 0.01 };
  }

  // --------------------------------------------------------------------------
  // Reversing Entries (GL entries are immutable)
  // --------------------------------------------------------------------------

  async reverseEntry(entryId: string, hospitalId: string, createdBy: string, reason?: string) {
    const original = await prisma.gLEntry.findFirst({
      where: { id: entryId, hospitalId },
      include: { glAccount: true },
    });
    if (!original) throw new NotFoundError('GL Entry not found');

    // Check if already reversed
    const existingReversal = await prisma.gLEntry.findFirst({
      where: { reversesId: entryId },
    });
    if (existingReversal) throw new AppError('This entry has already been reversed');

    // Find all entries with the same referenceId to reverse the whole journal entry
    const allEntries = await prisma.gLEntry.findMany({
      where: { hospitalId, referenceId: original.referenceId, referenceType: original.referenceType },
    });

    const reversalDescription = `REVERSAL: ${reason || original.description}`;

    const reversals = await prisma.$transaction(
      allEntries.map((entry) =>
        prisma.gLEntry.create({
          data: {
            hospitalId: entry.hospitalId,
            transactionDate: new Date(),
            glAccountId: entry.glAccountId,
            debitAmount: entry.creditAmount, // Swap debit and credit
            creditAmount: entry.debitAmount,
            description: reversalDescription,
            referenceType: 'REVERSAL' as GLReferenceType,
            referenceId: entry.referenceId,
            costCenter: entry.costCenter,
            fiscalPeriodId: entry.fiscalPeriodId,
            reversesId: entry.id,
            createdBy,
          },
          include: { glAccount: true },
        })
      )
    );

    return reversals;
  }

  // --------------------------------------------------------------------------
  // Transaction GL Hooks
  // --------------------------------------------------------------------------

  private async getAccountByCode(hospitalId: string, code: string) {
    const account = await prisma.gLAccount.findFirst({
      where: { hospitalId, accountCode: code, isActive: true },
    });
    if (!account) throw new AppError(`GL Account ${code} not found. Please seed Chart of Accounts first.`);
    return account;
  }

  async recordInvoiceGL(params: {
    hospitalId: string;
    invoiceId: string;
    amount: number;
    description: string;
    costCenter?: string;
    createdBy: string;
    revenueAccountCode?: string;
  }) {
    const arAccount = await this.getAccountByCode(params.hospitalId, '1100');
    const revenueAccount = await this.getAccountByCode(params.hospitalId, params.revenueAccountCode || '4000');

    return this.createJournalEntry({
      hospitalId: params.hospitalId,
      transactionDate: new Date(),
      referenceType: 'INVOICE',
      referenceId: params.invoiceId,
      description: params.description,
      createdBy: params.createdBy,
      lines: [
        { glAccountId: arAccount.id, debitAmount: params.amount, creditAmount: 0, costCenter: params.costCenter },
        { glAccountId: revenueAccount.id, debitAmount: 0, creditAmount: params.amount, costCenter: params.costCenter },
      ],
    });
  }

  async recordPaymentGL(params: {
    hospitalId: string;
    paymentId: string;
    amount: number;
    description: string;
    costCenter?: string;
    createdBy: string;
  }) {
    const cashAccount = await this.getAccountByCode(params.hospitalId, '1000');
    const arAccount = await this.getAccountByCode(params.hospitalId, '1100');

    return this.createJournalEntry({
      hospitalId: params.hospitalId,
      transactionDate: new Date(),
      referenceType: 'PAYMENT',
      referenceId: params.paymentId,
      description: params.description,
      createdBy: params.createdBy,
      lines: [
        { glAccountId: cashAccount.id, debitAmount: params.amount, creditAmount: 0, costCenter: params.costCenter },
        { glAccountId: arAccount.id, debitAmount: 0, creditAmount: params.amount, costCenter: params.costCenter },
      ],
    });
  }

  async recordRefundGL(params: {
    hospitalId: string;
    refundId: string;
    amount: number;
    description: string;
    costCenter?: string;
    createdBy: string;
  }) {
    const arAccount = await this.getAccountByCode(params.hospitalId, '1100');
    const cashAccount = await this.getAccountByCode(params.hospitalId, '1000');

    return this.createJournalEntry({
      hospitalId: params.hospitalId,
      transactionDate: new Date(),
      referenceType: 'REFUND',
      referenceId: params.refundId,
      description: params.description,
      createdBy: params.createdBy,
      lines: [
        { glAccountId: arAccount.id, debitAmount: params.amount, creditAmount: 0, costCenter: params.costCenter },
        { glAccountId: cashAccount.id, debitAmount: 0, creditAmount: params.amount, costCenter: params.costCenter },
      ],
    });
  }

  async recordWriteOffGL(params: {
    hospitalId: string;
    writeOffId: string;
    amount: number;
    description: string;
    costCenter?: string;
    createdBy: string;
  }) {
    const badDebtAccount = await this.getAccountByCode(params.hospitalId, '5100');
    const arAccount = await this.getAccountByCode(params.hospitalId, '1100');

    return this.createJournalEntry({
      hospitalId: params.hospitalId,
      transactionDate: new Date(),
      referenceType: 'WRITE_OFF',
      referenceId: params.writeOffId,
      description: params.description,
      createdBy: params.createdBy,
      lines: [
        { glAccountId: badDebtAccount.id, debitAmount: params.amount, creditAmount: 0, costCenter: params.costCenter },
        { glAccountId: arAccount.id, debitAmount: 0, creditAmount: params.amount, costCenter: params.costCenter },
      ],
    });
  }

  async recordDepositGL(params: {
    hospitalId: string;
    depositId: string;
    amount: number;
    description: string;
    costCenter?: string;
    createdBy: string;
  }) {
    const cashAccount = await this.getAccountByCode(params.hospitalId, '1000');
    const depositLiability = await this.getAccountByCode(params.hospitalId, '2100');

    return this.createJournalEntry({
      hospitalId: params.hospitalId,
      transactionDate: new Date(),
      referenceType: 'DEPOSIT',
      referenceId: params.depositId,
      description: params.description,
      createdBy: params.createdBy,
      lines: [
        { glAccountId: cashAccount.id, debitAmount: params.amount, creditAmount: 0, costCenter: params.costCenter },
        { glAccountId: depositLiability.id, debitAmount: 0, creditAmount: params.amount, costCenter: params.costCenter },
      ],
    });
  }

  // --------------------------------------------------------------------------
  // Trial Balance
  // --------------------------------------------------------------------------

  async getTrialBalance(
    hospitalId: string,
    filters?: { asOfDate?: Date; fiscalPeriodId?: string }
  ): Promise<TrialBalanceResult> {
    const where: Prisma.GLEntryWhereInput = { hospitalId };
    if (filters?.asOfDate) {
      where.transactionDate = { lte: filters.asOfDate };
    }
    if (filters?.fiscalPeriodId) {
      where.fiscalPeriodId = filters.fiscalPeriodId;
    }

    const entries = await prisma.gLEntry.findMany({
      where,
      include: { glAccount: true },
    });

    // Group by account
    const accountMap = new Map<string, TrialBalanceRow>();
    for (const entry of entries) {
      const key = entry.glAccountId;
      if (!accountMap.has(key)) {
        accountMap.set(key, {
          accountId: entry.glAccount.id,
          accountCode: entry.glAccount.accountCode,
          accountName: entry.glAccount.accountName,
          accountType: entry.glAccount.accountType,
          totalDebits: 0,
          totalCredits: 0,
          balance: 0,
        });
      }
      const row = accountMap.get(key)!;
      row.totalDebits += Number(entry.debitAmount);
      row.totalCredits += Number(entry.creditAmount);
    }

    // Calculate balances
    const rows = Array.from(accountMap.values()).map((row) => {
      // Normal balance: Assets & Expenses = Debit; Liabilities, Revenue, Equity = Credit
      row.balance = row.totalDebits - row.totalCredits;
      return row;
    });

    rows.sort((a, b) => a.accountCode.localeCompare(b.accountCode));

    const totalDebits = rows.reduce((s, r) => s + r.totalDebits, 0);
    const totalCredits = rows.reduce((s, r) => s + r.totalCredits, 0);

    return {
      asOfDate: filters?.asOfDate || new Date(),
      periodId: filters?.fiscalPeriodId,
      rows,
      totalDebits,
      totalCredits,
    };
  }

  // --------------------------------------------------------------------------
  // Revenue Recognition
  // --------------------------------------------------------------------------

  /**
   * Get the revenue recognition mode for a hospital.
   * Currently defaults to ON_SERVICE (revenue posted on invoice creation).
   * In the future, this could be a configurable hospital setting.
   */
  async getRevenueRecognitionMode(hospitalId: string): Promise<'ON_SERVICE' | 'ON_PAYMENT'> {
    // Foundation: hardcoded to ON_SERVICE since current GL hooks
    // post revenue at invoice creation time.
    // TODO: Make this a hospital setting in the future
    return 'ON_SERVICE';
  }

  // --------------------------------------------------------------------------
  // Fiscal Periods
  // --------------------------------------------------------------------------

  async listFiscalPeriods(hospitalId: string) {
    return prisma.fiscalPeriod.findMany({
      where: { hospitalId },
      orderBy: { startDate: 'desc' },
    });
  }

  async createFiscalPeriod(params: {
    hospitalId: string;
    name: string;
    startDate: Date;
    endDate: Date;
  }) {
    if (params.startDate >= params.endDate) {
      throw new AppError('Start date must be before end date');
    }

    // Check for overlapping periods
    const overlap = await prisma.fiscalPeriod.findFirst({
      where: {
        hospitalId: params.hospitalId,
        OR: [
          { startDate: { lte: params.startDate }, endDate: { gte: params.startDate } },
          { startDate: { lte: params.endDate }, endDate: { gte: params.endDate } },
          { startDate: { gte: params.startDate }, endDate: { lte: params.endDate } },
        ],
      },
    });
    if (overlap) {
      throw new AppError(`Overlaps with existing fiscal period: ${overlap.name}`);
    }

    return prisma.fiscalPeriod.create({
      data: {
        hospitalId: params.hospitalId,
        name: params.name,
        startDate: params.startDate,
        endDate: params.endDate,
      },
    });
  }

  async closeFiscalPeriod(id: string, hospitalId: string, closedBy: string) {
    const period = await prisma.fiscalPeriod.findFirst({ where: { id, hospitalId } });
    if (!period) throw new NotFoundError('Fiscal period not found');
    if (period.isClosed) throw new AppError('Fiscal period is already closed');

    return prisma.fiscalPeriod.update({
      where: { id },
      data: { isClosed: true, closedBy, closedAt: new Date() },
    });
  }
}

export const accountingService = new AccountingService();
