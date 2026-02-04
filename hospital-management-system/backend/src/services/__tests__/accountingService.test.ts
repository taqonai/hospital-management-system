import { accountingService } from '../accountingService';
import prisma from '../../config/database';
import { Decimal } from '@prisma/client/runtime/library';

// Mock Prisma
jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    gLAccount: {
      count: jest.fn(),
      createMany: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    gLEntry: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    fiscalPeriod: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

describe('AccountingService', () => {
  const mockHospitalId = 'hospital-123';
  const mockUserId = 'user-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('seedDefaultCoA', () => {
    it('should create 14 default accounts', async () => {
      (prisma.gLAccount.count as jest.Mock).mockResolvedValue(0);
      (prisma.gLAccount.createMany as jest.Mock).mockResolvedValue({ count: 14 });

      const result = await accountingService.seedDefaultCoA(mockHospitalId);

      expect(result.created).toBe(14);
      expect(prisma.gLAccount.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ accountCode: '1000', accountName: 'Cash/Bank', accountType: 'ASSET' }),
            expect.objectContaining({ accountCode: '1100', accountName: 'Patient Receivable', accountType: 'ASSET' }),
            expect.objectContaining({ accountCode: '4000', accountName: 'Patient Service Revenue', accountType: 'REVENUE' }),
            expect.objectContaining({ accountCode: '5100', accountName: 'Bad Debt Expense', accountType: 'EXPENSE' }),
          ]),
        })
      );
    });

    it('should throw if accounts already exist', async () => {
      (prisma.gLAccount.count as jest.Mock).mockResolvedValue(14);

      await expect(accountingService.seedDefaultCoA(mockHospitalId)).rejects.toThrow(
        'Chart of Accounts already exists'
      );
    });
  });

  describe('createJournalEntry', () => {
    it('should create balanced entries (debit = credit)', async () => {
      const arAccountId = 'account-ar';
      const revenueAccountId = 'account-revenue';

      (prisma.fiscalPeriod.findFirst as jest.Mock).mockResolvedValue(null);

      const mockEntries = [
        {
          id: 'entry-1',
          hospitalId: mockHospitalId,
          glAccountId: arAccountId,
          debitAmount: new Decimal(500),
          creditAmount: new Decimal(0),
          description: 'Invoice INV-001',
          glAccount: { id: arAccountId, accountCode: '1100', accountName: 'Accounts Receivable' },
        },
        {
          id: 'entry-2',
          hospitalId: mockHospitalId,
          glAccountId: revenueAccountId,
          debitAmount: new Decimal(0),
          creditAmount: new Decimal(500),
          description: 'Invoice INV-001',
          glAccount: { id: revenueAccountId, accountCode: '4000', accountName: 'Patient Service Revenue' },
        },
      ];

      (prisma.$transaction as jest.Mock).mockResolvedValue(mockEntries);

      const result = await accountingService.createJournalEntry({
        hospitalId: mockHospitalId,
        transactionDate: new Date(),
        referenceType: 'INVOICE',
        referenceId: 'inv-001',
        description: 'Invoice INV-001',
        createdBy: mockUserId,
        lines: [
          { glAccountId: arAccountId, debitAmount: 500, creditAmount: 0 },
          { glAccountId: revenueAccountId, debitAmount: 0, creditAmount: 500 },
        ],
      });

      expect(result).toHaveLength(2);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should reject unbalanced entries', async () => {
      await expect(
        accountingService.createJournalEntry({
          hospitalId: mockHospitalId,
          transactionDate: new Date(),
          referenceType: 'INVOICE',
          referenceId: 'inv-001',
          description: 'Unbalanced entry',
          createdBy: mockUserId,
          lines: [
            { glAccountId: 'acc-1', debitAmount: 500, creditAmount: 0 },
            { glAccountId: 'acc-2', debitAmount: 0, creditAmount: 300 },
          ],
        })
      ).rejects.toThrow('not balanced');
    });

    it('should reject entries with zero amounts', async () => {
      await expect(
        accountingService.createJournalEntry({
          hospitalId: mockHospitalId,
          transactionDate: new Date(),
          referenceType: 'INVOICE',
          referenceId: 'inv-001',
          description: 'Zero entry',
          createdBy: mockUserId,
          lines: [
            { glAccountId: 'acc-1', debitAmount: 0, creditAmount: 0 },
          ],
        })
      ).rejects.toThrow();
    });
  });

  describe('getTrialBalance', () => {
    it('should return balanced trial balance after entries', async () => {
      const mockEntries = [
        {
          id: 'e1',
          glAccountId: 'acc-ar',
          debitAmount: new Decimal(1000),
          creditAmount: new Decimal(0),
          glAccount: { id: 'acc-ar', accountCode: '1100', accountName: 'Accounts Receivable', accountType: 'ASSET' },
        },
        {
          id: 'e2',
          glAccountId: 'acc-rev',
          debitAmount: new Decimal(0),
          creditAmount: new Decimal(1000),
          glAccount: { id: 'acc-rev', accountCode: '4000', accountName: 'Patient Service Revenue', accountType: 'REVENUE' },
        },
        {
          id: 'e3',
          glAccountId: 'acc-cash',
          debitAmount: new Decimal(600),
          creditAmount: new Decimal(0),
          glAccount: { id: 'acc-cash', accountCode: '1000', accountName: 'Cash/Bank', accountType: 'ASSET' },
        },
        {
          id: 'e4',
          glAccountId: 'acc-ar',
          debitAmount: new Decimal(0),
          creditAmount: new Decimal(600),
          glAccount: { id: 'acc-ar', accountCode: '1100', accountName: 'Accounts Receivable', accountType: 'ASSET' },
        },
      ];

      (prisma.gLEntry.findMany as jest.Mock).mockResolvedValue(mockEntries);

      const result = await accountingService.getTrialBalance(mockHospitalId);

      expect(result.totalDebits).toBe(1600);
      expect(result.totalCredits).toBe(1600);
      expect(Math.abs(result.totalDebits - result.totalCredits)).toBeLessThan(0.01);
      expect(result.rows.length).toBe(3); // AR, Revenue, Cash

      const arRow = result.rows.find(r => r.accountCode === '1100');
      expect(arRow).toBeDefined();
      expect(arRow!.totalDebits).toBe(1000);
      expect(arRow!.totalCredits).toBe(600);
      expect(arRow!.balance).toBe(400); // 1000 - 600
    });
  });

  describe('reverseEntry', () => {
    it('should create opposite entries', async () => {
      const originalEntry = {
        id: 'entry-1',
        hospitalId: mockHospitalId,
        glAccountId: 'acc-ar',
        debitAmount: new Decimal(500),
        creditAmount: new Decimal(0),
        description: 'Invoice INV-001',
        referenceType: 'INVOICE',
        referenceId: 'inv-001',
        costCenter: null,
        fiscalPeriodId: null,
        glAccount: { id: 'acc-ar', accountCode: '1100', accountName: 'Accounts Receivable' },
      };

      const allOriginalEntries = [
        originalEntry,
        {
          id: 'entry-2',
          hospitalId: mockHospitalId,
          glAccountId: 'acc-rev',
          debitAmount: new Decimal(0),
          creditAmount: new Decimal(500),
          description: 'Invoice INV-001',
          referenceType: 'INVOICE',
          referenceId: 'inv-001',
          costCenter: null,
          fiscalPeriodId: null,
        },
      ];

      (prisma.gLEntry.findFirst as jest.Mock)
        .mockResolvedValueOnce(originalEntry) // Find original
        .mockResolvedValueOnce(null); // No existing reversal

      (prisma.gLEntry.findMany as jest.Mock).mockResolvedValue(allOriginalEntries);

      const reversalEntries = [
        {
          id: 'rev-1',
          glAccountId: 'acc-ar',
          debitAmount: new Decimal(0),
          creditAmount: new Decimal(500), // Reversed
          description: 'REVERSAL: Invoice INV-001',
          reversesId: 'entry-1',
          glAccount: { id: 'acc-ar', accountCode: '1100' },
        },
        {
          id: 'rev-2',
          glAccountId: 'acc-rev',
          debitAmount: new Decimal(500), // Reversed
          creditAmount: new Decimal(0),
          description: 'REVERSAL: Invoice INV-001',
          reversesId: 'entry-2',
          glAccount: { id: 'acc-rev', accountCode: '4000' },
        },
      ];

      (prisma.$transaction as jest.Mock).mockResolvedValue(reversalEntries);

      const result = await accountingService.reverseEntry('entry-1', mockHospitalId, mockUserId, 'Error correction');

      expect(result).toHaveLength(2);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      // Verify debits and credits are swapped
      expect(Number(result[0].creditAmount)).toBe(500); // Was debit 500
      expect(Number(result[1].debitAmount)).toBe(500);  // Was credit 500
    });

    it('should throw if entry already reversed', async () => {
      const originalEntry = {
        id: 'entry-1',
        hospitalId: mockHospitalId,
        glAccountId: 'acc-ar',
        debitAmount: new Decimal(500),
        creditAmount: new Decimal(0),
        glAccount: { id: 'acc-ar' },
      };

      (prisma.gLEntry.findFirst as jest.Mock)
        .mockResolvedValueOnce(originalEntry)
        .mockResolvedValueOnce({ id: 'existing-reversal', reversesId: 'entry-1' }); // Already reversed

      await expect(
        accountingService.reverseEntry('entry-1', mockHospitalId, mockUserId)
      ).rejects.toThrow('already been reversed');
    });
  });

  describe('recordInvoiceGL', () => {
    it('should create debit AR + credit Revenue entries', async () => {
      const arAccount = { id: 'acc-ar', accountCode: '1100', accountName: 'Accounts Receivable', isActive: true };
      const revenueAccount = { id: 'acc-rev', accountCode: '4000', accountName: 'Patient Service Revenue', isActive: true };

      (prisma.gLAccount.findFirst as jest.Mock)
        .mockResolvedValueOnce(arAccount)     // AR lookup (code 1100)
        .mockResolvedValueOnce(revenueAccount); // Revenue lookup (code 4000)

      (prisma.fiscalPeriod.findFirst as jest.Mock).mockResolvedValue(null);

      const mockEntries = [
        { id: 'e1', glAccountId: 'acc-ar', debitAmount: new Decimal(1000), creditAmount: new Decimal(0), glAccount: arAccount },
        { id: 'e2', glAccountId: 'acc-rev', debitAmount: new Decimal(0), creditAmount: new Decimal(1000), glAccount: revenueAccount },
      ];

      (prisma.$transaction as jest.Mock).mockResolvedValue(mockEntries);

      const result = await accountingService.recordInvoiceGL({
        hospitalId: mockHospitalId,
        invoiceId: 'inv-001',
        amount: 1000,
        description: 'Invoice for patient consultation',
        createdBy: mockUserId,
      });

      expect(result).toHaveLength(2);
      // First entry: Debit AR
      expect(Number(result[0].debitAmount)).toBe(1000);
      expect(Number(result[0].creditAmount)).toBe(0);
      // Second entry: Credit Revenue
      expect(Number(result[1].debitAmount)).toBe(0);
      expect(Number(result[1].creditAmount)).toBe(1000);
    });
  });

  describe('recordPaymentGL', () => {
    it('should create debit Cash + credit AR entries', async () => {
      const cashAccount = { id: 'acc-cash', accountCode: '1000', accountName: 'Cash/Bank', isActive: true };
      const arAccount = { id: 'acc-ar', accountCode: '1100', accountName: 'Accounts Receivable', isActive: true };

      (prisma.gLAccount.findFirst as jest.Mock)
        .mockResolvedValueOnce(cashAccount) // Cash lookup (code 1000)
        .mockResolvedValueOnce(arAccount);  // AR lookup (code 1100)

      (prisma.fiscalPeriod.findFirst as jest.Mock).mockResolvedValue(null);

      const mockEntries = [
        { id: 'e1', glAccountId: 'acc-cash', debitAmount: new Decimal(500), creditAmount: new Decimal(0), glAccount: cashAccount },
        { id: 'e2', glAccountId: 'acc-ar', debitAmount: new Decimal(0), creditAmount: new Decimal(500), glAccount: arAccount },
      ];

      (prisma.$transaction as jest.Mock).mockResolvedValue(mockEntries);

      const result = await accountingService.recordPaymentGL({
        hospitalId: mockHospitalId,
        paymentId: 'pay-001',
        amount: 500,
        description: 'Payment received for INV-001',
        createdBy: mockUserId,
      });

      expect(result).toHaveLength(2);
      // First entry: Debit Cash
      expect(Number(result[0].debitAmount)).toBe(500);
      expect(result[0].glAccountId).toBe('acc-cash');
      // Second entry: Credit AR
      expect(Number(result[1].creditAmount)).toBe(500);
      expect(result[1].glAccountId).toBe('acc-ar');
    });
  });
});
