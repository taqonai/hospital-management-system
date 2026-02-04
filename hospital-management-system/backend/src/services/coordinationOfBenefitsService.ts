/**
 * Coordination of Benefits (COB) Service
 * Handles billing when patient has multiple insurance policies
 * 
 * UAE Workflow:
 * 1. Bill primary insurance first
 * 2. Remaining balance → bill secondary insurance
 * 3. Any remaining after both → patient copay
 */

import prisma from '../config/database';
import { Decimal } from '@prisma/client/runtime/library';
import logger from '../utils/logger';

export interface InsuranceSplit {
  primaryInsurance: {
    id: string;
    providerName: string;
    policyNumber: string;
    claimedAmount: number;
    approvedAmount: number;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PARTIAL';
  } | null;
  secondaryInsurance: {
    id: string;
    providerName: string;
    policyNumber: string;
    claimedAmount: number;
    approvedAmount: number;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PARTIAL';
  } | null;
  patientResponsibility: number;
  totalAmount: number;
  breakdown: {
    description: string;
    amount: number;
    paidBy: 'PRIMARY' | 'SECONDARY' | 'PATIENT';
  }[];
}

export interface COBCalculationResult {
  success: boolean;
  primaryCoverage: number;
  secondaryCoverage: number;
  patientCopay: number;
  totalAmount: number;
  insurances: {
    priority: number;
    providerName: string;
    policyNumber: string;
    coveragePercentage: number;
    coverageAmount: number;
    remainingAfter: number;
  }[];
  message?: string;
}

class CoordinationOfBenefitsService {
  
  /**
   * Get patient's active insurance policies ordered by priority
   */
  async getPatientInsurances(patientId: string): Promise<any[]> {
    const insurances = await prisma.patientInsurance.findMany({
      where: {
        patientId,
        isActive: true,
        OR: [
          { expiryDate: null },
          { expiryDate: { gte: new Date() } },
        ],
      },
      orderBy: [
        { priority: 'asc' },
        { isPrimary: 'desc' },
      ],
    });

    return insurances;
  }

  /**
   * Calculate insurance split for a given amount
   * Follows COB rules: Primary pays first, secondary covers remainder
   */
  async calculateCOBSplit(
    patientId: string,
    totalAmount: number,
    serviceCategory?: string
  ): Promise<COBCalculationResult> {
    const insurances = await this.getPatientInsurances(patientId);

    if (insurances.length === 0) {
      return {
        success: true,
        primaryCoverage: 0,
        secondaryCoverage: 0,
        patientCopay: totalAmount,
        totalAmount,
        insurances: [],
        message: 'No active insurance - patient pays full amount',
      };
    }

    let remainingAmount = totalAmount;
    let primaryCoverage = 0;
    let secondaryCoverage = 0;
    const insuranceDetails: COBCalculationResult['insurances'] = [];

    for (const insurance of insurances) {
      if (remainingAmount <= 0) break;

      // Calculate coverage based on policy
      const coveragePercentage = this.getCoveragePercentage(insurance, serviceCategory);
      const copay = Number(insurance.copay) || 0;
      const deductible = Number(insurance.deductible) || 0;

      // Calculate what this insurance covers
      let coverageAmount = (remainingAmount * coveragePercentage) / 100;
      
      // Apply any fixed copay (deducted from coverage)
      if (copay > 0) {
        coverageAmount = Math.max(0, coverageAmount - copay);
      }

      // Apply deductible (patient pays first)
      if (deductible > 0 && insurance.priority === 1) {
        // Deductible only applies to primary insurance
        const deductibleRemaining = await this.getRemainingDeductible(insurance.id);
        if (deductibleRemaining > 0) {
          const deductibleApplied = Math.min(deductibleRemaining, coverageAmount);
          coverageAmount -= deductibleApplied;
        }
      }

      coverageAmount = Math.min(coverageAmount, remainingAmount);

      if (insurance.priority === 1) {
        primaryCoverage = coverageAmount;
      } else if (insurance.priority === 2) {
        secondaryCoverage = coverageAmount;
      }

      remainingAmount -= coverageAmount;

      insuranceDetails.push({
        priority: insurance.priority,
        providerName: insurance.providerName,
        policyNumber: insurance.policyNumber,
        coveragePercentage,
        coverageAmount,
        remainingAfter: remainingAmount,
      });
    }

    return {
      success: true,
      primaryCoverage,
      secondaryCoverage,
      patientCopay: Math.max(0, remainingAmount),
      totalAmount,
      insurances: insuranceDetails,
      message: insurances.length > 1 
        ? `Coordination of Benefits applied with ${insurances.length} policies`
        : 'Single insurance policy applied',
    };
  }

  /**
   * Get coverage percentage based on service category and network status
   */
  private getCoveragePercentage(insurance: any, serviceCategory?: string): number {
    // Default coverage based on network tier
    let baseCoverage = insurance.networkTier === 'IN_NETWORK' ? 80 : 50;

    // Adjust based on coverage type
    if (insurance.coverageType === 'ENHANCED' || insurance.coverageType === 'PLATINUM') {
      baseCoverage = Math.min(100, baseCoverage + 10);
    } else if (insurance.coverageType === 'BASIC') {
      baseCoverage = Math.max(50, baseCoverage - 10);
    }

    // Category-specific adjustments
    if (serviceCategory) {
      switch (serviceCategory.toUpperCase()) {
        case 'EMERGENCY':
          baseCoverage = Math.min(100, baseCoverage + 10); // Higher coverage for emergency
          break;
        case 'PREVENTIVE':
        case 'WELLNESS':
          baseCoverage = 100; // Often 100% covered
          break;
        case 'COSMETIC':
          baseCoverage = 0; // Usually not covered
          break;
      }
    }

    return baseCoverage;
  }

  /**
   * Get remaining deductible for an insurance policy
   */
  private async getRemainingDeductible(insuranceId: string): Promise<number> {
    const insurance = await prisma.patientInsurance.findUnique({
      where: { id: insuranceId },
    });

    if (!insurance || !insurance.annualDeductible) {
      return 0;
    }

    // Calculate YTD deductible usage
    const startOfYear = new Date(new Date().getFullYear(), 0, 1);
    
    const ytdPayments = await prisma.invoiceItem.aggregate({
      _sum: { patientAmount: true },
      where: {
        invoice: {
          patientId: insurance.patientId,
          status: 'PAID',
          createdAt: { gte: startOfYear },
        },
      },
    });

    const usedDeductible = Number(ytdPayments._sum.patientAmount) || 0;
    return Math.max(0, Number(insurance.annualDeductible) - usedDeductible);
  }

  /**
   * Create insurance claims for both primary and secondary insurers
   */
  async createCOBClaims(
    invoiceId: string,
    hospitalId: string,
    cobResult: COBCalculationResult
  ): Promise<{ primaryClaimId?: string; secondaryClaimId?: string }> {
    const result: { primaryClaimId?: string; secondaryClaimId?: string } = {};

    for (const ins of cobResult.insurances) {
      if (ins.coverageAmount <= 0) continue;

      const claim = await prisma.insuranceClaim.create({
        data: {
          hospitalId,
          invoiceId,
          claimNumber: `CLM-${Date.now()}-${ins.priority}`,
          insuranceProvider: ins.providerName,
          status: 'PENDING',
          claimedAmount: new Decimal(ins.coverageAmount),
          submittedDate: new Date(),
          notes: `COB Priority ${ins.priority} - ${ins.policyNumber}`,
        },
      });

      if (ins.priority === 1) {
        result.primaryClaimId = claim.id;
      } else if (ins.priority === 2) {
        result.secondaryClaimId = claim.id;
      }
    }

    return result;
  }

  /**
   * Process secondary claim after primary claim is adjudicated
   */
  async processSecondaryClaimAfterPrimary(
    invoiceId: string,
    primaryClaimResult: {
      approvedAmount: number;
      rejectedAmount: number;
      denialCodes?: string[];
    }
  ): Promise<void> {
    // Find secondary claim
    const secondaryClaim = await prisma.insuranceClaim.findFirst({
      where: {
        invoiceId,
        notes: { contains: 'COB Priority 2' },
      },
    });

    if (!secondaryClaim) {
      logger.info('[COB] No secondary claim found for invoice:', invoiceId);
      return;
    }

    // Recalculate secondary claim amount based on primary result
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) return;

    const totalAmount = Number(invoice.totalAmount);
    const primaryPaid = primaryClaimResult.approvedAmount;
    const remainingForSecondary = totalAmount - primaryPaid;

    // Update secondary claim amount
    await prisma.insuranceClaim.update({
      where: { id: secondaryClaim.id },
      data: {
        claimedAmount: new Decimal(Math.max(0, remainingForSecondary)),
        notes: `${secondaryClaim.notes} | Adjusted after primary paid ${primaryPaid}`,
      },
    });

    logger.info(`[COB] Secondary claim ${secondaryClaim.id} adjusted to ${remainingForSecondary}`);
  }

  /**
   * Get COB summary for an invoice
   */
  async getInvoiceCOBSummary(invoiceId: string): Promise<InsuranceSplit> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        insuranceClaims: true,
        patient: {
          include: {
            insurances: {
              where: { isActive: true },
              orderBy: { priority: 'asc' },
            },
          },
        },
      },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const totalAmount = Number(invoice.totalAmount);
    const claims = invoice.insuranceClaims || [];
    
    // Find primary and secondary claims
    const primaryClaim = claims.find(c => c.notes?.includes('Priority 1'));
    const secondaryClaim = claims.find(c => c.notes?.includes('Priority 2'));

    const primaryApproved = primaryClaim ? Number(primaryClaim.approvedAmount || 0) : 0;
    const secondaryApproved = secondaryClaim ? Number(secondaryClaim.approvedAmount || 0) : 0;
    const patientResponsibility = totalAmount - primaryApproved - secondaryApproved;

    return {
      primaryInsurance: primaryClaim ? {
        id: primaryClaim.id,
        providerName: primaryClaim.insuranceProvider,
        policyNumber: primaryClaim.claimNumber,
        claimedAmount: Number(primaryClaim.claimedAmount),
        approvedAmount: primaryApproved,
        status: primaryClaim.status as any,
      } : null,
      secondaryInsurance: secondaryClaim ? {
        id: secondaryClaim.id,
        providerName: secondaryClaim.insuranceProvider,
        policyNumber: secondaryClaim.claimNumber,
        claimedAmount: Number(secondaryClaim.claimedAmount),
        approvedAmount: secondaryApproved,
        status: secondaryClaim.status as any,
      } : null,
      patientResponsibility: Math.max(0, patientResponsibility),
      totalAmount,
      breakdown: [
        ...(primaryClaim ? [{
          description: `Primary Insurance (${primaryClaim.insuranceProvider})`,
          amount: primaryApproved,
          paidBy: 'PRIMARY' as const,
        }] : []),
        ...(secondaryClaim ? [{
          description: `Secondary Insurance (${secondaryClaim.insuranceProvider})`,
          amount: secondaryApproved,
          paidBy: 'SECONDARY' as const,
        }] : []),
        {
          description: 'Patient Copay/Deductible',
          amount: Math.max(0, patientResponsibility),
          paidBy: 'PATIENT' as const,
        },
      ],
    };
  }
}

export const cobService = new CoordinationOfBenefitsService();
