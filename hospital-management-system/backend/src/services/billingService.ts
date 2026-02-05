import prisma from '../config/database';
import { NotFoundError } from '../middleware/errorHandler';
import { Decimal } from '@prisma/client/runtime/library';
import { notificationService } from './notificationService';
import { chargeManagementService } from './chargeManagementService';
import { accountingService } from './accountingService';
import { preAuthService } from './preAuthService';
import { deductibleService } from './deductibleService';

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
      vatExempt?: boolean;
    }>;
    discount?: number;
    tax?: number;
    dueDate?: Date;
    notes?: string;
    createdBy: string;
    skipVatCalculation?: boolean;
  }) {
    const invoiceNumber = this.generateInvoiceNumber();

    // UAE VAT rate: 5%
    const UAE_VAT_RATE = 0.05;

    // Calculate totals
    let subtotal = 0;
    let taxableAmount = 0;
    const itemsWithTotal = data.items.map(item => {
      const itemDiscount = item.discount || 0;
      const totalPrice = (item.unitPrice * item.quantity) - itemDiscount;
      subtotal += totalPrice;
      
      // Add to taxable amount if not VAT exempt
      if (!item.vatExempt) {
        taxableAmount += totalPrice;
      }
      
      return { ...item, totalPrice, discount: itemDiscount };
    });

    const discount = data.discount || 0;
    
    // Auto-calculate VAT at 5% for taxable services (unless explicitly provided or skipped)
    let tax = data.tax || 0;
    if (!data.skipVatCalculation && data.tax === undefined) {
      tax = Math.round((taxableAmount - discount) * UAE_VAT_RATE * 100) / 100;
      if (tax < 0) tax = 0;
    }
    
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

    // Validate referenceNumber uniqueness
    if (data.referenceNumber) {
      const existing = await prisma.payment.findFirst({
        where: { referenceNumber: data.referenceNumber },
      });
      if (existing) {
        throw new Error(`Payment with reference number ${data.referenceNumber} already exists`);
      }
    }

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

    // Wrap claim update + auto-payment + COB in atomic transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update claim
      const claim = await tx.insuranceClaim.update({
        where: { id: claimId },
        data: updateData,
        include: {
          invoice: {
            include: {
              patient: {
                include: {
                  insurances: {
                    where: { isActive: true },
                    orderBy: [
                      { isPrimary: 'desc' },
                      { createdAt: 'desc' },
                    ],
                  },
                },
              },
            },
          },
        },
      });

      let autoPayment: { id: string } | null = null;
      let secondaryClaim: { id: string; claimNumber: string } | null = null;

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

      // PARTIALLY_APPROVED: Create payment + check for COB (Coordination of Benefits)
      if (status === 'PARTIALLY_APPROVED' && approvedAmount) {
        const paymentAmount = approvedAmount;

        // Create payment record for approved portion
        autoPayment = await tx.payment.create({
          data: {
            invoiceId: claim.invoiceId,
            amount: paymentAmount,
            paymentMethod: 'INSURANCE',
            referenceNumber: claim.claimNumber,
            notes: `Partial insurance claim ${claim.claimNumber}`,
            createdBy: processedBy || 'system',
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
            updatedBy: processedBy || 'system',
          },
        });

        // COB: Check if patient has secondary insurance
        if (claim.isPrimary && newBalance > 0) {
          const secondaryInsurance = invoice.patient.insurances.find(
            (ins: any) => !ins.isPrimary && ins.isActive
          );

          if (secondaryInsurance) {
            // Auto-create secondary claim for remaining balance
            const secondaryClaimNumber = this.generateClaimNumber();
            
            secondaryClaim = await tx.insuranceClaim.create({
              data: {
                invoiceId: claim.invoiceId,
                claimNumber: secondaryClaimNumber,
                insuranceProvider: secondaryInsurance.providerName,
                insurancePayerId: secondaryInsurance.id,
                policyNumber: secondaryInsurance.policyNumber,
                claimAmount: newBalance,
                isPrimary: false,
                linkedClaimId: claim.id,
                notes: `Secondary claim - Primary claim ${claim.claimNumber} partially approved for ${paymentAmount}. Primary payer: ${claim.insuranceProvider}`,
                createdBy: processedBy || 'system',
                submittedBy: processedBy || 'system',
              },
              select: { id: true, claimNumber: true },
            });

            console.log(`[COB] Auto-created secondary claim ${secondaryClaimNumber} for remaining balance: ${newBalance}`);
          }
        }
      }

      return { claim, autoPayment, secondaryClaim };
    });

    // Post insurance claim payment to GL (handles partial approvals with auto write-off)
    if (result.autoPayment) {
      try {
        await accountingService.recordClaimPaymentGL({
          hospitalId: result.claim.invoice.hospitalId,
          claimId: result.claim.id,
          approvedAmount: Number(approvedAmount || result.claim.claimAmount),
          claimedAmount: Number(result.claim.claimAmount),
          description: `Insurance claim payment - ${result.claim.claimNumber}`,
          createdBy: processedBy || 'system',
        });
      } catch (glError) {
        console.error('[GL] Failed to post insurance claim payment GL entry:', glError);
      }

      // Update deductible ledger
      try {
        await preAuthService.updateDeductibleLedger(
          result.claim.invoice.hospitalId,
          result.claim.invoice.patientId,
          Number(approvedAmount || result.claim.claimAmount),
          10000 // default max deductible, should come from insurance plan
        );
      } catch (err) {
        console.error('[DEDUCTIBLE] Failed to update deductible ledger:', err);
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

  // ==================== PHASE 2: IPD BILLING ====================

  /**
   * 2.1 Create DRAFT invoice for admission
   * Called when patient is admitted
   */
  async createAdmissionInvoice(hospitalId: string, admissionId: string, data: {
    patientId: string;
    depositAmount?: number;
    createdBy: string;
  }) {
    console.log('[IPD BILLING] Creating admission invoice for:', admissionId);

    // Check for active patient insurance
    let primaryInsuranceId: string | undefined;
    let shouldTriggerPreAuth = false;

    try {
      const insurance = await prisma.patientInsurance.findFirst({
        where: {
          patientId: data.patientId,
          isActive: true,
          isPrimary: true,
        },
      });

      if (insurance) {
        primaryInsuranceId = insurance.id;
        shouldTriggerPreAuth = true;
      }
    } catch (err) {
      console.error('[IPD BILLING] Failed to check insurance:', err);
    }

    // Create DRAFT invoice linked to admission
    const invoiceNumber = this.generateInvoiceNumber();
    const depositAmount = data.depositAmount || 0;

    const invoice = await prisma.invoice.create({
      data: {
        hospitalId,
        patientId: data.patientId,
        admissionId,
        invoiceNumber,
        status: 'PENDING', // Use PENDING instead of DRAFT for compatibility
        subtotal: 0,
        totalAmount: 0,
        balanceAmount: 0,
        depositAmount,
        paidAmount: depositAmount, // Deposit counts as payment
        primaryInsuranceId,
        createdBy: data.createdBy,
        notes: 'IPD admission invoice - charges will accumulate during stay',
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
      },
    });

    // If deposit was collected, record it as a payment
    if (depositAmount > 0) {
      await prisma.payment.create({
        data: {
          invoiceId: invoice.id,
          amount: depositAmount,
          paymentMethod: 'DEPOSIT',
          notes: 'Admission deposit',
          createdBy: data.createdBy,
        },
      });
    }

    // Trigger pre-authorization request if patient has insurance
    if (shouldTriggerPreAuth && primaryInsuranceId) {
      try {
        // TODO: Implement autoTriggerPreAuth in preAuthService
        // await preAuthService.autoTriggerPreAuth(
        //   hospitalId,
        //   data.patientId,
        //   primaryInsuranceId,
        //   admissionId,
        //   data.createdBy
        // );
        console.log('[IPD BILLING] Pre-auth auto-trigger TODO for admission:', admissionId);
      } catch (err) {
        console.error('[IPD BILLING] Failed to trigger pre-auth:', err);
        // Don't fail admission if pre-auth fails
      }
    }

    console.log('[IPD BILLING] Admission invoice created:', invoice.invoiceNumber);
    return invoice;
  }

  /**
   * 2.2 Accumulate daily bed charges for all active admissions
   * This will be called by a cron job
   */
  async accumulateDailyBedCharges(hospitalId: string, createdBy: string = 'system'): Promise<{
    processed: number;
    charged: number;
    failed: number;
    totalAmount: number;
    errors: string[];
  }> {
    console.log('[IPD BILLING] Starting daily bed charge accumulation for hospital:', hospitalId);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    // Find all active admissions
    const activeAdmissions = await prisma.admission.findMany({
      where: {
        hospitalId,
        status: 'ADMITTED',
        dischargeDate: null,
      },
      include: {
        bed: true,
        patient: true,
        invoices: {
          where: { admissionId: { not: null } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    const results = {
      processed: activeAdmissions.length,
      charged: 0,
      failed: 0,
      totalAmount: 0,
      errors: [] as string[],
    };

    for (const admission of activeAdmissions) {
      try {
        // Find admission invoice
        const invoice = admission.invoices[0];
        if (!invoice) {
          results.errors.push(`Admission ${admission.id}: No invoice found`);
          results.failed++;
          continue;
        }

        // Check if already charged today
        const lastChargeDate = invoice.lastBedChargeDate
          ? new Date(invoice.lastBedChargeDate).toISOString().split('T')[0]
          : null;

        if (lastChargeDate === todayStr) {
          console.log(`[IPD BILLING] Admission ${admission.id} already charged today, skipping`);
          continue;
        }

        // Get bed daily rate
        const dailyRate = Number(admission.bed.dailyRate);
        if (dailyRate <= 0) {
          console.log(`[IPD BILLING] Admission ${admission.id} bed has no daily rate, skipping`);
          continue;
        }

        // Add bed charge to invoice
        const bedNumber = admission.bed.bedNumber;
        const wardName = await prisma.ward.findUnique({
          where: { id: admission.bed.wardId },
          select: { name: true },
        });

        await this.addItemToInvoice(invoice.id, hospitalId, {
          description: `Room charge - ${wardName?.name || 'Ward'} - Bed ${bedNumber} - ${todayStr}`,
          category: 'ACCOMMODATION',
          quantity: 1,
          unitPrice: dailyRate,
        }, createdBy);

        // Update last bed charge date
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { lastBedChargeDate: today },
        });

        results.charged++;
        results.totalAmount += dailyRate;

        console.log(`[IPD BILLING] Added bed charge for admission ${admission.id}: ${dailyRate}`);
      } catch (error) {
        results.failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`Admission ${admission.id}: ${errorMessage}`);
        console.error(`[IPD BILLING] Failed to charge admission ${admission.id}:`, error);
      }
    }

    console.log('[IPD BILLING] Daily bed charge accumulation complete:', results);
    return results;
  }

  /**
   * 2.3 Helper: Find active admission for patient
   */
  private async findActiveAdmission(hospitalId: string, patientId: string): Promise<any | null> {
    return prisma.admission.findFirst({
      where: {
        hospitalId,
        patientId,
        status: 'ADMITTED',
        dischargeDate: null,
      },
      include: {
        invoices: {
          where: { admissionId: { not: null } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  /**
   * Find or create a PENDING invoice for a patient for today.
   * Prevents creating multiple invoices per patient per day.
   * 
   * UPDATED FOR PHASE 2: Now checks for active admission first
   */
  private async findOrCreateOpenInvoice(hospitalId: string, patientId: string, createdBy: string, admissionId?: string): Promise<any> {
    // PHASE 2: If admissionId provided, use that admission's invoice
    if (admissionId) {
      const admissionInvoice = await prisma.invoice.findFirst({
        where: {
          hospitalId,
          admissionId,
          status: { in: ['PENDING', 'PARTIALLY_PAID'] },
        },
        include: {
          patient: { select: { id: true, firstName: true, lastName: true, mrn: true, email: true, phone: true } },
          items: true,
        },
      });

      if (admissionInvoice) {
        return admissionInvoice;
      }
    }

    // PHASE 2: Check if patient has active admission
    const activeAdmission = await this.findActiveAdmission(hospitalId, patientId);
    if (activeAdmission && activeAdmission.invoices.length > 0) {
      console.log('[AUTO-BILLING] Patient has active admission, using admission invoice');
      return activeAdmission.invoices[0];
    }

    // OPD flow: Look for existing PENDING invoice for this patient created today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const existingInvoice = await prisma.invoice.findFirst({
      where: {
        hospitalId,
        patientId,
        status: 'PENDING',
        admissionId: null, // OPD invoices have no admissionId
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

    // Create a new empty OPD invoice
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
    cptCodeId?: string;
    icd10CodeId?: string;
  }, createdBy: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, hospitalId },
      include: { 
        items: true,
        patient: true,
      },
    });

    if (!invoice) throw new NotFoundError('Invoice not found');

    if (invoice.status !== 'PENDING' && invoice.status !== 'PARTIALLY_PAID') {
      throw new Error(`Cannot add items to invoice with status ${invoice.status}`);
    }

    const itemDiscount = item.discount || 0;
    const totalPrice = (item.unitPrice * item.quantity) - itemDiscount;

    // Calculate insurance split
    let insuranceCoverage: number | null = null;
    let insuranceAmount: number | null = null;
    let patientAmount: number | null = null;
    let payerRuleId: string | null = null;

    try {
      // Look up patient's active primary insurance
      const patientInsurance = await prisma.patientInsurance.findFirst({
        where: {
          patientId: invoice.patientId,
          isActive: true,
          isPrimary: true,
        },
      });

      if (patientInsurance) {
        // Try to find applicable payer rule based on CPT or ICD-10 code
        let payerRule: any = null;

        if (item.cptCodeId) {
          payerRule = await prisma.cPTPayerRule.findFirst({
            where: {
              payerId: patientInsurance.id,
              cptCodeId: item.cptCodeId,
              isActive: true,
              isCovered: true,
            },
          });
        } else if (item.icd10CodeId) {
          payerRule = await prisma.iCD10PayerRule.findFirst({
            where: {
              payerId: patientInsurance.id,
              icd10CodeId: item.icd10CodeId,
              isActive: true,
              isCovered: true,
            },
          });
        }

        // Calculate insurance vs patient split
        if (payerRule) {
          payerRuleId = payerRule.id;

          // ICD10PayerRule has copayAmount and copayPercentage
          // CPTPayerRule does not - use default coverage for CPT rules
          if (item.icd10CodeId && payerRule.copayPercentage) {
            insuranceCoverage = Number(payerRule.copayPercentage);
            const coverageDecimal = insuranceCoverage / 100;
            patientAmount = totalPrice * coverageDecimal;
            insuranceAmount = totalPrice - patientAmount;
          } else if (item.icd10CodeId && payerRule.copayAmount) {
            patientAmount = Number(payerRule.copayAmount);
            insuranceAmount = totalPrice - patientAmount;
            if (totalPrice > 0) {
              insuranceCoverage = (insuranceAmount / totalPrice) * 100;
            }
          } else {
            // CPT rule or no copay specified, insurance covers 80%
            insuranceCoverage = 80;
            insuranceAmount = totalPrice * 0.8;
            patientAmount = totalPrice * 0.2;
          }
        } else if (patientInsurance.copay) {
          // Use patient's default copay from insurance record
          patientAmount = Number(patientInsurance.copay);
          insuranceAmount = totalPrice - patientAmount;
          if (totalPrice > 0) {
            insuranceCoverage = (insuranceAmount / totalPrice) * 100;
          }
        } else {
          // Default: 80/20 split (insurance covers 80%, patient pays 20%)
          insuranceCoverage = 80;
          insuranceAmount = totalPrice * 0.8;
          patientAmount = totalPrice * 0.2;
        }

        // Ensure amounts don't go negative
        if (insuranceAmount < 0) insuranceAmount = 0;
        if (patientAmount < 0) patientAmount = 0;
      }
    } catch (error) {
      console.error('[INSURANCE SPLIT] Error calculating insurance split:', error);
      // Continue without insurance split
    }

    const result = await prisma.$transaction(async (tx) => {
      // Create the invoice item with insurance split
      const newItem = await tx.invoiceItem.create({
        data: {
          invoiceId,
          description: item.description,
          category: item.category,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: itemDiscount,
          totalPrice,
          insuranceCoverage,
          insuranceAmount,
          patientAmount,
          payerRuleId,
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
        console.warn(`[AUTO-BILLING] No ChargeMaster entry for ${chargeCode} in hospital ${hospitalId}`);
      }
    } catch (err) {
      console.error('[AUTO-BILLING] ChargeMaster lookup failed, using default:', err);
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
   * UPDATED PHASE 2: Checks for active admission
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

    // PHASE 2: Check for active admission
    const activeAdmission = await this.findActiveAdmission(hospitalId, labOrder.patientId);
    const admissionId = activeAdmission?.id;

    // Find or create open invoice (will use admission invoice if exists)
    const invoice = await this.findOrCreateOpenInvoice(hospitalId, labOrder.patientId, createdBy, admissionId);

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
   * UPDATED PHASE 2: Checks for active admission
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
        console.warn(`[AUTO-BILLING] No ChargeMaster entry for imaging ${chargeCode} in hospital ${hospitalId}`);
      }
    } catch (err) {
      console.error('[AUTO-BILLING] Imaging ChargeMaster lookup failed, using default:', err);
    }

    // PHASE 2: Check for active admission
    const activeAdmission = await this.findActiveAdmission(hospitalId, imagingOrder.patientId);
    const admissionId = activeAdmission?.id;

    // Find or create open invoice (will use admission invoice if exists)
    const invoice = await this.findOrCreateOpenInvoice(hospitalId, imagingOrder.patientId, createdBy, admissionId);

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
   * UPDATED PHASE 2: Checks for active admission
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
        admission: true, // PHASE 2: Include admission
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

    // PHASE 2: Check for admission (from prescription or active admission)
    let admissionId = prescription.admissionId;
    if (!admissionId) {
      const activeAdmission = await this.findActiveAdmission(effectiveHospitalId, prescription.patientId);
      admissionId = activeAdmission?.id;
    }

    // Find or create open invoice (will use admission invoice if exists)
    const invoice = await this.findOrCreateOpenInvoice(effectiveHospitalId, prescription.patientId, createdBy, admissionId);

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
   * Add surgery charges to a patient's invoice when a surgery is completed.
   * UPDATED PHASE 2: Uses admission invoice
   */
  async addSurgeryCharges(surgeryId: string, hospitalId: string, createdBy: string) {
    console.log('[AUTO-BILLING] Adding surgery charges for surgery:', surgeryId);

    const surgery = await prisma.surgery.findFirst({
      where: { id: surgeryId },
      include: {
        admission: {
          include: { patient: true },
        },
        surgeon: {
          include: { user: true },
        },
      },
    });

    if (!surgery) {
      console.error('[AUTO-BILLING] Surgery not found:', surgeryId);
      return null;
    }

    const effectiveHospitalId = hospitalId || surgery.admission?.patient?.hospitalId;
    if (!effectiveHospitalId) {
      console.error('[AUTO-BILLING] No hospitalId available for surgery:', surgeryId);
      return null;
    }

    // PHASE 2: Surgery is always linked to admission
    const admissionId = surgery.admissionId;

    // Find or create open invoice (will use admission invoice)
    const invoice = await this.findOrCreateOpenInvoice(effectiveHospitalId, surgery.patientId, createdBy, admissionId);

    // Add procedure fee (from CPT code lookup or default pricing)
    let procedureFee = 5000; // Default fallback
    let procedureDescription = surgery.procedureName || surgery.surgeryType;

    if (surgery.cptCode) {
      try {
        const priceResult = await chargeManagementService.lookupPrice(effectiveHospitalId, surgery.cptCode);
        if (priceResult) {
          procedureFee = priceResult.finalPrice;
          procedureDescription = priceResult.description || procedureDescription;
        } else {
          console.warn(`[AUTO-BILLING] No ChargeMaster entry for CPT ${surgery.cptCode} in hospital ${effectiveHospitalId}`);
        }
      } catch (err) {
        console.error('[AUTO-BILLING] Surgery ChargeMaster lookup failed, using default:', err);
      }
    }

    const surgeonName = surgery.surgeon?.user
      ? `Dr. ${surgery.surgeon.user.firstName} ${surgery.surgeon.user.lastName}`
      : 'Surgeon';

    // Add procedure fee
    await this.addItemToInvoice(invoice.id, effectiveHospitalId, {
      description: `Surgery - ${procedureDescription} - ${surgeonName}`,
      category: 'PROCEDURE',
      quantity: 1,
      unitPrice: procedureFee,
    }, createdBy);

    // Add anesthesia fee if specified
    if (surgery.anesthesiaType) {
      let anesthesiaFee = 1500; // Default
      const anesthesiaCode = 'anesthesia_general'; // Could map different types

      try {
        const priceResult = await chargeManagementService.lookupPrice(effectiveHospitalId, anesthesiaCode);
        if (priceResult) {
          anesthesiaFee = priceResult.finalPrice;
        }
      } catch (err) {
        // Use default
      }

      await this.addItemToInvoice(invoice.id, effectiveHospitalId, {
        description: `Anesthesia - ${surgery.anesthesiaType}`,
        category: 'PROCEDURE',
        quantity: 1,
        unitPrice: anesthesiaFee,
      }, createdBy);
    }

    // Add OT facility fee
    let otFee = 2000; // Default
    try {
      const priceResult = await chargeManagementService.lookupPrice(effectiveHospitalId, 'ot_facility_fee');
      if (priceResult) {
        otFee = priceResult.finalPrice;
      }
    } catch (err) {
      // Use default
    }

    await this.addItemToInvoice(invoice.id, effectiveHospitalId, {
      description: `Operation Theatre - ${surgery.operationTheatre}`,
      category: 'PROCEDURE',
      quantity: 1,
      unitPrice: otFee,
    }, createdBy);

    console.log('[AUTO-BILLING] Surgery charges added for surgery:', surgeryId);
    return invoice;
  }

  /**
   * 2.4 Finalize invoice on discharge
   * Called when patient is discharged
   */
  async finalizeDischargeInvoice(hospitalId: string, admissionId: string, data: {
    dischargeDate: Date;
    finalizedBy: string;
  }): Promise<any> {
    console.log('[IPD BILLING] Finalizing discharge invoice for admission:', admissionId);

    // Find admission invoice
    const invoice = await prisma.invoice.findFirst({
      where: {
        hospitalId,
        admissionId,
        status: { in: ['PENDING', 'PARTIALLY_PAID'] },
      },
      include: {
        items: true,
        patient: true,
        primaryInsurance: true,
        admission: {
          include: {
            bed: {
              include: { ward: true },
            },
          },
        },
      },
    });

    if (!invoice) {
      console.error('[IPD BILLING] No invoice found for admission:', admissionId);
      throw new Error('Admission invoice not found');
    }

    // Calculate final bed charges up to discharge date
    const admission = invoice.admission;
    if (!admission) {
      throw new Error('Admission not found');
    }

    const admissionDate = new Date(admission.admissionDate);
    const dischargeDate = new Date(data.dischargeDate);
    
    // Calculate days between last bed charge and discharge
    const lastChargeDate = invoice.lastBedChargeDate 
      ? new Date(invoice.lastBedChargeDate)
      : admissionDate;
    
    const daysToCharge = Math.ceil((dischargeDate.getTime() - lastChargeDate.getTime()) / (1000 * 60 * 60 * 24));

    // Add final bed charges if needed
    if (daysToCharge > 0 && admission.bed) {
      const dailyRate = Number(admission.bed.dailyRate);
      if (dailyRate > 0) {
        const wardName = admission.bed.ward?.name || 'Ward';
        const bedNumber = admission.bed.bedNumber;
        
        for (let i = 0; i < daysToCharge; i++) {
          const chargeDate = new Date(lastChargeDate);
          chargeDate.setDate(chargeDate.getDate() + i + 1);
          const chargeDateStr = chargeDate.toISOString().split('T')[0];

          await this.addItemToInvoice(invoice.id, hospitalId, {
            description: `Room charge - ${wardName} - Bed ${bedNumber} - ${chargeDateStr}`,
            category: 'ACCOMMODATION',
            quantity: 1,
            unitPrice: dailyRate,
          }, data.finalizedBy);
        }

        console.log(`[IPD BILLING] Added ${daysToCharge} final bed charges`);
      }
    }

    // Reload invoice with updated totals
    const updatedInvoice = await prisma.invoice.findUnique({
      where: { id: invoice.id },
      include: {
        items: true,
        primaryInsurance: true,
        patient: true,
      },
    });

    if (!updatedInvoice) {
      throw new Error('Failed to reload invoice');
    }

    // Apply full insurance split across ALL line items (if not already done)
    // This is handled automatically by addItemToInvoice, but we need to calculate totals
    let totalInsurancePortion = 0;
    let totalPatientPortion = 0;

    for (const item of updatedInvoice.items) {
      if (item.insuranceAmount !== null) {
        totalInsurancePortion += Number(item.insuranceAmount);
      }
      if (item.patientAmount !== null) {
        totalPatientPortion += Number(item.patientAmount);
      }
    }

    // If no insurance split was calculated, assume patient pays full amount
    if (totalInsurancePortion === 0 && totalPatientPortion === 0) {
      totalPatientPortion = Number(updatedInvoice.totalAmount);
    }

    // Calculate balance: Total - Insurance portion - Deposit used - Already paid
    const depositUsed = Math.min(Number(updatedInvoice.depositAmount), totalPatientPortion);
    const alreadyPaid = Number(updatedInvoice.paidAmount);
    const balanceDue = totalPatientPortion - alreadyPaid;

    // Update invoice to finalized status
    const finalizedInvoice = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: balanceDue <= 0 ? 'PAID' : 'PENDING',
        insuranceTotal: totalInsurancePortion,
        patientTotal: totalPatientPortion,
        balanceAmount: balanceDue > 0 ? balanceDue : 0,
        finalizedAt: new Date(),
        updatedBy: data.finalizedBy,
        notes: `${updatedInvoice.notes || ''}\n\nFinalized on discharge: ${data.dischargeDate.toISOString().split('T')[0]}`,
      },
      include: {
        items: true,
        patient: true,
        primaryInsurance: true,
      },
    });

    // Auto-submit insurance claim if patient has insurance
    if (updatedInvoice.primaryInsurance && totalInsurancePortion > 0) {
      try {
        await this.submitInsuranceClaim(finalizedInvoice.id, {
          insuranceProvider: updatedInvoice.primaryInsurance.providerName,
          insurancePayerId: updatedInvoice.primaryInsuranceId || undefined,
          policyNumber: updatedInvoice.primaryInsurance.policyNumber,
          claimAmount: totalInsurancePortion,
          notes: `Discharge claim for admission ${admissionId}`,
          createdBy: data.finalizedBy,
          submittedBy: data.finalizedBy,
        });
        console.log('[IPD BILLING] Insurance claim submitted automatically');
      } catch (err) {
        console.error('[IPD BILLING] Failed to submit insurance claim:', err);
        // Don't fail discharge if claim submission fails
      }
    }

    console.log('[IPD BILLING] Discharge invoice finalized:', {
      invoiceNumber: finalizedInvoice.invoiceNumber,
      totalAmount: Number(finalizedInvoice.totalAmount),
      insurancePortion: totalInsurancePortion,
      patientPortion: totalPatientPortion,
      depositUsed,
      balanceDue,
    });

    return {
      invoice: finalizedInvoice,
      summary: {
        totalAmount: Number(finalizedInvoice.totalAmount),
        insurancePortion: totalInsurancePortion,
        patientPortion: totalPatientPortion,
        depositCollected: Number(finalizedInvoice.depositAmount),
        depositUsed,
        alreadyPaid,
        balanceDue: balanceDue > 0 ? balanceDue : 0,
        lengthOfStay: Math.ceil((dischargeDate.getTime() - admissionDate.getTime()) / (1000 * 60 * 60 * 24)),
      },
    };
  }

  /**
   * 2.5 ER visit fee based on ESI triage level
   * Called when ER visit is completed
   */
  async addERVisitFee(appointmentId: string, hospitalId: string, createdBy: string) {
    console.log('[AUTO-BILLING] Adding ER visit fee for appointment:', appointmentId);

    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, hospitalId, type: 'EMERGENCY' },
      include: { patient: true },
    });

    if (!appointment) {
      console.error('[AUTO-BILLING] Emergency appointment not found:', appointmentId);
      return null;
    }

    // Extract ESI level from notes
    let esiLevel = 3; // Default
    try {
      const notes = appointment.notes ? JSON.parse(appointment.notes) : {};
      esiLevel = notes.esiLevel || 3;
    } catch (err) {
      console.error('[AUTO-BILLING] Failed to parse appointment notes:', err);
    }

    // Map ESI level to charge code
    const esiChargeMap: Record<number, string> = {
      1: 'er_visit_level_1', // Resuscitation
      2: 'er_visit_level_2', // Emergent
      3: 'er_visit_level_3', // Urgent
      4: 'er_visit_level_4', // Less Urgent
      5: 'er_visit_level_5', // Non-Urgent
    };

    const chargeCode = esiChargeMap[esiLevel] || 'er_visit_level_3';

    // Default pricing based on ESI level
    const defaultPricing: Record<number, number> = {
      1: 1000, // Critical
      2: 750,  // High acuity
      3: 500,  // Moderate
      4: 300,  // Low acuity
      5: 150,  // Minimal
    };

    let price = defaultPricing[esiLevel] || 500;
    let description = `ER Visit - ESI Level ${esiLevel}`;

    // Try ChargeMaster lookup
    try {
      const priceResult = await chargeManagementService.lookupPrice(hospitalId, chargeCode);
      if (priceResult) {
        price = priceResult.finalPrice;
        description = priceResult.description;
      } else {
        console.warn(`[AUTO-BILLING] No ChargeMaster entry for ER visit ${chargeCode}, using default pricing`);
      }
    } catch (err) {
      console.error('[AUTO-BILLING] ER ChargeMaster lookup failed, using default:', err);
    }

    // Find or create OPD invoice (ER visits are outpatient)
    const invoice = await this.findOrCreateOpenInvoice(hospitalId, appointment.patientId, createdBy);

    await this.addItemToInvoice(invoice.id, hospitalId, {
      description,
      category: 'CONSULTATION',
      quantity: 1,
      unitPrice: price,
    }, createdBy);

    console.log('[AUTO-BILLING] ER visit fee added:', { esiLevel, price });
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

    // No charges found — warn and return empty (don't throw to avoid breaking flows)
    console.warn(`[BILLING] No charges found in ChargeMaster for hospital ${hospitalId}. Run seed script: npm run db:seed:charges`);
    return {};
  }

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

  // Extract charges from clinical notes (async - uses ChargeMaster)
  // Note: Previously sync, now async. All callers must await.
  async extractChargesFromNotes(notes: string, hospitalId?: string): Promise<{
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
    const chargeDb = hospitalId ? await this.loadChargeDatabase(hospitalId) : {};
    return this.extractChargesFromNotesSync(notes, chargeDb);
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
  async suggestBillingCodes(hospitalId: string, params: {
    diagnosis?: string;
    procedures?: string[];
    isInpatient?: boolean;
    lengthOfStay?: number;
  }): Promise<{
    suggestedCodes: {
      code: string;
      description: string;
      category: string;
      price: number;
      reason: string;
    }[];
    estimatedTotal: number;
    missingCharges: string[];
  }> {
    const chargeDb = await this.loadChargeDatabase(hospitalId);
    const suggestedCodes: {
      code: string;
      description: string;
      category: string;
      price: number;
      reason: string;
    }[] = [];
    const missingCharges: string[] = [];

    // Add consultation charge from ChargeMaster or default
    const consultCharge = chargeDb['99201'] || chargeDb['initial_consultation'];
    suggestedCodes.push({
      code: consultCharge?.code || '99201',
      description: consultCharge?.description || 'Initial Office Visit',
      category: consultCharge?.category || 'CONSULTATION',
      price: consultCharge?.price || 150,
      reason: 'Standard consultation fee',
    });

    // Add procedure-based codes
    if (params.procedures) {
      for (const proc of params.procedures) {
        const procLower = proc.toLowerCase();
        for (const [, charge] of Object.entries(chargeDb)) {
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

      // Helper to safely push from chargeDb
      const pushIfExists = (key: string, reason: string) => {
        const charge = chargeDb[key];
        if (charge) {
          suggestedCodes.push({ ...charge, reason });
        }
      };

      if (diagLower.includes('diabetes')) {
        pushIfExists('80053', 'Diabetic monitoring');
        pushIfExists('metabolic_panel', 'Diabetic monitoring');
        suggestedCodes.push({ code: '82947', description: 'Glucose Test', category: 'LAB', price: 15, reason: 'Diabetes management' });
      }
      if (diagLower.includes('heart') || diagLower.includes('cardiac') || diagLower.includes('chest pain')) {
        pushIfExists('93000', 'Cardiac evaluation');
        pushIfExists('ecg', 'Cardiac evaluation');
        suggestedCodes.push({ code: '82553', description: 'Troponin', category: 'LAB', price: 45, reason: 'Cardiac markers' });
      }
      if (diagLower.includes('infection') || diagLower.includes('fever')) {
        pushIfExists('85025', 'Infection workup');
        pushIfExists('cbc', 'Infection workup');
        pushIfExists('87040', 'Infection identification');
        pushIfExists('blood_culture', 'Infection identification');
      }
      if (diagLower.includes('fracture') || diagLower.includes('injury')) {
        pushIfExists('73030', 'Injury assessment');
        pushIfExists('xray_extremity', 'Injury assessment');
      }
    }

    // Add inpatient charges
    if (params.isInpatient && params.lengthOfStay) {
      const los = params.lengthOfStay;
      const roomCharge = chargeDb['ROOM-GEN'] || chargeDb['room_general'];
      const roomRate = roomCharge?.price || 300;
      suggestedCodes.push({
        code: roomCharge?.code || 'ROOM-GEN',
        description: `General Ward (${los} days)`,
        category: 'ACCOMMODATION',
        price: roomRate * los,
        reason: `Room charges for ${los} days`,
      });
      missingCharges.push('Verify nursing care charges');
      missingCharges.push('Verify daily physician visit charges');
    }

    // Check for missing common charges
    if (!suggestedCodes.find(c => c.category === 'LAB')) {
      missingCharges.push('No lab tests captured - verify if any were ordered');
    }

    // Deduplicate by code
    const seen = new Set<string>();
    const deduped = suggestedCodes.filter(c => {
      if (seen.has(c.code)) return false;
      seen.add(c.code);
      return true;
    });

    const estimatedTotal = deduped.reduce((sum, c) => sum + c.price, 0);

    return { suggestedCodes: deduped, estimatedTotal, missingCharges };
  }

  // Estimate costs for procedure (async - uses ChargeMaster)
  async estimateCost(hospitalId: string, params: {
    procedureName: string;
    isInpatient?: boolean;
    expectedStay?: number;
    includeAnesthesia?: boolean;
    insuranceCoverage?: number; // percentage
  }): Promise<{
    breakdown: { item: string; quantity: number; unitPrice: number; total: number }[];
    subtotal: number;
    insuranceCoverage: number;
    patientResponsibility: number;
    disclaimer: string;
  }> {
    const chargeDb = await this.loadChargeDatabase(hospitalId);
    const breakdown: { item: string; quantity: number; unitPrice: number; total: number }[] = [];
    const procLower = params.procedureName.toLowerCase();

    // Find matching procedure from ChargeMaster
    let procedureCharge = 2000; // Default
    for (const [, charge] of Object.entries(chargeDb)) {
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
      const anesthesiaCharge = chargeDb['00100'] || chargeDb['anesthesia_general'];
      const localAnesthesia = chargeDb['00300'] || chargeDb['anesthesia_local'];
      const anesthesiaPrice = procLower.includes('major')
        ? (anesthesiaCharge?.price || 800)
        : (localAnesthesia?.price || 200);
      breakdown.push({
        item: 'Anesthesia Services',
        quantity: 1,
        unitPrice: anesthesiaPrice,
        total: anesthesiaPrice,
      });
    }

    // Add room charges for inpatient
    if (params.isInpatient && params.expectedStay) {
      const roomCharge = chargeDb['ROOM-GEN'] || chargeDb['room_general'];
      const roomRate = roomCharge?.price || 400;
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

  // ==================== COPAY COLLECTION AT CHECK-IN ====================

  /**
   * Calculate copay amount for a patient based on their insurance and payer rules
   * Enhanced with full fee breakdown, visit type pricing, deductible tracking
   */
  async calculateCopay(patientId: string, hospitalId: string, appointmentId?: string): Promise<{
    hasCopay: boolean;
    consultationFee: number;
    coveragePercentage: number;
    copayPercentage: number;
    copayAmount: number;
    copayCapPerVisit: number;
    insuranceAmount: number;
    patientAmount: number;
    insuranceProvider: string | null;
    policyNumber: string | null;
    planType: string;
    networkStatus: string;
    deductible: { total: number; used: number; remaining: number };
    annualCopay: { total: number; used: number; remaining: number };
    visitType: string;
    paymentRequired: boolean;
  }> {
    // Check if appointment is marked as self-pay (bypassing insurance)
    let forceSelfPay = false;
    if (appointmentId) {
      const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        select: { selfPay: true },
      });
      if (appointment?.selfPay) {
        forceSelfPay = true;
      }
    }

    // Look up patient's active primary insurance (skip if forceSelfPay)
    let patientInsurance = forceSelfPay ? null : await prisma.patientInsurance.findFirst({
      where: {
        patientId,
        isActive: true,
        isPrimary: true,
      },
    });

    // === FIX: Check if insurance is expired ===
    let insuranceExpired = false;
    let insuranceExpiryDate: Date | null = null;
    if (patientInsurance && patientInsurance.expiryDate) {
      insuranceExpiryDate = new Date(patientInsurance.expiryDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      insuranceExpiryDate.setHours(0, 0, 0, 0);
      if (insuranceExpiryDate < today) {
        insuranceExpired = true;
        console.warn(`[COPAY] Insurance EXPIRED on ${patientInsurance.expiryDate} for patient ${patientId}`);
      }
    }

    // For self-pay patients (no insurance), calculate consultation fee
    if (!patientInsurance) {
      // Determine visit type from appointment
      let visitType = 'NEW';
      if (appointmentId) {
        const appointment = await prisma.appointment.findUnique({
          where: { id: appointmentId },
          select: { type: true },
        });
        if (appointment) {
          const typeMap: Record<string, string> = {
            CONSULTATION: 'NEW',
            FOLLOW_UP: 'FOLLOW_UP',
            EMERGENCY: 'EMERGENCY',
            TELEMEDICINE: 'NEW',
            PROCEDURE: 'NEW',
          };
          visitType = typeMap[appointment.type] || 'NEW';
        }
      }

      // Get consultation fee from ChargeMaster
      const chargeCodeMap: Record<string, string> = {
        NEW: 'initial_consultation',
        FOLLOW_UP: 'follow_up',
        EMERGENCY: 'emergency_consult',
      };
      const chargeCode = chargeCodeMap[visitType] || 'initial_consultation';

      let consultationFee = 200; // Default fallback (AED)
      try {
        const priceResult = await chargeManagementService.lookupPrice(hospitalId, chargeCode);
        if (priceResult) {
          consultationFee = priceResult.finalPrice;
        }
      } catch (err) {
        console.warn(`[COPAY] ChargeMaster lookup failed for self-pay ${chargeCode}, using default AED 200`);
      }

      // Self-pay: Patient pays 100% of consultation fee
      return {
        hasCopay: true, // YES - patient must pay
        noInsurance: true, // Flag for frontend self-pay view
        consultationFee,
        coveragePercentage: 0,
        copayPercentage: 100,
        copayAmount: consultationFee,
        copayCapPerVisit: 0,
        insuranceAmount: 0,
        patientAmount: consultationFee, // Full amount
        insuranceProvider: null,
        policyNumber: null,
        planType: 'SELF_PAY',
        networkStatus: 'NONE',
        deductible: { total: 0, used: 0, remaining: 0, metForYear: false },
        annualCopay: { total: 0, used: 0, remaining: 0, metForYear: false },
        visitType,
        paymentRequired: true, // Payment required for self-pay
        // GAP 1: Pre-auth not applicable for self-pay
        preAuthRequired: false,
        preAuthStatus: 'NOT_REQUIRED',
        preAuthNumber: null,
        preAuthMessage: null,
        // GAP 5: Data source
        dataSource: 'CACHED_DB',
        // GAP 2: COB not applicable for self-pay
        hasSecondaryInsurance: false,
        cobApplied: false,
        primaryBreakdown: null,
        secondaryBreakdown: null,
        finalPatientAmount: consultationFee,
        // GAP 6: Pharmacy estimate not applicable for self-pay
        pharmacyEstimate: null,
      } as any;
    }

    // 1. Determine visit type from appointment (if provided)
    let visitType = 'NEW'; // Default
    if (appointmentId) {
      const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        select: { type: true },
      });
      if (appointment) {
        // Map AppointmentType to visit type
        const typeMap: Record<string, string> = {
          CONSULTATION: 'NEW',
          FOLLOW_UP: 'FOLLOW_UP',
          EMERGENCY: 'EMERGENCY',
          TELEMEDICINE: 'NEW',
          PROCEDURE: 'NEW',
        };
        visitType = typeMap[appointment.type] || 'NEW';
      }
    }

    // 2. Look up consultation fee from ChargeMaster based on visit type
    const chargeCodeMap: Record<string, string> = {
      NEW: 'initial_consultation',
      FOLLOW_UP: 'follow_up',
      EMERGENCY: 'emergency_consult',
    };
    const chargeCode = chargeCodeMap[visitType] || 'initial_consultation';

    let consultationFee = 200; // Default fallback
    try {
      const priceResult = await chargeManagementService.lookupPrice(hospitalId, chargeCode);
      if (priceResult) {
        consultationFee = priceResult.finalPrice;
      }
    } catch (err) {
      console.warn(`[COPAY] ChargeMaster lookup failed for ${chargeCode}, using default`);
    }

    // 3. Get network tier
    const networkStatus = patientInsurance.networkTier || 'IN_NETWORK';

    // 4. Find payer rule to determine coverage percentage
    let coveragePercentage = 80; // Default: insurance covers 80%
    let copayPercentage = 20; // Default: patient pays 20%
    let copayCapPerVisit = 0; // No cap by default

    try {
      // Find the insurance payer
      const insurancePayer = await prisma.insurancePayer.findFirst({
        where: {
          hospitalId,
          OR: [
            { name: { contains: patientInsurance.providerName, mode: 'insensitive' } },
            { code: { contains: patientInsurance.providerName, mode: 'insensitive' } },
          ],
          isActive: true,
        },
      });

      if (insurancePayer) {
        // Look for ICD-10 payer rules for consultation
        const consultationICD = await prisma.iCD10Code.findFirst({
          where: {
            hospitalId,
            code: { startsWith: 'Z00' },
            isActive: true,
          },
        });

        if (consultationICD) {
          const icdPayerRule = await prisma.iCD10PayerRule.findFirst({
            where: {
              payerId: insurancePayer.id,
              icd10CodeId: consultationICD.id,
              isActive: true,
              isCovered: true,
            },
          });

          if (icdPayerRule) {
            if (icdPayerRule.copayPercentage) {
              copayPercentage = Number(icdPayerRule.copayPercentage);
              coveragePercentage = 100 - copayPercentage;
            }
            if (icdPayerRule.copayAmount) {
              copayCapPerVisit = Number(icdPayerRule.copayAmount);
            }
          }
        }
      }
    } catch (error) {
      console.error('[COPAY] Error looking up payer rules:', error);
    }

    // Apply out-of-network penalty (patient pays more)
    if (networkStatus === 'OUT_OF_NETWORK') {
      copayPercentage = Math.min(40, copayPercentage * 2); // Double copay or 40%, whichever is less
      coveragePercentage = 100 - copayPercentage;
    }

    // 5. Calculate amounts
    let patientAmount = (consultationFee * copayPercentage) / 100;
    let insuranceAmount = consultationFee - patientAmount;

    // Apply per-visit cap if configured
    if (copayCapPerVisit > 0 && patientAmount > copayCapPerVisit) {
      patientAmount = copayCapPerVisit;
      insuranceAmount = consultationFee - patientAmount;
    }

    // 6. GAP 4: Use DeductibleLedger for deductible & copay cap tracking (with CopayPayment fallback)
    let annualCopayUsed = 0;
    let annualDeductible = Number(patientInsurance.annualDeductible || 0);
    let annualCopayMax = Number(patientInsurance.annualCopayMax || 0);
    let deductibleRemaining = 0;
    let annualCopayRemaining = annualCopayMax > 0 ? annualCopayMax : Number.MAX_SAFE_INTEGER;
    let deductibleMetForYear = false;
    let copayMaxMetForYear = false;

    try {
      // Primary: Use DeductibleLedger for atomic YTD tracking
      const ledgerData = await deductibleService.getOrCreateLedger(
        hospitalId,
        patientId,
        patientInsurance.id
      );

      annualDeductible = ledgerData.deductible.annual;
      annualCopayUsed = ledgerData.copay.used;
      deductibleRemaining = ledgerData.deductible.remaining;
      deductibleMetForYear = ledgerData.deductible.metForYear;
      annualCopayMax = ledgerData.copay.limit || annualCopayMax;
      annualCopayRemaining = ledgerData.copay.remaining;
      copayMaxMetForYear = ledgerData.copay.metForYear;
    } catch (ledgerError) {
      // Fallback: Use CopayPayment YTD aggregation (original approach)
      console.warn('[COPAY] DeductibleLedger lookup failed, falling back to CopayPayment aggregation:', ledgerError);
      try {
        const currentYear = new Date().getFullYear();
        const yearStart = new Date(currentYear, 0, 1);
        const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59);

        const copayPayments = await prisma.copayPayment.findMany({
          where: {
            patientId,
            paymentDate: { gte: yearStart, lte: yearEnd },
          },
          select: { amount: true },
        });

        annualCopayUsed = copayPayments.reduce((sum, p) => sum + Number(p.amount), 0);
        deductibleRemaining = Math.max(0, annualDeductible - annualCopayUsed);
        annualCopayRemaining = annualCopayMax > 0 ? Math.max(0, annualCopayMax - annualCopayUsed) : Number.MAX_SAFE_INTEGER;
        deductibleMetForYear = annualDeductible > 0 && annualCopayUsed >= annualDeductible;
        copayMaxMetForYear = annualCopayMax > 0 && annualCopayUsed >= annualCopayMax;
      } catch (fallbackError) {
        console.error('[COPAY] CopayPayment fallback also failed:', fallbackError);
        // Continue with defaults (0 used) — don't block check-in
      }
    }

    // 7. Check annual copay cap
    if (annualCopayMax > 0) {
      if (annualCopayUsed >= annualCopayMax) {
        // Cap reached — patient pays AED 0
        patientAmount = 0;
        insuranceAmount = consultationFee;
      } else if (annualCopayUsed + patientAmount > annualCopayMax) {
        // Partial — only charge up to the remaining cap
        patientAmount = annualCopayMax - annualCopayUsed;
        insuranceAmount = consultationFee - patientAmount;
      }
    }

    // 8. Check deductible
    // If deductible not met, patient typically pays full amount until deductible is met
    // (For simplicity, we're treating copay as part of deductible here)

    // === GAP 1: Pre-Auth Check at Check-In ===
    // Wrapped in try-catch so failure never blocks the check-in flow
    let preAuthRequired = false;
    let preAuthStatus = 'NOT_REQUIRED';
    let preAuthNumber: string | null = null;
    let preAuthMessage: string | null = null;

    try {
      // Skip pre-auth for EMERGENCY appointments (UAE regulation)
      if (visitType !== 'EMERGENCY') {
        // Check if payer requires pre-auth globally
        let payerRequiresPreAuth = false;
        let payerId: string | null = null;

        const payer = await prisma.insurancePayer.findFirst({
          where: {
            hospitalId,
            OR: [
              { name: { contains: patientInsurance.providerName, mode: 'insensitive' } },
              { code: { contains: patientInsurance.providerName, mode: 'insensitive' } },
            ],
            isActive: true,
          },
        });

        if (payer) {
          payerRequiresPreAuth = (payer as any).preAuthRequired || false;
          payerId = payer.id;
        }

        // Check if consultation CPT codes require pre-auth
        let cptRequiresPreAuth = false;
        const consultationCPT = await prisma.cPTCode.findFirst({
          where: {
            hospitalId,
            OR: [
              { code: { startsWith: '992' } },
              { description: { contains: 'consultation', mode: 'insensitive' } },
            ],
            requiresPreAuth: true,
            isActive: true,
          },
        });

        if (consultationCPT) {
          cptRequiresPreAuth = true;
        }

        // Check payer-specific CPT rules for pre-auth
        if (!cptRequiresPreAuth && payerId) {
          try {
            const payerCPTRule = await (prisma.cPTPayerRule as any).findFirst({
              where: {
                payerId,
                requiresPreAuth: true,
                isActive: true,
              },
            });
            if (payerCPTRule) {
              cptRequiresPreAuth = true;
            }
          } catch (ruleErr) {
            // Payer rule lookup failed, continue without
          }
        }

        // FIX: Only require pre-auth if there are actual pending orders that need it
    // For check-in (consultation), we DON'T require pre-auth unless there's a pending imaging/surgery order
    const pendingPreAuthOrders = await prisma.preAuthRequest.findFirst({
      where: {
        hospitalId,
        patientId,
        status: { in: ['PENDING', 'SUBMITTED'] },
      },
    });

    if ((payerRequiresPreAuth || cptRequiresPreAuth) && pendingPreAuthOrders) {
      preAuthRequired = true;

          // Look for existing pre-auth request for this patient and policy
          const existingPreAuth = await prisma.preAuthRequest.findFirst({
            where: {
              hospitalId,
              patientId,
              insurancePolicyId: patientInsurance.id,
              status: { in: ['APPROVED', 'PARTIALLY_APPROVED', 'PENDING', 'SUBMITTED', 'DENIED'] },
            },
            orderBy: { createdAt: 'desc' },
          });

          if (existingPreAuth) {
            const statusMap: Record<string, string> = {
              APPROVED: 'APPROVED',
              PARTIALLY_APPROVED: 'APPROVED',
              PENDING: 'PENDING',
              SUBMITTED: 'PENDING',
              DENIED: 'DENIED',
            };
            preAuthStatus = statusMap[existingPreAuth.status] || 'REQUIRED_NOT_SUBMITTED';
            preAuthNumber = (existingPreAuth as any).authorizationNumber || existingPreAuth.requestNumber;
            preAuthMessage = existingPreAuth.status === 'DENIED'
              ? `Pre-authorization denied: ${(existingPreAuth as any).denialReason || 'No reason provided'}`
              : existingPreAuth.status === 'APPROVED' || existingPreAuth.status === 'PARTIALLY_APPROVED'
              ? `Pre-authorization approved (${(existingPreAuth as any).authorizationNumber || existingPreAuth.requestNumber})`
              : `Pre-authorization ${existingPreAuth.status.toLowerCase()}`;
          } else {
            preAuthStatus = 'REQUIRED_NOT_SUBMITTED';
            preAuthMessage = 'Pre-authorization required but not yet submitted';
          }
        }
      }
    } catch (preAuthErr) {
      console.warn('[COPAY] Pre-auth check failed, continuing without:', preAuthErr);
    }

    // === GAP 5: Determine Data Source ===
    // Wrapped in try-catch so failure never blocks the check-in flow
    let dataSource: string = 'CACHED_DB';
    try {
      const { dhaEClaimService } = require('./dhaEClaimService');
      const dhaConfigured = await dhaEClaimService.isConfigured(hospitalId);

      if (!dhaConfigured) {
        dataSource = process.env.NODE_ENV === 'production' ? 'NOT_CONFIGURED' : 'MOCK_DATA';
      } else {
        const mode = await dhaEClaimService.getMode(hospitalId);
        if ((patientInsurance as any).verificationSource === 'DHA_ECLAIM') {
          dataSource = mode === 'production' ? 'DHA_LIVE' : 'DHA_SANDBOX';
        } else {
          dataSource = 'CACHED_DB';
        }
      }
    } catch (dsErr) {
      console.warn('[COPAY] Failed to determine data source, defaulting to CACHED_DB:', dsErr);
    }

    // === GAP 2: COB (Coordination of Benefits) — Secondary Insurance ===
    // Added AFTER primary calculation. If COB fails, primary-only result is returned.
    let hasSecondaryInsurance = false;
    let cobApplied = false;
    let primaryBreakdown: any = null;
    let secondaryBreakdown: any = null;
    let finalPatientAmount = patientAmount;

    try {
      // Query secondary insurance (isPrimary: false, isActive: true)
      const secondaryInsurance = await prisma.patientInsurance.findFirst({
        where: {
          patientId,
          isActive: true,
          isPrimary: false,
          OR: [
            { priority: 2 },
            { coordinationOfBenefits: 'COB_SECONDARY' },
          ],
        },
      });

      if (secondaryInsurance && patientAmount > 0) {
        hasSecondaryInsurance = true;

        // Save primary breakdown before COB adjustment
        primaryBreakdown = {
          insuranceProvider: patientInsurance.providerName,
          policyNumber: patientInsurance.policyNumber,
          coveragePercentage,
          copayPercentage,
          insuranceAmount,
          patientResponsibility: patientAmount,
        };

        // Determine secondary coverage percentage using payer rules
        let secondaryCoverage = 80; // Default 80% coverage
        let secondaryCopay = 20;

        try {
          const secondaryPayer = await prisma.insurancePayer.findFirst({
            where: {
              hospitalId,
              OR: [
                { name: { contains: secondaryInsurance.providerName, mode: 'insensitive' } },
                { code: { contains: secondaryInsurance.providerName, mode: 'insensitive' } },
              ],
              isActive: true,
            },
          });

          if (secondaryPayer) {
            const consultationICD = await prisma.iCD10Code.findFirst({
              where: {
                hospitalId,
                code: { startsWith: 'Z00' },
                isActive: true,
              },
            });

            if (consultationICD) {
              const icdPayerRule = await prisma.iCD10PayerRule.findFirst({
                where: {
                  payerId: secondaryPayer.id,
                  icd10CodeId: consultationICD.id,
                  isActive: true,
                  isCovered: true,
                },
              });

              if (icdPayerRule) {
                if (icdPayerRule.copayPercentage) {
                  secondaryCopay = Number(icdPayerRule.copayPercentage);
                  secondaryCoverage = 100 - secondaryCopay;
                }
              }
            }
          }
        } catch (payerErr) {
          console.warn('[COB] Secondary payer rule lookup failed, using default 80/20:', payerErr);
        }

        // Apply secondary network penalty if out-of-network
        const secondaryNetworkStatus = secondaryInsurance.networkTier || 'IN_NETWORK';
        if (secondaryNetworkStatus === 'OUT_OF_NETWORK') {
          secondaryCopay = Math.min(40, secondaryCopay * 2);
          secondaryCoverage = 100 - secondaryCopay;
        }

        // COB calculation: secondary covers its portion of the remaining patient amount
        // "Remaining" = what patient owes after primary
        const remainingAfterPrimary = patientAmount;
        const secondaryInsuranceAmount = Math.round(((remainingAfterPrimary * secondaryCoverage) / 100) * 100) / 100;
        finalPatientAmount = Math.round((remainingAfterPrimary - secondaryInsuranceAmount) * 100) / 100;

        // Ensure patient amount doesn't go negative
        if (finalPatientAmount < 0) finalPatientAmount = 0;

        secondaryBreakdown = {
          insuranceProvider: secondaryInsurance.providerName,
          policyNumber: secondaryInsurance.policyNumber,
          coveragePercentage: secondaryCoverage,
          copayPercentage: secondaryCopay,
          networkStatus: secondaryNetworkStatus,
          insuranceAmount: secondaryInsuranceAmount,
          appliedToRemaining: remainingAfterPrimary,
        };

        // Apply COB — update final amounts
        cobApplied = true;
        patientAmount = finalPatientAmount;
      }
    } catch (cobError) {
      console.warn('[COB] Secondary insurance lookup failed, returning primary-only result:', cobError);
      // Reset COB fields — fall back to primary-only
      hasSecondaryInsurance = false;
      cobApplied = false;
      primaryBreakdown = null;
      secondaryBreakdown = null;
      finalPatientAmount = patientAmount;
    }

    // GAP 6: Combined Copay Estimate — pharmacy estimate for follow-up visits
    let pharmacyEstimate: any = null;
    try {
      if ((visitType === 'FOLLOW_UP' || visitType === 'NEW') && patientId) {
        // Query active prescriptions for this patient
        const activePrescriptions = await prisma.prescription.findMany({
          where: {
            patientId,
            status: 'ACTIVE',
          },
          include: {
            medications: {
              include: {
                drug: { select: { price: true } },
              },
            },
          },
          take: 10, // Safety limit
        });

        if (activePrescriptions.length > 0) {
          let totalMedCost = 0;
          const prescriptionSummaries: Array<{
            prescriptionId: string;
            medicationCount: number;
            estimatedCost: number;
          }> = [];

          for (const rx of activePrescriptions) {
            let rxCost = 0;
            for (const med of rx.medications) {
              const unitPrice = med.drug ? Number(med.drug.price || 0) : 0;
              rxCost += unitPrice * (med.quantity || 1);
            }
            totalMedCost += rxCost;
            prescriptionSummaries.push({
              prescriptionId: rx.id,
              medicationCount: rx.medications.length,
              estimatedCost: Math.round(rxCost * 100) / 100,
            });
          }

          // Apply same insurance coverage % to pharmacy estimate
          const pharmInsuranceAmount = Math.round((totalMedCost * coveragePercentage) / 100 * 100) / 100;
          const pharmPatientAmount = Math.round((totalMedCost - pharmInsuranceAmount) * 100) / 100;

          pharmacyEstimate = {
            estimated: true,
            estimatedAmount: Math.round(pharmPatientAmount * 100) / 100,
            totalMedicationCost: Math.round(totalMedCost * 100) / 100,
            insuranceCovers: pharmInsuranceAmount,
            activePrescriptions: prescriptionSummaries.length,
            prescriptions: prescriptionSummaries,
          };
        }
      }
    } catch (pharmError) {
      console.warn('[COPAY] Pharmacy estimate failed, skipping:', pharmError);
      pharmacyEstimate = null;
    }

    return {
      hasCopay: patientAmount > 0,
      consultationFee,
      coveragePercentage,
      copayPercentage,
      copayAmount: patientAmount,
      copayCapPerVisit,
      insuranceAmount,
      patientAmount,
      insuranceProvider: patientInsurance.providerName,
      policyNumber: patientInsurance.policyNumber,
      planType: patientInsurance.coverageType,
      networkStatus,
      deductible: {
        total: annualDeductible,
        used: Math.min(annualCopayUsed, annualDeductible),
        remaining: deductibleRemaining,
        metForYear: deductibleMetForYear,
      },
      annualCopay: {
        total: annualCopayMax,
        used: annualCopayUsed,
        remaining: annualCopayRemaining === Number.MAX_SAFE_INTEGER ? annualCopayMax : annualCopayRemaining,
        metForYear: copayMaxMetForYear,
      },
      visitType,
      paymentRequired: patientAmount > 0,
      // GAP 1: Pre-auth check results
      preAuthRequired,
      preAuthStatus,
      preAuthNumber,
      preAuthMessage,
      insuranceExpired,
      insuranceExpiryDate: insuranceExpiryDate ? insuranceExpiryDate.toISOString() : null,
      // GAP 5: Data source indicator
      dataSource,
      // GAP 2: COB (Coordination of Benefits)
      hasSecondaryInsurance,
      cobApplied,
      primaryBreakdown,
      secondaryBreakdown,
      finalPatientAmount,
      // GAP 6: Pharmacy estimate (informational only)
      pharmacyEstimate,
    } as any;
  }

  // ==================== CREDIT NOTES ====================

  /**
   * Create a credit note for an invoice or patient
   */
  async createCreditNote(hospitalId: string, data: {
    invoiceId?: string;
    patientId: string;
    amount: number;
    reason: string;
    createdBy: string;
  }) {
    // Generate credit note number
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    const creditNoteNumber = `CN-${timestamp}${random}`;

    // Validate invoice if provided
    if (data.invoiceId) {
      const invoice = await prisma.invoice.findFirst({
        where: { id: data.invoiceId, hospitalId },
      });
      if (!invoice) {
        throw new NotFoundError('Invoice not found');
      }
    }

    return prisma.creditNote.create({
      data: {
        hospitalId,
        invoiceId: data.invoiceId,
        patientId: data.patientId,
        creditNoteNumber,
        amount: data.amount,
        reason: data.reason,
        status: 'DRAFT',
        createdBy: data.createdBy,
      },
      include: {
        patient: true,
        invoice: true,
      },
    });
  }

  /**
   * Issue a credit note (status DRAFT → ISSUED)
   * Posts to GL when issued
   */
  async issueCreditNote(creditNoteId: string, hospitalId: string, issuedBy: string) {
    const creditNote = await prisma.creditNote.findFirst({
      where: { id: creditNoteId, hospitalId },
      include: {
        invoice: true,
        patient: true,
      },
    });

    if (!creditNote) {
      throw new NotFoundError('Credit note not found');
    }

    if (creditNote.status !== 'DRAFT') {
      throw new Error(`Cannot issue credit note with status ${creditNote.status}`);
    }

    // Update status to ISSUED
    const issuedCreditNote = await prisma.creditNote.update({
      where: { id: creditNoteId },
      data: { status: 'ISSUED' },
      include: {
        invoice: true,
        patient: true,
      },
    });

    // Post to GL (reduces revenue and receivables)
    try {
      const isInsurance = creditNote.invoice?.primaryInsuranceId != null;
      await accountingService.recordCreditNoteGL({
        hospitalId,
        creditNoteId: issuedCreditNote.id,
        amount: Number(creditNote.amount),
        description: `Credit Note ${creditNote.creditNoteNumber} - ${creditNote.reason}`,
        createdBy: issuedBy,
        isInsurance,
      });
    } catch (glError) {
      console.error('[GL] Failed to post credit note GL entry:', glError);
    }

    return issuedCreditNote;
  }

  /**
   * Apply credit note to an invoice (reduces invoice balance)
   */
  async applyCreditNoteToInvoice(
    creditNoteId: string,
    invoiceId: string,
    hospitalId: string,
    appliedBy: string
  ) {
    const creditNote = await prisma.creditNote.findFirst({
      where: { id: creditNoteId, hospitalId, status: 'ISSUED' },
    });

    if (!creditNote) {
      throw new NotFoundError('Credit note not found or not issued');
    }

    if (creditNote.appliedToInvoiceId) {
      throw new Error('Credit note already applied to an invoice');
    }

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, hospitalId },
    });

    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    // Apply credit note to invoice
    const result = await prisma.$transaction(async (tx) => {
      // Update credit note
      const updatedCreditNote = await tx.creditNote.update({
        where: { id: creditNoteId },
        data: {
          appliedToInvoiceId: invoiceId,
          status: 'APPLIED',
        },
      });

      // Reduce invoice balance
      const creditAmount = Number(creditNote.amount);
      const newBalance = Math.max(0, Number(invoice.balanceAmount) - creditAmount);

      const updatedInvoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          balanceAmount: newBalance,
          status: newBalance === 0 ? 'PAID' : invoice.status,
        },
      });

      return { creditNote: updatedCreditNote, invoice: updatedInvoice };
    });

    return result;
  }

  /**
   * Get credit notes list
   */
  async getCreditNotes(hospitalId: string, params: {
    page?: number;
    limit?: number;
    status?: string;
    patientId?: string;
  }) {
    const { page = 1, limit = 20, status, patientId } = params;

    const where: any = { hospitalId };
    if (status) where.status = status;
    if (patientId) where.patientId = patientId;

    const [data, total] = await Promise.all([
      prisma.creditNote.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          patient: { select: { firstName: true, lastName: true, mrn: true } },
          invoice: { select: { invoiceNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.creditNote.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Generate receipt HTML for a payment
   */
  async generateReceiptHTML(paymentId: string, hospitalId: string): Promise<string> {
    const payment = await prisma.payment.findFirst({
      where: { id: paymentId },
      include: {
        invoice: {
          include: {
            patient: true,
            items: true,
            hospital: true,
          },
        },
      },
    });

    if (!payment || payment.invoice.hospitalId !== hospitalId) {
      throw new NotFoundError('Payment not found');
    }

    const invoice = payment.invoice;
    const patient = invoice.patient;
    const hospital = invoice.hospital;

    const receiptNumber = `RCP-${payment.id.substring(0, 8).toUpperCase()}`;
    const paymentDate = payment.paymentDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Payment Receipt - ${receiptNumber}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      color: #333;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #333;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      margin: 0;
      color: #2563eb;
    }
    .header p {
      margin: 5px 0;
      color: #666;
    }
    .receipt-info {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
    }
    .info-section {
      flex: 1;
    }
    .info-section h3 {
      margin-top: 0;
      color: #2563eb;
      font-size: 14px;
      text-transform: uppercase;
    }
    .info-section p {
      margin: 5px 0;
      font-size: 13px;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    .items-table th {
      background-color: #f3f4f6;
      padding: 12px;
      text-align: left;
      border-bottom: 2px solid #ddd;
      font-size: 13px;
      text-transform: uppercase;
    }
    .items-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #eee;
      font-size: 13px;
    }
    .amount-section {
      text-align: right;
      margin-top: 20px;
      padding-top: 20px;
      border-top: 2px solid #333;
    }
    .amount-row {
      display: flex;
      justify-content: flex-end;
      margin: 8px 0;
    }
    .amount-label {
      width: 200px;
      text-align: right;
      padding-right: 20px;
      font-weight: bold;
    }
    .amount-value {
      width: 120px;
      text-align: right;
    }
    .total-amount {
      font-size: 18px;
      color: #2563eb;
      font-weight: bold;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      text-align: center;
      font-size: 12px;
      color: #666;
    }
    .payment-method {
      background-color: #f0fdf4;
      border-left: 4px solid #16a34a;
      padding: 15px;
      margin: 20px 0;
    }
    .payment-method strong {
      color: #16a34a;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${hospital.name}</h1>
    <p>${hospital.address || ''}</p>
    <p>Phone: ${hospital.phone || 'N/A'} | Email: ${hospital.email || 'N/A'}</p>
  </div>

  <div class="receipt-info">
    <div class="info-section">
      <h3>Receipt Information</h3>
      <p><strong>Receipt Number:</strong> ${receiptNumber}</p>
      <p><strong>Date:</strong> ${paymentDate}</p>
      <p><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</p>
    </div>
    <div class="info-section">
      <h3>Patient Information</h3>
      <p><strong>Name:</strong> ${patient.firstName} ${patient.lastName}</p>
      <p><strong>MRN:</strong> ${patient.mrn}</p>
      <p><strong>Phone:</strong> ${patient.phone || 'N/A'}</p>
    </div>
  </div>

  <h3>Invoice Items</h3>
  <table class="items-table">
    <thead>
      <tr>
        <th>Description</th>
        <th>Category</th>
        <th style="text-align: right;">Quantity</th>
        <th style="text-align: right;">Unit Price</th>
        <th style="text-align: right;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${invoice.items
        .map(
          (item: any) => `
        <tr>
          <td>${item.description}</td>
          <td>${item.category}</td>
          <td style="text-align: right;">${item.quantity}</td>
          <td style="text-align: right;">${Number(item.unitPrice).toFixed(2)}</td>
          <td style="text-align: right;">${Number(item.totalPrice).toFixed(2)}</td>
        </tr>
      `
        )
        .join('')}
    </tbody>
  </table>

  <div class="amount-section">
    <div class="amount-row">
      <div class="amount-label">Subtotal:</div>
      <div class="amount-value">${Number(invoice.subtotal).toFixed(2)}</div>
    </div>
    ${
      Number(invoice.discount) > 0
        ? `
    <div class="amount-row">
      <div class="amount-label">Discount:</div>
      <div class="amount-value">-${Number(invoice.discount).toFixed(2)}</div>
    </div>
    `
        : ''
    }
    ${
      Number(invoice.tax) > 0
        ? `
    <div class="amount-row">
      <div class="amount-label">Tax:</div>
      <div class="amount-value">${Number(invoice.tax).toFixed(2)}</div>
    </div>
    `
        : ''
    }
    <div class="amount-row">
      <div class="amount-label">Total Amount:</div>
      <div class="amount-value">${Number(invoice.totalAmount).toFixed(2)}</div>
    </div>
    <div class="amount-row total-amount">
      <div class="amount-label">Amount Paid:</div>
      <div class="amount-value">${Number(payment.amount).toFixed(2)}</div>
    </div>
    <div class="amount-row">
      <div class="amount-label">Balance Due:</div>
      <div class="amount-value">${Number(invoice.balanceAmount).toFixed(2)}</div>
    </div>
  </div>

  <div class="payment-method">
    <p><strong>Payment Method:</strong> ${payment.paymentMethod}</p>
    ${payment.referenceNumber ? `<p><strong>Reference Number:</strong> ${payment.referenceNumber}</p>` : ''}
    ${payment.notes ? `<p><strong>Notes:</strong> ${payment.notes}</p>` : ''}
  </div>

  <div class="footer">
    <p>Thank you for your payment!</p>
    <p>This is an official receipt for your records.</p>
    <p>Receipt generated on ${new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })}</p>
  </div>
</body>
</html>
    `;

    return html;
  }

  /**
   * Collect copay payment at check-in
   */
  async collectCopay(params: {
    patientId: string;
    appointmentId: string;
    amount: number;
    paymentMethod: 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'UPI' | 'DEPOSIT';
    useDeposit?: boolean;
    hospitalId: string;
    collectedBy: string;
    notes?: string;
  }): Promise<{
    success: boolean;
    payment?: any;
    depositUtilization?: any;
    message: string;
    receiptNumber?: string | null;
    vatAmount?: number | null;
  }> {
    // Validate insurance and copay amount
    const copayInfo = await this.calculateCopay(params.patientId, params.hospitalId, params.appointmentId);

    if (!copayInfo.hasCopay) {
      return {
        success: false,
        message: 'Patient does not have a copay requirement',
      };
    }

    if (params.amount !== copayInfo.patientAmount) {
      console.warn(`[COPAY COLLECT] Amount mismatch: provided ${params.amount}, expected ${copayInfo.patientAmount}`);
      // Allow collection anyway (manual override)
    }

    // Handle deposit payment method
    if (params.useDeposit && params.paymentMethod === 'DEPOSIT') {
      try {
        const { depositService } = require('./depositService');
        
        // Check available deposit balance
        const balance = await depositService.getPatientDepositBalance(params.patientId, params.hospitalId);
        
        if (balance.availableBalance < params.amount) {
          return {
            success: false,
            message: `Insufficient deposit balance. Available: ${balance.availableBalance}, Required: ${params.amount}`,
          };
        }

        // Utilize deposit for copay
        const utilization = await depositService.utilizeDeposit({
          patientId: params.patientId,
          hospitalId: params.hospitalId,
          amount: params.amount,
          purpose: 'COPAY',
          referenceType: 'APPOINTMENT',
          referenceId: params.appointmentId,
          notes: `Copay for appointment ${params.appointmentId}`,
          processedBy: params.collectedBy,
        });

        // Update appointment with copay collected flag
        await prisma.appointment.update({
          where: { id: params.appointmentId },
          data: {
            copayCollected: true,
            copayAmount: params.amount,
          },
        });

        // GAP 4: Update DeductibleLedger with copay payment
        try {
          const insurance = await prisma.patientInsurance.findFirst({
            where: { patientId: params.patientId, isActive: true, isPrimary: true },
            select: { id: true },
          });
          await deductibleService.recordPayment(
            params.hospitalId,
            params.patientId,
            params.amount,
            insurance?.id
          );
        } catch (ledgerError) {
          console.error('[COPAY COLLECT] DeductibleLedger update failed (deposit path):', ledgerError);
          // Non-blocking — copay was collected, ledger update is best-effort
        }

        // GAP 3: Generate receipt for deposit payment
        // Deposit path doesn't create a CopayPayment record, so we create one for receipt tracking
        let receiptInfo: any = null;
        try {
          // Create a CopayPayment record for deposit path so we can attach receipt
          const depositPayment = await prisma.copayPayment.create({
            data: {
              patientId: params.patientId,
              appointmentId: params.appointmentId,
              amount: params.amount,
              paymentMethod: 'DEPOSIT' as any,
              insuranceProvider: copayInfo.insuranceProvider || '',
              policyNumber: copayInfo.policyNumber || '',
              notes: params.notes || 'Paid via deposit',
              collectedBy: params.collectedBy,
            },
          });

          const { receiptService } = require('./receiptService');
          const receipt = await receiptService.generateCopayReceipt(
            depositPayment.id,
            params.hospitalId,
            {
              consultationFee: copayInfo.consultationFee,
              coveragePercentage: copayInfo.coveragePercentage,
              copayPercentage: copayInfo.copayPercentage,
              insuranceAmount: copayInfo.insuranceAmount,
              patientAmount: copayInfo.patientAmount,
              cobApplied: (copayInfo as any).cobApplied,
              secondaryBreakdown: (copayInfo as any).secondaryBreakdown,
            }
          );
          receiptInfo = {
            receiptNumber: receipt.receiptNumber,
            vatAmount: receipt.vatAmount,
          };
        } catch (receiptError) {
          console.error('[COPAY COLLECT] Receipt generation failed for deposit (non-blocking):', receiptError);
        }

        return {
          success: true,
          depositUtilization: utilization,
          receiptNumber: receiptInfo?.receiptNumber || null,
          vatAmount: receiptInfo?.vatAmount || null,
          message: 'Copay collected from deposit successfully',
        };
      } catch (error) {
        console.error('[COPAY COLLECT] Deposit utilization failed:', error);
        return {
          success: false,
          message: `Deposit utilization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    }

    // Handle direct payment methods (Cash/Card)
    try {
      // Create a copay payment record
      // GAP 2: Include COB fields if applicable
      const cobFields: any = {};
      if ((copayInfo as any).cobApplied && (copayInfo as any).secondaryBreakdown) {
        cobFields.secondaryInsuranceProvider = (copayInfo as any).secondaryBreakdown.insuranceProvider || null;
        cobFields.secondaryPolicyNumber = (copayInfo as any).secondaryBreakdown.policyNumber || null;
        cobFields.cobApplied = true;
      }

      const payment = await prisma.copayPayment.create({
        data: {
          patientId: params.patientId,
          appointmentId: params.appointmentId,
          amount: params.amount,
          paymentMethod: params.paymentMethod,
          insuranceProvider: copayInfo.insuranceProvider || '',
          policyNumber: copayInfo.policyNumber || '',
          notes: params.notes,
          collectedBy: params.collectedBy,
          ...cobFields,
        },
      });

      // Update appointment with copay collected flag
      await prisma.appointment.update({
        where: { id: params.appointmentId },
        data: {
          copayCollected: true,
          copayAmount: params.amount,
        },
      });

      // Post to GL (Cash/AR account depending on payment method)
      try {
        await accountingService.recordCopayGL({
          hospitalId: params.hospitalId,
          paymentId: payment.id,
          amount: params.amount,
          paymentMethod: params.paymentMethod,
          description: `Copay for appointment ${params.appointmentId}`,
          createdBy: params.collectedBy,
        });
      } catch (glError) {
        console.error('[GL] Failed to post copay GL entry:', glError);
      }

      // GAP 4: Update DeductibleLedger with copay payment
      try {
        const insurance = await prisma.patientInsurance.findFirst({
          where: { patientId: params.patientId, isActive: true, isPrimary: true },
          select: { id: true },
        });
        await deductibleService.recordPayment(
          params.hospitalId,
          params.patientId,
          params.amount,
          insurance?.id
        );
      } catch (ledgerError) {
        console.error('[COPAY COLLECT] DeductibleLedger update failed (direct payment):', ledgerError);
        // Non-blocking — copay was collected, ledger update is best-effort
      }

      // GAP 3: Generate receipt after successful payment
      let receiptInfo: any = null;
      try {
        const { receiptService } = require('./receiptService');
        const receipt = await receiptService.generateCopayReceipt(
          payment.id,
          params.hospitalId,
          {
            consultationFee: copayInfo.consultationFee,
            coveragePercentage: copayInfo.coveragePercentage,
            copayPercentage: copayInfo.copayPercentage,
            insuranceAmount: copayInfo.insuranceAmount,
            patientAmount: copayInfo.patientAmount,
            cobApplied: (copayInfo as any).cobApplied,
            secondaryBreakdown: (copayInfo as any).secondaryBreakdown,
          }
        );
        receiptInfo = {
          receiptNumber: receipt.receiptNumber,
          vatAmount: receipt.vatAmount,
        };
      } catch (receiptError) {
        console.error('[COPAY COLLECT] Receipt generation failed (non-blocking):', receiptError);
        // Non-blocking — copay was collected, receipt is best-effort
      }

      return {
        success: true,
        payment,
        receiptNumber: receiptInfo?.receiptNumber || null,
        vatAmount: receiptInfo?.vatAmount || null,
        message: 'Copay collected successfully',
      };
    } catch (error) {
      console.error('[COPAY COLLECT] Payment recording failed:', error);
      return {
        success: false,
        message: `Payment recording failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // ==================== Pharmacy Copay ====================

  /**
   * Calculate copay for pharmacy prescription
   * Takes into account patient insurance, drug costs, and coverage
   */
  async calculatePharmacyCopay(prescriptionId: string, hospitalId: string): Promise<{
    hasCopay: boolean;
    prescriptionId: string;
    medications: Array<{
      name: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      insuranceCoverage: number;
      patientPays: number;
    }>;
    totalCost: number;
    insuranceCovers: number;
    patientPays: number;
    coveragePercentage: number;
    insuranceProvider: string | null;
    policyNumber: string | null;
    networkStatus: string;
    copayCollected: boolean;
    noInsurance: boolean;
  }> {
    // Fetch prescription with medications
    const prescription = await prisma.prescription.findUnique({
      where: { id: prescriptionId },
      include: {
        patient: {
          include: {
            insurances: {
              where: { isActive: true, isPrimary: true },
              take: 1,
            },
          },
        },
        medications: true,
      },
    });

    if (!prescription) {
      throw new Error('Prescription not found');
    }

    // Calculate total medication cost
    const medications = prescription.medications.map((med: any) => {
      const unitPrice = Number(med.unitPrice) || 0;
      const quantity = med.quantity || 1;
      const totalPrice = unitPrice * quantity;
      return {
        name: med.drugName,
        quantity,
        unitPrice,
        totalPrice,
        insuranceCoverage: 0,
        patientPays: totalPrice,
      };
    });

    const totalCost = medications.reduce((sum: number, m: any) => sum + m.totalPrice, 0);

    // Check if patient has insurance
    const insurance = prescription.patient.insurances[0];

    if (!insurance) {
      // No insurance - patient pays full amount
      return {
        hasCopay: true,
        prescriptionId,
        medications,
        totalCost,
        insuranceCovers: 0,
        patientPays: totalCost,
        coveragePercentage: 0,
        insuranceProvider: null,
        policyNumber: null,
        networkStatus: 'NONE',
        copayCollected: prescription.copayCollected || false,
        noInsurance: true,
      };
    }

    // Get coverage percentage based on network status
    // UAE typical: In-network 80%, Out-of-network 50%
    const networkStatus = insurance.networkTier || 'IN_NETWORK';
    let coveragePercentage = networkStatus === 'IN_NETWORK' ? 80 : 50;

    // Check if there's a pharmacy-specific copay in insurance (some plans have fixed drug copay)
    const fixedCopay = insurance.copay ? Number(insurance.copay) : null;

    // Calculate coverage for each medication
    const medicationsWithCoverage = medications.map((med: any) => {
      if (fixedCopay !== null && fixedCopay > 0) {
        // Fixed copay per prescription line
        const patientPays = Math.min(fixedCopay, med.totalPrice);
        return {
          ...med,
          insuranceCoverage: med.totalPrice - patientPays,
          patientPays,
        };
      } else {
        // Percentage-based coverage
        const insuranceCoverage = (med.totalPrice * coveragePercentage) / 100;
        const patientPays = med.totalPrice - insuranceCoverage;
        return {
          ...med,
          insuranceCoverage,
          patientPays,
        };
      }
    });

    const insuranceCovers = medicationsWithCoverage.reduce((sum: number, m: any) => sum + m.insuranceCoverage, 0);
    const patientPays = medicationsWithCoverage.reduce((sum: number, m: any) => sum + m.patientPays, 0);

    return {
      hasCopay: patientPays > 0,
      prescriptionId,
      medications: medicationsWithCoverage,
      totalCost,
      insuranceCovers,
      patientPays,
      coveragePercentage,
      insuranceProvider: insurance.providerName,
      policyNumber: insurance.policyNumber,
      networkStatus,
      copayCollected: prescription.copayCollected || false,
      noInsurance: false,
    };
  }

  /**
   * Collect pharmacy copay before dispensing
   */
  async collectPharmacyCopay(params: {
    prescriptionId: string;
    hospitalId: string;
    amount: number;
    paymentMethod: 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD';
    collectedBy: string;
    waived?: boolean;
    waiverReason?: string;
  }): Promise<{ success: boolean; message: string; payment?: any }> {
    try {
      const prescription = await prisma.prescription.findUnique({
        where: { id: params.prescriptionId },
        include: { patient: true },
      });

      if (!prescription) {
        return { success: false, message: 'Prescription not found' };
      }

      if (params.waived) {
        // Mark as waived without payment
        await prisma.prescription.update({
          where: { id: params.prescriptionId },
          data: {
            copayCollected: true,
            copayAmount: new Decimal(0),
            copayWaived: true,
            copayWaiverReason: params.waiverReason || 'Waived by pharmacy staff',
          },
        });

        return {
          success: true,
          message: 'Pharmacy copay waived',
        };
      }

      // Record payment
      const payment = await prisma.payment.create({
        data: {
          invoiceId: (prescription as any).invoiceId || '',
          amount: new Decimal(params.amount),
          paymentMethod: params.paymentMethod,
          referenceNumber: `PHARM-${Date.now()}`,
          notes: `Pharmacy copay for prescription ${params.prescriptionId}`,
          createdBy: params.collectedBy,
        },
      });

      // Update prescription with copay collected flag
      await prisma.prescription.update({
        where: { id: params.prescriptionId },
        data: {
          copayCollected: true,
          copayAmount: new Decimal(params.amount),
        },
      });

      // Post to GL
      try {
        await accountingService.recordCopayGL({
          hospitalId: params.hospitalId,
          paymentId: payment.id,
          amount: params.amount,
          paymentMethod: params.paymentMethod,
          description: `Pharmacy copay for prescription ${params.prescriptionId}`,
          createdBy: params.collectedBy,
        });
      } catch (glError) {
        console.error('[GL] Failed to post pharmacy copay GL entry:', glError);
      }

      return {
        success: true,
        payment,
        message: 'Pharmacy copay collected successfully',
      };
    } catch (error) {
      console.error('[PHARMACY COPAY] Collection failed:', error);
      return {
        success: false,
        message: `Collection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}

export const billingService = new BillingService();
