import { paymentGatewayService } from '../services/paymentGatewayService';
import prisma from '../config/database';
import Stripe from 'stripe';

// Mock Stripe
jest.mock('stripe');
const MockStripe = Stripe as jest.MockedClass<typeof Stripe>;

// Mock Prisma
jest.mock('../config/database', () => ({
  __esModule: true,
  default: {
    invoice: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    paymentTransaction: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    payment: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(prisma)),
  },
}));

describe('PaymentGatewayService', () => {
  const mockHospitalId = 'hospital-123';
  const mockInvoiceId = 'invoice-123';
  const mockTransactionId = 'transaction-123';
  const mockPaymentId = 'payment-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createPaymentIntent', () => {
    it('should create a payment transaction record', async () => {
      const mockInvoice = {
        id: mockInvoiceId,
        invoiceNumber: 'INV-001',
        balanceAmount: 100,
        totalAmount: 100,
        patient: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          phone: '1234567890',
        },
      };

      (prisma.invoice.findFirst as jest.Mock).mockResolvedValue(mockInvoice);
      (prisma.paymentTransaction.create as jest.Mock).mockResolvedValue({
        id: mockTransactionId,
        hospitalId: mockHospitalId,
        invoiceId: mockInvoiceId,
        amount: 100,
        currency: 'AED',
        gatewayStatus: 'pending',
      });
      (prisma.paymentTransaction.update as jest.Mock).mockResolvedValue({});

      const result = await paymentGatewayService.createPaymentIntent(
        mockHospitalId,
        mockInvoiceId,
        100,
        'AED'
      );

      expect(prisma.invoice.findFirst).toHaveBeenCalledWith({
        where: { id: mockInvoiceId, hospitalId: mockHospitalId },
        include: expect.any(Object),
      });
      expect(prisma.paymentTransaction.create).toHaveBeenCalled();
      expect(result).toHaveProperty('transactionId');
      expect(result).toHaveProperty('clientSecret');
      expect(result.amount).toBe(100);
      expect(result.currency).toBe('AED');
    });

    it('should throw error if invoice not found', async () => {
      (prisma.invoice.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        paymentGatewayService.createPaymentIntent(mockHospitalId, mockInvoiceId, 100, 'AED')
      ).rejects.toThrow('Invoice not found');
    });

    it('should throw error if amount exceeds balance', async () => {
      const mockInvoice = {
        id: mockInvoiceId,
        balanceAmount: 50,
        patient: {},
      };

      (prisma.invoice.findFirst as jest.Mock).mockResolvedValue(mockInvoice);

      await expect(
        paymentGatewayService.createPaymentIntent(mockHospitalId, mockInvoiceId, 100, 'AED')
      ).rejects.toThrow('Payment amount (100) exceeds invoice balance (50)');
    });
  });

  describe('confirmPayment', () => {
    it('should create payment and update invoice', async () => {
      const mockTransaction = {
        id: mockTransactionId,
        invoiceId: mockInvoiceId,
        amount: 100,
        gatewayTransactionId: 'pi_test_123',
        paymentId: null,
        invoice: {
          id: mockInvoiceId,
          status: 'PENDING',
          totalAmount: 100,
          paidAmount: 0,
          balanceAmount: 100,
        },
      };

      const mockPayment = {
        id: mockPaymentId,
        invoiceId: mockInvoiceId,
        amount: 100,
      };

      const mockUpdatedInvoice = {
        id: mockInvoiceId,
        status: 'PAID',
        paidAmount: 100,
        balanceAmount: 0,
      };

      (prisma.paymentTransaction.findUnique as jest.Mock).mockResolvedValue(mockTransaction);
      (prisma.paymentTransaction.update as jest.Mock).mockResolvedValue({});
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        // Mock the transaction callback
        const tx = {
          payment: {
            create: jest.fn().mockResolvedValue(mockPayment),
          },
          paymentTransaction: {
            update: jest.fn().mockResolvedValue({}),
          },
          invoice: {
            update: jest.fn().mockResolvedValue(mockUpdatedInvoice),
          },
        };
        return callback(tx);
      });

      const result = await paymentGatewayService.confirmPayment(mockTransactionId, 'user-123');

      expect(result.success).toBe(true);
      expect(result.paymentId).toBeDefined();
      expect(result.invoiceStatus).toBe('PAID');
    });

    it('should handle idempotency - return existing payment', async () => {
      const mockTransaction = {
        id: mockTransactionId,
        paymentId: mockPaymentId,
        invoice: {
          status: 'PAID',
        },
      };

      const mockPayment = {
        id: mockPaymentId,
      };

      (prisma.paymentTransaction.findUnique as jest.Mock).mockResolvedValue(mockTransaction);
      (prisma.payment.findUnique as jest.Mock).mockResolvedValue(mockPayment);

      const result = await paymentGatewayService.confirmPayment(mockTransactionId, 'user-123');

      expect(result.success).toBe(true);
      expect(result.message).toContain('already recorded');
    });

    it('should throw error if transaction not found', async () => {
      (prisma.paymentTransaction.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        paymentGatewayService.confirmPayment(mockTransactionId, 'user-123')
      ).rejects.toThrow('Transaction not found');
    });
  });

  describe('getTransactionsByInvoice', () => {
    it('should return all transactions for an invoice', async () => {
      const mockTransactions = [
        {
          id: 'txn-1',
          invoiceId: mockInvoiceId,
          amount: 100,
          gatewayStatus: 'succeeded',
          createdAt: new Date(),
        },
        {
          id: 'txn-2',
          invoiceId: mockInvoiceId,
          amount: 50,
          gatewayStatus: 'succeeded',
          createdAt: new Date(),
        },
      ];

      (prisma.paymentTransaction.findMany as jest.Mock).mockResolvedValue(mockTransactions);

      const result = await paymentGatewayService.getTransactionsByInvoice(mockInvoiceId);

      expect(prisma.paymentTransaction.findMany).toHaveBeenCalledWith({
        where: { invoiceId: mockInvoiceId },
        orderBy: { createdAt: 'desc' },
        include: { payment: true },
      });
      expect(result).toHaveLength(2);
    });
  });

  describe('handleWebhook', () => {
    it('should handle payment_intent.succeeded event', async () => {
      const mockPaymentIntent = {
        id: 'pi_123',
        metadata: { transactionId: mockTransactionId },
        charges: {
          data: [
            {
              payment_method_details: { type: 'card', card: { last4: '4242' } },
              receipt_url: 'https://stripe.com/receipt',
            },
          ],
        },
      };

      const mockTransaction = {
        id: mockTransactionId,
        invoiceId: mockInvoiceId,
        amount: 100,
        paymentId: null,
        invoice: {
          id: mockInvoiceId,
          status: 'PENDING',
          totalAmount: 100,
          paidAmount: 0,
          balanceAmount: 100,
        },
      };

      (prisma.paymentTransaction.findUnique as jest.Mock).mockResolvedValue(mockTransaction);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          paymentTransaction: {
            update: jest.fn().mockResolvedValue({}),
          },
          payment: {
            create: jest.fn().mockResolvedValue({ id: mockPaymentId }),
          },
          invoice: {
            update: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      // We can't fully test webhook without mocking Stripe SDK's webhook verification
      // But we can test the internal handler
      await (paymentGatewayService as any).handlePaymentIntentSucceeded(mockPaymentIntent);

      expect(prisma.paymentTransaction.findUnique).toHaveBeenCalledWith({
        where: { id: mockTransactionId },
        include: { invoice: true },
      });
    });
  });
});
