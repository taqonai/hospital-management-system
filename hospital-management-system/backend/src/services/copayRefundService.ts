/**
 * GAP 9: Copay Refund Service
 *
 * Handles refund requests for copay payments. Separate flow from collectCopay:
 * - Receptionist/staff requests refund
 * - Admin approves/rejects
 * - Approved refunds are processed and update DeductibleLedger
 */

import prisma from '../config/database';

const VALID_REASONS = [
  'APPOINTMENT_CANCELLED',
  'INSURANCE_UPDATED',
  'OVERCHARGE',
  'DOCTOR_WAIVED',
  'OTHER',
];

const VALID_METHODS = ['CASH', 'CREDIT_CARD', 'BANK_TRANSFER', 'DEPOSIT_CREDIT'];

class CopayRefundService {
  /**
   * Request a copay refund. Creates a PENDING refund entry.
   */
  async requestRefund(hospitalId: string, params: {
    copayPaymentId: string;
    refundAmount: number;
    refundReason: string;
    reasonDetails?: string;
    refundMethod?: string;
    requestedBy: string;
  }) {
    const { copayPaymentId, refundAmount, refundReason, reasonDetails, refundMethod, requestedBy } = params;

    if (!VALID_REASONS.includes(refundReason)) {
      throw new Error(`Invalid refund reason. Must be one of: ${VALID_REASONS.join(', ')}`);
    }

    if (refundMethod && !VALID_METHODS.includes(refundMethod)) {
      throw new Error(`Invalid refund method. Must be one of: ${VALID_METHODS.join(', ')}`);
    }

    // Find the original copay payment
    const copayPayment = await prisma.copayPayment.findUnique({
      where: { id: copayPaymentId },
    });

    if (!copayPayment) {
      throw new Error('Copay payment not found');
    }

    const paidAmount = Number(copayPayment.amount);

    // Check refund doesn't exceed original payment
    // Sum any existing non-rejected refunds for this payment
    const existingRefunds = await (prisma as any).copayRefund.aggregate({
      where: {
        copayPaymentId,
        status: { notIn: ['REJECTED'] },
      },
      _sum: { refundAmount: true },
    });

    const alreadyRefunded = Number(existingRefunds._sum?.refundAmount || 0);
    const maxRefundable = paidAmount - alreadyRefunded;

    if (refundAmount <= 0) {
      throw new Error('Refund amount must be positive');
    }

    if (refundAmount > maxRefundable) {
      throw new Error(
        `Refund amount (AED ${refundAmount.toFixed(2)}) exceeds refundable balance (AED ${maxRefundable.toFixed(2)})`
      );
    }

    const refund = await (prisma as any).copayRefund.create({
      data: {
        hospitalId,
        copayPaymentId,
        patientId: copayPayment.patientId,
        appointmentId: copayPayment.appointmentId,
        refundAmount,
        refundMethod: refundMethod || null,
        refundReason,
        reasonDetails: reasonDetails || null,
        status: 'PENDING',
        requestedBy,
      },
    });

    return refund;
  }

  /**
   * Approve a pending refund (admin action).
   */
  async approveRefund(refundId: string, hospitalId: string, approvedBy: string) {
    const refund = await (prisma as any).copayRefund.findFirst({
      where: { id: refundId, hospitalId },
    });

    if (!refund) {
      throw new Error('Refund not found');
    }

    if (refund.status !== 'PENDING') {
      throw new Error(`Cannot approve refund in '${refund.status}' status`);
    }

    const updated = await (prisma as any).copayRefund.update({
      where: { id: refundId },
      data: {
        status: 'APPROVED',
        approvedBy,
        approvedAt: new Date(),
      },
    });

    return updated;
  }

  /**
   * Reject a pending refund (admin action).
   */
  async rejectRefund(refundId: string, hospitalId: string, rejectedBy: string, rejectionReason: string) {
    const refund = await (prisma as any).copayRefund.findFirst({
      where: { id: refundId, hospitalId },
    });

    if (!refund) {
      throw new Error('Refund not found');
    }

    if (refund.status !== 'PENDING') {
      throw new Error(`Cannot reject refund in '${refund.status}' status`);
    }

    const updated = await (prisma as any).copayRefund.update({
      where: { id: refundId },
      data: {
        status: 'REJECTED',
        rejectedBy,
        rejectedAt: new Date(),
        rejectionReason: rejectionReason || 'No reason provided',
      },
    });

    return updated;
  }

  /**
   * Process an approved refund — update DeductibleLedger and mark as processed.
   */
  async processRefund(refundId: string, hospitalId: string, processedBy: string, refundMethod?: string) {
    const refund = await (prisma as any).copayRefund.findFirst({
      where: { id: refundId, hospitalId },
      include: {
        copayPayment: true,
      },
    });

    if (!refund) {
      throw new Error('Refund not found');
    }

    if (refund.status !== 'APPROVED') {
      throw new Error(`Cannot process refund in '${refund.status}' status. Must be APPROVED first.`);
    }

    // Update DeductibleLedger — reverse the copay accumulation
    try {
      const { deductibleService } = await import('./deductibleService');
      await deductibleService.recordPayment(
        hospitalId,
        refund.patientId,
        -Number(refund.refundAmount) // negative to reverse
      );
    } catch (error) {
      console.warn('[REFUND] Failed to update deductible ledger for refund, continuing:', error);
    }

    const updated = await (prisma as any).copayRefund.update({
      where: { id: refundId },
      data: {
        status: 'PROCESSED',
        processedBy,
        processedAt: new Date(),
        refundMethod: refundMethod || refund.refundMethod,
      },
    });

    return updated;
  }

  /**
   * List refunds with filters.
   */
  async listRefunds(hospitalId: string, filters: {
    page?: number;
    limit?: number;
    status?: string;
    patientId?: string;
    copayPaymentId?: string;
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { hospitalId };
    if (filters.status) where.status = filters.status;
    if (filters.patientId) where.patientId = filters.patientId;
    if (filters.copayPaymentId) where.copayPaymentId = filters.copayPaymentId;

    const [refunds, total] = await Promise.all([
      (prisma as any).copayRefund.findMany({
        where,
        orderBy: { requestedAt: 'desc' },
        skip,
        take: limit,
        include: {
          copayPayment: {
            select: {
              amount: true,
              paymentMethod: true,
              paymentDate: true,
              receiptNumber: true,
              insuranceProvider: true,
            },
          },
        },
      }),
      (prisma as any).copayRefund.count({ where }),
    ]);

    return { refunds, total, page, limit };
  }

  /**
   * Get a single refund by ID.
   */
  async getRefundById(refundId: string, hospitalId: string) {
    const refund = await (prisma as any).copayRefund.findFirst({
      where: { id: refundId, hospitalId },
      include: {
        copayPayment: {
          select: {
            id: true,
            amount: true,
            paymentMethod: true,
            paymentDate: true,
            receiptNumber: true,
            insuranceProvider: true,
            policyNumber: true,
          },
        },
      },
    });

    if (!refund) {
      throw new Error('Refund not found');
    }

    return refund;
  }
}

export const copayRefundService = new CopayRefundService();
