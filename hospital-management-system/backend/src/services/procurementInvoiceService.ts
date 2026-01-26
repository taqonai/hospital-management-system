import prisma from '../config/database';
import { NotFoundError, AppError } from '../middleware/errorHandler';
import { InvoiceMatchStatus, InvoicePaymentStatus } from '@prisma/client';

// ==================== Invoice CRUD ====================

export async function createInvoice(hospitalId: string, data: {
  invoiceNumber: string;
  supplierId: string;
  poId: string;
  invoiceDate: Date;
  dueDate?: Date;
  amount: number;
  taxAmount?: number;
  totalAmount: number;
  documentPath?: string;
}) {
  // Validate PO exists
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: data.poId, hospitalId },
  });
  if (!po) throw new NotFoundError('Purchase order not found');

  return prisma.supplierInvoice.create({
    data: {
      hospitalId,
      invoiceNumber: data.invoiceNumber,
      supplierId: data.supplierId,
      poId: data.poId,
      invoiceDate: data.invoiceDate,
      dueDate: data.dueDate,
      amount: data.amount,
      taxAmount: data.taxAmount || 0,
      totalAmount: data.totalAmount,
      documentPath: data.documentPath,
      matchStatus: 'UNMATCHED',
      paymentStatus: 'PENDING',
    },
    include: {
      supplier: { select: { id: true, companyName: true, code: true } },
      purchaseOrder: { select: { id: true, poNumber: true, totalAmount: true } },
    },
  });
}

export async function listInvoices(hospitalId: string, params: {
  supplierId?: string;
  matchStatus?: InvoiceMatchStatus;
  paymentStatus?: InvoicePaymentStatus;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const where: any = { hospitalId };

  if (params.supplierId) where.supplierId = params.supplierId;
  if (params.matchStatus) where.matchStatus = params.matchStatus;
  if (params.paymentStatus) where.paymentStatus = params.paymentStatus;
  if (params.search) {
    where.OR = [
      { invoiceNumber: { contains: params.search, mode: 'insensitive' } },
      { supplier: { companyName: { contains: params.search, mode: 'insensitive' } } },
    ];
  }

  const page = params.page || 1;
  const limit = params.limit || 20;
  const skip = (page - 1) * limit;

  const [invoices, total] = await Promise.all([
    prisma.supplierInvoice.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        supplier: { select: { id: true, companyName: true, code: true } },
        purchaseOrder: { select: { id: true, poNumber: true } },
      },
    }),
    prisma.supplierInvoice.count({ where }),
  ]);

  return { invoices, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getInvoiceById(hospitalId: string, invoiceId: string) {
  const invoice = await prisma.supplierInvoice.findFirst({
    where: { id: invoiceId, hospitalId },
    include: {
      supplier: { select: { id: true, companyName: true, code: true, email: true } },
      purchaseOrder: {
        include: {
          items: true,
          grns: {
            include: { items: true },
          },
        },
      },
    },
  });

  if (!invoice) throw new NotFoundError('Invoice not found');
  return invoice;
}

// ==================== 3-Way Matching ====================

export async function performThreeWayMatch(hospitalId: string, invoiceId: string, matchedById: string) {
  const invoice = await prisma.supplierInvoice.findFirst({
    where: { id: invoiceId, hospitalId },
    include: {
      purchaseOrder: {
        include: {
          items: true,
          grns: {
            where: { status: 'APPROVED_GRN' },
            include: { items: true },
          },
        },
      },
    },
  });

  if (!invoice) throw new NotFoundError('Invoice not found');

  const po = invoice.purchaseOrder;
  const grns = po.grns;
  const discrepancies: string[] = [];

  // 1. Check if GRNs exist
  if (grns.length === 0) {
    discrepancies.push('No approved GRN found for this PO');
  }

  // 2. Compare PO total vs Invoice total (with tolerance)
  const poTotal = Number(po.totalAmount);
  const invoiceTotal = Number(invoice.totalAmount);
  const tolerance = 0.05; // 5% tolerance

  const priceDiff = Math.abs(poTotal - invoiceTotal);
  const priceVariance = poTotal > 0 ? priceDiff / poTotal : 0;

  if (priceVariance > tolerance) {
    discrepancies.push(
      `Price variance: PO total ${poTotal.toFixed(2)} vs Invoice total ${invoiceTotal.toFixed(2)} (${(priceVariance * 100).toFixed(1)}% difference)`
    );
  }

  // 3. Compare received quantities (from GRNs) vs PO quantities
  const totalReceivedByItem: Record<string, number> = {};
  for (const grn of grns) {
    for (const grnItem of grn.items) {
      totalReceivedByItem[grnItem.poItemId] = (totalReceivedByItem[grnItem.poItemId] || 0) + grnItem.acceptedQty;
    }
  }

  for (const poItem of po.items) {
    const received = totalReceivedByItem[poItem.id] || 0;
    if (received < poItem.orderedQty) {
      discrepancies.push(
        `Quantity discrepancy for ${poItem.itemName}: ordered ${poItem.orderedQty}, received ${received}`
      );
    }
  }

  // Determine match status
  let matchStatus: InvoiceMatchStatus;
  if (discrepancies.length === 0) {
    matchStatus = 'MATCHED';
  } else if (discrepancies.some(d => d.includes('No approved GRN') || d.includes('Price variance'))) {
    matchStatus = 'DISCREPANCY';
  } else {
    matchStatus = 'PARTIAL_MATCH';
  }

  // Update invoice
  return prisma.supplierInvoice.update({
    where: { id: invoiceId },
    data: {
      matchStatus,
      matchedById,
      matchedAt: new Date(),
      discrepancyNotes: discrepancies.length > 0 ? discrepancies.join('; ') : null,
    },
    include: {
      supplier: { select: { id: true, companyName: true } },
      purchaseOrder: { select: { id: true, poNumber: true } },
    },
  });
}

// ==================== Payment ====================

export async function approveInvoiceForPayment(hospitalId: string, invoiceId: string) {
  const invoice = await prisma.supplierInvoice.findFirst({
    where: { id: invoiceId, hospitalId },
  });

  if (!invoice) throw new NotFoundError('Invoice not found');
  if (invoice.matchStatus !== 'MATCHED' && invoice.matchStatus !== 'PARTIAL_MATCH') {
    throw new AppError('Invoice must be matched before approval. Current status: ' + invoice.matchStatus, 400);
  }

  return prisma.supplierInvoice.update({
    where: { id: invoiceId },
    data: { paymentStatus: 'APPROVED_PAYMENT' },
  });
}

export async function recordPayment(hospitalId: string, invoiceId: string, amount: number) {
  const invoice = await prisma.supplierInvoice.findFirst({
    where: { id: invoiceId, hospitalId },
  });

  if (!invoice) throw new NotFoundError('Invoice not found');

  const newPaidAmount = Number(invoice.paidAmount) + amount;
  const totalAmount = Number(invoice.totalAmount);

  let paymentStatus: InvoicePaymentStatus;
  if (newPaidAmount >= totalAmount) {
    paymentStatus = 'PAID_INV';
  } else if (newPaidAmount > 0) {
    paymentStatus = 'PARTIALLY_PAID_INV';
  } else {
    paymentStatus = 'PENDING';
  }

  return prisma.supplierInvoice.update({
    where: { id: invoiceId },
    data: {
      paidAmount: newPaidAmount,
      paymentStatus,
      paidAt: paymentStatus === 'PAID_INV' ? new Date() : undefined,
    },
  });
}

export async function getOverdueInvoices(hospitalId: string) {
  return prisma.supplierInvoice.findMany({
    where: {
      hospitalId,
      paymentStatus: { in: ['PENDING', 'APPROVED_PAYMENT', 'PARTIALLY_PAID_INV'] },
      dueDate: { lt: new Date() },
    },
    include: {
      supplier: { select: { id: true, companyName: true, code: true } },
      purchaseOrder: { select: { id: true, poNumber: true } },
    },
    orderBy: { dueDate: 'asc' },
  });
}
