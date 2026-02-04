/**
 * Insurance Underpayment Service
 * 
 * Handles scenarios where insurance remittance is less than claimed
 * - Auto-calculate shortfall
 * - Generate patient bill for difference
 * - Notify finance team
 * - Track for reporting
 */

import prisma from '../config/database';
import { Decimal } from '@prisma/client/runtime/library';
import logger from '../utils/logger';

export interface UnderpaymentResult {
  claimId: string;
  claimNumber: string;
  invoiceId: string;
  invoiceNumber: string;
  patientId: string;
  patientName: string;
  claimedAmount: number;
  approvedAmount: number;
  shortfall: number;
  shortfallPercentage: number;
  denialCodes?: string[];
  denialReasons?: string[];
  action: 'PATIENT_BILL_CREATED' | 'APPEAL_RECOMMENDED' | 'WRITE_OFF_RECOMMENDED';
  patientBillId?: string;
  recommendedAction: string;
}

export interface UnderpaymentReport {
  period: { start: Date; end: Date };
  totalClaims: number;
  totalClaimedAmount: number;
  totalApprovedAmount: number;
  totalShortfall: number;
  shortfallPercentage: number;
  byPayer: Array<{
    payerName: string;
    claimCount: number;
    claimedAmount: number;
    approvedAmount: number;
    shortfall: number;
    shortfallPercentage: number;
  }>;
  byDenialReason: Array<{
    reason: string;
    count: number;
    totalShortfall: number;
  }>;
  patientBillsGenerated: number;
  totalPatientBillAmount: number;
}

class InsuranceUnderpaymentService {
  
  /**
   * Process insurance remittance and handle underpayment
   */
  async processRemittance(
    claimId: string,
    remittanceData: {
      approvedAmount: number;
      paidAmount?: number;
      denialCodes?: string[];
      denialReasons?: string[];
      adjustmentCodes?: Array<{ code: string; amount: number; reason: string }>;
    }
  ): Promise<UnderpaymentResult> {
    const claim = await prisma.insuranceClaim.findUnique({
      where: { id: claimId },
      include: {
        invoice: {
          include: {
            patient: true,
            hospital: true,
          },
        },
      },
    });

    if (!claim) {
      throw new Error('Claim not found');
    }

    const claimedAmount = Number(claim.claimedAmount);
    const approvedAmount = remittanceData.approvedAmount;
    const shortfall = claimedAmount - approvedAmount;
    const shortfallPercentage = (shortfall / claimedAmount) * 100;

    // Update claim with remittance data
    await prisma.insuranceClaim.update({
      where: { id: claimId },
      data: {
        approvedAmount: new Decimal(approvedAmount),
        status: approvedAmount === 0 ? 'REJECTED' 
          : approvedAmount < claimedAmount ? 'PARTIALLY_APPROVED'
          : 'APPROVED',
        processedDate: new Date(),
        denialReason: remittanceData.denialReasons?.join('; '),
        notes: `${claim.notes || ''}\nRemittance received: Approved ${approvedAmount} of ${claimedAmount}`,
      },
    });

    let action: UnderpaymentResult['action'];
    let patientBillId: string | undefined;
    let recommendedAction: string;

    if (shortfall <= 0) {
      // Full payment - no action needed
      return {
        claimId,
        claimNumber: claim.claimNumber,
        invoiceId: claim.invoiceId,
        invoiceNumber: claim.invoice.invoiceNumber,
        patientId: claim.invoice.patientId,
        patientName: `${claim.invoice.patient.firstName} ${claim.invoice.patient.lastName}`,
        claimedAmount,
        approvedAmount,
        shortfall: 0,
        shortfallPercentage: 0,
        action: 'PATIENT_BILL_CREATED', // No actual bill needed
        recommendedAction: 'Claim paid in full. No further action required.',
      };
    }

    // Determine action based on shortfall amount and reasons
    if (this.shouldAppeal(shortfall, shortfallPercentage, remittanceData.denialCodes)) {
      action = 'APPEAL_RECOMMENDED';
      recommendedAction = `Shortfall of AED ${shortfall.toFixed(2)} (${shortfallPercentage.toFixed(1)}%) may be recoverable through appeal. Review denial codes: ${remittanceData.denialCodes?.join(', ') || 'N/A'}`;
    } else if (shortfall < 50) {
      action = 'WRITE_OFF_RECOMMENDED';
      recommendedAction = `Small shortfall of AED ${shortfall.toFixed(2)} recommended for write-off.`;
    } else {
      // Create patient bill for the shortfall
      action = 'PATIENT_BILL_CREATED';
      patientBillId = await this.createPatientBillForShortfall(claim, shortfall, remittanceData);
      recommendedAction = `Patient bill created for AED ${shortfall.toFixed(2)}. Original claim partially approved.`;
    }

    // Create underpayment record for tracking
    await this.recordUnderpayment(claim, shortfall, approvedAmount, remittanceData, action);

    // Notify finance team if significant
    if (shortfall > 100 || shortfallPercentage > 20) {
      await this.notifyFinanceTeam(claim, shortfall, shortfallPercentage, action);
    }

    // Update invoice balance
    await this.updateInvoiceBalance(claim.invoiceId, shortfall);

    return {
      claimId,
      claimNumber: claim.claimNumber,
      invoiceId: claim.invoiceId,
      invoiceNumber: claim.invoice.invoiceNumber,
      patientId: claim.invoice.patientId,
      patientName: `${claim.invoice.patient.firstName} ${claim.invoice.patient.lastName}`,
      claimedAmount,
      approvedAmount,
      shortfall,
      shortfallPercentage,
      denialCodes: remittanceData.denialCodes,
      denialReasons: remittanceData.denialReasons,
      action,
      patientBillId,
      recommendedAction,
    };
  }

  /**
   * Determine if claim should be appealed
   */
  private shouldAppeal(shortfall: number, percentage: number, denialCodes?: string[]): boolean {
    // Appeal if significant shortfall with appealable denial codes
    const appealableCodes = ['AUTH_REQUIRED', 'CODING_ERROR', 'TIMELY_FILING', 'DUPLICATE_DENIED'];
    
    if (denialCodes?.some(code => appealableCodes.includes(code))) {
      return true;
    }

    // Appeal if >30% shortfall and > AED 200
    if (percentage > 30 && shortfall > 200) {
      return true;
    }

    return false;
  }

  /**
   * Create patient bill for insurance shortfall
   */
  private async createPatientBillForShortfall(
    claim: any,
    shortfall: number,
    remittanceData: any
  ): Promise<string> {
    // Create a supplementary invoice for the shortfall
    const invoice = await prisma.invoice.create({
      data: {
        hospitalId: claim.invoice.hospitalId,
        patientId: claim.invoice.patientId,
        invoiceNumber: `${claim.invoice.invoiceNumber}-SH`,
        status: 'PENDING',
        paymentStatus: 'UNPAID',
        subtotal: new Decimal(shortfall),
        discount: new Decimal(0),
        tax: new Decimal(0),
        totalAmount: new Decimal(shortfall),
        balanceAmount: new Decimal(shortfall),
        notes: `Insurance shortfall bill. Original invoice: ${claim.invoice.invoiceNumber}. Claim: ${claim.claimNumber}. Reason: ${remittanceData.denialReasons?.join(', ') || 'Partial approval'}`,
        items: {
          create: [{
            description: `Insurance Shortfall - ${claim.insuranceProvider}`,
            category: 'INSURANCE_SHORTFALL',
            quantity: 1,
            unitPrice: new Decimal(shortfall),
            totalPrice: new Decimal(shortfall),
          }],
        },
      },
    });

    logger.info(`[UNDERPAYMENT] Created shortfall bill ${invoice.id} for AED ${shortfall}`);
    return invoice.id;
  }

  /**
   * Record underpayment for reporting
   */
  private async recordUnderpayment(
    claim: any,
    shortfall: number,
    approvedAmount: number,
    remittanceData: any,
    action: string
  ): Promise<void> {
    // Store in audit log for reporting
    await prisma.auditLog.create({
      data: {
        hospitalId: claim.invoice.hospitalId,
        userId: 'SYSTEM',
        action: 'INSURANCE_UNDERPAYMENT',
        entity: 'InsuranceClaim',
        entityId: claim.id,
        details: JSON.stringify({
          claimNumber: claim.claimNumber,
          invoiceNumber: claim.invoice.invoiceNumber,
          patientMrn: claim.invoice.patient.mrn,
          insuranceProvider: claim.insuranceProvider,
          claimedAmount: Number(claim.claimedAmount),
          approvedAmount,
          shortfall,
          shortfallPercentage: (shortfall / Number(claim.claimedAmount)) * 100,
          denialCodes: remittanceData.denialCodes,
          denialReasons: remittanceData.denialReasons,
          action,
        }),
      },
    });
  }

  /**
   * Notify finance team of significant underpayment
   */
  private async notifyFinanceTeam(
    claim: any,
    shortfall: number,
    percentage: number,
    action: string
  ): Promise<void> {
    await prisma.notification.create({
      data: {
        hospitalId: claim.invoice.hospitalId,
        type: 'INSURANCE_UNDERPAYMENT',
        title: `💰 Insurance Underpayment: ${claim.insuranceProvider}`,
        message: `Claim ${claim.claimNumber} received ${percentage.toFixed(1)}% less than claimed. Shortfall: AED ${shortfall.toFixed(2)}. Action: ${action}`,
        priority: percentage > 50 ? 'HIGH' : 'MEDIUM',
        referenceId: claim.id,
        referenceType: 'INSURANCE_CLAIM',
        targetRoles: ['HOSPITAL_ADMIN', 'ACCOUNTANT'],
      },
    });
  }

  /**
   * Update invoice balance after partial insurance payment
   */
  private async updateInvoiceBalance(invoiceId: string, shortfall: number): Promise<void> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (invoice) {
      const newBalance = Number(invoice.balanceAmount) + shortfall;
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          balanceAmount: new Decimal(Math.max(0, newBalance)),
          paymentStatus: newBalance > 0 ? 'PARTIAL' : 'PAID',
        },
      });
    }
  }

  /**
   * Generate underpayment report for a period
   */
  async generateUnderpaymentReport(
    hospitalId: string,
    startDate: Date,
    endDate: Date
  ): Promise<UnderpaymentReport> {
    // Get all underpayment records in period
    const underpayments = await prisma.auditLog.findMany({
      where: {
        hospitalId,
        action: 'INSURANCE_UNDERPAYMENT',
        createdAt: { gte: startDate, lte: endDate },
      },
    });

    let totalClaimed = 0;
    let totalApproved = 0;
    const byPayer: Map<string, { claimed: number; approved: number; count: number }> = new Map();
    const byReason: Map<string, { count: number; shortfall: number }> = new Map();

    for (const record of underpayments) {
      const details = typeof record.details === 'string' 
        ? JSON.parse(record.details) 
        : record.details as any;

      totalClaimed += details.claimedAmount || 0;
      totalApproved += details.approvedAmount || 0;

      // By payer
      const payer = details.insuranceProvider || 'Unknown';
      const payerData = byPayer.get(payer) || { claimed: 0, approved: 0, count: 0 };
      payerData.claimed += details.claimedAmount || 0;
      payerData.approved += details.approvedAmount || 0;
      payerData.count += 1;
      byPayer.set(payer, payerData);

      // By denial reason
      const reasons = details.denialReasons || ['Unknown'];
      for (const reason of reasons) {
        const reasonData = byReason.get(reason) || { count: 0, shortfall: 0 };
        reasonData.count += 1;
        reasonData.shortfall += details.shortfall || 0;
        byReason.set(reason, reasonData);
      }
    }

    const totalShortfall = totalClaimed - totalApproved;

    // Get patient bills generated for shortfalls
    const patientBills = await prisma.invoice.findMany({
      where: {
        hospitalId,
        createdAt: { gte: startDate, lte: endDate },
        items: { some: { category: 'INSURANCE_SHORTFALL' } },
      },
      select: { totalAmount: true },
    });

    return {
      period: { start: startDate, end: endDate },
      totalClaims: underpayments.length,
      totalClaimedAmount: totalClaimed,
      totalApprovedAmount: totalApproved,
      totalShortfall,
      shortfallPercentage: totalClaimed > 0 ? (totalShortfall / totalClaimed) * 100 : 0,
      byPayer: Array.from(byPayer.entries()).map(([name, data]) => ({
        payerName: name,
        claimCount: data.count,
        claimedAmount: data.claimed,
        approvedAmount: data.approved,
        shortfall: data.claimed - data.approved,
        shortfallPercentage: data.claimed > 0 ? ((data.claimed - data.approved) / data.claimed) * 100 : 0,
      })),
      byDenialReason: Array.from(byReason.entries()).map(([reason, data]) => ({
        reason,
        count: data.count,
        totalShortfall: data.shortfall,
      })),
      patientBillsGenerated: patientBills.length,
      totalPatientBillAmount: patientBills.reduce((sum, b) => sum + Number(b.totalAmount), 0),
    };
  }
}

export const insuranceUnderpaymentService = new InsuranceUnderpaymentService();
