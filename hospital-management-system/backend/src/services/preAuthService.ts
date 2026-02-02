import prisma from '../config/database';
import { NotFoundError, AppError } from '../middleware/errorHandler';
import { Decimal } from '@prisma/client/runtime/library';
import logger from '../utils/logger';

interface CreatePreAuthData {
  patientId: string;
  insurancePolicyId: string;
  procedureCPTCode: string;
  diagnosisICDCode: string;
  urgency?: 'ROUTINE' | 'URGENT' | 'EMERGENCY';
  clinicalJustification?: string;
  estimatedCost?: number;
}

interface UpdatePreAuthData {
  status?: 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'PARTIALLY_APPROVED' | 'DENIED' | 'EXPIRED' | 'CANCELLED';
  authorizationNumber?: string;
  approvedUnits?: number;
  approvedAmount?: number;
  approvedFrom?: Date;
  approvedTo?: Date;
  denialReason?: string;
  reviewerNotes?: string;
  payerResponseDate?: Date;
}

interface CoverageDetails {
  isActive: boolean;
  copayAmount: number | null;
  copayPercentage: number | null;
  deductible: number | null;
  deductibleRemaining: number | null;
  requiresPreAuth: boolean;
  coveragePercentage: number;
  estimatedPatientResponsibility: number;
  estimatedInsuranceCoverage: number;
}

interface CopayDeductibleCalculation {
  totalAmount: number;
  copayAmount: number;
  deductibleAmount: number;
  coinsuranceAmount: number;
  insuranceCoverage: number;
  patientResponsibility: number;
  breakdown: {
    item: string;
    amount: number;
    copay: number;
    deductible: number;
    coinsurance: number;
  }[];
}

export class PreAuthService {
  private generatePreAuthNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `PRE-${timestamp}${random}`;
  }

  /**
   * Create a new pre-authorization request
   */
  async createPreAuthRequest(
    hospitalId: string,
    data: CreatePreAuthData,
    createdBy: string
  ) {
    const requestNumber = this.generatePreAuthNumber();

    // Verify patient and insurance policy exist
    const patient = await prisma.patient.findFirst({
      where: { id: data.patientId, hospitalId, isActive: true },
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    const insurancePolicy = await prisma.patientInsurance.findFirst({
      where: {
        id: data.insurancePolicyId,
        patientId: data.patientId,
        isActive: true,
      },
    });

    if (!insurancePolicy) {
      throw new NotFoundError('Insurance policy not found or inactive');
    }

    // Check if procedure requires pre-auth
    const cptCode = await prisma.cPTCode.findFirst({
      where: {
        hospitalId,
        code: data.procedureCPTCode,
        isActive: true,
      },
      include: {
        payerRules: true,
      },
    });

    if (!cptCode) {
      throw new NotFoundError(`CPT code ${data.procedureCPTCode} not found`);
    }

    // Check if diagnosis is valid
    const icdCode = await prisma.iCD10Code.findFirst({
      where: {
        hospitalId,
        code: data.diagnosisICDCode,
        isActive: true,
      },
    });

    if (!icdCode) {
      throw new NotFoundError(`ICD-10 code ${data.diagnosisICDCode} not found`);
    }

    // Create pre-auth request
    const preAuthRequest = await prisma.preAuthRequest.create({
      data: {
        hospitalId,
        patientId: data.patientId,
        insurancePolicyId: data.insurancePolicyId,
        requestNumber,
        procedureCPTCode: data.procedureCPTCode,
        diagnosisICDCode: data.diagnosisICDCode,
        urgency: data.urgency || 'ROUTINE',
        clinicalJustification: data.clinicalJustification,
        estimatedCost: data.estimatedCost
          ? new Decimal(data.estimatedCost)
          : null,
        status: 'PENDING',
        createdBy,
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            mrn: true,
          },
        },
        policy: true,
        payer: true,
      },
    });

    logger.info(`Pre-auth request created: ${requestNumber} for patient ${patient.mrn}`);

    return preAuthRequest;
  }

  /**
   * Update pre-authorization status
   */
  async updatePreAuthStatus(
    id: string,
    hospitalId: string,
    data: UpdatePreAuthData,
    updatedBy: string
  ) {
    const preAuth = await prisma.preAuthRequest.findFirst({
      where: { id, hospitalId },
    });

    if (!preAuth) {
      throw new NotFoundError('Pre-authorization request not found');
    }

    const updated = await prisma.preAuthRequest.update({
      where: { id },
      data: {
        ...data,
        ...(data.approvedAmount && {
          approvedAmount: new Decimal(data.approvedAmount),
        }),
        updatedBy,
        updatedAt: new Date(),
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            mrn: true,
          },
        },
        policy: true,
        payer: true,
      },
    });

    logger.info(`Pre-auth ${preAuth.requestNumber} updated to status: ${data.status}`);

    return updated;
  }

  /**
   * Get pre-authorization request by ID
   */
  async getPreAuthById(id: string, hospitalId: string) {
    const preAuth = await prisma.preAuthRequest.findFirst({
      where: { id, hospitalId },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            mrn: true,
            phone: true,
            dateOfBirth: true,
          },
        },
        policy: true,
        payer: true,
      },
    });

    if (!preAuth) {
      throw new NotFoundError('Pre-authorization request not found');
    }

    return preAuth;
  }

  /**
   * List pre-authorization requests with filters
   */
  async listPreAuthRequests(
    hospitalId: string,
    filters: {
      patientId?: string;
      status?: string;
      urgency?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const { patientId, status, urgency, page = 1, limit = 20 } = filters;

    const where: any = { hospitalId };

    if (patientId) where.patientId = patientId;
    if (status) where.status = status;
    if (urgency) where.urgency = urgency;

    const [data, total] = await Promise.all([
      prisma.preAuthRequest.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              mrn: true,
            },
          },
          policy: true,
          payer: true,
        },
      }),
      prisma.preAuthRequest.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Verify coverage and calculate patient responsibility
   */
  async verifyCoverage(
    hospitalId: string,
    patientId: string,
    procedureCPTCode: string,
    diagnosisICDCode: string
  ): Promise<CoverageDetails> {
    // Get patient's active primary insurance
    const insurance = await prisma.patientInsurance.findFirst({
      where: {
        patientId,
        isPrimary: true,
        isActive: true,
      },
    });

    if (!insurance) {
      return {
        isActive: false,
        copayAmount: null,
        copayPercentage: null,
        deductible: null,
        deductibleRemaining: null,
        requiresPreAuth: false,
        coveragePercentage: 0,
        estimatedPatientResponsibility: 0,
        estimatedInsuranceCoverage: 0,
      };
    }

    // Check if coverage is active (not expired)
    const isActive = insurance.expiryDate
      ? new Date() <= insurance.expiryDate
      : true;

    if (!isActive) {
      return {
        isActive: false,
        copayAmount: null,
        copayPercentage: null,
        deductible: null,
        deductibleRemaining: null,
        requiresPreAuth: false,
        coveragePercentage: 0,
        estimatedPatientResponsibility: 0,
        estimatedInsuranceCoverage: 0,
      };
    }

    // Get CPT code payer rules (if payer is linked)
    const cptCode = await prisma.cPTCode.findFirst({
      where: {
        hospitalId,
        code: procedureCPTCode,
        isActive: true,
      },
      include: {
        payerRules: true,
      },
    });

    const requiresPreAuth = cptCode?.requiresPreAuth || false;
    const copayAmount = insurance.copay ? Number(insurance.copay) : null;
    const deductible = insurance.deductible ? Number(insurance.deductible) : null;

    // For simplicity, assume 80% coverage after copay/deductible
    // In a real system, this would come from payer rules
    const coveragePercentage = 80;

    // Estimate patient responsibility (this is a simplified calculation)
    const estimatedProcedureCost = Number(cptCode?.basePrice || 0);
    const copayApplied = copayAmount || 0;
    const coinsurance = (estimatedProcedureCost - copayApplied) * (1 - coveragePercentage / 100);
    const estimatedPatientResponsibility = copayApplied + coinsurance;
    const estimatedInsuranceCoverage = estimatedProcedureCost - estimatedPatientResponsibility;

    return {
      isActive,
      copayAmount,
      copayPercentage: null,
      deductible,
      deductibleRemaining: deductible, // Simplified - would need to track YTD payments
      requiresPreAuth,
      coveragePercentage,
      estimatedPatientResponsibility,
      estimatedInsuranceCoverage,
    };
  }

  /**
   * Calculate copay, deductible, and coinsurance for invoice items
   */
  async calculateCopayDeductible(
    hospitalId: string,
    patientId: string,
    items: Array<{
      cptCode?: string;
      description: string;
      amount: number;
    }>
  ): Promise<CopayDeductibleCalculation> {
    // Get patient's primary insurance
    const insurance = await prisma.patientInsurance.findFirst({
      where: {
        patientId,
        isPrimary: true,
        isActive: true,
      },
    });

    let totalAmount = 0;
    let totalCopay = 0;
    let totalDeductible = 0;
    let totalCoinsurance = 0;

    const breakdown: CopayDeductibleCalculation['breakdown'] = [];

    for (const item of items) {
      let itemCopay = 0;
      let itemDeductible = 0;
      let itemCoinsurance = 0;

      totalAmount += item.amount;

      if (insurance) {
        // Apply copay (fixed amount per service)
        const copay = Number(insurance.copay || 0);
        itemCopay = Math.min(copay, item.amount);

        // Apply deductible with YTD tracking via DeductibleLedger
        const deductible = Number(insurance.deductible || 0);
        const remainingAfterCopay = item.amount - itemCopay;

        // Look up YTD accumulated deductible
        const fiscalYear = new Date().getFullYear();
        let ytdAccumulated = 0;
        try {
          const ledger = await prisma.deductibleLedger.findUnique({
            where: {
              hospitalId_patientId_fiscalYear: {
                hospitalId,
                patientId,
                fiscalYear,
              },
            },
          });
          if (ledger) {
            ytdAccumulated = Number(ledger.accumulatedAmount);
          }
        } catch (err) {
          logger.warn('[DEDUCTIBLE] Failed to query deductible ledger, using full deductible', err);
        }

        // Remaining deductible = max deductible - already accumulated this year
        const remainingDeductible = Math.max(0, deductible - ytdAccumulated);
        itemDeductible = Math.min(remainingDeductible, remainingAfterCopay);

        // Apply coinsurance (20% of remaining amount after copay/deductible)
        const remainingAfterDeductible = remainingAfterCopay - itemDeductible;
        itemCoinsurance = remainingAfterDeductible * 0.2; // 20% coinsurance
      } else {
        // No insurance - patient pays 100%
        itemCoinsurance = item.amount;
      }

      totalCopay += itemCopay;
      totalDeductible += itemDeductible;
      totalCoinsurance += itemCoinsurance;

      breakdown.push({
        item: item.description,
        amount: item.amount,
        copay: itemCopay,
        deductible: itemDeductible,
        coinsurance: itemCoinsurance,
      });
    }

    const patientResponsibility = totalCopay + totalDeductible + totalCoinsurance;
    const insuranceCoverage = totalAmount - patientResponsibility;

    return {
      totalAmount,
      copayAmount: totalCopay,
      deductibleAmount: totalDeductible,
      coinsuranceAmount: totalCoinsurance,
      insuranceCoverage,
      patientResponsibility,
      breakdown,
    };
  }

  /**
   * Update the deductible ledger for a patient after insurance payment
   */
  async updateDeductibleLedger(
    hospitalId: string,
    patientId: string,
    amount: number,
    maxDeductible: number
  ) {
    const fiscalYear = new Date().getFullYear();
    await prisma.deductibleLedger.upsert({
      where: {
        hospitalId_patientId_fiscalYear: {
          hospitalId,
          patientId,
          fiscalYear,
        },
      },
      update: {
        accumulatedAmount: { increment: amount },
        lastUpdated: new Date(),
      },
      create: {
        hospitalId,
        patientId,
        fiscalYear,
        accumulatedAmount: amount,
        maxDeductible,
      },
    });
  }

  /**
   * Check if procedure requires pre-authorization
   */
  async checkPreAuthRequirement(
    hospitalId: string,
    cptCode: string,
    payerId?: string
  ): Promise<{
    requiresPreAuth: boolean;
    payerName?: string;
    reason?: string;
  }> {
    const cpt = await prisma.cPTCode.findFirst({
      where: {
        hospitalId,
        code: cptCode,
        isActive: true,
      },
      include: {
        payerRules: {
          where: payerId ? { payerId } : undefined,
        },
      },
    });

    if (!cpt) {
      return { requiresPreAuth: false };
    }

    // Check global CPT requirement
    if (cpt.requiresPreAuth) {
      return {
        requiresPreAuth: true,
        reason: 'Procedure requires pre-authorization per hospital policy',
      };
    }

    // Check payer-specific rules
    const payerRule = cpt.payerRules.find((rule: any) => rule.requiresPreAuth);
    if (payerRule) {
      return {
        requiresPreAuth: true,
        reason: 'Procedure requires pre-authorization per insurance payer policy',
      };
    }

    return { requiresPreAuth: false };
  }
}

export const preAuthService = new PreAuthService();
