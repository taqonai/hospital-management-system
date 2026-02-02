import prisma from '../config/database';
import { NotFoundError, BadRequestError } from '../middleware/errorHandler';
import { Decimal } from '@prisma/client/runtime/library';

export class DepositService {
  /**
   * Generate a unique credit note number
   */
  private generateCreditNoteNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `CN-${timestamp}${random}`;
  }

  /**
   * Record a new deposit with initial ledger entry
   */
  async recordDeposit(
    hospitalId: string,
    patientId: string,
    data: {
      amount: number;
      currency?: string;
      paymentMethod: string;
      referenceNumber?: string;
      reason?: string;
    },
    createdBy: string
  ) {
    // Validate amount
    if (data.amount <= 0) {
      throw new BadRequestError('Deposit amount must be greater than zero');
    }

    // Verify patient exists
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, hospitalId },
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    // Create deposit and initial ledger entry in a transaction
    const deposit = await prisma.$transaction(async (tx) => {
      const newDeposit = await tx.deposit.create({
        data: {
          hospitalId,
          patientId,
          amount: new Decimal(data.amount),
          currency: data.currency || 'AED',
          paymentMethod: data.paymentMethod as any,
          referenceNumber: data.referenceNumber,
          reason: data.reason,
          status: 'ACTIVE',
          remainingBalance: new Decimal(data.amount),
          createdBy,
        },
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              mrn: true,
              phone: true,
              email: true,
            },
          },
        },
      });

      // Create initial ledger entry
      await tx.depositLedger.create({
        data: {
          depositId: newDeposit.id,
          type: 'DEPOSIT',
          amount: new Decimal(data.amount),
          description: data.reason || 'Initial deposit',
          createdBy,
        },
      });

      return newDeposit;
    });

    return deposit;
  }

  /**
   * Get deposit balance for a patient
   */
  async getDepositBalance(hospitalId: string, patientId: string) {
    const deposits = await prisma.deposit.findMany({
      where: {
        hospitalId,
        patientId,
        status: 'ACTIVE',
      },
      select: {
        remainingBalance: true,
      },
    });

    const totalBalance = deposits.reduce(
      (sum, deposit) => sum + Number(deposit.remainingBalance),
      0
    );

    return {
      patientId,
      totalBalance,
      activeDeposits: deposits.length,
    };
  }

  /**
   * Get deposits with filtering and pagination
   */
  async getDeposits(
    hospitalId: string,
    filters: {
      patientId?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { hospitalId };

    if (filters.patientId) {
      where.patientId = filters.patientId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.createdAt.lte = new Date(filters.endDate);
      }
    }

    const [deposits, total] = await Promise.all([
      prisma.deposit.findMany({
        where,
        skip,
        take: limit,
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              mrn: true,
              phone: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.deposit.count({ where }),
    ]);

    return {
      deposits,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get deposit ledger entries for a specific deposit
   */
  async getDepositLedger(depositId: string) {
    const deposit = await prisma.deposit.findUnique({
      where: { id: depositId },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            mrn: true,
          },
        },
      },
    });

    if (!deposit) {
      throw new NotFoundError('Deposit not found');
    }

    const ledgerEntries = await prisma.depositLedger.findMany({
      where: { depositId },
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      deposit,
      ledgerEntries,
    };
  }

  /**
   * Apply deposit to an invoice
   */
  async applyDepositToInvoice(
    hospitalId: string,
    patientId: string,
    invoiceId: string,
    amount: number,
    createdBy: string
  ) {
    if (amount <= 0) {
      throw new BadRequestError('Application amount must be greater than zero');
    }

    // Verify invoice exists and belongs to patient
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        hospitalId,
        patientId,
      },
    });

    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    if (invoice.status === 'PAID' || invoice.status === 'CANCELLED') {
      throw new BadRequestError(`Cannot apply deposit to ${invoice.status.toLowerCase()} invoice`);
    }

    // Get available deposits
    const deposits = await prisma.deposit.findMany({
      where: {
        hospitalId,
        patientId,
        status: 'ACTIVE',
        remainingBalance: { gt: 0 },
      },
      orderBy: { createdAt: 'asc' }, // FIFO
    });

    const totalAvailable = deposits.reduce(
      (sum, d) => sum + Number(d.remainingBalance),
      0
    );

    if (totalAvailable < amount) {
      throw new BadRequestError(
        `Insufficient deposit balance. Available: ${totalAvailable}, Requested: ${amount}`
      );
    }

    // Apply deposits in FIFO order
    return await prisma.$transaction(async (tx) => {
      let remainingAmount = amount;
      const appliedDeposits = [];

      for (const deposit of deposits) {
        if (remainingAmount <= 0) break;

        const availableBalance = Number(deposit.remainingBalance);
        const amountToApply = Math.min(remainingAmount, availableBalance);
        const newBalance = availableBalance - amountToApply;

        // Update deposit balance
        await tx.deposit.update({
          where: { id: deposit.id },
          data: {
            remainingBalance: new Decimal(newBalance),
            status: newBalance === 0 ? 'UTILIZED' : 'ACTIVE',
          },
        });

        // Create ledger entry
        await tx.depositLedger.create({
          data: {
            depositId: deposit.id,
            type: 'UTILIZATION',
            amount: new Decimal(amountToApply),
            invoiceId,
            description: `Applied to invoice ${invoice.invoiceNumber}`,
            createdBy,
          },
        });

        appliedDeposits.push({
          depositId: deposit.id,
          amountApplied: amountToApply,
        });

        remainingAmount -= amountToApply;
      }

      // Update invoice
      const newPaidAmount = Number(invoice.paidAmount) + amount;
      const newBalanceAmount = Number(invoice.totalAmount) - newPaidAmount;
      let newStatus = invoice.status;

      if (newBalanceAmount === 0) {
        newStatus = 'PAID';
      } else if (newPaidAmount > 0) {
        newStatus = 'PARTIALLY_PAID';
      }

      const updatedInvoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount: new Decimal(newPaidAmount),
          balanceAmount: new Decimal(newBalanceAmount),
          status: newStatus,
        },
      });

      return {
        invoice: updatedInvoice,
        appliedDeposits,
        totalApplied: amount,
      };
    });
  }

  /**
   * Automatically apply available deposits to an invoice
   */
  async autoApplyDeposits(
    hospitalId: string,
    patientId: string,
    invoiceId: string,
    createdBy: string
  ) {
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        hospitalId,
        patientId,
      },
    });

    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    const balanceAmount = Number(invoice.balanceAmount);

    if (balanceAmount <= 0) {
      throw new BadRequestError('Invoice has no outstanding balance');
    }

    const balance = await this.getDepositBalance(hospitalId, patientId);

    if (balance.totalBalance === 0) {
      throw new BadRequestError('No available deposit balance');
    }

    const amountToApply = Math.min(balanceAmount, balance.totalBalance);

    return await this.applyDepositToInvoice(
      hospitalId,
      patientId,
      invoiceId,
      amountToApply,
      createdBy
    );
  }

  /**
   * Create a credit note
   */
  async createCreditNote(
    hospitalId: string,
    data: {
      invoiceId?: string;
      patientId: string;
      amount: number;
      reason: string;
    },
    createdBy: string
  ) {
    if (data.amount <= 0) {
      throw new BadRequestError('Credit note amount must be greater than zero');
    }

    // Verify patient exists
    const patient = await prisma.patient.findFirst({
      where: { id: data.patientId, hospitalId },
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    // If invoice specified, verify it exists
    if (data.invoiceId) {
      const invoice = await prisma.invoice.findFirst({
        where: {
          id: data.invoiceId,
          hospitalId,
          patientId: data.patientId,
        },
      });

      if (!invoice) {
        throw new NotFoundError('Invoice not found');
      }
    }

    const creditNoteNumber = this.generateCreditNoteNumber();

    const creditNote = await prisma.creditNote.create({
      data: {
        hospitalId,
        invoiceId: data.invoiceId,
        patientId: data.patientId,
        creditNoteNumber,
        amount: new Decimal(data.amount),
        reason: data.reason,
        status: 'ISSUED',
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
        sourceInvoice: {
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
          },
        },
      },
    });

    return creditNote;
  }

  /**
   * Apply credit note to an invoice
   */
  async applyCreditNote(creditNoteId: string, invoiceId: string, createdBy: string) {
    const creditNote = await prisma.creditNote.findUnique({
      where: { id: creditNoteId },
    });

    if (!creditNote) {
      throw new NotFoundError('Credit note not found');
    }

    if (creditNote.status !== 'ISSUED') {
      throw new BadRequestError(`Cannot apply credit note with status: ${creditNote.status}`);
    }

    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        hospitalId: creditNote.hospitalId,
        patientId: creditNote.patientId,
      },
    });

    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    if (invoice.status === 'PAID' || invoice.status === 'CANCELLED') {
      throw new BadRequestError(`Cannot apply credit to ${invoice.status.toLowerCase()} invoice`);
    }

    return await prisma.$transaction(async (tx) => {
      // Update credit note
      await tx.creditNote.update({
        where: { id: creditNoteId },
        data: {
          status: 'APPLIED',
          appliedToInvoiceId: invoiceId,
        },
      });

      // Update invoice
      const creditAmount = Number(creditNote.amount);
      const newPaidAmount = Number(invoice.paidAmount) + creditAmount;
      const newBalanceAmount = Number(invoice.totalAmount) - newPaidAmount;
      let newStatus = invoice.status;

      if (newBalanceAmount === 0) {
        newStatus = 'PAID';
      } else if (newPaidAmount > 0) {
        newStatus = 'PARTIALLY_PAID';
      }

      const updatedInvoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount: new Decimal(newPaidAmount),
          balanceAmount: new Decimal(newBalanceAmount),
          status: newStatus,
        },
      });

      return {
        creditNote,
        invoice: updatedInvoice,
      };
    });
  }

  /**
   * Get credit notes with filtering
   */
  async getCreditNotes(
    hospitalId: string,
    filters: {
      patientId?: string;
      status?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { hospitalId };

    if (filters.patientId) {
      where.patientId = filters.patientId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    const [creditNotes, total] = await Promise.all([
      prisma.creditNote.findMany({
        where,
        skip,
        take: limit,
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              mrn: true,
            },
          },
          sourceInvoice: {
            select: {
              id: true,
              invoiceNumber: true,
            },
          },
          appliedToInvoice: {
            select: {
              id: true,
              invoiceNumber: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.creditNote.count({ where }),
    ]);

    return {
      creditNotes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Request a refund
   */
  async requestRefund(
    hospitalId: string,
    data: {
      patientId: string;
      depositId?: string;
      creditNoteId?: string;
      paymentId?: string;
      amount: number;
      refundMethod: string;
      requestReason: string;
      bankDetails?: any;
      notes?: string;
    },
    createdBy: string
  ) {
    if (data.amount <= 0) {
      throw new BadRequestError('Refund amount must be greater than zero');
    }

    // Verify patient exists
    const patient = await prisma.patient.findFirst({
      where: { id: data.patientId, hospitalId },
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    // Verify deposit if specified
    if (data.depositId) {
      const deposit = await prisma.deposit.findFirst({
        where: {
          id: data.depositId,
          hospitalId,
          patientId: data.patientId,
        },
      });

      if (!deposit) {
        throw new NotFoundError('Deposit not found');
      }

      if (Number(deposit.remainingBalance) < data.amount) {
        throw new BadRequestError('Refund amount exceeds deposit balance');
      }
    }

    const refund = await prisma.refund.create({
      data: {
        hospitalId,
        patientId: data.patientId,
        depositId: data.depositId,
        creditNoteId: data.creditNoteId,
        paymentId: data.paymentId,
        amount: new Decimal(data.amount),
        refundMethod: data.refundMethod,
        requestReason: data.requestReason,
        bankDetails: data.bankDetails,
        notes: data.notes,
        status: 'REQUESTED',
        createdBy,
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            mrn: true,
            phone: true,
            email: true,
          },
        },
        deposit: {
          select: {
            id: true,
            amount: true,
            remainingBalance: true,
            currency: true,
          },
        },
      },
    });

    return refund;
  }

  /**
   * Approve a refund
   */
  async approveRefund(refundId: string, approvedBy: string) {
    const refund = await prisma.refund.findUnique({
      where: { id: refundId },
    });

    if (!refund) {
      throw new NotFoundError('Refund not found');
    }

    if (refund.status !== 'REQUESTED') {
      throw new BadRequestError(`Cannot approve refund with status: ${refund.status}`);
    }

    const updatedRefund = await prisma.refund.update({
      where: { id: refundId },
      data: {
        status: 'APPROVED',
        approvedBy,
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
      },
    });

    return updatedRefund;
  }

  /**
   * Process a refund
   */
  async processRefund(refundId: string, processedBy: string) {
    const refund = await prisma.refund.findUnique({
      where: { id: refundId },
      include: {
        deposit: true,
      },
    });

    if (!refund) {
      throw new NotFoundError('Refund not found');
    }

    if (refund.status !== 'APPROVED') {
      throw new BadRequestError(`Cannot process refund with status: ${refund.status}`);
    }

    return await prisma.$transaction(async (tx) => {
      // Update refund status
      const updatedRefund = await tx.refund.update({
        where: { id: refundId },
        data: {
          status: 'PROCESSED',
          processedAt: new Date(),
        },
      });

      // If deposit-based refund, update deposit
      if (refund.depositId && refund.deposit) {
        const newBalance = Number(refund.deposit.remainingBalance) - Number(refund.amount);

        await tx.deposit.update({
          where: { id: refund.depositId },
          data: {
            remainingBalance: new Decimal(Math.max(0, newBalance)),
            status: newBalance <= 0 ? 'REFUNDED' : 'ACTIVE',
          },
        });

        // Create ledger entry
        await tx.depositLedger.create({
          data: {
            depositId: refund.depositId,
            type: 'REFUND',
            amount: new Decimal(refund.amount),
            description: `Refund processed: ${refund.requestReason}`,
            createdBy: processedBy,
          },
        });
      }

      return updatedRefund;
    });
  }

  /**
   * Reject a refund
   */
  async rejectRefund(refundId: string, reason: string, rejectedBy: string) {
    const refund = await prisma.refund.findUnique({
      where: { id: refundId },
    });

    if (!refund) {
      throw new NotFoundError('Refund not found');
    }

    if (refund.status !== 'REQUESTED' && refund.status !== 'APPROVED') {
      throw new BadRequestError(`Cannot reject refund with status: ${refund.status}`);
    }

    const updatedRefund = await prisma.refund.update({
      where: { id: refundId },
      data: {
        status: 'REJECTED',
        notes: reason,
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
      },
    });

    return updatedRefund;
  }

  /**
   * Get refunds with filtering
   */
  async getRefunds(
    hospitalId: string,
    filters: {
      patientId?: string;
      status?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { hospitalId };

    if (filters.patientId) {
      where.patientId = filters.patientId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    const [refunds, total] = await Promise.all([
      prisma.refund.findMany({
        where,
        skip,
        take: limit,
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              mrn: true,
              phone: true,
            },
          },
          deposit: {
            select: {
              id: true,
              amount: true,
              remainingBalance: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.refund.count({ where }),
    ]);

    return {
      refunds,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export const depositService = new DepositService();
