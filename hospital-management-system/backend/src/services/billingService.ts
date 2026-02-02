import prisma from '../config/database';
import { NotFoundError } from '../middleware/errorHandler';
import { Decimal } from '@prisma/client/runtime/library';
import { notificationService } from './notificationService';
import { chargeManagementService } from './chargeManagementService';
import { accountingService } from './accountingService';

export class BillingService {
  private generateInvoiceNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `INV-${timestamp}${random}`;
  }

  private generateClaimNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `CLM-${timestamp}${random}`;
  }

  async createInvoice(hospitalId: string, data: {
    patientId: string;
    items: Array<{
      description: string;
      category: string;
      quantity: number;
      unitPrice: number;
      discount?: number;
    }>;
    discount?: number;
    tax?: number;
    dueDate?: Date;
    notes?: string;
    createdBy: string;
  }) {
    const invoiceNumber = this.generateInvoiceNumber();

    // Calculate totals
    let subtotal = 0;
    const itemsWithTotal = data.items.map(item => {
      const itemDiscount = item.discount || 0;
      const totalPrice = (item.unitPrice * item.quantity) - itemDiscount;
      subtotal += totalPrice;
      return { ...item, totalPrice, discount: itemDiscount };
    });

    const discount = data.discount || 0;
    const tax = data.tax || 0;
    const totalAmount = subtotal - discount + tax;

    const invoice = await prisma.invoice.create({
      data: {
        hospitalId,
        patientId: data.patientId,
        invoiceNumber,
        dueDate: data.dueDate,
        subtotal,
        discount,
        tax,
        totalAmount,
        balanceAmount: totalAmount,
        notes: data.notes,
        createdBy: data.createdBy,
        items: {
          create: itemsWithTotal,
        },
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, mrn: true, email: true, phone: true } },
        items: true,
      },
    });

    // Post to General Ledger
    try {
      await accountingService.recordInvoiceGL({
        hospitalId,
        invoiceId: invoice.id,
        amount: Number(invoice.totalAmount),
        description: `Invoice ${invoice.invoiceNumber}`,
        createdBy: data.createdBy || 'system',
      });
    } catch (glError) {
      console.error('[GL] Failed to post invoice GL entry:', glError);
      // Don't fail the invoice creation if GL posting fails
    }

    // Send invoice notification to patient
    try {
      await notificationService.sendBillingNotification({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        patientName: `${invoice.patient.firstName} ${invoice.patient.lastName}`,
        amount: totalAmount,
        dueDate: data.dueDate,
        type: 'INVOICE_CREATED',
        title: 'New Invoice Generated',
        message: `Invoice #${invoice.invoiceNumber} has been generated for ${totalAmount.toFixed(2)}.`,
      });
    } catch (error) {
      console.error('[BILLING] Failed to send invoice notification:', error);
      // Don't fail the billing operation if notification fails
    }

    return invoice;
  }

  async getInvoices(hospitalId: string, params: {
    page?: number;
    limit?: number;
    status?: string;
    patientId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const { page = 1, limit = 20, status, patientId, startDate, endDate } = params;
    const skip = (page - 1) * limit;

    const where: any = { hospitalId };
    if (status) where.status = status;
    if (patientId) where.patientId = patientId;
    if (startDate || endDate) {
      where.invoiceDate = {};
      if (startDate) where.invoiceDate.gte = new Date(startDate);
      if (endDate) where.invoiceDate.lte = new Date(endDate);
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { invoiceDate: 'desc' },
        include: {
          patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
          items: true,
          payments: true,
        },
      }),
      prisma.invoice.count({ where }),
    ]);

    return { invoices, total, page, limit };
  }

  async getInvoiceById(id: string, hospitalId: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id, hospitalId },
      include: {
        patient: true,
        items: true,
        payments: true,
        claims: true,
      },
    });

    if (!invoice) throw new NotFoundError('Invoice not found');
    return invoice;
  }

  async addPayment(invoiceId: string, data: {
    amount: number;
    paymentMethod: 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'UPI' | 'NET_BANKING' | 'INSURANCE' | 'CHEQUE';
    referenceNumber?: string;
    notes?: string;
    createdBy: string;
  }) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      },
    });
    if (!invoice) throw new NotFoundError('Invoice not found');

    // Validate payment amount
    const currentBalance = Number(invoice.balanceAmount);
    if (data.amount > currentBalance) {
      throw new Error(
        `Payment amount (${data.amount}) exceeds remaining balance (${currentBalance})`
      );
    }

    // Wrap payment creation + invoice update in atomic transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create payment record
      const payment = await tx.payment.create({
        data: {
          invoiceId,
          amount: data.amount,
          paymentMethod: data.paymentMethod,
          referenceNumber: data.referenceNumber,
          notes: data.notes,
          createdBy: data.createdBy,
        },
      });

      // Calculate new amounts
      const newPaidAmount = Number(invoice.paidAmount) + data.amount;
      const newBalance = Number(invoice.totalAmount) - newPaidAmount;

      let newStatus = invoice.status;
      if (newBalance <= 0) {
        newStatus = 'PAID';
      } else if (newPaidAmount > 0) {
        newStatus = 'PARTIALLY_PAID';
      }

      // Update invoice
      const updatedInvoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount: newPaidAmount,
          balanceAmount: newBalance > 0 ? newBalance : 0,
          status: newStatus,
          updatedBy: data.createdBy,
        },
      });

      return { payment, invoice: updatedInvoice };
    });

    // Post payment to GL (after successful transaction)
    try {
      await accountingService.recordPaymentGL({
        hospitalId: invoice.hospitalId,
        paymentId: result.payment.id,
        amount: Number(data.amount),
        description: `Payment for ${invoice.invoiceNumber} via ${data.paymentMethod}`,
        createdBy: data.createdBy || 'system',
      });
    } catch (glError) {
      console.error('[GL] Failed to post payment GL entry:', glError);
    }

    // Send payment confirmation notification
    try {
      await notificationService.sendBillingNotification({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        patientName: `${invoice.patient.firstName} ${invoice.patient.lastName}`,
        amount: data.amount,
        type: 'PAYMENT_RECEIVED',
        title: 'Payment Received',
        message: `Payment of ${data.amount.toFixed(2)} received for invoice #${invoice.invoiceNumber}.`,
      });
    } catch (error) {
      console.error('[BILLING] Failed to send payment notification:', error);
      // Don't fail the billing operation if notification fails
    }

    return result.payment;
  }

  async submitInsuranceClaim(invoiceId: string, data: {
    insuranceProvider: string;
    insurancePayerId?: string;
    policyNumber: string;
    claimAmount: number;
    notes?: string;
    createdBy: string;
    submittedBy?: string;
  }) {
    const claimNumber = this.generateClaimNumber();

    return prisma.insuranceClaim.create({
      data: {
        invoiceId,
        claimNumber,
        insuranceProvider: data.insuranceProvider,
        insurancePayerId: data.insurancePayerId,
        policyNumber: data.policyNumber,
        claimAmount: data.claimAmount,
        notes: data.notes,
        createdBy: data.createdBy,
        submittedBy: data.submittedBy || data.createdBy,
      },
      include: { invoice: true },
    });
  }

  async updateClaimStatus(
    claimId: string,
    status: string,
    approvedAmount?: number,
    processedBy?: string,
    denialReasonCode?: string
  ) {
    const updateData: any = {
      status,
      processedAt: new Date(),
      updatedBy: processedBy,
      processedBy,
    };
    if (approvedAmount !== undefined) {
      updateData.approvedAmount = approvedAmount;
    }
    if (denialReasonCode) {
      updateData.denialReasonCode = denialReasonCode;
    }

    // Wrap claim update + auto-payment in atomic transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update claim
      const claim = await tx.insuranceClaim.update({
        where: { id: claimId },
        data: updateData,
        include: { invoice: true },
      });

      let autoPayment: { id: string } | null = null;

      // If claim approved/paid, create auto-payment
      if ((status === 'APPROVED' || status === 'PAID') && processedBy) {
        const paymentAmount = approvedAmount || Number(claim.claimAmount);

        // Create payment record
        autoPayment = await tx.payment.create({
          data: {
            invoiceId: claim.invoiceId,
            amount: paymentAmount,
            paymentMethod: 'INSURANCE',
            referenceNumber: claim.claimNumber,
            notes: `Insurance claim ${claim.claimNumber}`,
            createdBy: processedBy,
          },
        });

        // Update invoice
        const invoice = claim.invoice;
        const newPaidAmount = Number(invoice.paidAmount) + paymentAmount;
        const newBalance = Number(invoice.totalAmount) - newPaidAmount;

        let newStatus = invoice.status;
        if (newBalance <= 0) {
          newStatus = 'PAID';
        } else if (newPaidAmount > 0) {
          newStatus = 'PARTIALLY_PAID';
        }

        await tx.invoice.update({
          where: { id: claim.invoiceId },
          data: {
            paidAmount: newPaidAmount,
            balanceAmount: newBalance > 0 ? newBalance : 0,
            status: newStatus,
            updatedBy: processedBy,
          },
        });
      }

      return { claim, autoPayment };
    });

    // Post insurance payment to GL
    if (result.autoPayment) {
      try {
        await accountingService.recordPaymentGL({
          hospitalId: result.claim.invoice.hospitalId,
          paymentId: result.autoPayment.id,
          amount: Number(approvedAmount || result.claim.claimAmount),
          description: `Insurance payment - Claim ${result.claim.claimNumber}`,
          createdBy: processedBy || 'system',
        });
      } catch (glError) {
        console.error('[GL] Failed to post insurance payment GL entry:', glError);
      }
    }

    return result.claim;
  }

  async getClaims(hospitalId: string, params: {
    page?: number;
    limit?: number;
    status?: string;
  }) {
    const { page = 1, limit = 20, status } = params;
    const skip = (page - 1) * limit;

    const where: any = { invoice: { hospitalId } };
    if (status) where.status = status;

    const [claims, total] = await Promise.all([
      prisma.insuranceClaim.findMany({
        where,
        skip,
        take: limit,
        orderBy: { submittedAt: 'desc' },
        include: {
          invoice: {
            include: {
              patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
            },
          },
        },
      }),
      prisma.insuranceClaim.count({ where }),
    ]);

    return { claims, total, page, limit };
  }

  async cancelInvoice(id: string, hospitalId: string) {
    const invoice = await prisma.invoice.findFirst({ where: { id, hospitalId } });
    if (!invoice) throw new NotFoundError('Invoice not found');

    if (Number(invoice.paidAmount) > 0) {
      throw new Error('Cannot cancel invoice with payments');
    }

    return prisma.invoice.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  async generatePatientStatement(patientId: string, hospitalId: string) {
    const [patient, invoices] = await Promise.all([
      prisma.patient.findFirst({ where: { id: patientId, hospitalId } }),
      prisma.invoice.findMany({
        where: { patientId, hospitalId },
        orderBy: { invoiceDate: 'desc' },
        include: { items: true, payments: true },
      }),
    ]);

    if (!patient) throw new NotFoundError('Patient not found');

    const totalBilled = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
    const totalPaid = invoices.reduce((sum, inv) => sum + Number(inv.paidAmount), 0);
    const totalOutstanding = invoices.reduce((sum, inv) => sum + Number(inv.balanceAmount), 0);

    return {
      patient,
      invoices,
      summary: {
        totalBilled,
        totalPaid,
        totalOutstanding,
        invoiceCount: invoices.length,
      },
    };
  }

  async getBillingStats(hospitalId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [totalRevenue, pendingAmount, todayRevenue, monthRevenue, claimsSubmitted, deniedClaims] = await Promise.all([
      prisma.invoice.aggregate({
        where: { hospitalId, status: 'PAID' },
        _sum: { totalAmount: true },
      }),
      prisma.invoice.aggregate({
        where: { hospitalId, status: { in: ['PENDING', 'PARTIALLY_PAID'] } },
        _sum: { balanceAmount: true },
      }),
      prisma.payment.aggregate({
        where: { invoice: { hospitalId }, paymentDate: { gte: today } },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: { invoice: { hospitalId }, paymentDate: { gte: thisMonth } },
        _sum: { amount: true },
      }),
      prisma.insuranceClaim.count({
        where: { invoice: { hospitalId }, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
      }),
      prisma.insuranceClaim.count({
        where: { invoice: { hospitalId }, status: 'REJECTED' },
      }),
    ]);

    return {
      totalRevenue: Number(totalRevenue._sum.totalAmount || 0),
      pendingPayments: Number(pendingAmount._sum.balanceAmount || 0),
      todayRevenue: Number(todayRevenue._sum.amount || 0),
      monthRevenue: Number(monthRevenue._sum.amount || 0),
      claimsSubmitted,
      deniedClaims,
    };
  }

  async getOutstandingPayments(hospitalId: string) {
    return prisma.invoice.findMany({
      where: {
        hospitalId,
        status: { in: ['PENDING', 'PARTIALLY_PAID'] },
        balanceAmount: { gt: 0 },
      },
      orderBy: [
        { dueDate: 'asc' },
        { balanceAmount: 'desc' },
      ],
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, mrn: true, phone: true } },
      },
    });
  }

  /**
   * Send overdue payment reminders for invoices past their due date
   * This function can be called by a scheduled job
   */
  async sendOverduePaymentReminders(hospitalId: string): Promise<{
    processed: number;
    sent: number;
    failed: number;
    errors: string[];
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find all overdue invoices
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        hospitalId,
        status: { in: ['PENDING', 'PARTIALLY_PAID'] },
        balanceAmount: { gt: 0 },
        dueDate: { lt: today },
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      },
    });

    const results = {
      processed: overdueInvoices.length,
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const invoice of overdueInvoices) {
      try {
        await notificationService.sendBillingNotification({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          patientName: `${invoice.patient.firstName} ${invoice.patient.lastName}`,
          amount: Number(invoice.balanceAmount),
          dueDate: invoice.dueDate || undefined,
          type: 'PAYMENT_OVERDUE',
          title: 'Payment Overdue',
          message: `Your payment of ${Number(invoice.balanceAmount).toFixed(2)} for invoice #${invoice.invoiceNumber} is overdue. Please make the payment at your earliest convenience.`,
        });
        results.sent++;
      } catch (error) {
        results.failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`Invoice ${invoice.invoiceNumber}: ${errorMessage}`);
        console.error(`[BILLING] Failed to send overdue reminder for invoice ${invoice.invoiceNumber}:`, error);
      }
    }

    return results;
  }

  // ==================== AUTO-BILLING FROM CLINICAL EVENTS (Sprint 2) ====================

  /**
   * Find or create a PENDING invoice for a patient for today.
   * Prevents creating multiple invoices per patient per day.
   */
  private async findOrCreateOpenInvoice(hospitalId: string, patientId: string, createdBy: string): Promise<any> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Look for existing PENDING invoice for this patient created today
    const existingInvoice = await prisma.invoice.findFirst({
      where: {
        hospitalId,
        patientId,
        status: 'PENDING',
        invoiceDate: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, mrn: true, email: true, phone: true } },
        items: true,
      },
    });

    if (existingInvoice) {
      return existingInvoice;
    }

    // Create a new empty invoice
    const invoice = await this.createInvoice(hospitalId, {
      patientId,
      items: [],
      createdBy,
    });

    return invoice;
  }

  /**
   * Add a single item to an existing invoice and recalculate totals.
   */
  async addItemToInvoice(invoiceId: string, hospitalId: string, item: {
    description: string;
    category: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
  }, createdBy: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, hospitalId },
      include: { items: true },
    });

    if (!invoice) throw new NotFoundError('Invoice not found');

    if (invoice.status !== 'PENDING' && invoice.status !== 'PARTIALLY_PAID') {
      throw new Error(`Cannot add items to invoice with status ${invoice.status}`);
    }

    const itemDiscount = item.discount || 0;
    const totalPrice = (item.unitPrice * item.quantity) - itemDiscount;

    const result = await prisma.$transaction(async (tx) => {
      // Create the invoice item
      const newItem = await tx.invoiceItem.create({
        data: {
          invoiceId,
          description: item.description,
          category: item.category,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: itemDiscount,
          totalPrice,
        },
      });

      // Recalculate invoice totals
      const allItems = await tx.invoiceItem.findMany({
        where: { invoiceId },
      });

      const subtotal = allItems.reduce((sum, i) => sum + Number(i.totalPrice), 0);
      const invoiceDiscount = Number(invoice.discount);
      const tax = Number(invoice.tax);
      const totalAmount = subtotal - invoiceDiscount + tax;
      const paidAmount = Number(invoice.paidAmount);
      const balanceAmount = totalAmount - paidAmount;

      // Update invoice
      const updatedInvoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          subtotal,
          totalAmount,
          balanceAmount: balanceAmount > 0 ? balanceAmount : 0,
          updatedBy: createdBy,
        },
        include: {
          patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
          items: true,
        },
      });

      return { item: newItem, invoice: updatedInvoice };
    });

    // Post updated GL entry
    try {
      await accountingService.recordInvoiceGL({
        hospitalId,
        invoiceId,
        amount: Number(result.invoice.totalAmount),
        description: `Invoice ${result.invoice.invoiceNumber} - item added: ${item.description}`,
        createdBy,
      });
    } catch (glError) {
      console.error('[GL] Failed to post updated invoice GL entry:', glError);
    }

    return result;
  }

  /**
   * Auto-generate an invoice when an appointment is completed.
   */
  async autoGenerateInvoice(appointmentId: string, hospitalId: string, createdBy: string) {
    console.log('[AUTO-BILLING] Generating invoice for appointment:', appointmentId);

    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, hospitalId },
      include: {
        patient: true,
        doctor: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
            department: true,
          },
        },
        consultation: {
          include: {
            prescriptions: { include: { medications: true } },
          },
        },
      },
    });

    if (!appointment) {
      console.error('[AUTO-BILLING] Appointment not found:', appointmentId);
      return null;
    }

    // Determine charge code based on appointment type
    const chargeCodeMap: Record<string, string> = {
      'CONSULTATION': 'initial_consultation',
      'FOLLOW_UP': 'follow_up',
      'EMERGENCY': 'emergency_consult',
      'TELEMEDICINE': 'initial_consultation',
      'PROCEDURE': 'specialist_consult',
    };

    const chargeCode = chargeCodeMap[appointment.type] || 'initial_consultation';

    // Check if patient has insurance for fee schedule override
    let payerId: string | undefined;
    try {
      const insurance = await prisma.patientInsurance.findFirst({
        where: {
          patientId: appointment.patientId,
          isActive: true,
          isPrimary: true,
        },
      });
      if (insurance) {
        payerId = insurance.id;
      }
    } catch (err) {
      console.error('[AUTO-BILLING] Failed to check insurance:', err);
    }

    // Look up price from ChargeMaster
    let price = 150; // Default fallback
    let description = 'Consultation';

    try {
      const priceResult = await chargeManagementService.lookupPrice(hospitalId, chargeCode, payerId);
      if (priceResult) {
        price = priceResult.finalPrice;
        description = priceResult.description;
      } else {
        // Try with the hardcoded charge database
        const fallback = this.chargeDatabase[chargeCode];
        if (fallback) {
          price = fallback.price;
          description = fallback.description;
        }
      }
    } catch (err) {
      console.error('[AUTO-BILLING] ChargeMaster lookup failed, using fallback:', err);
      const fallback = this.chargeDatabase[chargeCode];
      if (fallback) {
        price = fallback.price;
        description = fallback.description;
      }
    }

    const doctorName = appointment.doctor?.user
      ? `Dr. ${appointment.doctor.user.firstName} ${appointment.doctor.user.lastName}`
      : 'Doctor';
    const deptName = appointment.doctor?.department?.name || '';

    // Create the invoice
    const invoice = await this.createInvoice(hospitalId, {
      patientId: appointment.patientId,
      items: [
        {
          description: `${description} - ${doctorName}${deptName ? ` (${deptName})` : ''}`,
          category: 'CONSULTATION',
          quantity: 1,
          unitPrice: price,
        },
      ],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      notes: `Auto-generated for appointment ${appointmentId}`,
      createdBy,
    });

    console.log('[AUTO-BILLING] Invoice created:', invoice.invoiceNumber, 'Amount:', price);
    return invoice;
  }

  /**
   * Add lab test charges to a patient's invoice when a lab order is created.
   */
  async addLabCharges(labOrderId: string, hospitalId: string, createdBy: string) {
    console.log('[AUTO-BILLING] Adding lab charges for order:', labOrderId);

    const labOrder = await prisma.labOrder.findFirst({
      where: { id: labOrderId, hospitalId },
      include: {
        tests: {
          include: { labTest: true },
        },
        patient: true,
      },
    });

    if (!labOrder) {
      console.error('[AUTO-BILLING] Lab order not found:', labOrderId);
      return null;
    }

    // Find or create open invoice
    const invoice = await this.findOrCreateOpenInvoice(hospitalId, labOrder.patientId, createdBy);

    // Add each test as an invoice item
    for (const test of labOrder.tests) {
      let price = Number(test.labTest.price) || 0;
      let description = test.labTest.name;

      // Try ChargeMaster lookup using the lab test code
      try {
        const priceResult = await chargeManagementService.lookupPrice(hospitalId, test.labTest.code);
        if (priceResult) {
          price = priceResult.finalPrice;
          description = priceResult.description || test.labTest.name;
        }
      } catch (err) {
        // Use LabTest.price as fallback (already set above)
      }

      if (price > 0) {
        await this.addItemToInvoice(invoice.id, hospitalId, {
          description: `Lab Test - ${description}`,
          category: 'LAB',
          quantity: 1,
          unitPrice: price,
        }, createdBy);
      }
    }

    console.log('[AUTO-BILLING] Lab charges added for order:', labOrderId, 'Tests:', labOrder.tests.length);
    return invoice;
  }

  /**
   * Add imaging charges to a patient's invoice when an imaging order is created.
   */
  async addImagingCharges(imagingOrderId: string, hospitalId: string, createdBy: string) {
    console.log('[AUTO-BILLING] Adding imaging charges for order:', imagingOrderId);

    const imagingOrder = await prisma.imagingOrder.findFirst({
      where: { id: imagingOrderId, hospitalId },
      include: { patient: true },
    });

    if (!imagingOrder) {
      console.error('[AUTO-BILLING] Imaging order not found:', imagingOrderId);
      return null;
    }

    // Map modality type to charge code
    const modalityChargeMap: Record<string, string> = {
      'XRAY': 'xray_chest',
      'CT': 'ct_scan',
      'MRI': 'mri',
      'ULTRASOUND': 'ultrasound',
      'MAMMOGRAPHY': 'ultrasound', // fallback
      'PET': 'ct_scan', // fallback to CT pricing
      'FLUOROSCOPY': 'xray_chest', // fallback to X-ray pricing
    };

    const chargeCode = modalityChargeMap[imagingOrder.modalityType] || 'xray_chest';

    let price = 150; // Default fallback
    let description = `${imagingOrder.modalityType} - ${imagingOrder.bodyPart}`;

    // Try ChargeMaster lookup
    try {
      const priceResult = await chargeManagementService.lookupPrice(hospitalId, chargeCode);
      if (priceResult) {
        price = priceResult.finalPrice;
        description = `${priceResult.description} - ${imagingOrder.bodyPart}`;
      } else {
        // Use hardcoded fallback
        const fallback = this.chargeDatabase[chargeCode];
        if (fallback) {
          price = fallback.price;
          description = `${fallback.description} - ${imagingOrder.bodyPart}`;
        }
      }
    } catch (err) {
      const fallback = this.chargeDatabase[chargeCode];
      if (fallback) {
        price = fallback.price;
        description = `${fallback.description} - ${imagingOrder.bodyPart}`;
      }
    }

    // Find or create open invoice
    const invoice = await this.findOrCreateOpenInvoice(hospitalId, imagingOrder.patientId, createdBy);

    await this.addItemToInvoice(invoice.id, hospitalId, {
      description: `Imaging - ${description}`,
      category: 'IMAGING',
      quantity: 1,
      unitPrice: price,
    }, createdBy);

    console.log('[AUTO-BILLING] Imaging charges added for order:', imagingOrderId, 'Amount:', price);
    return invoice;
  }

  /**
   * Add pharmacy charges to a patient's invoice when a prescription is dispensed.
   */
  async addPharmacyCharges(prescriptionId: string, hospitalId: string, createdBy: string) {
    console.log('[AUTO-BILLING] Adding pharmacy charges for prescription:', prescriptionId);

    const prescription = await prisma.prescription.findFirst({
      where: { id: prescriptionId },
      include: {
        medications: {
          include: { drug: true },
        },
        patient: true,
      },
    });

    if (!prescription) {
      console.error('[AUTO-BILLING] Prescription not found:', prescriptionId);
      return null;
    }

    const effectiveHospitalId = hospitalId || prescription.patient?.hospitalId;
    if (!effectiveHospitalId) {
      console.error('[AUTO-BILLING] No hospitalId available for prescription:', prescriptionId);
      return null;
    }

    // Find or create open invoice
    const invoice = await this.findOrCreateOpenInvoice(effectiveHospitalId, prescription.patientId, createdBy);

    // Add each medication as an invoice item
    for (const med of prescription.medications) {
      let unitPrice = 0;

      // Use drug price if available
      if (med.drug) {
        unitPrice = Number(med.drug.price) || 0;
      }

      // Try ChargeMaster lookup if drug price not available
      if (unitPrice === 0 && med.drug) {
        try {
          const priceResult = await chargeManagementService.lookupPrice(effectiveHospitalId, med.drug.code);
          if (priceResult) {
            unitPrice = priceResult.finalPrice;
          }
        } catch (err) {
          // Use drug price as fallback
        }
      }

      if (unitPrice > 0) {
        await this.addItemToInvoice(invoice.id, effectiveHospitalId, {
          description: `Medication - ${med.drugName}${med.dosage ? ` (${med.dosage})` : ''}`,
          category: 'MEDICATION',
          quantity: med.quantity || 1,
          unitPrice,
        }, createdBy);
      }
    }

    console.log('[AUTO-BILLING] Pharmacy charges added for prescription:', prescriptionId);
    return invoice;
  }

  /**
   * Generate daily room charges for all active inpatient admissions.
   */
  async generateIPDDailyCharges(hospitalId: string, createdBy: string) {
    console.log('[AUTO-BILLING] Generating IPD daily charges for hospital:', hospitalId);

    const activeAdmissions = await prisma.admission.findMany({
      where: {
        hospitalId,
        dischargeDate: null,
        status: 'ADMITTED',
      },
      include: {
        bed: {
          include: { ward: true },
        },
        patient: true,
      },
    });

    const today = new Date().toISOString().split('T')[0];
    const results = [];

    for (const admission of activeAdmissions) {
      try {
        const dailyRate = Number(admission.bed.dailyRate) || 0;
        if (dailyRate <= 0) continue;

        const wardName = admission.bed.ward?.name || 'Ward';
        const bedNumber = admission.bed.bedNumber;

        // Find or create open invoice
        const invoice = await this.findOrCreateOpenInvoice(hospitalId, admission.patientId, createdBy);

        await this.addItemToInvoice(invoice.id, hospitalId, {
          description: `Room charge - ${wardName} - Bed ${bedNumber} - ${today}`,
          category: 'ACCOMMODATION',
          quantity: 1,
          unitPrice: dailyRate,
        }, createdBy);

        results.push({ admissionId: admission.id, status: 'charged', amount: dailyRate });
      } catch (error) {
        console.error('[AUTO-BILLING] Failed to charge admission:', admission.id, error);
        results.push({ admissionId: admission.id, status: 'failed', error: String(error) });
      }
    }

    console.log('[AUTO-BILLING] IPD daily charges generated:', results.length, 'admissions processed');
    return results;
  }

  // ==================== AI AUTO CHARGE CAPTURE ====================

  // Load charges from ChargeMaster or fall back to hardcoded
  private async loadChargeDatabase(hospitalId: string): Promise<Record<string, {
    code: string;
    description: string;
    category: string;
    price: number;
    keywords: string[];
  }>> {
    try {
      // Try to load from ChargeMaster
      const charges = await prisma.chargeMaster.findMany({
        where: {
          hospitalId,
          isActive: true,
        },
      });

      if (charges.length > 0) {
        // Build charge database from ChargeMaster
        const chargeDb: Record<string, any> = {};
        
        for (const charge of charges) {
          // Generate keywords from description
          const keywords = [
            charge.code.toLowerCase(),
            charge.description.toLowerCase(),
            ...charge.description.toLowerCase().split(/\s+/)
          ].filter(k => k.length > 2); // Filter out short words

          chargeDb[charge.code.toLowerCase()] = {
            code: charge.code,
            description: charge.description,
            category: charge.category,
            price: Number(charge.defaultPrice),
            keywords,
          };
        }

        return chargeDb;
      }
    } catch (error) {
      console.error('[BILLING] Failed to load charges from ChargeMaster:', error);
    }

    // Fall back to hardcoded data
    return this.chargeDatabase;
  }

  // Standard price database (in currency units) - FALLBACK ONLY
  private readonly chargeDatabase: Record<string, {
    code: string;
    description: string;
    category: string;
    price: number;
    keywords: string[];
  }> = {
    // Consultations
    'initial_consultation': { code: '99201', description: 'Initial Office Visit', category: 'CONSULTATION', price: 150, keywords: ['initial visit', 'new patient', 'first visit'] },
    'follow_up': { code: '99211', description: 'Follow-up Visit', category: 'CONSULTATION', price: 75, keywords: ['follow up', 'review', 'check up', 'return visit'] },
    'emergency_consult': { code: '99281', description: 'Emergency Consultation', category: 'EMERGENCY', price: 250, keywords: ['emergency', 'er visit', 'urgent'] },
    'specialist_consult': { code: '99241', description: 'Specialist Consultation', category: 'CONSULTATION', price: 200, keywords: ['specialist', 'referral', 'second opinion'] },

    // Procedures
    'wound_care': { code: '97602', description: 'Wound Care Management', category: 'PROCEDURE', price: 100, keywords: ['wound dressing', 'wound care', 'debridement'] },
    'suturing': { code: '12001', description: 'Simple Wound Repair', category: 'PROCEDURE', price: 150, keywords: ['suture', 'stitches', 'laceration repair'] },
    'iv_infusion': { code: '96365', description: 'IV Infusion Therapy', category: 'PROCEDURE', price: 80, keywords: ['iv', 'infusion', 'drip', 'intravenous'] },
    'catheterization': { code: '51702', description: 'Bladder Catheterization', category: 'PROCEDURE', price: 75, keywords: ['catheter', 'foley', 'urinary catheter'] },
    'nebulization': { code: '94640', description: 'Nebulizer Treatment', category: 'PROCEDURE', price: 50, keywords: ['nebulizer', 'nebulization', 'inhaler treatment'] },
    'ecg': { code: '93000', description: 'Electrocardiogram', category: 'DIAGNOSTIC', price: 100, keywords: ['ecg', 'ekg', 'electrocardiogram'] },
    'blood_draw': { code: '36415', description: 'Venipuncture', category: 'LAB', price: 25, keywords: ['blood draw', 'venipuncture', 'blood collection'] },

    // Imaging
    'xray_chest': { code: '71046', description: 'Chest X-Ray', category: 'IMAGING', price: 150, keywords: ['chest x-ray', 'cxr', 'chest radiograph'] },
    'xray_extremity': { code: '73030', description: 'Extremity X-Ray', category: 'IMAGING', price: 100, keywords: ['x-ray arm', 'x-ray leg', 'bone x-ray'] },
    'ct_scan': { code: '70450', description: 'CT Scan', category: 'IMAGING', price: 500, keywords: ['ct scan', 'ct', 'cat scan'] },
    'mri': { code: '70551', description: 'MRI Scan', category: 'IMAGING', price: 800, keywords: ['mri', 'magnetic resonance'] },
    'ultrasound': { code: '76700', description: 'Ultrasound', category: 'IMAGING', price: 200, keywords: ['ultrasound', 'sonogram', 'usg'] },

    // Lab
    'cbc': { code: '85025', description: 'Complete Blood Count', category: 'LAB', price: 30, keywords: ['cbc', 'complete blood count', 'blood count'] },
    'metabolic_panel': { code: '80053', description: 'Comprehensive Metabolic Panel', category: 'LAB', price: 50, keywords: ['metabolic panel', 'cmp', 'chemistry'] },
    'lipid_panel': { code: '80061', description: 'Lipid Panel', category: 'LAB', price: 40, keywords: ['lipid panel', 'cholesterol'] },
    'urinalysis': { code: '81003', description: 'Urinalysis', category: 'LAB', price: 20, keywords: ['urinalysis', 'urine test', 'ua'] },
    'blood_culture': { code: '87040', description: 'Blood Culture', category: 'LAB', price: 75, keywords: ['blood culture', 'culture'] },

    // Medications
    'injection_im': { code: '96372', description: 'Intramuscular Injection', category: 'MEDICATION', price: 25, keywords: ['im injection', 'intramuscular'] },
    'injection_iv': { code: '96374', description: 'IV Push Medication', category: 'MEDICATION', price: 35, keywords: ['iv push', 'iv medication'] },

    // Room Charges
    'room_general': { code: 'ROOM-GEN', description: 'General Ward (per day)', category: 'ACCOMMODATION', price: 300, keywords: ['admitted', 'ward', 'general bed'] },
    'room_private': { code: 'ROOM-PVT', description: 'Private Room (per day)', category: 'ACCOMMODATION', price: 600, keywords: ['private room', 'single room'] },
    'room_icu': { code: 'ROOM-ICU', description: 'ICU (per day)', category: 'ACCOMMODATION', price: 1500, keywords: ['icu', 'intensive care'] },

    // Surgery
    'surgery_minor': { code: 'SURG-MIN', description: 'Minor Surgical Procedure', category: 'SURGERY', price: 1000, keywords: ['minor surgery', 'minor procedure'] },
    'surgery_major': { code: 'SURG-MAJ', description: 'Major Surgical Procedure', category: 'SURGERY', price: 5000, keywords: ['major surgery', 'operation'] },
    'anesthesia_local': { code: '00300', description: 'Local Anesthesia', category: 'ANESTHESIA', price: 100, keywords: ['local anesthesia', 'local anaesthesia'] },
    'anesthesia_general': { code: '00100', description: 'General Anesthesia', category: 'ANESTHESIA', price: 800, keywords: ['general anesthesia', 'ga'] },
  };

  // Extract charges from clinical notes (async version with ChargeMaster support)
  async extractChargesFromNotesAsync(notes: string, hospitalId: string): Promise<{
    capturedCharges: {
      code: string;
      description: string;
      category: string;
      price: number;
      matchedKeyword: string;
      confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    }[];
    subtotal: number;
    suggestions: string[];
  }> {
    const chargeDb = await this.loadChargeDatabase(hospitalId);
    return this.extractChargesFromNotesSync(notes, chargeDb);
  }

  // Extract charges from clinical notes (synchronous - for backward compatibility)
  extractChargesFromNotes(notes: string): {
    capturedCharges: {
      code: string;
      description: string;
      category: string;
      price: number;
      matchedKeyword: string;
      confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    }[];
    subtotal: number;
    suggestions: string[];
  } {
    return this.extractChargesFromNotesSync(notes, this.chargeDatabase);
  }

  // Internal sync method used by both versions
  private extractChargesFromNotesSync(
    notes: string,
    chargeDb: Record<string, {
      code: string;
      description: string;
      category: string;
      price: number;
      keywords: string[];
    }>
  ): {
    capturedCharges: {
      code: string;
      description: string;
      category: string;
      price: number;
      matchedKeyword: string;
      confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    }[];
    subtotal: number;
    suggestions: string[];
  } {
    const capturedCharges: {
      code: string;
      description: string;
      category: string;
      price: number;
      matchedKeyword: string;
      confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    }[] = [];
    const suggestions: string[] = [];

    const notesLower = notes.toLowerCase();

    // Search for matching charges
    for (const [key, charge] of Object.entries(chargeDb)) {
      for (const keyword of charge.keywords) {
        if (notesLower.includes(keyword)) {
          // Check if this charge is already captured
          const exists = capturedCharges.find(c => c.code === charge.code);
          if (!exists) {
            capturedCharges.push({
              ...charge,
              matchedKeyword: keyword,
              confidence: notesLower.includes(keyword) ? 'HIGH' : 'MEDIUM',
            });
          }
          break;
        }
      }
    }

    // Add suggestions based on patterns
    if (notesLower.includes('admit') && !capturedCharges.find(c => c.category === 'ACCOMMODATION')) {
      suggestions.push('Patient appears to be admitted - add room charges');
    }
    if (notesLower.includes('blood') && !capturedCharges.find(c => c.code === '36415')) {
      suggestions.push('Blood work mentioned - verify venipuncture charge');
    }
    if ((notesLower.includes('antibiotic') || notesLower.includes('injection')) && !capturedCharges.find(c => c.code === '96372' || c.code === '96374')) {
      suggestions.push('Medication administration mentioned - verify injection charges');
    }
    if (notesLower.includes('surgery') && !capturedCharges.find(c => c.category === 'SURGERY')) {
      suggestions.push('Surgery mentioned - verify surgical procedure charges');
    }

    const subtotal = capturedCharges.reduce((sum, c) => sum + c.price, 0);

    return { capturedCharges, subtotal, suggestions };
  }

  // Get billing code suggestions for diagnosis
  suggestBillingCodes(params: {
    diagnosis?: string;
    procedures?: string[];
    isInpatient?: boolean;
    lengthOfStay?: number;
  }): {
    suggestedCodes: {
      code: string;
      description: string;
      category: string;
      price: number;
      reason: string;
    }[];
    estimatedTotal: number;
    missingCharges: string[];
  } {
    const suggestedCodes: {
      code: string;
      description: string;
      category: string;
      price: number;
      reason: string;
    }[] = [];
    const missingCharges: string[] = [];

    // Add consultation charge
    suggestedCodes.push({
      code: '99201',
      description: 'Initial Office Visit',
      category: 'CONSULTATION',
      price: 150,
      reason: 'Standard consultation fee',
    });

    // Add procedure-based codes
    if (params.procedures) {
      for (const proc of params.procedures) {
        const procLower = proc.toLowerCase();
        for (const [, charge] of Object.entries(this.chargeDatabase)) {
          for (const keyword of charge.keywords) {
            if (procLower.includes(keyword)) {
              if (!suggestedCodes.find(c => c.code === charge.code)) {
                suggestedCodes.push({
                  ...charge,
                  reason: `Procedure: ${proc}`,
                });
              }
              break;
            }
          }
        }
      }
    }

    // Add diagnosis-based codes
    if (params.diagnosis) {
      const diagLower = params.diagnosis.toLowerCase();

      // Common diagnosis-based suggestions
      if (diagLower.includes('diabetes')) {
        suggestedCodes.push({ ...this.chargeDatabase['metabolic_panel'], reason: 'Diabetic monitoring' });
        suggestedCodes.push({ code: '82947', description: 'Glucose Test', category: 'LAB', price: 15, reason: 'Diabetes management' });
      }
      if (diagLower.includes('heart') || diagLower.includes('cardiac') || diagLower.includes('chest pain')) {
        suggestedCodes.push({ ...this.chargeDatabase['ecg'], reason: 'Cardiac evaluation' });
        suggestedCodes.push({ code: '82553', description: 'Troponin', category: 'LAB', price: 45, reason: 'Cardiac markers' });
      }
      if (diagLower.includes('infection') || diagLower.includes('fever')) {
        suggestedCodes.push({ ...this.chargeDatabase['cbc'], reason: 'Infection workup' });
        suggestedCodes.push({ ...this.chargeDatabase['blood_culture'], reason: 'Infection identification' });
      }
      if (diagLower.includes('fracture') || diagLower.includes('injury')) {
        suggestedCodes.push({ ...this.chargeDatabase['xray_extremity'], reason: 'Injury assessment' });
      }
    }

    // Add inpatient charges
    if (params.isInpatient && params.lengthOfStay) {
      const los = params.lengthOfStay;
      suggestedCodes.push({
        code: 'ROOM-GEN',
        description: `General Ward (${los} days)`,
        category: 'ACCOMMODATION',
        price: 300 * los,
        reason: `Room charges for ${los} days`,
      });
      missingCharges.push('Verify nursing care charges');
      missingCharges.push('Verify daily physician visit charges');
    }

    // Check for missing common charges
    if (!suggestedCodes.find(c => c.category === 'LAB')) {
      missingCharges.push('No lab tests captured - verify if any were ordered');
    }

    const estimatedTotal = suggestedCodes.reduce((sum, c) => sum + c.price, 0);

    return { suggestedCodes, estimatedTotal, missingCharges };
  }

  // Estimate costs for procedure
  estimateCost(params: {
    procedureName: string;
    isInpatient?: boolean;
    expectedStay?: number;
    includeAnesthesia?: boolean;
    insuranceCoverage?: number; // percentage
  }): {
    breakdown: { item: string; quantity: number; unitPrice: number; total: number }[];
    subtotal: number;
    insuranceCoverage: number;
    patientResponsibility: number;
    disclaimer: string;
  } {
    const breakdown: { item: string; quantity: number; unitPrice: number; total: number }[] = [];
    const procLower = params.procedureName.toLowerCase();

    // Find matching procedure
    let procedureCharge = 2000; // Default
    for (const [, charge] of Object.entries(this.chargeDatabase)) {
      for (const keyword of charge.keywords) {
        if (procLower.includes(keyword)) {
          procedureCharge = charge.price;
          breakdown.push({
            item: charge.description,
            quantity: 1,
            unitPrice: charge.price,
            total: charge.price,
          });
          break;
        }
      }
    }

    // If no match, add generic procedure
    if (breakdown.length === 0) {
      breakdown.push({
        item: `Procedure: ${params.procedureName}`,
        quantity: 1,
        unitPrice: procedureCharge,
        total: procedureCharge,
      });
    }

    // Add anesthesia if applicable
    if (params.includeAnesthesia) {
      const anesthesiaPrice = procLower.includes('major') ? 800 : 200;
      breakdown.push({
        item: 'Anesthesia Services',
        quantity: 1,
        unitPrice: anesthesiaPrice,
        total: anesthesiaPrice,
      });
    }

    // Add room charges for inpatient
    if (params.isInpatient && params.expectedStay) {
      const roomRate = 400; // Average
      breakdown.push({
        item: 'Hospital Stay (per day)',
        quantity: params.expectedStay,
        unitPrice: roomRate,
        total: roomRate * params.expectedStay,
      });

      // Add nursing care
      breakdown.push({
        item: 'Nursing Care',
        quantity: params.expectedStay,
        unitPrice: 100,
        total: 100 * params.expectedStay,
      });
    }

    // Add standard charges
    breakdown.push({
      item: 'Pre-operative Assessment',
      quantity: 1,
      unitPrice: 200,
      total: 200,
    });

    breakdown.push({
      item: 'Lab Tests (estimated)',
      quantity: 1,
      unitPrice: 150,
      total: 150,
    });

    const subtotal = breakdown.reduce((sum, item) => sum + item.total, 0);
    const coveragePercent = params.insuranceCoverage || 0;
    const insuranceCoverage = (subtotal * coveragePercent) / 100;
    const patientResponsibility = subtotal - insuranceCoverage;

    return {
      breakdown,
      subtotal,
      insuranceCoverage,
      patientResponsibility,
      disclaimer: 'This is an estimate only. Actual charges may vary based on clinical needs and complications.',
    };
  }

  /**
   * Create a claim appeal (resubmission)
   */
  async createClaimAppeal(
    hospitalId: string,
    originalClaimId: string,
    appealData: {
      resubmissionCode: string;
      appealNotes: string;
      appealDocumentUrl?: string;
      updatedClaimAmount?: number;
    },
    createdBy: string
  ) {
    // Get original claim
    const originalClaim = await prisma.insuranceClaim.findFirst({
      where: { id: originalClaimId },
      include: { invoice: true },
    });

    if (!originalClaim) {
      throw new NotFoundError('Original claim not found');
    }

    if (originalClaim.status !== 'REJECTED') {
      throw new Error('Can only appeal rejected claims');
    }

    // Generate new claim number
    const appealClaimNumber = this.generateClaimNumber();

    // Create appeal claim
    const appealClaim = await prisma.insuranceClaim.create({
      data: {
        invoiceId: originalClaim.invoiceId,
        claimNumber: appealClaimNumber,
        insuranceProvider: originalClaim.insuranceProvider,
        insurancePayerId: originalClaim.insurancePayerId,
        policyNumber: originalClaim.policyNumber,
        claimAmount: appealData.updatedClaimAmount
          ? new Decimal(appealData.updatedClaimAmount)
          : originalClaim.claimAmount,
        status: 'DRAFT',
        originalClaimId,
        resubmissionCode: appealData.resubmissionCode,
        appealNotes: appealData.appealNotes,
        appealDate: new Date(),
        appealStatus: 'PENDING',
        appealDocumentUrl: appealData.appealDocumentUrl,
        createdBy,
      },
      include: {
        invoice: true,
        insurancePayer: true,
        originalClaim: true,
      },
    });

    // Update original claim
    await prisma.insuranceClaim.update({
      where: { id: originalClaimId },
      data: {
        appealStatus: 'APPEALED',
        appealDate: new Date(),
      },
    });

    return appealClaim;
  }

  /**
   * Submit claim appeal
   */
  async submitClaimAppeal(
    appealClaimId: string,
    hospitalId: string,
    submittedBy: string
  ) {
    const claim = await prisma.insuranceClaim.findFirst({
      where: { id: appealClaimId },
    });

    if (!claim) {
      throw new NotFoundError('Appeal claim not found');
    }

    if (claim.status !== 'DRAFT') {
      throw new Error('Claim has already been submitted');
    }

    const updated = await prisma.insuranceClaim.update({
      where: { id: appealClaimId },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        submittedBy,
        appealStatus: 'UNDER_REVIEW',
      },
      include: {
        invoice: true,
        insurancePayer: true,
        originalClaim: true,
      },
    });

    return updated;
  }

  /**
   * Get claim appeal history
   */
  async getClaimAppealHistory(claimId: string, hospitalId: string) {
    const claim = await prisma.insuranceClaim.findFirst({
      where: { id: claimId },
      include: {
        originalClaim: {
          include: {
            originalClaim: true, // Parent's parent if exists
          },
        },
        appeals: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!claim) {
      throw new NotFoundError('Claim not found');
    }

    // Build appeal chain
    const history: any[] = [];

    // Add parent claims
    let current: any = claim;
    while (current.originalClaim) {
      history.unshift({
        id: current.originalClaim.id,
        claimNumber: current.originalClaim.claimNumber,
        status: current.originalClaim.status,
        claimAmount: current.originalClaim.claimAmount,
        approvedAmount: current.originalClaim.approvedAmount,
        submittedAt: current.originalClaim.submittedAt,
        processedAt: current.originalClaim.processedAt,
        denialReasonCode: current.originalClaim.denialReasonCode,
        appealStatus: current.originalClaim.appealStatus,
        type: 'ORIGINAL',
      });
      current = current.originalClaim;
    }

    // Add current claim
    history.push({
      id: claim.id,
      claimNumber: claim.claimNumber,
      status: claim.status,
      claimAmount: claim.claimAmount,
      approvedAmount: claim.approvedAmount,
      submittedAt: claim.submittedAt,
      processedAt: claim.processedAt,
      denialReasonCode: claim.denialReasonCode,
      appealStatus: claim.appealStatus,
      appealNotes: claim.appealNotes,
      appealDocumentUrl: claim.appealDocumentUrl,
      type: claim.originalClaimId ? 'APPEAL' : 'ORIGINAL',
    });

    // Add child appeals
    if (claim.appeals && claim.appeals.length > 0) {
      claim.appeals.forEach((appeal: any) => {
        history.push({
          id: appeal.id,
          claimNumber: appeal.claimNumber,
          status: appeal.status,
          claimAmount: appeal.claimAmount,
          approvedAmount: appeal.approvedAmount,
          submittedAt: appeal.submittedAt,
          processedAt: appeal.processedAt,
          denialReasonCode: appeal.denialReasonCode,
          appealStatus: appeal.appealStatus,
          appealNotes: appeal.appealNotes,
          appealDocumentUrl: appeal.appealDocumentUrl,
          type: 'APPEAL',
        });
      });
    }

    return history;
  }
}

export const billingService = new BillingService();
