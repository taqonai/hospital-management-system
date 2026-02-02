import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { depositService } from '../services/depositService';
import prisma from '../config/database';
import { Decimal } from '@prisma/client/runtime/library';

// Mock Prisma
vi.mock('../config/database', () => ({
  default: {
    deposit: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    depositLedger: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    creditNote: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    refund: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    patient: {
      findFirst: vi.fn(),
    },
    invoice: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

describe('DepositService', () => {
  const mockHospitalId = 'hospital-123';
  const mockPatientId = 'patient-456';
  const mockUserId = 'user-789';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('recordDeposit', () => {
    it('should record a new deposit with initial ledger entry', async () => {
      const mockPatient = {
        id: mockPatientId,
        hospitalId: mockHospitalId,
        firstName: 'John',
        lastName: 'Doe',
        mrn: 'MRN001',
        phone: '+971501234567',
        email: 'john@example.com',
      };

      const mockDeposit = {
        id: 'deposit-1',
        hospitalId: mockHospitalId,
        patientId: mockPatientId,
        amount: new Decimal(1000),
        currency: 'AED',
        paymentMethod: 'CASH',
        status: 'ACTIVE',
        remainingBalance: new Decimal(1000),
        createdBy: mockUserId,
        patient: mockPatient,
      };

      (prisma.patient.findFirst as any).mockResolvedValue(mockPatient);
      (prisma.$transaction as any).mockImplementation(async (callback: any) => {
        return callback({
          deposit: {
            create: vi.fn().mockResolvedValue(mockDeposit),
          },
          depositLedger: {
            create: vi.fn().mockResolvedValue({}),
          },
        });
      });

      const result = await depositService.recordDeposit(
        mockHospitalId,
        mockPatientId,
        {
          amount: 1000,
          paymentMethod: 'CASH',
          reason: 'Advance payment',
        },
        mockUserId
      );

      expect(result).toEqual(mockDeposit);
      expect(prisma.patient.findFirst).toHaveBeenCalledWith({
        where: { id: mockPatientId, hospitalId: mockHospitalId },
      });
    });

    it('should throw error for negative amount', async () => {
      await expect(
        depositService.recordDeposit(
          mockHospitalId,
          mockPatientId,
          {
            amount: -100,
            paymentMethod: 'CASH',
          },
          mockUserId
        )
      ).rejects.toThrow('Deposit amount must be greater than zero');
    });

    it('should throw error if patient not found', async () => {
      (prisma.patient.findFirst as any).mockResolvedValue(null);

      await expect(
        depositService.recordDeposit(
          mockHospitalId,
          mockPatientId,
          {
            amount: 1000,
            paymentMethod: 'CASH',
          },
          mockUserId
        )
      ).rejects.toThrow('Patient not found');
    });
  });

  describe('getDepositBalance', () => {
    it('should calculate total deposit balance correctly', async () => {
      const mockDeposits = [
        { remainingBalance: new Decimal(500) },
        { remainingBalance: new Decimal(300) },
        { remainingBalance: new Decimal(200) },
      ];

      (prisma.deposit.findMany as any).mockResolvedValue(mockDeposits);

      const result = await depositService.getDepositBalance(mockHospitalId, mockPatientId);

      expect(result).toEqual({
        patientId: mockPatientId,
        totalBalance: 1000,
        activeDeposits: 3,
      });
    });

    it('should return zero balance when no active deposits', async () => {
      (prisma.deposit.findMany as any).mockResolvedValue([]);

      const result = await depositService.getDepositBalance(mockHospitalId, mockPatientId);

      expect(result.totalBalance).toBe(0);
      expect(result.activeDeposits).toBe(0);
    });
  });

  describe('applyDepositToInvoice', () => {
    it('should apply deposit to invoice and update both records', async () => {
      const mockInvoice = {
        id: 'invoice-1',
        invoiceNumber: 'INV-001',
        totalAmount: new Decimal(1500),
        paidAmount: new Decimal(0),
        balanceAmount: new Decimal(1500),
        status: 'PENDING',
      };

      const mockDeposits = [
        {
          id: 'deposit-1',
          remainingBalance: new Decimal(1000),
          createdAt: new Date('2024-01-01'),
        },
      ];

      (prisma.invoice.findFirst as any).mockResolvedValue(mockInvoice);
      (prisma.deposit.findMany as any).mockResolvedValue(mockDeposits);
      (prisma.$transaction as any).mockImplementation(async (callback: any) => {
        const updatedInvoice = {
          ...mockInvoice,
          paidAmount: new Decimal(500),
          balanceAmount: new Decimal(1000),
          status: 'PARTIALLY_PAID',
        };
        return callback({
          deposit: {
            update: vi.fn(),
          },
          depositLedger: {
            create: vi.fn(),
          },
          invoice: {
            update: vi.fn().mockResolvedValue(updatedInvoice),
          },
        });
      });

      const result = await depositService.applyDepositToInvoice(
        mockHospitalId,
        mockPatientId,
        'invoice-1',
        500,
        mockUserId
      );

      expect(result.totalApplied).toBe(500);
      expect(result.invoice.status).toBe('PARTIALLY_PAID');
    });

    it('should throw error when insufficient deposit balance', async () => {
      const mockInvoice = {
        id: 'invoice-1',
        status: 'PENDING',
      };

      const mockDeposits = [
        {
          id: 'deposit-1',
          remainingBalance: new Decimal(100),
        },
      ];

      (prisma.invoice.findFirst as any).mockResolvedValue(mockInvoice);
      (prisma.deposit.findMany as any).mockResolvedValue(mockDeposits);

      await expect(
        depositService.applyDepositToInvoice(
          mockHospitalId,
          mockPatientId,
          'invoice-1',
          500,
          mockUserId
        )
      ).rejects.toThrow('Insufficient deposit balance');
    });

    it('should prevent applying deposit to paid invoice', async () => {
      const mockInvoice = {
        id: 'invoice-1',
        status: 'PAID',
      };

      (prisma.invoice.findFirst as any).mockResolvedValue(mockInvoice);

      await expect(
        depositService.applyDepositToInvoice(
          mockHospitalId,
          mockPatientId,
          'invoice-1',
          500,
          mockUserId
        )
      ).rejects.toThrow('Cannot apply deposit to paid invoice');
    });
  });

  describe('createCreditNote', () => {
    it('should create a credit note successfully', async () => {
      const mockPatient = {
        id: mockPatientId,
        firstName: 'John',
        lastName: 'Doe',
        mrn: 'MRN001',
      };

      const mockCreditNote = {
        id: 'cn-1',
        creditNoteNumber: 'CN-ABC123',
        amount: new Decimal(200),
        reason: 'Overcharge correction',
        status: 'ISSUED',
        patient: mockPatient,
      };

      (prisma.patient.findFirst as any).mockResolvedValue(mockPatient);
      (prisma.creditNote.create as any).mockResolvedValue(mockCreditNote);

      const result = await depositService.createCreditNote(
        mockHospitalId,
        {
          patientId: mockPatientId,
          amount: 200,
          reason: 'Overcharge correction',
        },
        mockUserId
      );

      expect(result.creditNoteNumber).toMatch(/^CN-/);
      expect(result.status).toBe('ISSUED');
    });
  });

  describe('refund workflow', () => {
    it('should process complete refund workflow', async () => {
      const mockRefund = {
        id: 'refund-1',
        status: 'REQUESTED',
        amount: new Decimal(300),
        depositId: 'deposit-1',
      };

      // Request refund
      const mockPatient = { id: mockPatientId };
      const mockDeposit = {
        id: 'deposit-1',
        remainingBalance: new Decimal(500),
      };

      (prisma.patient.findFirst as any).mockResolvedValue(mockPatient);
      (prisma.deposit.findFirst as any).mockResolvedValue(mockDeposit);
      (prisma.refund.create as any).mockResolvedValue(mockRefund);
      (prisma.refund.findUnique as any).mockResolvedValue({
        ...mockRefund,
        deposit: mockDeposit,
      });
      (prisma.refund.update as any).mockResolvedValue({
        ...mockRefund,
        status: 'APPROVED',
      });
      (prisma.$transaction as any).mockImplementation(async (callback: any) => {
        return callback({
          refund: {
            update: vi.fn().mockResolvedValue({ ...mockRefund, status: 'PROCESSED' }),
          },
          deposit: {
            update: vi.fn(),
          },
          depositLedger: {
            create: vi.fn(),
          },
        });
      });

      // 1. Request refund
      const requested = await depositService.requestRefund(
        mockHospitalId,
        {
          patientId: mockPatientId,
          depositId: 'deposit-1',
          amount: 300,
          refundMethod: 'BANK_TRANSFER',
          requestReason: 'Requested by patient',
        },
        mockUserId
      );

      expect(requested.status).toBe('REQUESTED');

      // 2. Approve refund
      const approved = await depositService.approveRefund('refund-1', mockUserId);

      expect(approved.status).toBe('APPROVED');

      // 3. Process refund
      const processed = await depositService.processRefund('refund-1', mockUserId);

      expect(processed.status).toBe('PROCESSED');
    });

    it('should prevent processing refund that is not approved', async () => {
      const mockRefund = {
        id: 'refund-1',
        status: 'REQUESTED',
      };

      (prisma.refund.findUnique as any).mockResolvedValue(mockRefund);

      await expect(depositService.processRefund('refund-1', mockUserId)).rejects.toThrow(
        'Cannot process refund with status: REQUESTED'
      );
    });
  });

  describe('deposit balance validation', () => {
    it('should never allow deposit balance to go negative', async () => {
      const mockInvoice = {
        id: 'invoice-1',
        status: 'PENDING',
        totalAmount: new Decimal(1500),
        paidAmount: new Decimal(0),
        balanceAmount: new Decimal(1500),
      };

      const mockDeposits = [
        {
          id: 'deposit-1',
          remainingBalance: new Decimal(1000),
          createdAt: new Date(),
        },
      ];

      (prisma.invoice.findFirst as any).mockResolvedValue(mockInvoice);
      (prisma.deposit.findMany as any).mockResolvedValue(mockDeposits);

      await expect(
        depositService.applyDepositToInvoice(
          mockHospitalId,
          mockPatientId,
          'invoice-1',
          1500, // More than available
          mockUserId
        )
      ).rejects.toThrow('Insufficient deposit balance');
    });
  });
});
