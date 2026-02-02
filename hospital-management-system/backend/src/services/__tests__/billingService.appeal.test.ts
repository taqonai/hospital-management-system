import { billingService } from '../billingService';
import prisma from '../../config/database';

// Mock Prisma
jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    insuranceClaim: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe('BillingService - Claim Appeals', () => {
  const mockHospitalId = 'hospital-123';
  const mockUserId = 'user-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createClaimAppeal', () => {
    it('should create appeal for rejected claim', async () => {
      const mockOriginalClaim = {
        id: 'claim-123',
        invoiceId: 'invoice-123',
        claimNumber: 'CLM-001',
        status: 'REJECTED',
        insuranceProvider: 'Daman',
        insurancePayerId: 'payer-123',
        policyNumber: 'POL-123',
        claimAmount: 1000,
      };

      const mockAppealClaim = {
        id: 'appeal-claim-123',
        claimNumber: 'CLM-002',
        status: 'DRAFT',
        originalClaimId: 'claim-123',
        resubmissionCode: 'ADDITIONAL_INFO',
        appealNotes: 'Providing additional documentation',
        claimAmount: 1000,
      };

      (prisma.insuranceClaim.findFirst as jest.Mock).mockResolvedValue(
        mockOriginalClaim
      );
      (prisma.insuranceClaim.create as jest.Mock).mockResolvedValue(
        mockAppealClaim
      );
      (prisma.insuranceClaim.update as jest.Mock).mockResolvedValue({
        ...mockOriginalClaim,
        appealStatus: 'APPEALED',
      });

      const result = await billingService.createClaimAppeal(
        mockHospitalId,
        'claim-123',
        {
          resubmissionCode: 'ADDITIONAL_INFO',
          appealNotes: 'Providing additional documentation',
        },
        mockUserId
      );

      expect(result).toBeDefined();
      expect(result.originalClaimId).toBe('claim-123');
      expect(result.status).toBe('DRAFT');
      expect(prisma.insuranceClaim.create).toHaveBeenCalledTimes(1);
      expect(prisma.insuranceClaim.update).toHaveBeenCalledTimes(1);
    });

    it('should throw error if original claim not found', async () => {
      (prisma.insuranceClaim.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        billingService.createClaimAppeal(
          mockHospitalId,
          'invalid-claim',
          {
            resubmissionCode: 'ADDITIONAL_INFO',
            appealNotes: 'Test',
          },
          mockUserId
        )
      ).rejects.toThrow('Original claim not found');
    });

    it('should throw error if claim is not rejected', async () => {
      const mockClaim = {
        id: 'claim-123',
        status: 'APPROVED', // Not rejected
      };

      (prisma.insuranceClaim.findFirst as jest.Mock).mockResolvedValue(mockClaim);

      await expect(
        billingService.createClaimAppeal(
          mockHospitalId,
          'claim-123',
          {
            resubmissionCode: 'ADDITIONAL_INFO',
            appealNotes: 'Test',
          },
          mockUserId
        )
      ).rejects.toThrow('Can only appeal rejected claims');
    });

    it('should allow updated claim amount in appeal', async () => {
      const mockOriginalClaim = {
        id: 'claim-123',
        invoiceId: 'invoice-123',
        claimNumber: 'CLM-001',
        status: 'REJECTED',
        insuranceProvider: 'Daman',
        claimAmount: 1000,
      };

      const mockAppealClaim = {
        id: 'appeal-claim-123',
        claimNumber: 'CLM-002',
        claimAmount: 800, // Reduced amount
        originalClaimId: 'claim-123',
      };

      (prisma.insuranceClaim.findFirst as jest.Mock).mockResolvedValue(
        mockOriginalClaim
      );
      (prisma.insuranceClaim.create as jest.Mock).mockResolvedValue(
        mockAppealClaim
      );
      (prisma.insuranceClaim.update as jest.Mock).mockResolvedValue(
        mockOriginalClaim
      );

      const result = await billingService.createClaimAppeal(
        mockHospitalId,
        'claim-123',
        {
          resubmissionCode: 'CODING_ERROR',
          appealNotes: 'Correcting claim amount',
          updatedClaimAmount: 800,
        },
        mockUserId
      );

      expect(result).toBeDefined();
      expect(prisma.insuranceClaim.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            claimAmount: expect.any(Object), // Decimal type
          }),
        })
      );
    });
  });

  describe('submitClaimAppeal', () => {
    it('should submit draft appeal claim', async () => {
      const mockAppealClaim = {
        id: 'appeal-claim-123',
        status: 'DRAFT',
        claimNumber: 'CLM-002',
      };

      const mockSubmittedClaim = {
        ...mockAppealClaim,
        status: 'SUBMITTED',
        submittedAt: new Date(),
        appealStatus: 'UNDER_REVIEW',
      };

      (prisma.insuranceClaim.findFirst as jest.Mock).mockResolvedValue(
        mockAppealClaim
      );
      (prisma.insuranceClaim.update as jest.Mock).mockResolvedValue(
        mockSubmittedClaim
      );

      const result = await billingService.submitClaimAppeal(
        'appeal-claim-123',
        mockHospitalId,
        mockUserId
      );

      expect(result.status).toBe('SUBMITTED');
      expect(result.appealStatus).toBe('UNDER_REVIEW');
      expect(prisma.insuranceClaim.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'SUBMITTED',
            appealStatus: 'UNDER_REVIEW',
            submittedBy: mockUserId,
          }),
        })
      );
    });

    it('should throw error if claim not found', async () => {
      (prisma.insuranceClaim.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        billingService.submitClaimAppeal(
          'invalid-claim',
          mockHospitalId,
          mockUserId
        )
      ).rejects.toThrow('Appeal claim not found');
    });

    it('should throw error if claim already submitted', async () => {
      const mockClaim = {
        id: 'appeal-claim-123',
        status: 'SUBMITTED', // Already submitted
      };

      (prisma.insuranceClaim.findFirst as jest.Mock).mockResolvedValue(mockClaim);

      await expect(
        billingService.submitClaimAppeal(
          'appeal-claim-123',
          mockHospitalId,
          mockUserId
        )
      ).rejects.toThrow('Claim has already been submitted');
    });
  });

  describe('getClaimAppealHistory', () => {
    it('should return complete appeal chain', async () => {
      const mockClaim = {
        id: 'current-claim',
        claimNumber: 'CLM-003',
        status: 'SUBMITTED',
        originalClaimId: 'original-claim',
        originalClaim: {
          id: 'original-claim',
          claimNumber: 'CLM-001',
          status: 'REJECTED',
          originalClaim: null,
        },
        appeals: [
          {
            id: 'child-appeal',
            claimNumber: 'CLM-004',
            status: 'SUBMITTED',
            appealNotes: 'Second appeal',
          },
        ],
      };

      (prisma.insuranceClaim.findFirst as jest.Mock).mockResolvedValue(mockClaim);

      const result = await billingService.getClaimAppealHistory(
        'current-claim',
        mockHospitalId
      );

      expect(result).toHaveLength(3); // Original + Current + Child
      expect(result[0].claimNumber).toBe('CLM-001'); // Original first
      expect(result[1].claimNumber).toBe('CLM-003'); // Current second
      expect(result[2].claimNumber).toBe('CLM-004'); // Child third
      expect(result[0].type).toBe('ORIGINAL');
      expect(result[1].type).toBe('APPEAL');
      expect(result[2].type).toBe('APPEAL');
    });

    it('should throw error if claim not found', async () => {
      (prisma.insuranceClaim.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        billingService.getClaimAppealHistory('invalid-claim', mockHospitalId)
      ).rejects.toThrow('Claim not found');
    });

    it('should handle claim without appeals', async () => {
      const mockClaim = {
        id: 'claim-123',
        claimNumber: 'CLM-001',
        status: 'SUBMITTED',
        originalClaim: null,
        appeals: [],
      };

      (prisma.insuranceClaim.findFirst as jest.Mock).mockResolvedValue(mockClaim);

      const result = await billingService.getClaimAppealHistory(
        'claim-123',
        mockHospitalId
      );

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('ORIGINAL');
    });
  });
});
