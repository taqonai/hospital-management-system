import prisma from '../config/database';
import { NotFoundError, ValidationError } from '../middleware/errorHandler';
import { paymentGatewayService } from './paymentGatewayService';
import { Decimal } from '@prisma/client/runtime/library';
import { sendEmail } from './emailService';
import { format } from 'date-fns';
import logger from '../utils/logger';

export enum CopayPaymentStatus {
  PENDING = 'pending',
  PAY_AT_CLINIC = 'pay_at_clinic',
  PAYMENT_INITIATED = 'payment_initiated',
  PAID_ONLINE = 'paid_online',
  PAID_CASH = 'paid_cash',
  REFUNDED = 'refunded',
}

// Phase 3: Verification status enum
export enum CopayVerificationStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  MISMATCH = 'mismatch',
  UNDERPAYMENT = 'underpayment',
  OVERPAYMENT = 'overpayment',
  AUTO_VERIFIED = 'auto_verified',
}

export interface CopayInfo {
  appointmentId: string;
  copayAmount: number;
  paymentStatus: CopayPaymentStatus;
  paymentMethod?: string;
  paidAt?: Date;
  transactionId?: string;
  receiptUrl?: string;
  // Phase 3: Verification info
  verificationStatus?: string;
  verificationFlag?: string;
  autoVerified?: boolean;
  copayWaived?: boolean;
  copayWaivedReason?: string;
  breakdown?: {
    serviceFee: number;
    insuranceCoverage: number;
    insuranceCoveragePercent: number;
    patientResponsibility: number;
    deductibleApplied: number;
    annualCapRemaining?: number;
  };
  insuranceStatus?: {
    isActive: boolean;
    policyExpiry?: string;
    providerName?: string;
    policyNumber?: string;
    coverageChanged?: boolean;
    deductibleMet?: boolean;
    annualCapReached?: boolean;
    warnings?: string[];
  };
}

interface VerificationAction {
  appointmentId: string;
  action: 'verify' | 'mark_incorrect' | 'convert_selfpay' | 'flag_fraud' | 'request_refund';
  reason?: string;
  notes?: string;
}

class AppointmentCopayService {
  /**
   * Get copay information for an appointment
   */
  async getCopayInfo(hospitalId: string, patientId: string, appointmentId: string): Promise<CopayInfo> {
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        hospitalId,
        patientId,
      },
      include: {
        copayPayments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        doctor: {
          include: {
            department: true,
          },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }

    const patientInsurance = await prisma.patientInsurance.findFirst({
      where: { 
        patientId,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const serviceFee = appointment.doctor?.consultationFee 
      ? Number(appointment.doctor.consultationFee) 
      : 150;

    let copayAmount = appointment.copayAmount ? Number(appointment.copayAmount) : 0;
    
    if (!copayAmount && patientInsurance) {
      const insuranceCopay = patientInsurance.copay ? Number(patientInsurance.copay) : null;
      const coveragePercent = insuranceCopay ? Math.round((1 - insuranceCopay / serviceFee) * 100) : 80;
      copayAmount = insuranceCopay || Math.round(serviceFee * (100 - coveragePercent) / 100);
    }

    if (!copayAmount) {
      copayAmount = serviceFee;
    }

    let paymentStatus = CopayPaymentStatus.PENDING;
    let paymentMethod: string | undefined;
    let paidAt: Date | undefined;
    let transactionId: string | undefined;
    let receiptUrl: string | undefined;

    if (appointment.copayCollected && appointment.copayPayments[0]) {
      const lastPayment = appointment.copayPayments[0];
      paymentMethod = lastPayment.paymentMethod;
      paidAt = lastPayment.paymentDate;
      transactionId = lastPayment.id;
      receiptUrl = lastPayment.receiptUrl || undefined;
      
      if (['CREDIT_CARD', 'DEBIT_CARD', 'NET_BANKING', 'UPI'].includes(lastPayment.paymentMethod)) {
        paymentStatus = CopayPaymentStatus.PAID_ONLINE;
      } else {
        paymentStatus = CopayPaymentStatus.PAID_CASH;
      }
    } else {
      try {
        const metadata = appointment.notes ? JSON.parse(appointment.notes) : null;
        if (metadata?.paymentChoice === 'pay_at_clinic') {
          paymentStatus = CopayPaymentStatus.PAY_AT_CLINIC;
        }
      } catch {
        // Invalid JSON
      }
    }

    let insuranceStatus: CopayInfo['insuranceStatus'] | undefined;
    let breakdown: CopayInfo['breakdown'] | undefined;

    if (patientInsurance) {
      const now = new Date();
      const policyExpiry = patientInsurance.expiryDate ? new Date(patientInsurance.expiryDate) : null;
      const isActive = patientInsurance.isActive && (!policyExpiry || policyExpiry > now);
      
      const warnings: string[] = [];
      if (!isActive) {
        warnings.push('Your insurance policy is no longer active. You will be charged as self-pay.');
      } else if (policyExpiry) {
        const daysUntilExpiry = Math.ceil((policyExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntilExpiry <= 30 && daysUntilExpiry > 0) {
          warnings.push(`Your insurance expires in ${daysUntilExpiry} days.`);
        }
      }

      insuranceStatus = {
        isActive,
        policyExpiry: policyExpiry?.toISOString(),
        providerName: patientInsurance.providerName,
        policyNumber: patientInsurance.policyNumber,
        coverageChanged: false,
        deductibleMet: true,
        annualCapReached: false,
        warnings: warnings.length > 0 ? warnings : undefined,
      };

      const insuranceCopay = patientInsurance.copay ? Number(patientInsurance.copay) : null;
      const coveragePercent = isActive ? (insuranceCopay ? Math.round((1 - insuranceCopay / serviceFee) * 100) : 80) : 0;
      const insuranceCoverage = isActive ? Math.round(serviceFee * coveragePercent / 100) : 0;
      const patientResponsibility = serviceFee - insuranceCoverage;

      breakdown = {
        serviceFee,
        insuranceCoverage,
        insuranceCoveragePercent: coveragePercent,
        patientResponsibility,
        deductibleApplied: 0,
      };

      if (!isActive) {
        copayAmount = serviceFee;
      }
    } else {
      breakdown = {
        serviceFee,
        insuranceCoverage: 0,
        insuranceCoveragePercent: 0,
        patientResponsibility: serviceFee,
        deductibleApplied: 0,
      };
      copayAmount = serviceFee;
    }

    return {
      appointmentId,
      copayAmount,
      paymentStatus,
      paymentMethod,
      paidAt,
      transactionId,
      receiptUrl,
      breakdown,
      insuranceStatus,
      // Phase 3: Include verification info
      verificationStatus: (appointment as any).copayVerificationStatus || undefined,
      verificationFlag: (appointment as any).copayVerificationFlag || undefined,
      autoVerified: (appointment as any).copayAutoVerified || false,
      copayWaived: (appointment as any).copayWaived || false,
      copayWaivedReason: (appointment as any).copayWaivedReason || undefined,
    };
  }

  /**
   * Phase 3 Feature #4, #5, #6: Auto-verify/flag payment based on amount comparison
   */
  async autoVerifyPayment(appointmentId: string, paidAmount: number, expectedAmount: number): Promise<{
    status: CopayVerificationStatus;
    flag?: string;
    autoVerified: boolean;
  }> {
    let status: CopayVerificationStatus;
    let flag: string | undefined;
    let autoVerified = false;

    const tolerance = 0.01; // Allow small float differences

    if (Math.abs(paidAmount - expectedAmount) <= tolerance) {
      // Feature #4: Exact match - auto verify
      status = CopayVerificationStatus.AUTO_VERIFIED;
      autoVerified = true;
      logger.info(`Auto-verified payment for appointment ${appointmentId}: paid=${paidAmount}, expected=${expectedAmount}`);
    } else if (paidAmount < expectedAmount) {
      // Feature #5: Underpayment - flag for review
      status = CopayVerificationStatus.UNDERPAYMENT;
      flag = 'Underpayment';
      logger.warn(`Underpayment detected for appointment ${appointmentId}: paid=${paidAmount}, expected=${expectedAmount}`);
    } else {
      // Feature #6: Overpayment - flag for potential refund
      status = CopayVerificationStatus.OVERPAYMENT;
      flag = 'Overpayment - Refund may be needed';
      logger.warn(`Overpayment detected for appointment ${appointmentId}: paid=${paidAmount}, expected=${expectedAmount}`);
    }

    // Update appointment with verification status
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        copayVerificationStatus: status,
        copayVerificationFlag: flag || null,
        copayAutoVerified: autoVerified,
      },
    });

    return { status, flag, autoVerified };
  }

  /**
   * Phase 3 Feature #7: Check if appointment can be checked in
   */
  async canCheckIn(hospitalId: string, appointmentId: string): Promise<{
    allowed: boolean;
    reason?: string;
    copayRequired: boolean;
    copayAmount?: number;
    copayWaived?: boolean;
    copayPaid?: boolean;
  }> {
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, hospitalId },
      include: {
        copayPayments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        doctor: true,
      },
    });

    if (!appointment) {
      return { allowed: false, reason: 'Appointment not found', copayRequired: false };
    }

    const copayWaived = (appointment as any).copayWaived || false;
    const copayPaid = appointment.copayCollected;
    const copayAmount = appointment.copayAmount ? Number(appointment.copayAmount) : 0;

    // If copay is waived, allow check-in
    if (copayWaived) {
      return { allowed: true, copayRequired: false, copayWaived: true, copayPaid };
    }

    // If copay is paid, allow check-in
    if (copayPaid) {
      return { allowed: true, copayRequired: false, copayWaived: false, copayPaid: true, copayAmount };
    }

    // If copay amount is 0 (self-pay with no fee?), allow check-in
    if (copayAmount === 0) {
      return { allowed: true, copayRequired: false, copayWaived: false, copayPaid: false };
    }

    // Copay is required but not paid and not waived
    return {
      allowed: false,
      reason: 'Copay payment required',
      copayRequired: true,
      copayAmount,
      copayWaived: false,
      copayPaid: false,
    };
  }

  /**
   * Phase 3 Feature #7: Waive copay with reason and approval
   */
  async waiveCopay(
    hospitalId: string,
    appointmentId: string,
    waivedBy: string,
    reason: string
  ): Promise<void> {
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, hospitalId },
    });

    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }

    await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        copayWaived: true,
        copayWaivedReason: reason,
        copayWaivedBy: waivedBy,
        copayWaivedAt: new Date(),
      },
    });

    // Add to audit log in notes
    const existingNotes = appointment.notes ? JSON.parse(appointment.notes) : {};
    const auditLog = existingNotes.verificationLog || [];
    auditLog.push({
      action: 'copay_waived',
      reason,
      performedBy: waivedBy,
      performedAt: new Date().toISOString(),
    });

    await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        notes: JSON.stringify({ ...existingNotes, verificationLog: auditLog }),
      },
    });

    logger.info(`Copay waived for appointment ${appointmentId} by ${waivedBy}: ${reason}`);
  }

  /**
   * Phase 3 Feature #1: Get pending verifications with "paid but not verified" filter
   */
  async getPendingVerifications(hospitalId: string, filter?: 'all' | 'pending' | 'flagged'): Promise<any[]> {
    const where: any = {
      hospitalId,
      copayCollected: true,
      appointmentDate: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      },
    };

    if (filter === 'pending') {
      // Paid but not verified - Feature #1
      where.OR = [
        { copayVerificationStatus: null },
        { copayVerificationStatus: 'pending' },
      ];
    } else if (filter === 'flagged') {
      // Flagged payments (underpayment, overpayment)
      where.copayVerificationFlag = { not: null };
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        copayPayments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        patient: {
          select: { id: true, firstName: true, lastName: true, mrn: true },
        },
        doctor: {
          select: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: [
        // FIFO - oldest first for pending verification
        { createdAt: 'asc' },
      ],
    });

    return appointments.map((apt) => {
      const payment = apt.copayPayments[0];
      const expectedAmount = apt.copayAmount ? Number(apt.copayAmount) : 0;
      const paidAmount = payment ? Number(payment.amount) : 0;
      const amountMatches = Math.abs(paidAmount - expectedAmount) <= 0.01;

      return {
        appointmentId: apt.id,
        patientId: apt.patientId,
        patientName: `${apt.patient.firstName} ${apt.patient.lastName}`,
        mrn: apt.patient.mrn,
        doctorName: apt.doctor ? `Dr. ${apt.doctor.user.firstName} ${apt.doctor.user.lastName}` : 'Unknown',
        appointmentDate: apt.appointmentDate,
        expectedAmount,
        paidAmount,
        difference: paidAmount - expectedAmount,
        amountMatches,
        paymentMethod: payment?.paymentMethod,
        paidAt: payment?.paymentDate,
        verificationStatus: (apt as any).copayVerificationStatus,
        verificationFlag: (apt as any).copayVerificationFlag,
        autoVerified: (apt as any).copayAutoVerified,
      };
    });
  }

  /**
   * Phase 3 Feature #2: Quick verify for matching amounts
   */
  async quickVerify(hospitalId: string, appointmentId: string, staffUserId: string): Promise<void> {
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, hospitalId },
      include: {
        copayPayments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }

    const payment = appointment.copayPayments[0];
    if (!payment) {
      throw new ValidationError('No payment found for this appointment');
    }

    const expectedAmount = appointment.copayAmount ? Number(appointment.copayAmount) : 0;
    const paidAmount = Number(payment.amount);

    // Only allow quick verify if amounts match
    if (Math.abs(paidAmount - expectedAmount) > 0.01) {
      throw new ValidationError('Amount mismatch - cannot quick verify. Please use full verification flow.');
    }

    // Update verification status
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        copayVerificationStatus: CopayVerificationStatus.VERIFIED,
        copayVerificationFlag: null,
      },
    });

    // Add to audit log
    const existingNotes = appointment.notes ? JSON.parse(appointment.notes) : {};
    const auditLog = existingNotes.verificationLog || [];
    auditLog.push({
      action: 'quick_verify',
      performedBy: staffUserId,
      performedAt: new Date().toISOString(),
      note: 'Quick verified - exact amount match',
    });

    await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        notes: JSON.stringify({ ...existingNotes, verificationLog: auditLog }),
      },
    });

    logger.info(`Quick verified payment for appointment ${appointmentId} by ${staffUserId}`);
  }

  /**
   * Phase 3 Feature #3: Get reconciliation report for date range
   */
  async getReconciliationReport(
    hospitalId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    dateRange: { start: Date; end: Date };
    expected: { count: number; amount: number };
    actual: { 
      count: number; 
      amount: number;
      online: { count: number; amount: number };
      cash: { count: number; amount: number };
    };
    variance: number;
    discrepancies: any[];
    byPaymentMethod: Record<string, { count: number; amount: number }>;
  }> {
    const startOfRange = new Date(startDate);
    startOfRange.setHours(0, 0, 0, 0);
    const endOfRange = new Date(endDate);
    endOfRange.setHours(23, 59, 59, 999);

    // Get all appointments in range with copay info
    const appointments = await prisma.appointment.findMany({
      where: {
        hospitalId,
        appointmentDate: {
          gte: startOfRange,
          lte: endOfRange,
        },
        status: { not: 'CANCELLED' },
      },
      include: {
        copayPayments: true,
        patient: {
          select: { firstName: true, lastName: true, mrn: true },
        },
        doctor: {
          select: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    // Calculate expected copay
    const expectedCount = appointments.filter(a => a.copayAmount && Number(a.copayAmount) > 0).length;
    const expectedAmount = appointments.reduce((sum, a) => sum + (a.copayAmount ? Number(a.copayAmount) : 0), 0);

    // Calculate actual collected
    const allPayments = appointments.flatMap(a => a.copayPayments);
    const actualCount = allPayments.length;
    const actualAmount = allPayments.reduce((sum, p) => sum + Number(p.amount), 0);

    // Group by payment method
    const onlinePayments = allPayments.filter(p => 
      ['CREDIT_CARD', 'DEBIT_CARD', 'NET_BANKING', 'UPI', 'ONLINE', 'APPLE_PAY', 'GOOGLE_PAY'].includes(p.paymentMethod)
    );
    const cashPayments = allPayments.filter(p => p.paymentMethod === 'CASH');

    const byPaymentMethod: Record<string, { count: number; amount: number }> = {};
    allPayments.forEach(p => {
      if (!byPaymentMethod[p.paymentMethod]) {
        byPaymentMethod[p.paymentMethod] = { count: 0, amount: 0 };
      }
      byPaymentMethod[p.paymentMethod].count++;
      byPaymentMethod[p.paymentMethod].amount += Number(p.amount);
    });

    // Find discrepancies
    const discrepancies = appointments
      .filter(apt => {
        const expected = apt.copayAmount ? Number(apt.copayAmount) : 0;
        const paid = apt.copayPayments.reduce((sum, p) => sum + Number(p.amount), 0);
        // Discrepancy if: expected > 0 but not paid, or paid != expected
        return (expected > 0 && paid === 0) || (paid > 0 && Math.abs(paid - expected) > 0.01);
      })
      .map(apt => {
        const expected = apt.copayAmount ? Number(apt.copayAmount) : 0;
        const paid = apt.copayPayments.reduce((sum, p) => sum + Number(p.amount), 0);
        return {
          appointmentId: apt.id,
          patientName: `${apt.patient.firstName} ${apt.patient.lastName}`,
          mrn: apt.patient.mrn,
          doctorName: apt.doctor ? `Dr. ${apt.doctor.user.firstName} ${apt.doctor.user.lastName}` : 'Unknown',
          appointmentDate: apt.appointmentDate,
          expected,
          paid,
          difference: paid - expected,
          type: paid === 0 ? 'missing' : (paid < expected ? 'underpayment' : 'overpayment'),
          copayWaived: (apt as any).copayWaived || false,
        };
      });

    return {
      dateRange: { start: startOfRange, end: endOfRange },
      expected: { count: expectedCount, amount: expectedAmount },
      actual: {
        count: actualCount,
        amount: actualAmount,
        online: {
          count: onlinePayments.length,
          amount: onlinePayments.reduce((sum, p) => sum + Number(p.amount), 0),
        },
        cash: {
          count: cashPayments.length,
          amount: cashPayments.reduce((sum, p) => sum + Number(p.amount), 0),
        },
      },
      variance: actualAmount - expectedAmount,
      discrepancies,
      byPaymentMethod,
    };
  }

  /**
   * Select "Pay at Clinic" option
   */
  async selectPayAtClinic(hospitalId: string, patientId: string, appointmentId: string): Promise<CopayInfo> {
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        hospitalId,
        patientId,
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
      },
    });

    if (!appointment) {
      throw new NotFoundError('Appointment not found or not in valid status');
    }

    if (appointment.copayCollected) {
      throw new ValidationError('Copay already collected for this appointment');
    }

    const existingNotes = appointment.notes ? JSON.parse(appointment.notes) : {};
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        notes: JSON.stringify({
          ...existingNotes,
          paymentChoice: 'pay_at_clinic',
          paymentChoiceAt: new Date().toISOString(),
        }),
      },
    });

    return this.getCopayInfo(hospitalId, patientId, appointmentId);
  }

  /**
   * Select "Decide Later" option
   */
  async selectDecideLater(hospitalId: string, patientId: string, appointmentId: string): Promise<CopayInfo> {
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        hospitalId,
        patientId,
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
      },
    });

    if (!appointment) {
      throw new NotFoundError('Appointment not found or not in valid status');
    }

    const existingNotes = appointment.notes ? JSON.parse(appointment.notes) : {};
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        notes: JSON.stringify({
          ...existingNotes,
          paymentChoice: 'decide_later',
          paymentChoiceAt: new Date().toISOString(),
          reminderScheduled: true,
        }),
      },
    });

    return this.getCopayInfo(hospitalId, patientId, appointmentId);
  }

  /**
   * Initiate online payment for copay
   */
  async initiateOnlinePayment(
    hospitalId: string,
    patientId: string,
    appointmentId: string
  ): Promise<{
    copayInfo: CopayInfo;
    paymentIntent: {
      transactionId: string;
      clientSecret: string;
      amount: number;
      currency: string;
    };
  }> {
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        hospitalId,
        patientId,
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
      },
    });

    if (!appointment) {
      throw new NotFoundError('Appointment not found or not in valid status');
    }

    if (appointment.copayCollected) {
      throw new ValidationError('Copay already collected for this appointment');
    }

    const copayInfo = await this.getCopayInfo(hospitalId, patientId, appointmentId);

    if (copayInfo.copayAmount <= 0) {
      throw new ValidationError('No copay amount due for this appointment');
    }

    const invoice = await prisma.invoice.create({
      data: {
        hospitalId,
        patientId,
        invoiceNumber: `COP-${Date.now()}`,
        invoiceDate: new Date(),
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        subtotal: copayInfo.copayAmount,
        totalAmount: copayInfo.copayAmount,
        balanceAmount: copayInfo.copayAmount,
        status: 'PENDING',
        notes: JSON.stringify({ appointmentId, type: 'copay' }),
      },
    });

    const paymentIntent = await paymentGatewayService.createPaymentIntent(
      hospitalId,
      invoice.id,
      copayInfo.copayAmount,
      'AED'
    );

    const existingNotes = appointment.notes ? JSON.parse(appointment.notes) : {};
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        notes: JSON.stringify({
          ...existingNotes,
          paymentChoice: 'pay_online',
          paymentChoiceAt: new Date().toISOString(),
          invoiceId: invoice.id,
          transactionId: paymentIntent.transactionId,
        }),
      },
    });

    return {
      copayInfo: {
        ...copayInfo,
        paymentStatus: CopayPaymentStatus.PAYMENT_INITIATED,
      },
      paymentIntent,
    };
  }

  /**
   * Confirm online payment with Phase 3 auto-verification
   */
  async confirmOnlinePayment(
    transactionId: string,
    hospitalId: string
  ): Promise<CopayInfo> {
    const transaction = await prisma.paymentTransaction.findFirst({
      where: { id: transactionId },
      include: { invoice: true },
    });

    if (!transaction || !transaction.invoice) {
      throw new NotFoundError('Transaction not found');
    }

    const invoiceNotes = transaction.invoice.notes ? JSON.parse(transaction.invoice.notes as string) : {};
    const appointmentId = invoiceNotes.appointmentId;

    if (!appointmentId) {
      throw new ValidationError('Appointment ID not found in transaction');
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }

    const patientInsurance = await prisma.patientInsurance.findFirst({
      where: { 
        patientId: appointment.patientId,
        isActive: true,
      },
    });

    const receiptNumber = `RCP-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    const paidAmount = Number(transaction.amount);
    const expectedAmount = appointment.copayAmount ? Number(appointment.copayAmount) : 0;
    
    // Phase 4: Calculate remaining balance
    const remainingBalance = Math.max(0, expectedAmount - paidAmount);
    const fullyPaid = remainingBalance <= 0.01;
    const status = fullyPaid ? 'PAID' : 'PARTIAL';
    
    // Create CopayPayment record with Phase 4 fields
    await prisma.copayPayment.create({
      data: {
        patientId: appointment.patientId,
        appointmentId: appointment.id,
        expectedAmount, // Phase 4: Track expected amount
        amount: transaction.amount,
        remainingBalance, // Phase 4: Track remaining
        status, // Phase 4: Track payment status
        paymentMethod: 'CREDIT_CARD',
        insuranceProvider: patientInsurance?.providerName || 'Self-Pay',
        policyNumber: patientInsurance?.policyNumber || 'N/A',
        collectedBy: 'ONLINE_PAYMENT',
        receiptNumber,
      },
    });

    // Update appointment - only mark as collected if fully paid
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        copayCollected: fullyPaid,
        copayAmount: expectedAmount, // Keep expected amount, not paid amount
      },
    });

    // Phase 3: Auto-verify payment
    await this.autoVerifyPayment(appointmentId, paidAmount, expectedAmount);

    // Send receipt email
    try {
      await this.sendPaymentReceiptEmail(
        hospitalId,
        appointment.patientId,
        appointmentId,
        {
          transactionId,
          receiptNumber,
          amount: paidAmount,
          paymentMethod: 'CREDIT_CARD',
          paidAt: new Date(),
        }
      );
    } catch (emailError) {
      logger.error('Failed to send payment receipt email:', emailError);
    }

    return this.getCopayInfo(hospitalId, appointment.patientId, appointmentId);
  }

  /**
   * Staff collects cash payment with Phase 3 auto-verification
   */
  async collectCashPayment(
    hospitalId: string,
    appointmentId: string,
    staffUserId: string,
    amount: number,
    paymentMethod: 'CASH' | 'CREDIT_CARD' = 'CASH',
    notes?: string
  ): Promise<CopayInfo> {
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        hospitalId,
      },
      include: {
        copayPayments: true, // Get existing payments
      },
    });

    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }

    // Phase 4: Allow partial payments - check total paid vs expected
    const expectedAmount = appointment.copayAmount ? Number(appointment.copayAmount) : 0;
    const alreadyPaid = appointment.copayPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const currentBalance = expectedAmount - alreadyPaid;

    if (currentBalance <= 0.01 && appointment.copayCollected) {
      throw new ValidationError('Copay already fully collected for this appointment');
    }

    const patientInsurance = await prisma.patientInsurance.findFirst({
      where: { 
        patientId: appointment.patientId,
        isActive: true,
      },
    });

    // Phase 4: Calculate remaining balance after this payment
    const newRemainingBalance = Math.max(0, currentBalance - amount);
    const fullyPaid = newRemainingBalance <= 0.01;
    const status = fullyPaid ? 'PAID' : 'PARTIAL';

    await prisma.copayPayment.create({
      data: {
        patientId: appointment.patientId,
        appointmentId: appointment.id,
        expectedAmount, // Phase 4: Track expected amount
        amount,
        remainingBalance: newRemainingBalance, // Phase 4: Track remaining
        status, // Phase 4: Track payment status
        paymentMethod,
        insuranceProvider: patientInsurance?.providerName || 'Self-Pay',
        policyNumber: patientInsurance?.policyNumber || 'N/A',
        collectedBy: staffUserId,
        notes,
        receiptNumber: `RCP-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
      },
    });

    // Phase 4: Only mark as collected if fully paid
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        copayCollected: fullyPaid,
        copayAmount: expectedAmount, // Keep expected amount
        checkedInAt: new Date(),
      },
    });

    // Phase 3: Auto-verify payment (only if fully paid)
    if (fullyPaid) {
      await this.autoVerifyPayment(appointmentId, amount, expectedAmount);
    }

    return this.getCopayInfo(hospitalId, appointment.patientId, appointmentId);
  }

  /**
   * Get appointments with payment status for staff check-in view
   */
  async getAppointmentsWithPaymentStatus(
    hospitalId: string,
    date: Date,
    doctorId?: string
  ): Promise<Array<{
    appointment: any;
    paymentStatus: CopayPaymentStatus;
    copayAmount: number;
    paidAmount?: number;
    verificationStatus?: string;
    verificationFlag?: string;
    copayWaived?: boolean;
  }>> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const whereClause: any = {
      hospitalId,
      appointmentDate: {
        gte: startOfDay,
        lte: endOfDay,
      },
      status: { in: ['SCHEDULED', 'CONFIRMED', 'CHECKED_IN'] },
    };

    if (doctorId) {
      whereClause.doctorId = doctorId;
    }

    const appointments = await prisma.appointment.findMany({
      where: whereClause,
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
        doctor: {
          select: {
            id: true,
            consultationFee: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
        copayPayments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ startTime: 'asc' }],
    });

    return appointments.map((apt) => {
      let paymentStatus = CopayPaymentStatus.PENDING;
      const copayAmount = apt.copayAmount ? Number(apt.copayAmount) : 
                         (apt.doctor?.consultationFee ? Number(apt.doctor.consultationFee) * 0.2 : 50);
      const payment = apt.copayPayments[0];
      const paidAmount = payment ? Number(payment.amount) : undefined;

      if (apt.copayCollected && payment) {
        if (['CREDIT_CARD', 'DEBIT_CARD', 'NET_BANKING', 'UPI'].includes(payment.paymentMethod)) {
          paymentStatus = CopayPaymentStatus.PAID_ONLINE;
        } else {
          paymentStatus = CopayPaymentStatus.PAID_CASH;
        }
      } else {
        try {
          const notes = apt.notes ? JSON.parse(apt.notes) : null;
          if (notes?.paymentChoice === 'pay_at_clinic') {
            paymentStatus = CopayPaymentStatus.PAY_AT_CLINIC;
          }
        } catch {
          // Invalid JSON
        }
      }

      return {
        appointment: {
          id: apt.id,
          patientId: apt.patientId,
          patientName: `${apt.patient.firstName} ${apt.patient.lastName}`,
          mrn: apt.patient.mrn,
          phone: apt.patient.phone,
          doctorName: `Dr. ${apt.doctor.user.firstName} ${apt.doctor.user.lastName}`,
          appointmentDate: apt.appointmentDate,
          startTime: apt.startTime,
          endTime: apt.endTime,
          status: apt.status,
          tokenNumber: apt.tokenNumber,
          checkedInAt: apt.checkedInAt,
          notes: apt.notes,
        },
        paymentStatus,
        copayAmount,
        paidAmount,
        verificationStatus: (apt as any).copayVerificationStatus || undefined,
        verificationFlag: (apt as any).copayVerificationFlag || undefined,
        copayWaived: (apt as any).copayWaived || false,
      };
    });
  }

  /**
   * Get pending payment reminders
   */
  async getPendingPaymentReminders(hospitalId: string): Promise<Array<{
    appointmentId: string;
    patientId: string;
    patientName: string;
    patientPhone: string;
    patientEmail?: string;
    appointmentDate: Date;
    doctorName: string;
    copayAmount: number;
  }>> {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const appointments = await prisma.appointment.findMany({
      where: {
        hospitalId,
        appointmentDate: {
          gte: now,
          lte: tomorrow,
        },
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
        copayCollected: false,
      },
      include: {
        patient: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },
        doctor: {
          select: {
            consultationFee: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    return appointments
      .filter((apt) => {
        try {
          const notes = apt.notes ? JSON.parse(apt.notes) : null;
          return notes?.paymentChoice !== 'pay_at_clinic';
        } catch {
          return true;
        }
      })
      .map((apt) => ({
        appointmentId: apt.id,
        patientId: apt.patientId,
        patientName: `${apt.patient.firstName} ${apt.patient.lastName}`,
        patientPhone: apt.patient.phone || '',
        patientEmail: apt.patient.email || undefined,
        appointmentDate: apt.appointmentDate,
        doctorName: `Dr. ${apt.doctor.user.firstName} ${apt.doctor.user.lastName}`,
        copayAmount: apt.copayAmount ? Number(apt.copayAmount) : 
                    (apt.doctor?.consultationFee ? Number(apt.doctor.consultationFee) * 0.2 : 50),
      }));
  }

  /**
   * Send payment receipt email
   */
  async sendPaymentReceiptEmail(
    hospitalId: string,
    patientId: string,
    appointmentId: string,
    paymentDetails: {
      transactionId: string;
      receiptNumber: string;
      amount: number;
      paymentMethod: string;
      paidAt: Date;
    }
  ): Promise<void> {
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: {
        firstName: true,
        lastName: true,
        email: true,
      },
    });

    if (!patient?.email) {
      logger.warn(`Cannot send receipt email - patient ${patientId} has no email`);
      return;
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        doctor: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            department: { select: { name: true } },
          },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }

    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { name: true, address: true, phone: true },
    });

    const patientInsurance = await prisma.patientInsurance.findFirst({
      where: { patientId, isActive: true },
    });

    const doctorName = `Dr. ${appointment.doctor.user.firstName} ${appointment.doctor.user.lastName}`;
    const departmentName = appointment.doctor.department?.name || '';
    const appointmentDate = format(appointment.appointmentDate, 'MMMM d, yyyy');
    const appointmentTime = appointment.startTime || '';

    const receiptHtml = this.buildReceiptEmailHtml({
      patientName: `${patient.firstName} ${patient.lastName}`,
      transactionId: paymentDetails.transactionId,
      receiptNumber: paymentDetails.receiptNumber,
      amount: paymentDetails.amount,
      paymentMethod: paymentDetails.paymentMethod,
      paidAt: paymentDetails.paidAt,
      doctorName,
      departmentName,
      appointmentDate,
      appointmentTime,
      appointmentId,
      insuranceProvider: patientInsurance?.providerName,
      policyNumber: patientInsurance?.policyNumber,
      hospitalName: hospital?.name || 'Spetaar Healthcare',
      hospitalAddress: hospital?.address,
      hospitalPhone: hospital?.phone,
    });

    await sendEmail({
      to: patient.email,
      subject: `Payment Receipt - ${appointmentDate}`,
      html: receiptHtml,
      text: `Payment Receipt\n\nTransaction ID: ${paymentDetails.transactionId}\nAmount: AED ${paymentDetails.amount.toFixed(2)}\nDate: ${format(paymentDetails.paidAt, 'MMMM d, yyyy h:mm a')}\n\nDoctor: ${doctorName}\nAppointment: ${appointmentDate} at ${appointmentTime}\n\nThank you for your payment!`,
    });

    logger.info(`Payment receipt email sent to ${patient.email} for appointment ${appointmentId}`);
  }

  private buildReceiptEmailHtml(data: {
    patientName: string;
    transactionId: string;
    receiptNumber: string;
    amount: number;
    paymentMethod: string;
    paidAt: Date;
    doctorName: string;
    departmentName: string;
    appointmentDate: string;
    appointmentTime: string;
    appointmentId: string;
    insuranceProvider?: string;
    policyNumber?: string;
    hospitalName: string;
    hospitalAddress?: string;
    hospitalPhone?: string;
  }): string {
    const paymentMethodLabels: Record<string, string> = {
      CREDIT_CARD: 'Credit Card',
      DEBIT_CARD: 'Debit Card',
      CASH: 'Cash',
      NET_BANKING: 'Net Banking',
      UPI: 'UPI',
    };

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333333; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
          .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; padding: 30px 20px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
          .success-icon { font-size: 48px; margin-bottom: 10px; }
          .content { padding: 40px 30px; }
          .amount-box { background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border: 2px solid #10b981; border-radius: 12px; padding: 25px; text-align: center; margin: 25px 0; }
          .amount { font-size: 42px; font-weight: bold; color: #059669; }
          .info-box { background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
          .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
          .info-row:last-child { border-bottom: none; }
          .info-label { color: #64748b; font-weight: 500; }
          .info-value { color: #1e293b; font-weight: 600; }
          .footer { background-color: #f1f5f9; padding: 25px 20px; text-align: center; font-size: 12px; color: #64748b; }
          .divider { height: 1px; background-color: #e2e8f0; margin: 25px 0; }
          .note { background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0; font-size: 13px; color: #1e40af; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="success-icon">✓</div>
            <h1>Payment Successful</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Thank you for your payment</p>
          </div>
          
          <div class="content">
            <p>Dear ${data.patientName},</p>
            <p>Your copay payment has been successfully processed. Here are the details:</p>
            
            <div class="amount-box">
              <p style="margin: 0 0 5px 0; color: #059669; font-size: 14px;">Amount Paid</p>
              <div class="amount">AED ${data.amount.toFixed(2)}</div>
              <p style="margin: 10px 0 0 0; color: #6b7280; font-size: 13px;">
                ${format(data.paidAt, 'MMMM d, yyyy')} at ${format(data.paidAt, 'h:mm a')}
              </p>
            </div>
            
            <div class="info-box">
              <div class="info-row">
                <span class="info-label">Transaction ID</span>
                <span class="info-value">${data.transactionId}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Receipt Number</span>
                <span class="info-value">${data.receiptNumber}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Payment Method</span>
                <span class="info-value">${paymentMethodLabels[data.paymentMethod] || data.paymentMethod}</span>
              </div>
              ${data.insuranceProvider ? `
              <div class="info-row">
                <span class="info-label">Insurance</span>
                <span class="info-value">${data.insuranceProvider}</span>
              </div>
              ` : ''}
            </div>
            
            <div class="divider"></div>
            
            <h3 style="color: #1e40af; margin-bottom: 15px;">Appointment Details</h3>
            <div class="info-box">
              <div class="info-row">
                <span class="info-label">Doctor</span>
                <span class="info-value">${data.doctorName}</span>
              </div>
              ${data.departmentName ? `
              <div class="info-row">
                <span class="info-label">Department</span>
                <span class="info-value">${data.departmentName}</span>
              </div>
              ` : ''}
              <div class="info-row">
                <span class="info-label">Date</span>
                <span class="info-value">${data.appointmentDate}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Time</span>
                <span class="info-value">${data.appointmentTime}</span>
              </div>
            </div>
            
            <div class="note">
              <strong>💡 Pro Tip:</strong> Show this receipt at check-in for faster service. Your copay is already paid!
            </div>
          </div>
          
          <div class="footer">
            <p style="font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 5px;">${data.hospitalName}</p>
            ${data.hospitalAddress ? `<p style="margin: 5px 0;">${data.hospitalAddress}</p>` : ''}
            ${data.hospitalPhone ? `<p style="margin: 5px 0;">Phone: ${data.hospitalPhone}</p>` : ''}
            <div class="divider"></div>
            <p>This is an automated receipt. Please keep it for your records.</p>
            <p>&copy; ${new Date().getFullYear()} ${data.hospitalName}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  async getReceiptData(
    hospitalId: string,
    patientId: string,
    appointmentId: string
  ): Promise<{
    transactionId: string;
    receiptNumber: string;
    amount: number;
    paymentMethod: string;
    paidAt: Date;
    doctorName: string;
    departmentName?: string;
    appointmentDate: string;
    appointmentTime: string;
    insuranceProvider?: string;
    policyNumber?: string;
  } | null> {
    const copayPayment = await prisma.copayPayment.findFirst({
      where: {
        appointmentId,
        patientId,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!copayPayment) {
      return null;
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        doctor: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            department: { select: { name: true } },
          },
        },
      },
    });

    if (!appointment) {
      return null;
    }

    return {
      transactionId: copayPayment.id,
      receiptNumber: copayPayment.receiptNumber || `RCP-${copayPayment.id.slice(0, 8)}`,
      amount: Number(copayPayment.amount),
      paymentMethod: copayPayment.paymentMethod,
      paidAt: copayPayment.paymentDate,
      doctorName: `Dr. ${appointment.doctor.user.firstName} ${appointment.doctor.user.lastName}`,
      departmentName: appointment.doctor.department?.name,
      appointmentDate: format(appointment.appointmentDate, 'MMMM d, yyyy'),
      appointmentTime: appointment.startTime || '',
      insuranceProvider: copayPayment.insuranceProvider !== 'Self-Pay' ? copayPayment.insuranceProvider : undefined,
      policyNumber: copayPayment.policyNumber !== 'N/A' ? copayPayment.policyNumber : undefined,
    };
  }

  async resendReceiptEmail(
    hospitalId: string,
    patientId: string,
    appointmentId: string
  ): Promise<void> {
    const receiptData = await this.getReceiptData(hospitalId, patientId, appointmentId);

    if (!receiptData) {
      throw new NotFoundError('No payment found for this appointment');
    }

    await this.sendPaymentReceiptEmail(hospitalId, patientId, appointmentId, {
      transactionId: receiptData.transactionId,
      receiptNumber: receiptData.receiptNumber,
      amount: receiptData.amount,
      paymentMethod: receiptData.paymentMethod,
      paidAt: receiptData.paidAt,
    });
  }
}

export const appointmentCopayService = new AppointmentCopayService();
