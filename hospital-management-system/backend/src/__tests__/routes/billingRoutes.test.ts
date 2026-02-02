import request from 'supertest';
import express, { Express } from 'express';
import billingRoutes from '../../routes/billingRoutes';
import { prismaMock } from '../prismaMock';
import { createMockInvoice, createMockPayment, createMockPatient, createMockInsuranceClaim } from '../factories';
import { Decimal } from '@prisma/client/runtime/library';

// Mock middleware
jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    req.user = {
      userId: 'user-123',
      hospitalId: 'hosp-123',
      role: 'ACCOUNTANT',
    };
    next();
  },
  authorize: () => (req: any, res: any, next: any) => next(),
  authorizeWithPermission: () => (req: any, res: any, next: any) => next(),
}));

// Mock notification service
jest.mock('../../services/notificationService', () => ({
  notificationService: {
    sendBillingNotification: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('Billing Routes Integration Tests', () => {
  let app: Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/billing', billingRoutes);

    // Error handler
    app.use((err: any, req: any, res: any, next: any) => {
      res.status(err.statusCode || 500).json({
        success: false,
        message: err.message,
      });
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/billing/invoices', () => {
    it('should create a new invoice', async () => {
      const mockPatient = createMockPatient({ 
        id: 'patient-123', 
        hospitalId: 'hosp-123' 
      });
      
      const mockInvoice = createMockInvoice({
        hospitalId: 'hosp-123',
        patientId: 'patient-123',
        createdBy: 'user-123',
        subtotal: new Decimal(1000),
        discount: new Decimal(0),
        tax: new Decimal(0),
        totalAmount: new Decimal(1000),
        balanceAmount: new Decimal(1000),
      });

      prismaMock.invoice.create.mockResolvedValue({
        ...mockInvoice,
        patient: mockPatient,
        items: [],
      } as any);

      const response = await request(app)
        .post('/api/v1/billing/invoices')
        .send({
          patientId: 'patient-123',
          items: [
            {
              description: 'Consultation',
              category: 'CONSULTATION',
              quantity: 1,
              unitPrice: 1000,
            },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.createdBy).toBe('user-123');
    });

    it('should return 400 if required fields are missing', async () => {
      const response = await request(app)
        .post('/api/v1/billing/invoices')
        .send({
          // Missing patientId and items
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('POST /api/v1/billing/invoices/:invoiceId/payments', () => {
    it('should record a payment successfully', async () => {
      const invoiceId = 'inv-123';
      const mockInvoice = createMockInvoice({
        id: invoiceId,
        totalAmount: new Decimal(1000),
        balanceAmount: new Decimal(1000),
        paidAmount: new Decimal(0),
      });
      const mockPatient = createMockPatient();
      const mockPayment = createMockPayment({
        invoiceId,
        amount: new Decimal(500),
        createdBy: 'user-123',
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
              paidAmount: new Decimal(500),
              balanceAmount: new Decimal(500),
              status: 'PARTIALLY_PAID',
            }),
          },
        });
      });

      const response = await request(app)
        .post(`/api/v1/billing/invoices/${invoiceId}/payments`)
        .send({
          amount: 500,
          paymentMethod: 'CASH',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(Number(response.body.data.amount)).toBe(500);
    });

    it('should return 400 if payment exceeds balance', async () => {
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

      const response = await request(app)
        .post(`/api/v1/billing/invoices/${invoiceId}/payments`)
        .send({
          amount: 600, // Exceeds balance
          paymentMethod: 'CASH',
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/billing/invoices/:id', () => {
    it('should retrieve an invoice by ID', async () => {
      const invoiceId = 'inv-123';
      const mockInvoice = createMockInvoice({ 
        id: invoiceId,
        hospitalId: 'hosp-123',
      });
      const mockPatient = createMockPatient();

      prismaMock.invoice.findFirst.mockResolvedValue({
        ...mockInvoice,
        patient: mockPatient,
        items: [],
        payments: [],
        claims: [],
      } as any);

      const response = await request(app)
        .get(`/api/v1/billing/invoices/${invoiceId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(invoiceId);
    });

    it('should return 404 if invoice not found', async () => {
      prismaMock.invoice.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/billing/invoices/non-existent-id');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PATCH /api/v1/billing/claims/:claimId/status', () => {
    it('should update claim status successfully', async () => {
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
      });

      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        return callback({
          insuranceClaim: {
            update: jest.fn().mockResolvedValue({
              ...mockClaim,
              status: 'APPROVED',
              approvedAmount: new Decimal(800),
              invoice: mockInvoice,
            }),
          },
          payment: {
            create: jest.fn().mockResolvedValue(createMockPayment({
              invoiceId,
              amount: new Decimal(800),
              paymentMethod: 'INSURANCE',
            })),
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

      const response = await request(app)
        .patch(`/api/v1/billing/claims/${claimId}/status`)
        .send({
          status: 'APPROVED',
          approvedAmount: 800,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/v1/billing/invoices', () => {
    it('should retrieve paginated list of invoices', async () => {
      const mockInvoices = [
        createMockInvoice({ hospitalId: 'hosp-123' }),
        createMockInvoice({ hospitalId: 'hosp-123' }),
      ];

      prismaMock.invoice.findMany.mockResolvedValue(mockInvoices as any);
      prismaMock.invoice.count.mockResolvedValue(2);

      const response = await request(app)
        .get('/api/v1/billing/invoices')
        .query({ page: 1, limit: 20 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toBeDefined();
    });

    it('should filter invoices by status', async () => {
      const mockInvoices = [
        createMockInvoice({ hospitalId: 'hosp-123', status: 'PENDING' }),
      ];

      prismaMock.invoice.findMany.mockResolvedValue(mockInvoices as any);
      prismaMock.invoice.count.mockResolvedValue(1);

      const response = await request(app)
        .get('/api/v1/billing/invoices')
        .query({ status: 'PENDING' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
