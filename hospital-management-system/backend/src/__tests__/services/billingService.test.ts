import { BillingService } from '../../services/billingService';
import { prismaMock } from '../prismaMock';
import { createMockInvoice, createMockPayment, createMockPatient, createMockUser, createMockInsuranceClaim } from '../factories';
import { NotFoundError } from '../../middleware/errorHandler';
import { Decimal } from '@prisma/client/runtime/library';

// Mock the notification service
jest.mock('../../services/notificationService', () => ({
  notificationService: {
    sendBillingNotification: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('BillingService', () => {
  let billingService: BillingService;

  beforeEach(() => {
    billingService = new BillingService();
    jest.clearAllMocks();
  });

  describe('createInvoice', () => {
    it('should create an invoice with createdBy populated', async () => {
      const hospitalId = 'hosp-123';
      const patientId = 'patient-123';
      const createdBy = 'user-123';

      const mockPatient = createMockPatient({ id: patientId, hospitalId });
      const mockInvoice = createMockInvoice({ 
        hospitalId, 
        patientId, 
        createdBy,
        subtotal: new (require('@prisma/client/runtime/library').Decimal)(1000),
        discount: new (require('@prisma/client/runtime/library').Decimal)(0),
        tax: new (require('@prisma/client/runtime/library').Decimal)(0),
        totalAmount: new (require('@prisma/client/runtime/library').Decimal)(1000),
        balanceAmount: new (require('@prisma/client/runtime/library').Decimal)(1000),
      });

      prismaMock.invoice.create.mockResolvedValue({
        ...mockInvoice,
        patient: mockPatient,
        items: [],
      } as any);

      const result = await billingService.createInvoice(hospitalId, {
        patientId,
        items: [
          {
            description: 'Consultation',
            category: 'CONSULTATION',
            quantity: 1,
            unitPrice: 1000,
          },
        ],
        createdBy,
      });

      expect(result.createdBy).toBe(createdBy);
      expect(prismaMock.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            createdBy,
          }),
        })
      );
    });

    it('should calculate totals correctly', async () => {
      const hospitalId = 'hosp-123';
      const patientId = 'patient-123';
      const createdBy = 'user-123';

      const mockPatient = createMockPatient({ id: patientId, hospitalId });
      const mockInvoice = createMockInvoice({
        hospitalId,
        patientId,
        subtotal: new Decimal(1000),
        discount: new Decimal(100),
        tax: new Decimal(90),
        totalAmount: new Decimal(990),
        balanceAmount: new Decimal(990),
      });

      prismaMock.invoice.create.mockResolvedValue({
        ...mockInvoice,
        patient: mockPatient,
        items: [],
      } as any);

      const result = await billingService.createInvoice(hospitalId, {
        patientId,
        items: [
          {
            description: 'Consultation',
            category: 'CONSULTATION',
            quantity: 1,
            unitPrice: 1000,
          },
        ],
        discount: 100,
        tax: 90,
        createdBy,
      });

      expect(prismaMock.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotal: 1000,
            discount: 100,
            tax: 90,
            totalAmount: 990,
            balanceAmount: 990,
          }),
        })
      );
    });
  });

  describe('addPayment', () => {
    it('should reject payment amount exceeding balance', async () => {
      const invoiceId = 'inv-123';
      const mockInvoice = createMockInvoice({
        id: invoiceId,
        totalAmount: new Decimal(1000),
        balanceAmount: new Decimal(500),
        paidAmount: new Decimal(500),
      });
      const mockPatient = createMockPatient();

      prismaMock.invoice.findUnique.mockResolvedValue({
        ...mockInvoice,
        patient: mockPatient,
      } as any);

      await expect(
        billingService.addPayment(invoiceId, {
          amount: 600, // Exceeds balance of 500
          paymentMethod: 'CASH',
          createdBy: 'user-123',
        })
      ).rejects.toThrow('Payment amount (600) exceeds remaining balance (500)');

      // Ensure no payment or invoice update occurred
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('should accept payment equal to balance', async () => {
      const invoiceId = 'inv-123';
      const mockInvoice = createMockInvoice({
        id: invoiceId,
        totalAmount: new Decimal(1000),
        balanceAmount: new Decimal(500),
        paidAmount: new Decimal(500),
        status: 'PARTIALLY_PAID',
      });
      const mockPatient = createMockPatient();
      const mockPayment = createMockPayment({
        invoiceId,
        amount: new Decimal(500),
      });

      prismaMock.invoice.findUnique.mockResolvedValue({
        ...mockInvoice,
        patient: mockPatient,
      } as any);

      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        return callback({
          payment: {
            create: jest.fn().mockResolvedValue(mockPayment),
          },
          invoice: {
            update: jest.fn().mockResolvedValue({
              ...mockInvoice,
              paidAmount: new Decimal(1000),
              balanceAmount: new Decimal(0),
              status: 'PAID',
            }),
          },
        });
      });

      const result = await billingService.addPayment(invoiceId, {
        amount: 500,
        paymentMethod: 'CASH',
        createdBy: 'user-123',
      });

      expect(result).toBeDefined();
      expect(prismaMock.$transaction).toHaveBeenCalled();
    });

    it('should ensure addPayment and invoice update are atomic', async () => {
      const invoiceId = 'inv-123';
      const mockInvoice = createMockInvoice({
        id: invoiceId,
        totalAmount: new Decimal(1000),
        balanceAmount: new Decimal(1000),
        paidAmount: new Decimal(0),
        status: 'PENDING',
      });
      const mockPatient = createMockPatient();

      prismaMock.invoice.findUnique.mockResolvedValue({
        ...mockInvoice,
        patient: mockPatient,
      } as any);

      let paymentCreated = false;
      let invoiceUpdated = false;

      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        const txMock = {
          payment: {
            create: jest.fn().mockImplementation(() => {
              paymentCreated = true;
              return Promise.resolve(createMockPayment({ invoiceId, amount: new Decimal(500) }));
            }),
          },
          invoice: {
            update: jest.fn().mockImplementation(() => {
              invoiceUpdated = true;
              if (!paymentCreated) {
                throw new Error('Invoice update should not happen before payment creation');
              }
              return Promise.resolve({
                ...mockInvoice,
                paidAmount: new Decimal(500),
                balanceAmount: new Decimal(500),
                status: 'PARTIALLY_PAID',
              });
            }),
          },
        };
        return callback(txMock);
      });

      await billingService.addPayment(invoiceId, {
        amount: 500,
        paymentMethod: 'CASH',
        createdBy: 'user-123',
      });

      expect(paymentCreated).toBe(true);
      expect(invoiceUpdated).toBe(true);
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should update invoice status to PAID when balance reaches zero', async () => {
      const invoiceId = 'inv-123';
      const mockInvoice = createMockInvoice({
        id: invoiceId,
        totalAmount: new Decimal(1000),
        balanceAmount: new Decimal(300),
        paidAmount: new Decimal(700),
        status: 'PARTIALLY_PAID',
      });
      const mockPatient = createMockPatient();
      const mockPayment = createMockPayment({
        invoiceId,
        amount: new Decimal(300),
      });

      prismaMock.invoice.findUnique.mockResolvedValue({
        ...mockInvoice,
        patient: mockPatient,
      } as any);

      let finalStatus = '';

      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        return callback({
          payment: {
            create: jest.fn().mockResolvedValue(mockPayment),
          },
          invoice: {
            update: jest.fn().mockImplementation((args: any) => {
              finalStatus = args.data.status;
              return Promise.resolve({
                ...mockInvoice,
                paidAmount: new Decimal(1000),
                balanceAmount: new Decimal(0),
                status: args.data.status,
              });
            }),
          },
        });
      });

      await billingService.addPayment(invoiceId, {
        amount: 300,
        paymentMethod: 'CASH',
        createdBy: 'user-123',
      });

      expect(finalStatus).toBe('PAID');
    });

    it('should throw NotFoundError for non-existent invoice', async () => {
      prismaMock.invoice.findUnique.mockResolvedValue(null);

      await expect(
        billingService.addPayment('non-existent-id', {
          amount: 100,
          paymentMethod: 'CASH',
          createdBy: 'user-123',
        })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('updateClaimStatus', () => {
    it('should ensure updateClaimStatus and auto-payment are atomic', async () => {
      const claimId = 'claim-123';
      const invoiceId = 'inv-123';
      const mockClaim = createMockInsuranceClaim({
        id: claimId,
        invoiceId,
        claimAmount: new Decimal(1000),
        status: 'SUBMITTED',
      });
      const mockInvoice = createMockInvoice({ id: invoiceId });

      let claimUpdated = false;
      let paymentCreated = false;

      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        const txMock = {
          insuranceClaim: {
            update: jest.fn().mockImplementation(() => {
              claimUpdated = true;
              return Promise.resolve({
                ...mockClaim,
                status: 'APPROVED',
                approvedAmount: 800,
                invoice: mockInvoice,
              });
            }),
          },
          payment: {
            create: jest.fn().mockImplementation(() => {
              paymentCreated = true;
              if (!claimUpdated) {
                throw new Error('Payment should not be created before claim update');
              }
              return Promise.resolve(createMockPayment({
                invoiceId,
                amount: new Decimal(800),
                paymentMethod: 'INSURANCE',
              }));
            }),
          },
          invoice: {
            update: jest.fn().mockResolvedValue({
              ...mockInvoice,
              paidAmount: new Decimal(800),
              balanceAmount: new Decimal(200),
              status: 'PARTIALLY_PAID',
            }),
          },
        };
        return callback(txMock);
      });

      await billingService.updateClaimStatus(claimId, 'APPROVED', 800, 'user-123');

      expect(claimUpdated).toBe(true);
      expect(paymentCreated).toBe(true);
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should create auto-payment when claim is approved', async () => {
      const claimId = 'claim-123';
      const invoiceId = 'inv-123';
      const mockClaim = createMockInsuranceClaim({
        id: claimId,
        invoiceId,
        claimAmount: new Decimal(1000),
        status: 'SUBMITTED',
      });
      const mockInvoice = createMockInvoice({
        id: invoiceId,
        totalAmount: new Decimal(1000),
        balanceAmount: new Decimal(1000),
        paidAmount: new Decimal(0),
      });

      let paymentData: any = null;

      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        return callback({
          insuranceClaim: {
            update: jest.fn().mockResolvedValue({
              ...mockClaim,
              status: 'APPROVED',
              approvedAmount: 800,
              invoice: mockInvoice,
            }),
          },
          payment: {
            create: jest.fn().mockImplementation((args: any) => {
              paymentData = args.data;
              return Promise.resolve(createMockPayment({
                ...args.data,
              }));
            }),
          },
          invoice: {
            update: jest.fn().mockResolvedValue({
              ...mockInvoice,
              paidAmount: new Decimal(800),
              balanceAmount: new Decimal(200),
              status: 'PARTIALLY_PAID',
            }),
          },
        });
      });

      await billingService.updateClaimStatus(claimId, 'APPROVED', 800, 'user-123');

      expect(paymentData).toBeDefined();
      expect(paymentData.amount).toBe(800);
      expect(paymentData.paymentMethod).toBe('INSURANCE');
      expect(paymentData.createdBy).toBe('user-123');
    });

    it('should not create payment if claim is denied', async () => {
      const claimId = 'claim-123';
      const invoiceId = 'inv-123';
      const mockClaim = createMockInsuranceClaim({
        id: claimId,
        invoiceId,
        claimAmount: new Decimal(1000),
        status: 'SUBMITTED',
      });
      const mockInvoice = createMockInvoice({ id: invoiceId });

      let paymentCreated = false;

      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        return callback({
          insuranceClaim: {
            update: jest.fn().mockResolvedValue({
              ...mockClaim,
              status: 'DENIED',
              invoice: mockInvoice,
            }),
          },
          payment: {
            create: jest.fn().mockImplementation(() => {
              paymentCreated = true;
              return Promise.resolve({});
            }),
          },
        });
      });

      await billingService.updateClaimStatus(claimId, 'DENIED', undefined, 'user-123', 'INSUFFICIENT_DOCUMENTATION');

      expect(paymentCreated).toBe(false);
    });
  });

  describe('extractChargesFromNotes', () => {
    it('should extract charges from clinical notes', async () => {
      const hospitalId = 'hosp-123';
      const notes = 'Patient underwent ECG and blood draw. Initial consultation completed.';

      prismaMock.chargeMaster.findMany.mockResolvedValue([
        { id: '1', hospitalId, code: '93000', description: 'ECG', category: 'DIAGNOSTIC', defaultPrice: 150, currency: 'AED', unit: null, isActive: true, effectiveFrom: new Date(), effectiveTo: null, createdAt: new Date(), updatedAt: new Date(), createdBy: 'sys' },
        { id: '2', hospitalId, code: '36415', description: 'Blood draw venipuncture', category: 'LAB', defaultPrice: 50, currency: 'AED', unit: null, isActive: true, effectiveFrom: new Date(), effectiveTo: null, createdAt: new Date(), updatedAt: new Date(), createdBy: 'sys' },
        { id: '3', hospitalId, code: '99213', description: 'Office consultation', category: 'CONSULTATION', defaultPrice: 200, currency: 'AED', unit: null, isActive: true, effectiveFrom: new Date(), effectiveTo: null, createdAt: new Date(), updatedAt: new Date(), createdBy: 'sys' },
      ] as any);

      const result = await billingService.extractChargesFromNotes(notes, hospitalId);

      expect(result.capturedCharges.length).toBeGreaterThan(0);
      expect(result.capturedCharges.some(c => c.code === '93000')).toBe(true); // ECG
      expect(result.capturedCharges.some(c => c.code === '36415')).toBe(true); // Blood draw
      expect(result.subtotal).toBeGreaterThan(0);
    });

    it('should not capture duplicate charges', async () => {
      const hospitalId = 'hosp-123';
      const notes = 'ECG performed. Another ECG reading taken. ECG completed.';

      prismaMock.chargeMaster.findMany.mockResolvedValue([
        { id: '1', hospitalId, code: '93000', description: 'ECG', category: 'DIAGNOSTIC', defaultPrice: 150, currency: 'AED', unit: null, isActive: true, effectiveFrom: new Date(), effectiveTo: null, createdAt: new Date(), updatedAt: new Date(), createdBy: 'sys' },
      ] as any);

      const result = await billingService.extractChargesFromNotes(notes, hospitalId);

      const ecgCharges = result.capturedCharges.filter(c => c.code === '93000');
      expect(ecgCharges.length).toBe(1); // Should only capture once
    });
  });
});
