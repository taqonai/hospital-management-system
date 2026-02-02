import { billingService } from '../billingService';
import prisma from '../../config/database';
import { Decimal } from '@prisma/client/runtime/library';

// Mock dependencies
jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    invoice: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    invoiceItem: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    appointment: {
      findFirst: jest.fn(),
    },
    labOrder: {
      findFirst: jest.fn(),
    },
    patientInsurance: {
      findFirst: jest.fn(),
    },
    chargeMasterItem: {
      findFirst: jest.fn(),
    },
    insuranceClaim: {
      findFirst: jest.fn(),
    },
    payment: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('../chargeManagementService', () => ({
  chargeManagementService: {
    lookupPrice: jest.fn(),
  },
}));

jest.mock('../accountingService', () => ({
  accountingService: {
    recordInvoiceGL: jest.fn(),
    recordPaymentGL: jest.fn(),
  },
}));

jest.mock('../notificationService', () => ({
  notificationService: {
    sendNotification: jest.fn(),
  },
}));

jest.mock('../preAuthService', () => ({
  preAuthService: {
    checkPreAuthRequired: jest.fn(),
  },
}));

import { chargeManagementService } from '../chargeManagementService';

describe('BillingService - Auto-Billing', () => {
  const mockHospitalId = 'hospital-123';
  const mockUserId = 'user-123';
  const mockPatientId = 'patient-456';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('autoGenerateInvoice', () => {
    it('should generate invoice for completed appointment', async () => {
      const mockAppointment = {
        id: 'apt-001',
        hospitalId: mockHospitalId,
        patientId: mockPatientId,
        type: 'CONSULTATION',
        patient: { id: mockPatientId, firstName: 'John', lastName: 'Doe', mrn: 'MRN001' },
        doctor: {
          user: { id: 'doc-1', firstName: 'Jane', lastName: 'Smith' },
          department: { name: 'General Medicine' },
        },
        consultation: null,
      };

      (prisma.appointment.findFirst as jest.Mock).mockResolvedValue(mockAppointment);
      (prisma.patientInsurance.findFirst as jest.Mock).mockResolvedValue(null);
      (chargeManagementService.lookupPrice as jest.Mock).mockResolvedValue({
        finalPrice: 200,
        description: 'Initial Consultation',
      });

      // Mock createInvoice internals — createInvoice uses prisma.invoice.create
      const mockInvoice = {
        id: 'inv-001',
        invoiceNumber: 'INV-20250101-0001',
        hospitalId: mockHospitalId,
        patientId: mockPatientId,
        totalAmount: new Decimal(200),
        paidAmount: new Decimal(0),
        balanceAmount: new Decimal(200),
        status: 'PENDING',
        items: [{
          description: 'Initial Consultation - Dr. Jane Smith (General Medicine)',
          quantity: 1,
          unitPrice: new Decimal(200),
          totalPrice: new Decimal(200),
        }],
        patient: { id: mockPatientId, firstName: 'John', lastName: 'Doe', mrn: 'MRN001', email: null, phone: null },
      };

      (prisma.invoice.create as jest.Mock).mockResolvedValue(mockInvoice);

      const result = await billingService.autoGenerateInvoice('apt-001', mockHospitalId, mockUserId);

      expect(result).toBeDefined();
      expect(prisma.appointment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'apt-001', hospitalId: mockHospitalId },
        })
      );
      expect(chargeManagementService.lookupPrice).toHaveBeenCalledWith(
        mockHospitalId, 'initial_consultation', undefined
      );
    });

    it('should return null if appointment not found', async () => {
      (prisma.appointment.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await billingService.autoGenerateInvoice('apt-999', mockHospitalId, mockUserId);

      expect(result).toBeNull();
    });

    it('should use insurance payer ID for price lookup', async () => {
      const mockAppointment = {
        id: 'apt-002',
        hospitalId: mockHospitalId,
        patientId: mockPatientId,
        type: 'FOLLOW_UP',
        patient: { id: mockPatientId, firstName: 'John', lastName: 'Doe' },
        doctor: {
          user: { id: 'doc-1', firstName: 'Jane', lastName: 'Smith' },
          department: { name: 'Cardiology' },
        },
        consultation: null,
      };

      (prisma.appointment.findFirst as jest.Mock).mockResolvedValue(mockAppointment);
      (prisma.patientInsurance.findFirst as jest.Mock).mockResolvedValue({
        id: 'ins-001',
        isActive: true,
        isPrimary: true,
      });
      (chargeManagementService.lookupPrice as jest.Mock).mockResolvedValue({
        finalPrice: 100,
        description: 'Follow-up Visit',
      });

      const mockInvoice = {
        id: 'inv-002',
        invoiceNumber: 'INV-20250101-0002',
        totalAmount: new Decimal(100),
        paidAmount: new Decimal(0),
        balanceAmount: new Decimal(100),
        status: 'PENDING',
        items: [],
        patient: { id: mockPatientId, firstName: 'John', lastName: 'Doe', mrn: 'MRN001', email: null, phone: null },
      };

      (prisma.invoice.create as jest.Mock).mockResolvedValue(mockInvoice);

      await billingService.autoGenerateInvoice('apt-002', mockHospitalId, mockUserId);

      expect(chargeManagementService.lookupPrice).toHaveBeenCalledWith(
        mockHospitalId, 'follow_up', 'ins-001'
      );
    });
  });

  describe('addItemToInvoice', () => {
    it('should add item and recalculate totals', async () => {
      const existingInvoice = {
        id: 'inv-001',
        hospitalId: mockHospitalId,
        status: 'PENDING',
        discount: new Decimal(0),
        tax: new Decimal(0),
        paidAmount: new Decimal(0),
        items: [],
      };

      (prisma.invoice.findFirst as jest.Mock).mockResolvedValue(existingInvoice);

      const newItem = {
        id: 'item-1',
        invoiceId: 'inv-001',
        description: 'Lab Test - CBC',
        category: 'LAB',
        quantity: 1,
        unitPrice: new Decimal(50),
        totalPrice: new Decimal(50),
      };

      const updatedInvoice = {
        ...existingInvoice,
        totalAmount: new Decimal(50),
        balanceAmount: new Decimal(50),
        subtotal: new Decimal(50),
        items: [newItem],
        patient: { id: mockPatientId, firstName: 'John', lastName: 'Doe', mrn: 'MRN001' },
        invoiceNumber: 'INV-001',
      };

      (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
        if (typeof cb === 'function') {
          return cb({
            invoiceItem: {
              create: jest.fn().mockResolvedValue(newItem),
              findMany: jest.fn().mockResolvedValue([newItem]),
            },
            invoice: {
              update: jest.fn().mockResolvedValue(updatedInvoice),
            },
          });
        }
        return { item: newItem, invoice: updatedInvoice };
      });

      const result = await billingService.addItemToInvoice('inv-001', mockHospitalId, {
        description: 'Lab Test - CBC',
        category: 'LAB',
        quantity: 1,
        unitPrice: 50,
      }, mockUserId);

      expect(result).toBeDefined();
      expect(result.item).toBeDefined();
      expect(result.invoice).toBeDefined();
    });

    it('should throw if invoice not found', async () => {
      (prisma.invoice.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        billingService.addItemToInvoice('inv-999', mockHospitalId, {
          description: 'Test',
          category: 'LAB',
          quantity: 1,
          unitPrice: 100,
        }, mockUserId)
      ).rejects.toThrow('Invoice not found');
    });

    it('should throw if invoice is not PENDING or PARTIALLY_PAID', async () => {
      (prisma.invoice.findFirst as jest.Mock).mockResolvedValue({
        id: 'inv-001',
        hospitalId: mockHospitalId,
        status: 'PAID',
        items: [],
      });

      await expect(
        billingService.addItemToInvoice('inv-001', mockHospitalId, {
          description: 'Test',
          category: 'LAB',
          quantity: 1,
          unitPrice: 100,
        }, mockUserId)
      ).rejects.toThrow('Cannot add items to invoice with status PAID');
    });
  });

  describe('addLabCharges', () => {
    it('should add lab test charges to invoice', async () => {
      const mockLabOrder = {
        id: 'lab-001',
        hospitalId: mockHospitalId,
        patientId: mockPatientId,
        tests: [
          {
            labTest: { id: 'lt-1', name: 'Complete Blood Count', code: 'CBC', price: new Decimal(45) },
          },
          {
            labTest: { id: 'lt-2', name: 'Lipid Panel', code: 'LIPID', price: new Decimal(75) },
          },
        ],
        patient: { id: mockPatientId, firstName: 'John', lastName: 'Doe' },
      };

      (prisma.labOrder.findFirst as jest.Mock).mockResolvedValue(mockLabOrder);

      // Mock findOrCreateOpenInvoice (it's private, so mock the underlying calls)
      const mockInvoice = {
        id: 'inv-001',
        hospitalId: mockHospitalId,
        patientId: mockPatientId,
        status: 'PENDING',
        discount: new Decimal(0),
        tax: new Decimal(0),
        paidAmount: new Decimal(0),
        totalAmount: new Decimal(0),
        balanceAmount: new Decimal(0),
        invoiceNumber: 'INV-001',
        items: [],
        patient: { id: mockPatientId, firstName: 'John', lastName: 'Doe', mrn: 'MRN001' },
      };

      // findOrCreateOpenInvoice calls invoice.findFirst then potentially createInvoice
      (prisma.invoice.findFirst as jest.Mock).mockResolvedValue(mockInvoice);

      (chargeManagementService.lookupPrice as jest.Mock)
        .mockResolvedValueOnce({ finalPrice: 50, description: 'CBC Test' })
        .mockResolvedValueOnce({ finalPrice: 80, description: 'Lipid Panel' });

      // Mock addItemToInvoice transaction calls
      (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
        if (typeof cb === 'function') {
          const mockItem = { id: 'item-new', totalPrice: new Decimal(50) };
          return {
            item: mockItem,
            invoice: {
              ...mockInvoice,
              totalAmount: new Decimal(130),
              invoiceNumber: 'INV-001',
            },
          };
        }
        return mockInvoice;
      });

      const result = await billingService.addLabCharges('lab-001', mockHospitalId, mockUserId);

      expect(result).toBeDefined();
      expect(prisma.labOrder.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lab-001', hospitalId: mockHospitalId },
        })
      );
    });

    it('should return null if lab order not found', async () => {
      (prisma.labOrder.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await billingService.addLabCharges('lab-999', mockHospitalId, mockUserId);

      expect(result).toBeNull();
    });

    it('should skip tests with zero price', async () => {
      const mockLabOrder = {
        id: 'lab-002',
        hospitalId: mockHospitalId,
        patientId: mockPatientId,
        tests: [
          {
            labTest: { id: 'lt-1', name: 'Free Test', code: 'FREE', price: new Decimal(0) },
          },
        ],
        patient: { id: mockPatientId },
      };

      (prisma.labOrder.findFirst as jest.Mock).mockResolvedValue(mockLabOrder);

      const mockInvoice = {
        id: 'inv-001',
        hospitalId: mockHospitalId,
        patientId: mockPatientId,
        status: 'PENDING',
        items: [],
        patient: { id: mockPatientId, firstName: 'John', lastName: 'Doe', mrn: 'MRN001' },
      };

      (prisma.invoice.findFirst as jest.Mock).mockResolvedValue(mockInvoice);
      (chargeManagementService.lookupPrice as jest.Mock).mockResolvedValue(null);

      const result = await billingService.addLabCharges('lab-002', mockHospitalId, mockUserId);

      expect(result).toBeDefined();
      // addItemToInvoice should NOT have been called since price is 0
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
