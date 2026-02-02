import Stripe from 'stripe';
import prisma from '../config/database';
import { NotFoundError } from '../middleware/errorHandler';
import PDFDocument from 'pdfkit';
import { Readable } from 'stream';

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
      await prisma.$transaction(async (tx) => {
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
      });

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

    // Create PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));

    // Header
    doc.fontSize(20).text(hospital.name, { align: 'center' });
    doc.fontSize(10).text(hospital.address, { align: 'center' });
    doc.text(`${hospital.city}, ${hospital.state} ${hospital.zipCode}`, { align: 'center' });
    doc.text(`Phone: ${hospital.phone} | Email: ${hospital.email}`, { align: 'center' });

    doc.moveDown(2);
    doc.fontSize(16).text('PAYMENT RECEIPT', { align: 'center', underline: true });
    doc.moveDown(2);

    // Receipt details
    doc.fontSize(10);
    doc.text(`Receipt Number: ${payment.id}`, 50, doc.y);
    doc.text(`Date: ${payment.paymentDate.toLocaleDateString()}`, 300, doc.y - 12);
    doc.moveDown();
    doc.text(`Invoice Number: ${invoice.invoiceNumber}`);
    doc.text(`Payment Method: ${payment.paymentMethod}`);
    if (payment.referenceNumber) {
      doc.text(`Reference: ${payment.referenceNumber}`);
    }
    doc.moveDown(2);

    // Patient details
    doc.fontSize(12).text('Patient Information:', { underline: true });
    doc.fontSize(10).moveDown(0.5);
    doc.text(`Name: ${patient.firstName} ${patient.lastName}`);
    doc.text(`MRN: ${patient.mrn}`);
    doc.text(`Phone: ${patient.phone}`);
    doc.moveDown(2);

    // Payment details
    doc.fontSize(12).text('Payment Details:', { underline: true });
    doc.fontSize(10).moveDown(0.5);
    doc.text(`Amount Paid: ${invoice.currency || 'AED'} ${Number(payment.amount).toFixed(2)}`);
    doc.moveDown(2);

    // Footer
    doc.fontSize(8).text('Thank you for your payment!', { align: 'center' });
    doc.text('This is a computer-generated receipt and does not require a signature.', {
      align: 'center',
    });

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
