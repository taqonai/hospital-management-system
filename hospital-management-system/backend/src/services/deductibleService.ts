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
        invoice: { hospitalId, patientId },
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

  // === GAP 4: New methods for ledger-based deductible & copay tracking ===

  /**
   * Get or create a DeductibleLedger for a patient in the current fiscal year.
   * Populates maxDeductible and maxCopay from insurance if creating new.
   */
  async getOrCreateLedger(
    hospitalId: string,
    patientId: string,
    insuranceId?: string
  ): Promise<{
    ledger: any;
    deductible: { annual: number; used: number; remaining: number; metForYear: boolean };
    copay: { limit: number; used: number; remaining: number; metForYear: boolean };
  }> {
    const currentYear = new Date().getFullYear();

    // Get insurance plan limits
    let maxDeductible = 500; // Default AED 500
    let maxCopay = 0; // 0 = no cap
    if (insuranceId) {
      const insurance = await prisma.patientInsurance.findUnique({
        where: { id: insuranceId },
      });
      if (insurance?.annualDeductible) {
        maxDeductible = Number(insurance.annualDeductible);
      }
      if (insurance?.annualCopayMax) {
        maxCopay = Number(insurance.annualCopayMax);
      }
    }

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
      ledger = await prisma.deductibleLedger.create({
        data: {
          hospitalId,
          patientId,
          insurancePolicyId: insuranceId,
          fiscalYear: currentYear,
          maxDeductible: new Decimal(maxDeductible),
          accumulatedAmount: new Decimal(0),
          copayAccumulated: new Decimal(0),
          maxCopay: maxCopay > 0 ? new Decimal(maxCopay) : null,
        },
      });
    }

    const deductibleUsed = Number(ledger.accumulatedAmount);
    const deductibleMax = Number(ledger.maxDeductible);
    const copayUsed = Number(ledger.copayAccumulated || 0);
    const copayMax = Number(ledger.maxCopay || maxCopay);

    return {
      ledger,
      deductible: {
        annual: deductibleMax,
        used: deductibleUsed,
        remaining: Math.max(0, deductibleMax - deductibleUsed),
        metForYear: deductibleUsed >= deductibleMax,
      },
      copay: {
        limit: copayMax,
        used: copayUsed,
        remaining: copayMax > 0 ? Math.max(0, copayMax - copayUsed) : Number.MAX_SAFE_INTEGER,
        metForYear: copayMax > 0 && copayUsed >= copayMax,
      },
    };
  }

  /**
   * Record a copay payment against the ledger (called after CopayPayment creation).
   * Atomically increments both accumulatedAmount (deductible) and copayAccumulated.
   */
  async recordPayment(
    hospitalId: string,
    patientId: string,
    amount: number,
    insuranceId?: string
  ): Promise<void> {
    const currentYear = new Date().getFullYear();

    // Ensure ledger exists
    await this.getOrCreateLedger(hospitalId, patientId, insuranceId);

    await prisma.deductibleLedger.update({
      where: {
        hospitalId_patientId_fiscalYear: {
          hospitalId,
          patientId,
          fiscalYear: currentYear,
        },
      },
      data: {
        accumulatedAmount: { increment: new Decimal(amount) },
        copayAccumulated: { increment: new Decimal(amount) },
        lastUpdated: new Date(),
      },
    });
  }

  /**
   * Record a charge applied to the deductible (separate from copay payment).
   * Use when a charge is applied to deductible but copay tracking is separate.
   */
  async recordCharge(
    hospitalId: string,
    patientId: string,
    amount: number,
    insuranceId?: string
  ): Promise<void> {
    const currentYear = new Date().getFullYear();

    await this.getOrCreateLedger(hospitalId, patientId, insuranceId);

    await prisma.deductibleLedger.update({
      where: {
        hospitalId_patientId_fiscalYear: {
          hospitalId,
          patientId,
          fiscalYear: currentYear,
        },
      },
      data: {
        accumulatedAmount: { increment: new Decimal(amount) },
        lastUpdated: new Date(),
      },
    });
  }

  /**
   * Get remaining deductible from ledger for current year.
   */
  async getRemainingDeductible(
    hospitalId: string,
    patientId: string,
    insuranceId?: string
  ): Promise<{ annual: number; used: number; remaining: number; metForYear: boolean }> {
    const result = await this.getOrCreateLedger(hospitalId, patientId, insuranceId);
    return result.deductible;
  }

  /**
   * Get remaining copay max from ledger for current year.
   */
  async getRemainingCopayMax(
    hospitalId: string,
    patientId: string,
    insuranceId?: string
  ): Promise<{ limit: number; used: number; remaining: number; metForYear: boolean }> {
    const result = await this.getOrCreateLedger(hospitalId, patientId, insuranceId);
    return result.copay;
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
