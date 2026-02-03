/**
 * Payment Reminder Service
 * 
 * Automatically generates and sends payment reminders for overdue invoices.
 * Tracks reminder history and supports multiple reminder methods (SMS, email, phone).
 */

import prisma from '../config/database';
import logger from '../utils/logger';

interface ReminderConfig {
  firstReminderDays: number;
  secondReminderDays: number;
  finalReminderDays: number;
  maxRemindersPerInvoice: number;
  reminderMethods: string[];
}

interface ReminderRecord {
  invoiceId: string;
  invoiceNumber: string;
  patientId: string;
  patientName: string;
  amountDue: number;
  daysOverdue: number;
  reminderCount: number;
  lastReminderDate?: Date;
  reminderType: string;
  message: string;
}

const DEFAULT_CONFIG: ReminderConfig = {
  firstReminderDays: 7,
  secondReminderDays: 14,
  finalReminderDays: 30,
  maxRemindersPerInvoice: 5,
  reminderMethods: ['EMAIL', 'SMS'],
};

export class PaymentReminderService {
  /**
   * Generate reminders for all overdue invoices in a hospital
   */
  async generateReminders(
    hospitalId: string,
    config: ReminderConfig = DEFAULT_CONFIG
  ): Promise<ReminderRecord[]> {
    const today = new Date();

    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        hospitalId,
        status: { in: ['PENDING', 'PARTIALLY_PAID'] },
        balanceAmount: { gt: 0 },
        dueDate: { lt: today },
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },
        paymentReminders: {
          orderBy: { sentAt: 'desc' },
          take: 1,
        },
      },
      orderBy: {
        dueDate: 'asc',
      },
    });

    const remindersToSend: ReminderRecord[] = [];

    for (const invoice of overdueInvoices) {
      const dueDate = invoice.dueDate || invoice.invoiceDate;
      const daysOverdue = Math.floor(
        (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Count existing reminders
      const reminderCount = await prisma.paymentReminder.count({
        where: { invoiceId: invoice.id },
      });

      if (reminderCount >= config.maxRemindersPerInvoice) {
        continue;
      }

      const shouldSendReminder =
        daysOverdue >= config.firstReminderDays ||
        daysOverdue >= config.secondReminderDays ||
        daysOverdue >= config.finalReminderDays;

      if (!shouldSendReminder) continue;

      // Check cooldown (no reminder if sent in last 3 days)
      const lastReminder = invoice.paymentReminders[0];
      if (lastReminder) {
        const daysSinceLast = Math.floor(
          (today.getTime() - lastReminder.sentAt.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSinceLast < 3) continue;
      }

      const reminderType = invoice.patient.email ? 'EMAIL' : invoice.patient.phone ? 'SMS' : 'BOTH';

      const reminderLevel = reminderCount === 0 ? 1 : reminderCount === 1 ? 2 : 3;
      const message = this.generateReminderMessage(
        invoice.patient.firstName,
        invoice.invoiceNumber,
        Number(invoice.balanceAmount),
        daysOverdue,
        reminderLevel
      );

      remindersToSend.push({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        patientId: invoice.patient.id,
        patientName: `${invoice.patient.firstName} ${invoice.patient.lastName}`,
        amountDue: Number(invoice.balanceAmount),
        daysOverdue,
        reminderCount,
        lastReminderDate: lastReminder?.sentAt,
        reminderType,
        message,
      });
    }

    logger.info(`[REMINDER] Generated ${remindersToSend.length} payment reminders`);
    return remindersToSend;
  }

  /**
   * Send a reminder (creates record and logs)
   */
  async sendReminder(
    reminder: ReminderRecord,
    hospitalId: string
  ): Promise<{ success: boolean; reminderId?: string; error?: string }> {
    try {
      const reminderLevel = reminder.reminderCount + 1;

      const record = await prisma.paymentReminder.create({
        data: {
          hospitalId,
          invoiceId: reminder.invoiceId,
          patientId: reminder.patientId,
          reminderType: reminder.reminderType,
          reminderLevel: reminderLevel > 3 ? 3 : reminderLevel,
          dueAmount: reminder.amountDue,
          message: reminder.message,
          status: 'SENT',
        },
      });

      // Stub: Log reminder (in production, integrate SMS/email provider)
      logger.info('[REMINDER] Payment reminder sent:', {
        reminderId: record.id,
        invoiceNumber: reminder.invoiceNumber,
        reminderType: reminder.reminderType,
        patientName: reminder.patientName,
        amountDue: reminder.amountDue,
      });

      return { success: true, reminderId: record.id };
    } catch (error: any) {
      logger.error('[REMINDER] Failed to send reminder:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get reminder history for an invoice
   */
  async getReminderHistory(invoiceId: string) {
    const reminders = await prisma.paymentReminder.findMany({
      where: { invoiceId },
      orderBy: { sentAt: 'desc' },
    });

    return reminders.map((r) => ({
      id: r.id,
      reminderType: r.reminderType,
      reminderLevel: r.reminderLevel,
      sentAt: r.sentAt,
      dueAmount: Number(r.dueAmount),
      message: r.message,
      status: r.status,
      responseDate: r.responseDate,
      responseNotes: r.responseNotes,
    }));
  }

  /**
   * Get reminder statistics for a hospital
   */
  async getReminderStats(hospitalId: string, startDate?: Date, endDate?: Date) {
    const where: any = { hospitalId };
    if (startDate || endDate) {
      where.sentAt = {};
      if (startDate) where.sentAt.gte = startDate;
      if (endDate) where.sentAt.lte = endDate;
    }

    const [total, byType, byLevel] = await Promise.all([
      prisma.paymentReminder.count({ where }),
      prisma.paymentReminder.groupBy({
        by: ['reminderType'],
        where,
        _count: true,
      }),
      prisma.paymentReminder.groupBy({
        by: ['reminderLevel'],
        where,
        _count: true,
      }),
    ]);

    return {
      totalReminders: total,
      byType: byType.map((t) => ({ type: t.reminderType, count: t._count })),
      byLevel: byLevel.map((l) => ({ level: l.reminderLevel, count: l._count })),
    };
  }

  /**
   * Generate reminder message based on level
   */
  private generateReminderMessage(
    patientName: string,
    invoiceNumber: string,
    amount: number,
    daysOverdue: number,
    level: number
  ): string {
    switch (level) {
      case 1:
        return `Dear ${patientName}, this is a friendly reminder that invoice ${invoiceNumber} for AED ${amount.toFixed(2)} was due ${daysOverdue} days ago. Please make your payment at your earliest convenience. Thank you.`;
      case 2:
        return `Dear ${patientName}, your invoice ${invoiceNumber} for AED ${amount.toFixed(2)} is now ${daysOverdue} days overdue. Please settle this balance promptly to avoid further action. Contact us if you need assistance.`;
      default:
        return `Dear ${patientName}, FINAL NOTICE: Invoice ${invoiceNumber} for AED ${amount.toFixed(2)} is ${daysOverdue} days overdue. Immediate payment is required. Please contact our billing department urgently.`;
    }
  }
}

export const paymentReminderService = new PaymentReminderService();
