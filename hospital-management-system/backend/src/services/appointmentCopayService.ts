import prisma from '../config/database';
import { NotFoundError, BadRequestError } from '../middleware/errorHandler';
import { paymentGatewayService } from './paymentGatewayService';
import { Decimal } from '@prisma/client/runtime/library';

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
        patient: {
          include: {
            insuranceInfo: {
              where: { status: 'ACTIVE' },
              take: 1,
            },
          },
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

    // Determine copay amount from insurance or default
    let copayAmount = appointment.copayAmount ? Number(appointment.copayAmount) : 0;
    
    // If no copay set, try to get from insurance policy
    if (!copayAmount && appointment.patient.insuranceInfo?.[0]) {
      const insurance = appointment.patient.insuranceInfo[0];
      // Default copay based on insurance type (simplified - in production would come from payer contract)
      copayAmount = insurance.policyType === 'BASIC' ? 50 : 
                    insurance.policyType === 'ENHANCED' ? 30 : 20;
    }

    // If still no copay and self-pay, use consultation fee
    if (!copayAmount && appointment.selfPay) {
      // Get consultation fee from doctor/department
      const fee = await prisma.servicePricing.findFirst({
        where: {
          hospitalId,
          serviceType: 'CONSULTATION',
          departmentId: appointment.doctor.departmentId,
        },
      });
      copayAmount = fee ? Number(fee.basePrice) : 150; // Default consultation fee
    }

    // Determine payment status
    let paymentStatus = CopayPaymentStatus.PENDING;
    let paymentMethod: string | undefined;
    let paidAt: Date | undefined;
    let transactionId: string | undefined;
    let receiptUrl: string | undefined;

    if (appointment.copayCollected) {
      const lastPayment = appointment.copayPayments[0];
      if (lastPayment) {
        paymentMethod = lastPayment.paymentMethod;
        paidAt = lastPayment.paymentDate;
        transactionId = lastPayment.id;
        receiptUrl = lastPayment.receiptUrl || undefined;
        
        // Check if it was online or cash
        if (['CARD', 'ONLINE', 'APPLE_PAY', 'GOOGLE_PAY'].includes(lastPayment.paymentMethod)) {
          paymentStatus = CopayPaymentStatus.PAID_ONLINE;
        } else {
          paymentStatus = CopayPaymentStatus.PAID_CASH;
        }
      }
    } else {
      // Check if patient selected "pay at clinic"
      const metadata = appointment.notes ? JSON.parse(appointment.notes) : null;
      if (metadata?.paymentChoice === 'pay_at_clinic') {
        paymentStatus = CopayPaymentStatus.PAY_AT_CLINIC;
      }
    }

    return {
      appointmentId,
      copayAmount,
      paymentStatus,
      paymentMethod,
      paidAt,
      transactionId,
      receiptUrl,
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
      throw new BadRequestError('Copay already collected for this appointment');
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
      include: {
        patient: {
          include: {
            insuranceInfo: { where: { status: 'ACTIVE' }, take: 1 },
          },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundError('Appointment not found or not in valid status');
    }

    if (appointment.copayCollected) {
      throw new BadRequestError('Copay already collected for this appointment');
    }

    // Get copay amount
    const copayInfo = await this.getCopayInfo(hospitalId, patientId, appointmentId);

    if (copayInfo.copayAmount <= 0) {
      throw new BadRequestError('No copay amount due for this appointment');
    }

    // Create a temporary invoice for copay payment
    const invoice = await prisma.invoice.create({
      data: {
        hospitalId,
        patientId,
        invoiceNumber: `COP-${Date.now()}`,
        invoiceDate: new Date(),
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        totalAmount: copayInfo.copayAmount,
        balanceAmount: copayInfo.copayAmount,
        status: 'PENDING',
        invoiceType: 'OPD',
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
      throw new BadRequestError('Appointment ID not found in transaction');
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: {
          include: {
            insuranceInfo: { where: { status: 'ACTIVE' }, take: 1 },
          },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }

    // Create CopayPayment record
    const insurance = appointment.patient.insuranceInfo?.[0];
    await prisma.copayPayment.create({
      data: {
        patientId: appointment.patientId,
        appointmentId: appointment.id,
        amount: transaction.amount,
        paymentMethod: 'CARD',
        insuranceProvider: insurance?.providerName || 'Self-Pay',
        policyNumber: insurance?.policyNumber || 'N/A',
        collectedBy: 'ONLINE_PAYMENT',
        receiptNumber: `RCP-${Date.now()}`,
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
    paymentMethod: 'CASH' | 'CARD' = 'CASH',
    notes?: string
  ): Promise<CopayInfo> {
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        hospitalId,
      },
      include: {
        patient: {
          include: {
            insuranceInfo: { where: { status: 'ACTIVE' }, take: 1 },
          },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }

    if (appointment.copayCollected) {
      throw new BadRequestError('Copay already collected for this appointment');
    }

    // Create CopayPayment record
    const insurance = appointment.patient.insuranceInfo?.[0];
    const copayPayment = await prisma.copayPayment.create({
      data: {
        patientId: appointment.patientId,
        appointmentId: appointment.id,
        amount,
        paymentMethod,
        insuranceProvider: insurance?.providerName || 'Self-Pay',
        policyNumber: insurance?.policyNumber || 'N/A',
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
      const copayAmount = apt.copayAmount ? Number(apt.copayAmount) : 50; // Default

      if (apt.copayCollected && apt.copayPayments[0]) {
        const payment = apt.copayPayments[0];
        if (['CARD', 'ONLINE', 'APPLE_PAY', 'GOOGLE_PAY'].includes(payment.paymentMethod)) {
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
        copayAmount: apt.copayAmount ? Number(apt.copayAmount) : 50,
      }));
  }
}

export const appointmentCopayService = new AppointmentCopayService();
