import prisma from '../config/database';
import { NotFoundError, ValidationError } from '../middleware/errorHandler';
import { paymentGatewayService } from './paymentGatewayService';
import { Decimal } from '@prisma/client/runtime/library';
import { sendEmail } from './emailService';
import { format } from 'date-fns';
import logger from '../utils/logger';

export enum CopayPaymentStatus {
  PENDING = 'pending',           // No selection made yet
  PAY_AT_CLINIC = 'pay_at_clinic', // Patient chose to pay cash
  PAYMENT_INITIATED = 'payment_initiated', // Online payment started
  PAID_ONLINE = 'paid_online',   // Paid via online gateway
  PAID_CASH = 'paid_cash',       // Cash collected at clinic
  REFUNDED = 'refunded',         // Payment was refunded
}

export interface CopayInfo {
  appointmentId: string;
  copayAmount: number;
  paymentStatus: CopayPaymentStatus;
  paymentMethod?: string;
  paidAt?: Date;
  transactionId?: string;
  receiptUrl?: string;
  // Issue #3: Enhanced copay breakdown
  breakdown?: {
    serviceFee: number;
    insuranceCoverage: number;
    insuranceCoveragePercent: number;
    patientResponsibility: number;
    deductibleApplied: number;
    annualCapRemaining?: number;
  };
  // Issue #3: Insurance status for real-time validation
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

    // Get patient's active insurance separately
    const patientInsurance = await prisma.patientInsurance.findFirst({
      where: { 
        patientId,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get service fee from doctor's consultation fee
    const serviceFee = appointment.doctor?.consultationFee 
      ? Number(appointment.doctor.consultationFee) 
      : 150; // Default consultation fee

    // Determine copay amount from insurance or default
    let copayAmount = appointment.copayAmount ? Number(appointment.copayAmount) : 0;
    
    // If no copay set, calculate from insurance
    // Use copay field from insurance or default to 20% of service fee
    if (!copayAmount && patientInsurance) {
      const insuranceCopay = patientInsurance.copay ? Number(patientInsurance.copay) : null;
      const coveragePercent = insuranceCopay ? Math.round((1 - insuranceCopay / serviceFee) * 100) : 80;
      copayAmount = insuranceCopay || Math.round(serviceFee * (100 - coveragePercent) / 100);
    }

    // If still no copay (self-pay), use full service fee
    if (!copayAmount) {
      copayAmount = serviceFee;
    }

    // Determine payment status
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
      
      // Check if it was online or cash
      if (['CREDIT_CARD', 'DEBIT_CARD', 'NET_BANKING', 'UPI'].includes(lastPayment.paymentMethod)) {
        paymentStatus = CopayPaymentStatus.PAID_ONLINE;
      } else {
        paymentStatus = CopayPaymentStatus.PAID_CASH;
      }
    } else {
      // Check if patient selected "pay at clinic"
      try {
        const metadata = appointment.notes ? JSON.parse(appointment.notes) : null;
        if (metadata?.paymentChoice === 'pay_at_clinic') {
          paymentStatus = CopayPaymentStatus.PAY_AT_CLINIC;
        }
      } catch {
        // Invalid JSON, keep as pending
      }
    }

    // Issue #3: Build insurance status and breakdown
    let insuranceStatus: CopayInfo['insuranceStatus'] | undefined;
    let breakdown: CopayInfo['breakdown'] | undefined;

    if (patientInsurance) {
      // Real-time insurance validation
      const now = new Date();
      const policyExpiry = patientInsurance.expiryDate ? new Date(patientInsurance.expiryDate) : null;
      const isActive = patientInsurance.isActive && (!policyExpiry || policyExpiry > now);
      
      // Build warnings array
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
        deductibleMet: true, // Simplified
        annualCapReached: false,
        warnings: warnings.length > 0 ? warnings : undefined,
      };

      // Calculate breakdown - use copay if set, otherwise default to 80% coverage
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

      // Update copayAmount if insurance is inactive
      if (!isActive) {
        copayAmount = serviceFee;
      }
    } else {
      // Self-pay patient - full service fee
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
    };
  }

  /**
   * Patient selects "Pay at Clinic" option
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

    // Update appointment with payment choice in notes metadata
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
   * Patient selects "Decide Later" option
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

    // Update appointment - keep as pending, will send reminder
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

    // Get copay amount
    const copayInfo = await this.getCopayInfo(hospitalId, patientId, appointmentId);

    if (copayInfo.copayAmount <= 0) {
      throw new ValidationError('No copay amount due for this appointment');
    }

    // Create a temporary invoice for copay payment
    const invoice = await prisma.invoice.create({
      data: {
        hospitalId,
        patientId,
        invoiceNumber: `COP-${Date.now()}`,
        invoiceDate: new Date(),
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        subtotal: copayInfo.copayAmount,
        totalAmount: copayInfo.copayAmount,
        balanceAmount: copayInfo.copayAmount,
        status: 'PENDING',
        notes: JSON.stringify({ appointmentId, type: 'copay' }),
      },
    });

    // Create payment intent via Stripe
    const paymentIntent = await paymentGatewayService.createPaymentIntent(
      hospitalId,
      invoice.id,
      copayInfo.copayAmount,
      'AED'
    );

    // Update appointment with payment initiated status
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
   * Confirm online payment (called after Stripe webhook confirms payment)
   */
  async confirmOnlinePayment(
    transactionId: string,
    hospitalId: string
  ): Promise<CopayInfo> {
    // Get transaction details
    const transaction = await prisma.paymentTransaction.findFirst({
      where: { id: transactionId },
      include: { invoice: true },
    });

    if (!transaction || !transaction.invoice) {
      throw new NotFoundError('Transaction not found');
    }

    // Parse invoice notes to get appointmentId
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

    // Get patient's insurance for receipt
    const patientInsurance = await prisma.patientInsurance.findFirst({
      where: { 
        patientId: appointment.patientId,
        isActive: true,
      },
    });

    const receiptNumber = `RCP-${Date.now()}`;
    
    // Create CopayPayment record
    const copayPayment = await prisma.copayPayment.create({
      data: {
        patientId: appointment.patientId,
        appointmentId: appointment.id,
        amount: transaction.amount,
        paymentMethod: 'CREDIT_CARD',
        insuranceProvider: patientInsurance?.providerName || 'Self-Pay',
        policyNumber: patientInsurance?.policyNumber || 'N/A',
        collectedBy: 'ONLINE_PAYMENT',
        receiptNumber,
      },
    });

    // Update appointment
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        copayCollected: true,
        copayAmount: transaction.amount,
      },
    });

    // Phase 2 Feature #5: Send receipt email
    try {
      await this.sendPaymentReceiptEmail(
        hospitalId,
        appointment.patientId,
        appointmentId,
        {
          transactionId,
          receiptNumber,
          amount: Number(transaction.amount),
          paymentMethod: 'CREDIT_CARD',
          paidAt: new Date(),
        }
      );
    } catch (emailError) {
      // Don't fail the payment if email fails
      logger.error('Failed to send payment receipt email:', emailError);
    }

    return this.getCopayInfo(hospitalId, appointment.patientId, appointmentId);
  }

  /**
   * Staff collects cash payment at check-in
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
    });

    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }

    if (appointment.copayCollected) {
      throw new ValidationError('Copay already collected for this appointment');
    }

    // Get patient's insurance
    const patientInsurance = await prisma.patientInsurance.findFirst({
      where: { 
        patientId: appointment.patientId,
        isActive: true,
      },
    });

    // Create CopayPayment record
    await prisma.copayPayment.create({
      data: {
        patientId: appointment.patientId,
        appointmentId: appointment.id,
        amount,
        paymentMethod,
        insuranceProvider: patientInsurance?.providerName || 'Self-Pay',
        policyNumber: patientInsurance?.policyNumber || 'N/A',
        collectedBy: staffUserId,
        notes,
        receiptNumber: `RCP-${Date.now()}`,
      },
    });

    // Update appointment
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        copayCollected: true,
        copayAmount: amount,
        checkedInAt: new Date(),
      },
    });

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

      if (apt.copayCollected && apt.copayPayments[0]) {
        const payment = apt.copayPayments[0];
        if (['CREDIT_CARD', 'DEBIT_CARD', 'NET_BANKING', 'UPI'].includes(payment.paymentMethod)) {
          paymentStatus = CopayPaymentStatus.PAID_ONLINE;
        } else {
          paymentStatus = CopayPaymentStatus.PAID_CASH;
        }
      } else {
        // Check notes for payment choice
        try {
          const notes = apt.notes ? JSON.parse(apt.notes) : null;
          if (notes?.paymentChoice === 'pay_at_clinic') {
            paymentStatus = CopayPaymentStatus.PAY_AT_CLINIC;
          }
        } catch {
          // Invalid JSON, keep as pending
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
        },
        paymentStatus,
        copayAmount,
      };
    });
  }

  /**
   * Get pending payment reminders (for 24h before appointment)
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
        // Filter out those who selected "pay at clinic"
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
   * Phase 2 Feature #5: Send payment receipt email to patient
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
    // Get patient info
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

    // Get appointment details
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

    // Get hospital info
    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { name: true, address: true, phone: true },
    });

    // Get patient's insurance for breakdown
    const patientInsurance = await prisma.patientInsurance.findFirst({
      where: { patientId, isActive: true },
    });

    const doctorName = `Dr. ${appointment.doctor.user.firstName} ${appointment.doctor.user.lastName}`;
    const departmentName = appointment.doctor.department?.name || '';
    const appointmentDate = format(appointment.appointmentDate, 'MMMM d, yyyy');
    const appointmentTime = appointment.startTime || '';

    // Build email HTML
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

    // Send email
    await sendEmail({
      to: patient.email,
      subject: `Payment Receipt - ${appointmentDate}`,
      html: receiptHtml,
      text: `Payment Receipt\n\nTransaction ID: ${paymentDetails.transactionId}\nAmount: AED ${paymentDetails.amount.toFixed(2)}\nDate: ${format(paymentDetails.paidAt, 'MMMM d, yyyy h:mm a')}\n\nDoctor: ${doctorName}\nAppointment: ${appointmentDate} at ${appointmentTime}\n\nThank you for your payment!`,
    });

    logger.info(`Payment receipt email sent to ${patient.email} for appointment ${appointmentId}`);
  }

  /**
   * Build HTML email template for payment receipt
   */
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

  /**
   * Phase 2 Feature #5: Get receipt data for an appointment
   */
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

  /**
   * Phase 2 Feature #5: Resend receipt email
   */
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
