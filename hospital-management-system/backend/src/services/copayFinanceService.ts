import prisma from '../config/database';
import { NotFoundError, AppError } from '../middleware/errorHandler';
import { Prisma, CopayPaymentStatus } from '@prisma/client';
import logger from '../utils/logger';
import { Decimal } from '@prisma/client/runtime/library';

// ============================================================================
// Types
// ============================================================================

interface PatientOutstandingBalance {
  patientId: string;
  patientName: string;
  mrn: string;
  totalOutstanding: number;
  appointments: Array<{
    appointmentId: string;
    appointmentDate: Date;
    doctorName: string;
    expectedAmount: number;
    paidAmount: number;
    remainingBalance: number;
    status: string;
  }>;
}

interface CopayFinanceSummary {
  dateRange: { start: Date; end: Date };
  totalCollected: number;
  totalOnline: number;
  totalCash: number;
  totalCard: number;
  syncedToFinance: number;
  pendingSync: number;
  byRevenueCategory: Record<string, { count: number; amount: number }>;
  byPaymentMethod: Record<string, { count: number; amount: number }>;
}

interface PartialPaymentInput {
  hospitalId: string;
  appointmentId: string;
  patientId: string;
  amount: number;
  paymentMethod: 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD';
  collectedBy: string;
  notes?: string;
}

// ============================================================================
// Service
// ============================================================================

class CopayFinanceService {
  // --------------------------------------------------------------------------
  // Outstanding Balance Tracking
  // --------------------------------------------------------------------------

  /**
   * Get patient's total outstanding copay balance across all appointments
   */
  async getPatientOutstandingBalance(hospitalId: string, patientId: string): Promise<PatientOutstandingBalance> {
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, hospitalId },
      select: { id: true, firstName: true, lastName: true, mrn: true },
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    // Get all appointments with copay info
    const appointments = await prisma.appointment.findMany({
      where: {
        hospitalId,
        patientId,
        copayAmount: { not: null, gt: 0 },
        status: { notIn: ['CANCELLED'] },
      },
      include: {
        copayPayments: {
          orderBy: { createdAt: 'desc' },
        },
        doctor: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { appointmentDate: 'desc' },
    });

    const appointmentsWithBalance: PatientOutstandingBalance['appointments'] = [];
    let totalOutstanding = 0;

    for (const apt of appointments) {
      const expectedAmount = apt.copayAmount ? Number(apt.copayAmount) : 0;
      const paidAmount = apt.copayPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      const remainingBalance = Math.max(0, expectedAmount - paidAmount);

      // Only include if there's an outstanding balance
      if (remainingBalance > 0.01) {
        let status = 'UNPAID';
        if (paidAmount > 0 && paidAmount < expectedAmount) {
          status = 'PARTIAL';
        } else if ((apt as any).copayWaived) {
          status = 'WAIVED';
          continue; // Skip waived copays
        }

        appointmentsWithBalance.push({
          appointmentId: apt.id,
          appointmentDate: apt.appointmentDate,
          doctorName: `Dr. ${apt.doctor.user.firstName} ${apt.doctor.user.lastName}`,
          expectedAmount,
          paidAmount,
          remainingBalance,
          status,
        });

        totalOutstanding += remainingBalance;
      }
    }

    return {
      patientId: patient.id,
      patientName: `${patient.firstName} ${patient.lastName}`,
      mrn: patient.mrn,
      totalOutstanding,
      appointments: appointmentsWithBalance,
    };
  }

  /**
   * Get all patients with outstanding copay balances
   */
  async getPatientsWithOutstandingBalance(hospitalId: string, options?: {
    minBalance?: number;
    limit?: number;
    offset?: number;
  }): Promise<{ patients: PatientOutstandingBalance[]; total: number }> {
    const minBalance = options?.minBalance || 0.01;
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    // Get patients with unpaid copays using raw query for efficiency
    const patientsWithBalance = await prisma.$queryRaw<Array<{
      patientId: string;
      firstName: string;
      lastName: string;
      mrn: string;
      totalOutstanding: Decimal;
    }>>`
      SELECT 
        p.id as "patientId",
        p."firstName",
        p."lastName",
        p.mrn,
        COALESCE(SUM(a."copayAmount"), 0) - COALESCE(SUM(cp.total_paid), 0) as "totalOutstanding"
      FROM patients p
      INNER JOIN appointments a ON a."patientId" = p.id
      LEFT JOIN (
        SELECT "appointmentId", SUM(amount) as total_paid
        FROM copay_payments
        GROUP BY "appointmentId"
      ) cp ON cp."appointmentId" = a.id
      WHERE p."hospitalId" = ${hospitalId}
        AND a.status NOT IN ('CANCELLED')
        AND a."copayAmount" > 0
        AND COALESCE(a."copayWaived", false) = false
      GROUP BY p.id, p."firstName", p."lastName", p.mrn
      HAVING COALESCE(SUM(a."copayAmount"), 0) - COALESCE(SUM(cp.total_paid), 0) > ${minBalance}
      ORDER BY "totalOutstanding" DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const countResult = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT p.id)::bigint as count
      FROM patients p
      INNER JOIN appointments a ON a."patientId" = p.id
      LEFT JOIN (
        SELECT "appointmentId", SUM(amount) as total_paid
        FROM copay_payments
        GROUP BY "appointmentId"
      ) cp ON cp."appointmentId" = a.id
      WHERE p."hospitalId" = ${hospitalId}
        AND a.status NOT IN ('CANCELLED')
        AND a."copayAmount" > 0
        AND COALESCE(a."copayWaived", false) = false
      GROUP BY p.id
      HAVING COALESCE(SUM(a."copayAmount"), 0) - COALESCE(SUM(cp.total_paid), 0) > ${minBalance}
    `;

    const patients: PatientOutstandingBalance[] = patientsWithBalance.map(p => ({
      patientId: p.patientId,
      patientName: `${p.firstName} ${p.lastName}`,
      mrn: p.mrn,
      totalOutstanding: Number(p.totalOutstanding),
      appointments: [], // Can be loaded separately if needed
    }));

    return {
      patients,
      total: countResult.length > 0 ? Number(countResult[0].count) : 0,
    };
  }

  // --------------------------------------------------------------------------
  // Partial Payment Processing
  // --------------------------------------------------------------------------

  /**
   * Process a partial payment for a patient's copay
   */
  async processPartialPayment(input: PartialPaymentInput): Promise<{
    payment: any;
    remainingBalance: number;
    fullyPaid: boolean;
  }> {
    const { hospitalId, appointmentId, patientId, amount, paymentMethod, collectedBy, notes } = input;

    // Get appointment and existing payments
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, hospitalId, patientId },
      include: {
        copayPayments: true,
        doctor: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }

    const expectedAmount = appointment.copayAmount ? Number(appointment.copayAmount) : 0;
    const alreadyPaid = appointment.copayPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const currentBalance = expectedAmount - alreadyPaid;

    if (currentBalance <= 0.01) {
      throw new AppError('No outstanding balance for this appointment');
    }

    if (amount > currentBalance + 0.01) {
      throw new AppError(`Payment amount (${amount}) exceeds outstanding balance (${currentBalance.toFixed(2)})`);
    }

    // Get patient insurance info
    const patientInsurance = await prisma.patientInsurance.findFirst({
      where: { patientId, isActive: true },
    });

    const newRemainingBalance = Math.max(0, currentBalance - amount);
    const fullyPaid = newRemainingBalance <= 0.01;
    const status: CopayPaymentStatus = fullyPaid ? 'PAID' : 'PARTIAL';

    // Create payment record
    const payment = await prisma.copayPayment.create({
      data: {
        patientId,
        appointmentId,
        expectedAmount,
        amount,
        remainingBalance: newRemainingBalance,
        status,
        paymentMethod,
        insuranceProvider: patientInsurance?.providerName || 'Self-Pay',
        policyNumber: patientInsurance?.policyNumber || 'N/A',
        collectedBy,
        notes,
        receiptNumber: `RCP-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
      },
    });

    // Update appointment if fully paid
    if (fullyPaid) {
      await prisma.appointment.update({
        where: { id: appointmentId },
        data: {
          copayCollected: true,
        },
      });
    }

    logger.info(`Partial payment of ${amount} recorded for appointment ${appointmentId}. Remaining: ${newRemainingBalance}`);

    return {
      payment,
      remainingBalance: newRemainingBalance,
      fullyPaid,
    };
  }

  /**
   * Process payment for outstanding balance across multiple appointments
   */
  async processOutstandingBalancePayment(
    hospitalId: string,
    patientId: string,
    amount: number,
    paymentMethod: 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD',
    collectedBy: string,
    notes?: string
  ): Promise<{
    paymentsCreated: number;
    totalApplied: number;
    remainingBalance: number;
    appointmentsPaid: string[];
  }> {
    // Get outstanding appointments ordered by date (oldest first - FIFO)
    const outstandingBalance = await this.getPatientOutstandingBalance(hospitalId, patientId);

    if (outstandingBalance.totalOutstanding <= 0.01) {
      throw new AppError('No outstanding balance for this patient');
    }

    let remainingAmount = amount;
    const appointmentsPaid: string[] = [];
    let paymentsCreated = 0;
    let totalApplied = 0;

    // Apply payments to appointments in order (oldest first)
    const sortedAppointments = outstandingBalance.appointments.sort(
      (a, b) => new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime()
    );

    for (const apt of sortedAppointments) {
      if (remainingAmount <= 0.01) break;

      const paymentAmount = Math.min(remainingAmount, apt.remainingBalance);

      await this.processPartialPayment({
        hospitalId,
        appointmentId: apt.appointmentId,
        patientId,
        amount: paymentAmount,
        paymentMethod,
        collectedBy,
        notes: notes || `Bulk payment applied. Original amount: ${amount}`,
      });

      remainingAmount -= paymentAmount;
      totalApplied += paymentAmount;
      appointmentsPaid.push(apt.appointmentId);
      paymentsCreated++;
    }

    return {
      paymentsCreated,
      totalApplied,
      remainingBalance: Math.max(0, outstandingBalance.totalOutstanding - totalApplied),
      appointmentsPaid,
    };
  }

  // --------------------------------------------------------------------------
  // Finance Sync
  // --------------------------------------------------------------------------

  /**
   * Sync a copay payment to the finance/GL system
   */
  async syncCopayToFinance(paymentId: string, hospitalId: string, createdBy: string): Promise<{
    glEntryId: string;
    synced: boolean;
  }> {
    const payment = await prisma.copayPayment.findUnique({
      where: { id: paymentId },
      include: {
        appointment: {
          include: {
            hospital: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundError('Copay payment not found');
    }

    if (payment.syncedToFinance) {
      logger.info(`Payment ${paymentId} already synced to finance`);
      return { glEntryId: payment.financeRecordId || '', synced: true };
    }

    // Get or find appropriate GL accounts
    // Look for COPAY revenue account, fall back to Patient Service Revenue
    let revenueAccount = await prisma.gLAccount.findFirst({
      where: {
        hospitalId,
        OR: [
          { accountCode: '4500' }, // Copay Revenue
          { accountName: { contains: 'Copay', mode: 'insensitive' } },
        ],
        isActive: true,
      },
    });

    if (!revenueAccount) {
      // Fall back to Patient Service Revenue
      revenueAccount = await prisma.gLAccount.findFirst({
        where: {
          hospitalId,
          accountCode: '4000', // Patient Service Revenue
          isActive: true,
        },
      });
    }

    let cashAccount = await prisma.gLAccount.findFirst({
      where: {
        hospitalId,
        accountCode: '1000', // Cash/Bank
        isActive: true,
      },
    });

    if (!revenueAccount || !cashAccount) {
      logger.warn(`GL accounts not found for hospital ${hospitalId}. Skipping finance sync.`);
      return { glEntryId: '', synced: false };
    }

    const amount = Number(payment.amount);

    // Create GL entries in a transaction
    const glEntries = await prisma.$transaction(async (tx) => {
      // Debit Cash/Bank (Asset increases)
      const debitEntry = await tx.gLEntry.create({
        data: {
          hospitalId,
          transactionDate: payment.paymentDate,
          glAccountId: cashAccount!.id,
          debitAmount: amount,
          creditAmount: 0,
          description: `Copay payment - ${payment.receiptNumber || payment.id}`,
          referenceType: 'COPAY',
          referenceId: payment.id,
          createdBy,
        },
      });

      // Credit Revenue (Revenue increases)
      const creditEntry = await tx.gLEntry.create({
        data: {
          hospitalId,
          transactionDate: payment.paymentDate,
          glAccountId: revenueAccount!.id,
          debitAmount: 0,
          creditAmount: amount,
          description: `Copay payment - ${payment.receiptNumber || payment.id}`,
          referenceType: 'COPAY',
          referenceId: payment.id,
          createdBy,
        },
      });

      return [debitEntry, creditEntry];
    });

    // Update payment with sync info
    await prisma.copayPayment.update({
      where: { id: paymentId },
      data: {
        syncedToFinance: true,
        financeSyncDate: new Date(),
        financeRecordId: glEntries[0].id, // Reference to the debit entry
        glAccountId: revenueAccount.id,
      },
    });

    logger.info(`Synced copay payment ${paymentId} to finance. GL entries created.`);

    return { glEntryId: glEntries[0].id, synced: true };
  }

  /**
   * Batch sync all unsynced copay payments to finance
   */
  async batchSyncToFinance(hospitalId: string, createdBy: string, options?: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<{
    synced: number;
    failed: number;
    errors: string[];
  }> {
    const where: Prisma.CopayPaymentWhereInput = {
      appointment: { hospitalId },
      syncedToFinance: false,
    };

    if (options?.startDate || options?.endDate) {
      where.paymentDate = {};
      if (options.startDate) where.paymentDate.gte = options.startDate;
      if (options.endDate) where.paymentDate.lte = options.endDate;
    }

    const unsyncedPayments = await prisma.copayPayment.findMany({
      where,
      take: options?.limit || 100,
      orderBy: { paymentDate: 'asc' },
    });

    let synced = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const payment of unsyncedPayments) {
      try {
        await this.syncCopayToFinance(payment.id, hospitalId, createdBy);
        synced++;
      } catch (error: any) {
        failed++;
        errors.push(`Payment ${payment.id}: ${error.message}`);
        logger.error(`Failed to sync payment ${payment.id}:`, error);
      }
    }

    return { synced, failed, errors };
  }

  // --------------------------------------------------------------------------
  // Finance Reports
  // --------------------------------------------------------------------------

  /**
   * Get copay collection summary for finance dashboard
   */
  async getCopayFinanceSummary(
    hospitalId: string,
    startDate: Date,
    endDate: Date
  ): Promise<CopayFinanceSummary> {
    const payments = await prisma.copayPayment.findMany({
      where: {
        appointment: { hospitalId },
        paymentDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        appointment: true,
      },
    });

    const totalCollected = payments.reduce((sum, p) => sum + Number(p.amount), 0);

    // Group by payment method
    const byPaymentMethod: Record<string, { count: number; amount: number }> = {};
    const byRevenueCategory: Record<string, { count: number; amount: number }> = {};

    let totalOnline = 0;
    let totalCash = 0;
    let totalCard = 0;

    for (const payment of payments) {
      // Payment method grouping
      const method = payment.paymentMethod;
      if (!byPaymentMethod[method]) {
        byPaymentMethod[method] = { count: 0, amount: 0 };
      }
      byPaymentMethod[method].count++;
      byPaymentMethod[method].amount += Number(payment.amount);

      // Categorize by type
      if (['CREDIT_CARD', 'DEBIT_CARD'].includes(method)) {
        totalCard += Number(payment.amount);
      } else if (['NET_BANKING', 'UPI'].includes(method)) {
        totalOnline += Number(payment.amount);
      } else if (method === 'CASH') {
        totalCash += Number(payment.amount);
      }

      // Revenue category grouping
      const category = payment.revenueCategory || 'COPAY';
      if (!byRevenueCategory[category]) {
        byRevenueCategory[category] = { count: 0, amount: 0 };
      }
      byRevenueCategory[category].count++;
      byRevenueCategory[category].amount += Number(payment.amount);
    }

    const syncedPayments = payments.filter(p => p.syncedToFinance);
    const pendingPayments = payments.filter(p => !p.syncedToFinance);

    return {
      dateRange: { start: startDate, end: endDate },
      totalCollected,
      totalOnline: totalOnline + totalCard, // Online includes card
      totalCash,
      totalCard,
      syncedToFinance: syncedPayments.reduce((sum, p) => sum + Number(p.amount), 0),
      pendingSync: pendingPayments.reduce((sum, p) => sum + Number(p.amount), 0),
      byRevenueCategory,
      byPaymentMethod,
    };
  }

  /**
   * Get end-of-day copay summary for finance
   */
  async getEndOfDaySummary(hospitalId: string, date: Date): Promise<{
    date: string;
    totalTransactions: number;
    totalAmount: number;
    byPaymentMethod: Record<string, { count: number; amount: number }>;
    syncStatus: {
      synced: number;
      syncedAmount: number;
      pending: number;
      pendingAmount: number;
    };
    glEntries: Array<{
      id: string;
      accountName: string;
      debit: number;
      credit: number;
    }>;
  }> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const payments = await prisma.copayPayment.findMany({
      where: {
        appointment: { hospitalId },
        paymentDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    const byPaymentMethod: Record<string, { count: number; amount: number }> = {};
    for (const payment of payments) {
      const method = payment.paymentMethod;
      if (!byPaymentMethod[method]) {
        byPaymentMethod[method] = { count: 0, amount: 0 };
      }
      byPaymentMethod[method].count++;
      byPaymentMethod[method].amount += Number(payment.amount);
    }

    const syncedPayments = payments.filter(p => p.syncedToFinance);
    const pendingPayments = payments.filter(p => !p.syncedToFinance);

    // Get GL entries for this day's copay
    const glEntries = await prisma.gLEntry.findMany({
      where: {
        hospitalId,
        referenceType: 'COPAY',
        transactionDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        glAccount: true,
      },
    });

    return {
      date: date.toISOString().split('T')[0],
      totalTransactions: payments.length,
      totalAmount: payments.reduce((sum, p) => sum + Number(p.amount), 0),
      byPaymentMethod,
      syncStatus: {
        synced: syncedPayments.length,
        syncedAmount: syncedPayments.reduce((sum, p) => sum + Number(p.amount), 0),
        pending: pendingPayments.length,
        pendingAmount: pendingPayments.reduce((sum, p) => sum + Number(p.amount), 0),
      },
      glEntries: glEntries.map(e => ({
        id: e.id,
        accountName: e.glAccount.accountName,
        debit: Number(e.debitAmount),
        credit: Number(e.creditAmount),
      })),
    };
  }

  /**
   * Get patient's copay payment history
   */
  async getPatientPaymentHistory(
    hospitalId: string,
    patientId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<{
    payments: Array<{
      id: string;
      appointmentId: string;
      appointmentDate: Date;
      doctorName: string;
      amount: number;
      expectedAmount: number;
      remainingBalance: number;
      status: string;
      paymentMethod: string;
      paymentDate: Date;
      receiptNumber: string | null;
    }>;
    total: number;
  }> {
    const limit = options?.limit || 20;
    const offset = options?.offset || 0;

    const [payments, total] = await Promise.all([
      prisma.copayPayment.findMany({
        where: {
          patientId,
          appointment: { hospitalId },
        },
        include: {
          appointment: {
            include: {
              doctor: {
                include: {
                  user: { select: { firstName: true, lastName: true } },
                },
              },
            },
          },
        },
        orderBy: { paymentDate: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.copayPayment.count({
        where: {
          patientId,
          appointment: { hospitalId },
        },
      }),
    ]);

    return {
      payments: payments.map(p => ({
        id: p.id,
        appointmentId: p.appointmentId,
        appointmentDate: p.appointment.appointmentDate,
        doctorName: `Dr. ${p.appointment.doctor.user.firstName} ${p.appointment.doctor.user.lastName}`,
        amount: Number(p.amount),
        expectedAmount: Number(p.expectedAmount),
        remainingBalance: Number(p.remainingBalance),
        status: p.status,
        paymentMethod: p.paymentMethod,
        paymentDate: p.paymentDate,
        receiptNumber: p.receiptNumber,
      })),
      total,
    };
  }
}

export const copayFinanceService = new CopayFinanceService();
