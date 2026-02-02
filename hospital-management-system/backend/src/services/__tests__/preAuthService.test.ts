import { preAuthService } from '../preAuthService';
import prisma from '../../config/database';

// Mock Prisma
jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    patient: {
      findFirst: jest.fn(),
    },
    patientInsurance: {
      findFirst: jest.fn(),
    },
    cPTCode: {
      findFirst: jest.fn(),
    },
    iCD10Code: {
      findFirst: jest.fn(),
    },
    preAuthRequest: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe('PreAuthService', () => {
  const mockHospitalId = 'hospital-123';
  const mockUserId = 'user-123';
  const mockPatient = {
    id: 'patient-123',
    hospitalId: mockHospitalId,
    firstName: 'John',
    lastName: 'Doe',
    mrn: 'MRN001',
    isActive: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createPreAuthRequest', () => {
    it('should create a pre-auth request successfully', async () => {
      const mockInsurance = {
        id: 'insurance-123',
        patientId: 'patient-123',
        isActive: true,
      };

      const mockCPTCode = {
        id: 'cpt-123',
        code: '99213',
        requiresPreAuth: true,
        basePrice: 150,
      };

      const mockICDCode = {
        id: 'icd-123',
        code: 'J20.9',
        isActive: true,
      };

      const mockPreAuth = {
        id: 'preauth-123',
        requestNumber: 'PRE-ABC123',
        hospitalId: mockHospitalId,
        patientId: 'patient-123',
        status: 'PENDING',
      };

      (prisma.patient.findFirst as jest.Mock).mockResolvedValue(mockPatient);
      (prisma.patientInsurance.findFirst as jest.Mock).mockResolvedValue(
        mockInsurance
      );
      (prisma.cPTCode.findFirst as jest.Mock).mockResolvedValue(mockCPTCode);
      (prisma.iCD10Code.findFirst as jest.Mock).mockResolvedValue(mockICDCode);
      (prisma.preAuthRequest.create as jest.Mock).mockResolvedValue(mockPreAuth);

      const result = await preAuthService.createPreAuthRequest(
        mockHospitalId,
        {
          patientId: 'patient-123',
          insurancePolicyId: 'insurance-123',
          procedureCPTCode: '99213',
          diagnosisICDCode: 'J20.9',
          urgency: 'ROUTINE',
          clinicalJustification: 'Patient requires follow-up consultation',
        },
        mockUserId
      );

      expect(result).toBeDefined();
      expect(result.requestNumber).toContain('PRE-');
      expect(prisma.preAuthRequest.create).toHaveBeenCalledTimes(1);
    });

    it('should throw error if patient not found', async () => {
      (prisma.patient.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        preAuthService.createPreAuthRequest(
          mockHospitalId,
          {
            patientId: 'invalid-patient',
            insurancePolicyId: 'insurance-123',
            procedureCPTCode: '99213',
            diagnosisICDCode: 'J20.9',
          },
          mockUserId
        )
      ).rejects.toThrow('Patient not found');
    });

    it('should throw error if insurance policy not found', async () => {
      (prisma.patient.findFirst as jest.Mock).mockResolvedValue(mockPatient);
      (prisma.patientInsurance.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        preAuthService.createPreAuthRequest(
          mockHospitalId,
          {
            patientId: 'patient-123',
            insurancePolicyId: 'invalid-insurance',
            procedureCPTCode: '99213',
            diagnosisICDCode: 'J20.9',
          },
          mockUserId
        )
      ).rejects.toThrow('Insurance policy not found');
    });

    it('should throw error if CPT code not found', async () => {
      (prisma.patient.findFirst as jest.Mock).mockResolvedValue(mockPatient);
      (prisma.patientInsurance.findFirst as jest.Mock).mockResolvedValue({
        id: 'insurance-123',
      });
      (prisma.cPTCode.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        preAuthService.createPreAuthRequest(
          mockHospitalId,
          {
            patientId: 'patient-123',
            insurancePolicyId: 'insurance-123',
            procedureCPTCode: 'INVALID',
            diagnosisICDCode: 'J20.9',
          },
          mockUserId
        )
      ).rejects.toThrow('CPT code INVALID not found');
    });
  });

  describe('verifyCoverage', () => {
    it('should return coverage details for active insurance', async () => {
      const mockInsurance = {
        id: 'insurance-123',
        isPrimary: true,
        isActive: true,
        expiryDate: new Date('2027-12-31'),
        copay: 50,
        deductible: 500,
      };

      const mockCPTCode = {
        code: '99213',
        requiresPreAuth: false,
        basePrice: 150,
      };

      (prisma.patientInsurance.findFirst as jest.Mock).mockResolvedValue(
        mockInsurance
      );
      (prisma.cPTCode.findFirst as jest.Mock).mockResolvedValue(mockCPTCode);

      const result = await preAuthService.verifyCoverage(
        mockHospitalId,
        'patient-123',
        '99213',
        'J20.9'
      );

      expect(result.isActive).toBe(true);
      expect(result.copayAmount).toBe(50);
      expect(result.deductible).toBe(500);
      expect(result.coveragePercentage).toBe(80);
    });

    it('should return inactive coverage if no insurance found', async () => {
      (prisma.patientInsurance.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await preAuthService.verifyCoverage(
        mockHospitalId,
        'patient-123',
        '99213',
        'J20.9'
      );

      expect(result.isActive).toBe(false);
      expect(result.coveragePercentage).toBe(0);
    });

    it('should return inactive coverage if insurance expired', async () => {
      const mockInsurance = {
        id: 'insurance-123',
        isPrimary: true,
        isActive: true,
        expiryDate: new Date('2020-12-31'), // Expired
        copay: 50,
        deductible: 500,
      };

      (prisma.patientInsurance.findFirst as jest.Mock).mockResolvedValue(
        mockInsurance
      );

      const result = await preAuthService.verifyCoverage(
        mockHospitalId,
        'patient-123',
        '99213',
        'J20.9'
      );

      expect(result.isActive).toBe(false);
    });
  });

  describe('calculateCopayDeductible', () => {
    it('should calculate patient responsibility with insurance', async () => {
      const mockInsurance = {
        id: 'insurance-123',
        isPrimary: true,
        isActive: true,
        copay: 50,
        deductible: 100,
      };

      (prisma.patientInsurance.findFirst as jest.Mock).mockResolvedValue(
        mockInsurance
      );

      const items = [
        { description: 'Consultation', amount: 200 },
        { description: 'Lab Test', amount: 100 },
      ];

      const result = await preAuthService.calculateCopayDeductible(
        mockHospitalId,
        'patient-123',
        items
      );

      expect(result.totalAmount).toBe(300);
      expect(result.copayAmount).toBeGreaterThan(0);
      expect(result.patientResponsibility).toBeLessThan(300);
      expect(result.insuranceCoverage).toBeGreaterThan(0);
    });

    it('should calculate 100% patient responsibility without insurance', async () => {
      (prisma.patientInsurance.findFirst as jest.Mock).mockResolvedValue(null);

      const items = [{ description: 'Consultation', amount: 200 }];

      const result = await preAuthService.calculateCopayDeductible(
        mockHospitalId,
        'patient-123',
        items
      );

      expect(result.totalAmount).toBe(200);
      expect(result.copayAmount).toBe(0);
      expect(result.deductibleAmount).toBe(0);
      expect(result.patientResponsibility).toBe(200);
      expect(result.insuranceCoverage).toBe(0);
    });
  });

  describe('checkPreAuthRequirement', () => {
    it('should return true if CPT requires pre-auth', async () => {
      const mockCPTCode = {
        code: '99205',
        requiresPreAuth: true,
      };

      (prisma.cPTCode.findFirst as jest.Mock).mockResolvedValue(mockCPTCode);

      const result = await preAuthService.checkPreAuthRequirement(
        mockHospitalId,
        '99205'
      );

      expect(result.requiresPreAuth).toBe(true);
      expect(result.reason).toContain('hospital policy');
    });

    it('should return false if CPT does not require pre-auth', async () => {
      const mockCPTCode = {
        code: '99213',
        requiresPreAuth: false,
        payerRules: [],
      };

      (prisma.cPTCode.findFirst as jest.Mock).mockResolvedValue(mockCPTCode);

      const result = await preAuthService.checkPreAuthRequirement(
        mockHospitalId,
        '99213'
      );

      expect(result.requiresPreAuth).toBe(false);
    });

    it('should return false if CPT code not found', async () => {
      (prisma.cPTCode.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await preAuthService.checkPreAuthRequirement(
        mockHospitalId,
        'INVALID'
      );

      expect(result.requiresPreAuth).toBe(false);
    });
  });
});
