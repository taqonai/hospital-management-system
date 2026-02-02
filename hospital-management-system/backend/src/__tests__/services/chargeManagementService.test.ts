import { ChargeManagementService } from '../../services/chargeManagementService';
import { prismaMock } from '../prismaMock';
import { createMockUser } from '../factories';
import { NotFoundError } from '../../middleware/errorHandler';

describe('ChargeManagementService', () => {
  let service: ChargeManagementService;

  beforeEach(() => {
    service = new ChargeManagementService();
    jest.clearAllMocks();
  });

  describe('createCharge', () => {
    it('should create a charge successfully', async () => {
      const hospitalId = 'hosp-123';
      const userId = 'user-123';

      prismaMock.chargeMaster.findUnique.mockResolvedValue(null); // No duplicate

      const mockCharge = {
        id: 'charge-123',
        hospitalId,
        code: '99201',
        description: 'Initial Office Visit',
        category: 'CONSULTATION',
        defaultPrice: 150,
        currency: 'AED',
        unit: 'per visit',
        isActive: true,
        effectiveFrom: new Date(),
        effectiveTo: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userId,
      };

      prismaMock.chargeMaster.create.mockResolvedValue(mockCharge as any);

      const result = await service.createCharge(hospitalId, {
        code: '99201',
        description: 'Initial Office Visit',
        category: 'CONSULTATION',
        defaultPrice: 150,
        unit: 'per visit',
        createdBy: userId,
      });

      expect(result.code).toBe('99201');
      expect(result.hospitalId).toBe(hospitalId);
      expect(prismaMock.chargeMaster.create).toHaveBeenCalled();
    });

    it('should reject duplicate charge codes', async () => {
      const hospitalId = 'hosp-123';
      const userId = 'user-123';

      const existingCharge = {
        id: 'charge-123',
        hospitalId,
        code: '99201',
        description: 'Existing Charge',
        category: 'CONSULTATION',
        defaultPrice: 150,
        currency: 'AED',
        unit: null,
        isActive: true,
        effectiveFrom: new Date(),
        effectiveTo: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userId,
      };

      prismaMock.chargeMaster.findUnique.mockResolvedValue(existingCharge as any);

      await expect(
        service.createCharge(hospitalId, {
          code: '99201',
          description: 'Duplicate Charge',
          category: 'CONSULTATION',
          defaultPrice: 150,
          createdBy: userId,
        })
      ).rejects.toThrow('Charge code 99201 already exists');
    });
  });

  describe('updateCharge', () => {
    it('should update a charge successfully', async () => {
      const hospitalId = 'hosp-123';
      const chargeId = 'charge-123';

      const existingCharge = {
        id: chargeId,
        hospitalId,
        code: '99201',
        description: 'Initial Office Visit',
        category: 'CONSULTATION',
        defaultPrice: 150,
        currency: 'AED',
        unit: null,
        isActive: true,
        effectiveFrom: new Date(),
        effectiveTo: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-123',
      };

      prismaMock.chargeMaster.findFirst.mockResolvedValue(existingCharge as any);
      prismaMock.chargeMaster.update.mockResolvedValue({
        ...existingCharge,
        defaultPrice: 175,
      } as any);

      const result = await service.updateCharge(chargeId, hospitalId, {
        defaultPrice: 175,
      });

      expect(result.defaultPrice).toBe(175);
      expect(prismaMock.chargeMaster.update).toHaveBeenCalled();
    });

    it('should throw NotFoundError if charge does not exist', async () => {
      prismaMock.chargeMaster.findFirst.mockResolvedValue(null);

      await expect(
        service.updateCharge('non-existent-id', 'hosp-123', {
          defaultPrice: 175,
        })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('lookupPrice', () => {
    it('should return base price when no fee schedule exists', async () => {
      const hospitalId = 'hosp-123';
      const chargeCode = '99201';

      const mockCharge = {
        id: 'charge-123',
        hospitalId,
        code: chargeCode,
        description: 'Initial Office Visit',
        category: 'CONSULTATION',
        defaultPrice: 150,
        currency: 'AED',
        unit: 'per visit',
        isActive: true,
        effectiveFrom: new Date('2024-01-01'),
        effectiveTo: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-123',
      };

      prismaMock.chargeMaster.findUnique.mockResolvedValue(mockCharge as any);
      prismaMock.feeSchedule.findFirst.mockResolvedValue(null);

      const result = await service.lookupPrice(hospitalId, chargeCode);

      expect(result).not.toBeNull();
      expect(result?.code).toBe(chargeCode);
      expect(result?.basePrice).toBe(150);
      expect(result?.finalPrice).toBe(150);
      expect(result?.payerName).toBeNull();
    });

    it('should return payer-specific price when fee schedule exists', async () => {
      const hospitalId = 'hosp-123';
      const chargeCode = '99201';
      const payerId = 'payer-123';

      const mockCharge = {
        id: 'charge-123',
        hospitalId,
        code: chargeCode,
        description: 'Initial Office Visit',
        category: 'CONSULTATION',
        defaultPrice: 150,
        currency: 'AED',
        unit: 'per visit',
        isActive: true,
        effectiveFrom: new Date('2024-01-01'),
        effectiveTo: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-123',
      };

      const mockFeeSchedule = {
        id: 'fee-123',
        hospitalId,
        chargeId: 'charge-123',
        payerId,
        price: 120,
        discount: 20,
        effectiveFrom: new Date('2024-01-01'),
        effectiveTo: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-123',
        insurancePayer: {
          name: 'Test Insurance',
        },
      };

      prismaMock.chargeMaster.findUnique.mockResolvedValue(mockCharge as any);
      prismaMock.feeSchedule.findFirst.mockResolvedValue(mockFeeSchedule as any);

      const result = await service.lookupPrice(hospitalId, chargeCode, payerId);

      expect(result).not.toBeNull();
      expect(result?.basePrice).toBe(150);
      expect(result?.finalPrice).toBe(120);
      expect(result?.discount).toBe(20);
      expect(result?.payerName).toBe('Test Insurance');
    });

    it('should return null for inactive charges', async () => {
      const hospitalId = 'hosp-123';
      const chargeCode = '99201';

      const mockCharge = {
        id: 'charge-123',
        hospitalId,
        code: chargeCode,
        description: 'Initial Office Visit',
        category: 'CONSULTATION',
        defaultPrice: 150,
        currency: 'AED',
        unit: null,
        isActive: false, // Inactive
        effectiveFrom: new Date('2024-01-01'),
        effectiveTo: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-123',
      };

      prismaMock.chargeMaster.findUnique.mockResolvedValue(mockCharge as any);

      const result = await service.lookupPrice(hospitalId, chargeCode);

      expect(result).toBeNull();
    });
  });

  describe('seedHardcodedCharges', () => {
    it('should seed charges successfully', async () => {
      const hospitalId = 'hosp-123';
      const userId = 'user-123';

      // Mock that no charges exist
      prismaMock.chargeMaster.findUnique.mockResolvedValue(null);
      prismaMock.chargeMaster.create.mockResolvedValue({} as any);

      const result = await service.seedHardcodedCharges(hospitalId, userId);

      expect(result.created).toBeGreaterThan(0);
      expect(result.errors.length).toBe(0);
    });

    it('should skip existing charges', async () => {
      const hospitalId = 'hosp-123';
      const userId = 'user-123';

      // Mock that all charges already exist
      prismaMock.chargeMaster.findUnique.mockResolvedValue({
        id: 'existing',
        code: '99201',
      } as any);

      const result = await service.seedHardcodedCharges(hospitalId, userId);

      expect(result.skipped).toBeGreaterThan(0);
      expect(result.created).toBe(0);
    });

    it('should be idempotent (safe to run multiple times)', async () => {
      const hospitalId = 'hosp-123';
      const userId = 'user-123';

      // First run - create charges
      prismaMock.chargeMaster.findUnique.mockResolvedValue(null);
      prismaMock.chargeMaster.create.mockResolvedValue({} as any);

      const firstRun = await service.seedHardcodedCharges(hospitalId, userId);
      expect(firstRun.created).toBeGreaterThan(0);

      // Second run - skip existing charges
      prismaMock.chargeMaster.findUnique.mockResolvedValue({
        id: 'existing',
        code: '99201',
      } as any);

      const secondRun = await service.seedHardcodedCharges(hospitalId, userId);
      expect(secondRun.skipped).toBeGreaterThan(0);
      expect(secondRun.created).toBe(0);
    });
  });
});
