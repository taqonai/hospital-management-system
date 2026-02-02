import Stripe from 'stripe';
import prisma from '../config/database';
import { NotFoundError } from '../middleware/errorHandler';
import PDFDocument from 'pdfkit';
import { Readable } from 'stream';
import { accountingService } from './accountingService';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_placeholder';
const ENABLE_ONLINE_PAYMENTS = process.env.ENABLE_ONLINE_PAYMENTS === 'true';

// Initialize Stripe only if enabled
const stripe = ENABLE_ONLINE_PAYMENTS ? new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2026-01-28.clover',
}) : null;

export class PaymentGatewayService {
  /**
   * Create a payment intent for an invoice
   * Returns clientSecret for frontend to complete payment
   */
  async createPaymentIntent(
    hospitalId: string,
    invoiceId: string,
    amount: number,
    currency: string = 'AED'
  ): Promise<{
    transactionId: string;
    clientSecret: string;
    amount: number;
    currency: string;
  }> {
    // Verify invoice exists and belongs to hospital
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, hospitalId },
      include: {
        patient: { select: { firstName: true, lastName: true, email: true, phone: true } },
      },
    });

    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    // Verify amount doesn't exceed balance
    if (amount > Number(invoice.balanceAmount)) {
      throw new Error(
        `Payment amount (${amount}) exceeds invoice balance (${Number(invoice.balanceAmount)})`
      );
    }

    // Create PaymentTransaction record
    const transaction = await prisma.paymentTransaction.create({
      data: {
        hospitalId,
        invoiceId,
        gatewayProvider: 'stripe',
        gatewayStatus: 'pending',
        amount,
        currency: currency.toUpperCase(),
      },
    });

    let clientSecret = '';

    // Create Stripe PaymentIntent if enabled
    if (ENABLE_ONLINE_PAYMENTS && stripe) {
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(amount * 100), // Stripe uses cents
          currency: currency.toLowerCase(),
          metadata: {
            hospitalId,
            invoiceId,
            transactionId: transaction.id,
            invoiceNumber: invoice.invoiceNumber,
            patientName: `${invoice.patient.firstName} ${invoice.patient.lastName}`,
          },
          description: `Payment for invoice ${invoice.invoiceNumber}`,
        });

        // Update transaction with Stripe payment intent ID
        await prisma.paymentTransaction.update({
          where: { id: transaction.id },
          data: {
            gatewayTransactionId: paymentIntent.id,
            metadata: {
              paymentIntentId: paymentIntent.id,
              status: paymentIntent.status,
            },
          },
        });

        clientSecret = paymentIntent.client_secret || '';
      } catch (error: any) {
        console.error('[PaymentGateway] Stripe PaymentIntent creation failed:', error);
        
        // Update transaction status to failed
        await prisma.paymentTransaction.update({
          where: { id: transaction.id },
          data: { gatewayStatus: 'failed', metadata: { error: error.message } },
        });

        throw new Error(`Payment gateway error: ${error.message}`);
      }
    } else {
      // Mock mode - generate a fake client secret for testing
      clientSecret = `pi_test_${transaction.id}_secret_${Date.now()}`;
      await prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          gatewayTransactionId: `pi_test_${transaction.id}`,
          metadata: { mode: 'test', note: 'Stripe not configured' },
        },
      });
    }

    return {
      transactionId: transaction.id,
      clientSecret,
      amount,
      currency: currency.toUpperCase(),
    };
  }

  /**
   * Confirm payment after frontend completes the payment flow
   * This creates the Payment record and updates Invoice
   */
  async confirmPayment(transactionId: string, userId: string): Promise<{
    success: boolean;
    paymentId?: string;
    invoiceStatus?: string;
    message: string;
  }> {
    // Get transaction
    const transaction = await prisma.paymentTransaction.findUnique({
      where: { id: transactionId },
      include: { invoice: true },
    });

    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    // Check if payment already exists (idempotency)
    if (transaction.paymentId) {
      const existingPayment = await prisma.payment.findUnique({
        where: { id: transaction.paymentId },
      });
      if (existingPayment) {
        return {
          success: true,
          paymentId: existingPayment.id,
          invoiceStatus: transaction.invoice.status,
          message: 'Payment already recorded',
        };
      }
    }

    // If Stripe is enabled, verify payment status
    if (ENABLE_ONLINE_PAYMENTS && stripe && transaction.gatewayTransactionId) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(
          transaction.gatewayTransactionId
        );

        if (paymentIntent.status !== 'succeeded') {
          return {
            success: false,
            message: `Payment not completed. Status: ${paymentIntent.status}`,
          };
        }

        // Update transaction with payment details
        const charge = (paymentIntent as any).charges?.data?.[0];
        await prisma.paymentTransaction.update({
          where: { id: transactionId },
          data: {
            gatewayStatus: 'succeeded',
            paymentMethodType: charge?.payment_method_details?.type || null,
            last4: charge?.payment_method_details?.card?.last4 || null,
            receiptUrl: charge?.receipt_url || null,
          },
        });
      } catch (error: any) {
        console.error('[PaymentGateway] Stripe verification failed:', error);
        throw new Error(`Payment verification failed: ${error.message}`);
      }
    } else {
      // Mock mode - mark as succeeded
      await prisma.paymentTransaction.update({
        where: { id: transactionId },
        data: { gatewayStatus: 'succeeded' },
      });
    }

    // Create Payment record + update Invoice in atomic transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create payment record
      const payment = await tx.payment.create({
        data: {
          invoiceId: transaction.invoiceId,
          amount: transaction.amount,
          paymentMethod: 'CREDIT_CARD',
          referenceNumber: transaction.gatewayTransactionId || transactionId,
          notes: `Online payment via ${transaction.gatewayProvider}`,
          createdBy: userId,
          transactionId: transactionId,
        },
      });

      // Link transaction to payment
      await tx.paymentTransaction.update({
        where: { id: transactionId },
        data: { paymentId: payment.id },
      });

      // Update invoice
      const invoice = transaction.invoice;
      const newPaidAmount = Number(invoice.paidAmount) + Number(transaction.amount);
      const newBalance = Number(invoice.totalAmount) - newPaidAmount;

      let newStatus = invoice.status;
      if (newBalance <= 0) {
        newStatus = 'PAID';
      } else if (newPaidAmount > 0) {
        newStatus = 'PARTIALLY_PAID';
      }

      const updatedInvoice = await tx.invoice.update({
        where: { id: transaction.invoiceId },
        data: {
          paidAmount: newPaidAmount,
          balanceAmount: newBalance > 0 ? newBalance : 0,
          status: newStatus,
          updatedBy: userId,
        },
      });

      return { payment, invoice: updatedInvoice };
    });

    return {
      success: true,
      paymentId: result.payment.id,
      invoiceStatus: result.invoice.status,
      message: 'Payment recorded successfully',
    };
  }

  /**
   * Handle Stripe webhook events
   * Processes payment_intent.succeeded, payment_intent.payment_failed, charge.refunded
   */
  async handleWebhook(
    payload: string | Buffer,
    signature: string
  ): Promise<{ received: boolean; processed?: boolean; message?: string }> {
    if (!ENABLE_ONLINE_PAYMENTS || !stripe) {
      return { received: true, processed: false, message: 'Stripe not enabled' };
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(payload, signature, STRIPE_WEBHOOK_SECRET);
    } catch (err: any) {
      console.error('[PaymentGateway] Webhook signature verification failed:', err.message);
      throw new Error(`Webhook signature verification failed: ${err.message}`);
    }

    console.log('[PaymentGateway] Webhook received:', event.type);

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await this.handlePaymentIntentSucceeded(paymentIntent);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await this.handlePaymentIntentFailed(paymentIntent);
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        await this.handleChargeRefunded(charge);
        break;
      }

      default:
        console.log(`[PaymentGateway] Unhandled event type: ${event.type}`);
    }

    return { received: true, processed: true };
  }

  private async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
    const transactionId = paymentIntent.metadata.transactionId;
    if (!transactionId) {
      console.error('[PaymentGateway] No transactionId in payment intent metadata');
      return;
    }

    // Check if already processed (idempotency)
    const transaction = await prisma.paymentTransaction.findUnique({
      where: { id: transactionId },
      include: { invoice: true },
    });

    if (!transaction) {
      console.error(`[PaymentGateway] Transaction ${transactionId} not found`);
      return;
    }

    if (transaction.paymentId) {
      console.log(`[PaymentGateway] Transaction ${transactionId} already processed`);
      return;
    }

    // Process payment
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Update transaction
        const charge = (paymentIntent as any).charges?.data?.[0];
        await tx.paymentTransaction.update({
          where: { id: transactionId },
          data: {
            gatewayStatus: 'succeeded',
            paymentMethodType: charge?.payment_method_details?.type || null,
            last4: charge?.payment_method_details?.card?.last4 || null,
            receiptUrl: charge?.receipt_url || null,
          },
        });

        // Create payment record
        const payment = await tx.payment.create({
          data: {
            invoiceId: transaction.invoiceId,
            amount: transaction.amount,
            paymentMethod: 'CREDIT_CARD',
            referenceNumber: paymentIntent.id,
            notes: 'Online payment via Stripe (webhook)',
            createdBy: 'system',
            transactionId: transactionId,
          },
        });

        // Link payment to transaction
        await tx.paymentTransaction.update({
          where: { id: transactionId },
          data: { paymentId: payment.id },
        });

        // Update invoice
        const invoice = transaction.invoice;
        const newPaidAmount = Number(invoice.paidAmount) + Number(transaction.amount);
        const newBalance = Number(invoice.totalAmount) - newPaidAmount;

        let newStatus = invoice.status;
        if (newBalance <= 0) {
          newStatus = 'PAID';
        } else if (newPaidAmount > 0) {
          newStatus = 'PARTIALLY_PAID';
        }

        await tx.invoice.update({
          where: { id: transaction.invoiceId },
          data: {
            paidAmount: newPaidAmount,
            balanceAmount: newBalance > 0 ? newBalance : 0,
            status: newStatus,
            updatedBy: 'system',
          },
        });

        return { paymentId: payment.id };
      });

      // Post Stripe payment to GL
      try {
        await accountingService.recordPaymentGL({
          hospitalId: transaction.hospitalId,
          paymentId: result.paymentId,
          amount: Number(paymentIntent.amount_received) / 100,
          description: `Stripe payment ${paymentIntent.id}`,
          createdBy: 'stripe-webhook',
        });
      } catch (glError) {
        console.error('[GL] Failed to post Stripe payment GL entry:', glError);
      }

      console.log(`[PaymentGateway] Payment intent ${paymentIntent.id} processed successfully`);
    } catch (error) {
      console.error(`[PaymentGateway] Failed to process payment intent ${paymentIntent.id}:`, error);
    }
  }

  private async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
    const transactionId = paymentIntent.metadata.transactionId;
    if (!transactionId) return;

    await prisma.paymentTransaction.update({
      where: { id: transactionId },
      data: {
        gatewayStatus: 'failed',
        metadata: {
          error: paymentIntent.last_payment_error?.message || 'Payment failed',
        },
      },
    });

    console.log(`[PaymentGateway] Payment intent ${paymentIntent.id} failed`);
  }

  private async handleChargeRefunded(charge: Stripe.Charge) {
    // Find transaction by charge ID
    const transaction = await prisma.paymentTransaction.findFirst({
      where: { gatewayTransactionId: charge.payment_intent as string },
    });

    if (!transaction) {
      console.error(`[PaymentGateway] Transaction not found for charge ${charge.id}`);
      return;
    }

    await prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        gatewayStatus: 'refunded',
        metadata: {
          refundId: charge.refunds?.data[0]?.id,
          refundReason: charge.refunds?.data[0]?.reason,
        },
      },
    });

    // Post Stripe refund to GL
    try {
      await accountingService.recordRefundGL({
        hospitalId: transaction.hospitalId,
        refundId: charge.refunds?.data[0]?.id || charge.id,
        amount: Number(charge.amount_refunded) / 100,
        description: `Stripe refund for charge ${charge.id}`,
        createdBy: 'stripe-webhook',
      });
    } catch (glError) {
      console.error('[GL] Failed to post Stripe refund GL entry:', glError);
    }

    console.log(`[PaymentGateway] Charge ${charge.id} refunded`);
  }

  /**
   * Initiate a refund for a payment
   */
  async initiateRefund(
    paymentId: string,
    amount?: number,
    reason?: string,
    userId?: string
  ): Promise<{ success: boolean; refundId?: string; message: string }> {
    // Get payment and transaction
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        invoice: true,
        transactions: true,
      },
    });

    if (!payment) {
      throw new NotFoundError('Payment not found');
    }

    const transaction = payment.transactions[0];
    if (!transaction) {
      throw new Error('No transaction record found for this payment');
    }

    const refundAmount = amount || Number(payment.amount);

    // Process refund with Stripe if enabled
    if (ENABLE_ONLINE_PAYMENTS && stripe && transaction.gatewayTransactionId) {
      try {
        const refund = await stripe.refunds.create({
          payment_intent: transaction.gatewayTransactionId,
          amount: Math.round(refundAmount * 100), // Stripe uses cents
          reason: reason === 'requested_by_customer' ? 'requested_by_customer' : 'duplicate',
        });

        // Update transaction
        await prisma.paymentTransaction.update({
          where: { id: transaction.id },
          data: {
            gatewayStatus: 'refunded',
            metadata: {
              refundId: refund.id,
              refundAmount,
              refundReason: reason,
              refundedBy: userId,
            },
          },
        });

        // Update invoice
        await prisma.invoice.update({
          where: { id: payment.invoiceId },
          data: {
            paidAmount: { decrement: refundAmount },
            balanceAmount: { increment: refundAmount },
            status: 'REFUNDED',
            updatedBy: userId,
          },
        });

        return {
          success: true,
          refundId: refund.id,
          message: 'Refund processed successfully',
        };
      } catch (error: any) {
        console.error('[PaymentGateway] Refund failed:', error);
        throw new Error(`Refund failed: ${error.message}`);
      }
    } else {
      // Mock mode - just update records
      await prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          gatewayStatus: 'refunded',
          metadata: {
            refundAmount,
            refundReason: reason,
            refundedBy: userId,
            mode: 'test',
          },
        },
      });

      await prisma.invoice.update({
        where: { id: payment.invoiceId },
        data: {
          paidAmount: { decrement: refundAmount },
          balanceAmount: { increment: refundAmount },
          status: 'REFUNDED',
          updatedBy: userId,
        },
      });

      return {
        success: true,
        refundId: `refund_test_${Date.now()}`,
        message: 'Refund recorded (test mode)',
      };
    }
  }

  /**
   * Generate PDF receipt for a payment
   */
  async generateReceipt(paymentId: string): Promise<Buffer> {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        invoice: {
          include: {
            patient: true,
            items: true,
            hospital: true,
          },
        },
        transactions: true,
      },
    });

    if (!payment) {
      throw new NotFoundError('Payment not found');
    }

    const invoice = payment.invoice;
    const hospital = invoice.hospital;
    const patient = invoice.patient;
    const currency = (invoice as any).currency || 'AED';
    const fmt = (n: number) => `${currency} ${n.toFixed(2)}`;

    // Create PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    const pageWidth = doc.page.width - 100; // minus margins

    // ── Header ──
    doc.fontSize(20).font('Helvetica-Bold').text(hospital.name, { align: 'center' });
    doc.fontSize(9).font('Helvetica').text(hospital.address, { align: 'center' });
    doc.text(`${hospital.city}, ${hospital.state} ${hospital.zipCode}`, { align: 'center' });
    doc.text(`Phone: ${hospital.phone}  |  Email: ${hospital.email}`, { align: 'center' });
    if (hospital.website) {
      doc.text(hospital.website, { align: 'center' });
    }

    // Divider
    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).stroke('#cccccc');
    doc.moveDown(1);

    // ── Title ──
    doc.fontSize(16).font('Helvetica-Bold').text('PAYMENT RECEIPT', { align: 'center' });
    doc.moveDown(1.5);

    // ── Receipt & Patient Info (two columns) ──
    const leftX = 50;
    const rightX = 320;
    let y = doc.y;

    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Receipt Details', leftX, y);
    doc.text('Patient Information', rightX, y);
    y += 16;

    doc.fontSize(9).font('Helvetica');
    doc.text(`Receipt #: ${payment.id.substring(0, 8).toUpperCase()}`, leftX, y);
    doc.text(`Name: ${patient.firstName} ${patient.lastName}`, rightX, y);
    y += 13;
    doc.text(`Date: ${payment.paymentDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`, leftX, y);
    doc.text(`MRN: ${patient.mrn}`, rightX, y);
    y += 13;
    doc.text(`Invoice: ${invoice.invoiceNumber}`, leftX, y);
    doc.text(`Phone: ${patient.phone}`, rightX, y);
    y += 13;
    doc.text(`Method: ${payment.paymentMethod}`, leftX, y);
    if (patient.email) {
      doc.text(`Email: ${patient.email}`, rightX, y);
    }
    y += 13;
    if (payment.referenceNumber) {
      doc.text(`Reference: ${payment.referenceNumber}`, leftX, y);
      y += 13;
    }

    doc.y = y + 10;

    // Divider
    doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).stroke('#cccccc');
    doc.moveDown(1);

    // ── Line Items Table ──
    doc.fontSize(10).font('Helvetica-Bold').text('Invoice Items', leftX, doc.y);
    doc.moveDown(0.5);

    // Table header
    const colX = { desc: 50, qty: 310, unit: 380, total: 460 };
    y = doc.y;
    doc.rect(50, y - 2, pageWidth, 16).fill('#f0f0f0');
    doc.fillColor('#000000');
    doc.fontSize(8).font('Helvetica-Bold');
    doc.text('Description', colX.desc + 4, y + 2);
    doc.text('Qty', colX.qty, y + 2, { width: 50, align: 'right' });
    doc.text('Unit Price', colX.unit, y + 2, { width: 70, align: 'right' });
    doc.text('Total', colX.total, y + 2, { width: 80, align: 'right' });
    y += 18;

    // Table rows
    doc.font('Helvetica').fontSize(8);
    let subtotal = 0;
    for (const item of invoice.items) {
      const qty = Number((item as any).quantity || 1);
      const unitPrice = Number(item.unitPrice);
      const lineTotal = Number(item.totalPrice);
      subtotal += lineTotal;

      doc.text(item.description, colX.desc + 4, y, { width: 250 });
      doc.text(qty.toString(), colX.qty, y, { width: 50, align: 'right' });
      doc.text(fmt(unitPrice), colX.unit, y, { width: 70, align: 'right' });
      doc.text(fmt(lineTotal), colX.total, y, { width: 80, align: 'right' });
      y += 14;
    }

    // Divider under items
    doc.moveTo(colX.unit, y).lineTo(50 + pageWidth, y).stroke('#cccccc');
    y += 6;

    // Totals
    doc.font('Helvetica');
    const labelX = colX.unit - 20;
    const valX = colX.total;
    doc.text('Subtotal:', labelX, y, { width: 90, align: 'right' });
    doc.text(fmt(subtotal), valX, y, { width: 80, align: 'right' });
    y += 13;

    const discount = Number((invoice as any).discountAmount || 0);
    if (discount > 0) {
      doc.text('Discount:', labelX, y, { width: 90, align: 'right' });
      doc.text(`-${fmt(discount)}`, valX, y, { width: 80, align: 'right' });
      y += 13;
    }

    const tax = Number((invoice as any).taxAmount || 0);
    if (tax > 0) {
      doc.text('Tax:', labelX, y, { width: 90, align: 'right' });
      doc.text(fmt(tax), valX, y, { width: 80, align: 'right' });
      y += 13;
    }

    doc.font('Helvetica-Bold');
    doc.text('Total:', labelX, y, { width: 90, align: 'right' });
    doc.text(fmt(Number(invoice.totalAmount)), valX, y, { width: 80, align: 'right' });
    y += 18;

    // ── Payment Summary ──
    doc.moveTo(50, y).lineTo(50 + pageWidth, y).stroke('#cccccc');
    y += 10;

    doc.fontSize(10).font('Helvetica-Bold').text('Payment Summary', leftX, y);
    y += 16;
    doc.fontSize(9).font('Helvetica');
    doc.text(`Amount Paid:`, leftX, y);
    doc.font('Helvetica-Bold').text(fmt(Number(payment.amount)), leftX + 120, y);
    y += 14;

    const balance = Number(invoice.balanceAmount || 0);
    doc.font('Helvetica').text(`Balance Remaining:`, leftX, y);
    doc.font('Helvetica-Bold').text(fmt(balance), leftX + 120, y);
    y += 14;

    const totalPaid = Number(invoice.paidAmount || 0);
    doc.font('Helvetica').text(`Total Paid to Date:`, leftX, y);
    doc.text(fmt(totalPaid), leftX + 120, y);
    y += 30;

    // ── Footer ──
    doc.moveTo(50, y).lineTo(50 + pageWidth, y).stroke('#cccccc');
    y += 12;
    doc.fontSize(9).font('Helvetica').fillColor('#555555');
    doc.text('Thank you for your payment!', 50, y, { align: 'center', width: pageWidth });
    y += 14;
    doc.fontSize(7);
    doc.text('This is a computer-generated receipt and does not require a signature.', 50, y, { align: 'center', width: pageWidth });
    y += 10;
    if (hospital.licenseNumber) {
      doc.text(`License: ${hospital.licenseNumber}`, 50, y, { align: 'center', width: pageWidth });
    }

    doc.end();

    // Wait for PDF generation to complete
    return new Promise((resolve) => {
      doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    });
  }

  /**
   * Get all transactions for an invoice
   */
  async getTransactionsByInvoice(invoiceId: string) {
    return prisma.paymentTransaction.findMany({
      where: { invoiceId },
      orderBy: { createdAt: 'desc' },
      include: {
        payment: true,
      },
    });
  }
}

export const paymentGatewayService = new PaymentGatewayService();
