import prisma from '../config/database';
import { Decimal } from '@prisma/client/runtime/library';

export interface DeductibleStatus {
  fiscalYear: number;
  maxDeductible: number;
  usedAmount: number;
  remainingDeductible: number;
  deductibleMet: boolean;
  renewalDate?: Date;
}

export interface CopayCapStatus {
  fiscalYear: number;
  maxCopay: number;
  usedCopay: number;
  remainingCopay: number;
  copayCapReached: boolean;
}

class DeductibleService {
  /**
   * Get or create deductible ledger for a patient for current fiscal year
   */
  async getDeductibleStatus(
    hospitalId: string,
    patientId: string,
    insuranceId?: string
  ): Promise<DeductibleStatus> {
    const currentYear = new Date().getFullYear();

    // Get patient's insurance to determine max deductible
    let maxDeductible = 500; // Default AED 500 if no insurance
    let renewalDate: Date | undefined;

    if (insuranceId) {
      const insurance = await prisma.patientInsurance.findUnique({
        where: { id: insuranceId },
      });
      if (insurance?.annualDeductible) {
        maxDeductible = Number(insurance.annualDeductible);
      }
      if (insurance?.effectiveDate) {
        // Renewal date is typically 1 year from effective date
        renewalDate = new Date(insurance.effectiveDate);
        renewalDate.setFullYear(currentYear + 1);
      }
    }

    // Get or create ledger
    let ledger = await prisma.deductibleLedger.findUnique({
      where: {
        hospitalId_patientId_fiscalYear: {
          hospitalId,
          patientId,
          fiscalYear: currentYear,
        },
      },
    });

    if (!ledger) {
      // Create new ledger for this year
      ledger = await prisma.deductibleLedger.create({
        data: {
          hospitalId,
          patientId,
          insurancePolicyId: insuranceId,
          fiscalYear: currentYear,
          maxDeductible: new Decimal(maxDeductible),
          accumulatedAmount: new Decimal(0),
        },
      });
    }

    const usedAmount = Number(ledger.accumulatedAmount);
    const max = Number(ledger.maxDeductible);

    return {
      fiscalYear: currentYear,
      maxDeductible: max,
      usedAmount,
      remainingDeductible: Math.max(0, max - usedAmount),
      deductibleMet: usedAmount >= max,
      renewalDate,
    };
  }

  /**
   * Apply amount towards deductible
   * Returns amount that should be charged to patient vs insurance
   */
  async applyToDeductible(
    hospitalId: string,
    patientId: string,
    amount: number,
    insuranceId?: string
  ): Promise<{
    deductiblePortion: number;  // Patient pays this (goes to deductible)
    insurancePortion: number;   // Insurance covers this (after deductible met)
    newDeductibleStatus: DeductibleStatus;
  }> {
    const status = await this.getDeductibleStatus(hospitalId, patientId, insuranceId);

    if (status.deductibleMet) {
      // Deductible already met - insurance covers based on plan
      return {
        deductiblePortion: 0,
        insurancePortion: amount,
        newDeductibleStatus: status,
      };
    }

    // Calculate how much goes to deductible
    const deductiblePortion = Math.min(amount, status.remainingDeductible);
    const insurancePortion = amount - deductiblePortion;

    // Update ledger
    const currentYear = new Date().getFullYear();
    await prisma.deductibleLedger.update({
      where: {
        hospitalId_patientId_fiscalYear: {
          hospitalId,
          patientId,
          fiscalYear: currentYear,
        },
      },
      data: {
        accumulatedAmount: {
          increment: new Decimal(deductiblePortion),
        },
        lastUpdated: new Date(),
      },
    });

    // Get updated status
    const newStatus = await this.getDeductibleStatus(hospitalId, patientId, insuranceId);

    return {
      deductiblePortion,
      insurancePortion,
      newDeductibleStatus: newStatus,
    };
  }

  /**
   * Get annual copay cap status
   */
  async getCopayCapStatus(
    hospitalId: string,
    patientId: string,
    insuranceId?: string
  ): Promise<CopayCapStatus> {
    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59);

    // Get max copay from insurance plan
    let maxCopay = 1000; // Default AED 1000 annual cap
    if (insuranceId) {
      const insurance = await prisma.patientInsurance.findUnique({
        where: { id: insuranceId },
      });
      if (insurance?.annualCopayMax) {
        maxCopay = Number(insurance.annualCopayMax);
      }
    }

    // Calculate total copay paid this year from payments
    const copayPayments = await prisma.payment.aggregate({
      where: {
        hospitalId,
        patientId,
        paymentType: { in: ['COPAY', 'PHARMACY_COPAY'] },
        status: 'COMPLETED',
        createdAt: {
          gte: startOfYear,
          lte: endOfYear,
        },
      },
      _sum: {
        amount: true,
      },
    });

    const usedCopay = Number(copayPayments._sum.amount || 0);

    return {
      fiscalYear: currentYear,
      maxCopay,
      usedCopay,
      remainingCopay: Math.max(0, maxCopay - usedCopay),
      copayCapReached: usedCopay >= maxCopay,
    };
  }

  /**
   * Check if copay should be charged (considering cap)
   */
  async shouldChargeCopay(
    hospitalId: string,
    patientId: string,
    copayAmount: number,
    insuranceId?: string
  ): Promise<{
    shouldCharge: boolean;
    chargeAmount: number;
    message?: string;
    copayCapStatus: CopayCapStatus;
  }> {
    const capStatus = await this.getCopayCapStatus(hospitalId, patientId, insuranceId);

    if (capStatus.copayCapReached) {
      return {
        shouldCharge: false,
        chargeAmount: 0,
        message: `Patient has reached annual copay limit (AED ${capStatus.maxCopay}). No copay required.`,
        copayCapStatus: capStatus,
      };
    }

    // Calculate how much to charge (capped at remaining)
    const chargeAmount = Math.min(copayAmount, capStatus.remainingCopay);

    if (chargeAmount < copayAmount) {
      return {
        shouldCharge: true,
        chargeAmount,
        message: `Patient copay reduced from AED ${copayAmount} to AED ${chargeAmount} (annual cap).`,
        copayCapStatus: capStatus,
      };
    }

    return {
      shouldCharge: true,
      chargeAmount,
      copayCapStatus: capStatus,
    };
  }

  /**
   * Reset deductible for new fiscal year (called by cron job or policy renewal)
   */
  async resetDeductibleForYear(hospitalId: string, patientId: string, newYear: number): Promise<void> {
    // Check if ledger exists for new year
    const existing = await prisma.deductibleLedger.findUnique({
      where: {
        hospitalId_patientId_fiscalYear: {
          hospitalId,
          patientId,
          fiscalYear: newYear,
        },
      },
    });

    if (!existing) {
      // Get insurance to set max deductible
      const insurance = await prisma.patientInsurance.findFirst({
        where: {
          patientId,
          isActive: true,
          isPrimary: true,
        },
      });

      await prisma.deductibleLedger.create({
        data: {
          hospitalId,
          patientId,
          insurancePolicyId: insurance?.id,
          fiscalYear: newYear,
          maxDeductible: insurance?.annualDeductible || new Decimal(500),
          accumulatedAmount: new Decimal(0),
        },
      });
    }
  }
}

export const deductibleService = new DeductibleService();
