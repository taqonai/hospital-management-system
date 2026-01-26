import prisma from '../config/database';
import { NotFoundError, AppError } from '../middleware/errorHandler';
import { ReturnReason, ReturnStatus } from '@prisma/client';

// ==================== Supplier Returns ====================

export async function createReturn(hospitalId: string, createdById: string, data: {
  supplierId: string;
  poId?: string;
  grnId?: string;
  reason: ReturnReason;
  notes?: string;
  items: Array<{
    itemName: string;
    itemCode?: string;
    quantity: number;
    unitPrice: number;
    reason?: string;
  }>;
}) {
  // Generate return number
  const year = new Date().getFullYear();
  const hospital = await prisma.hospital.findUnique({
    where: { id: hospitalId },
    select: { code: true },
  });
  const count = await prisma.supplierReturn.count({
    where: { hospitalId, createdAt: { gte: new Date(`${year}-01-01`) } },
  });
  const seq = String(count + 1).padStart(5, '0');
  const returnNumber = `RET-${hospital?.code || 'HOS'}-${year}-${seq}`;

  const items = data.items.map(item => ({
    ...item,
    totalPrice: item.quantity * item.unitPrice,
  }));
  const totalAmount = items.reduce((sum, i) => sum + i.totalPrice, 0);

  return prisma.supplierReturn.create({
    data: {
      hospitalId,
      returnNumber,
      supplierId: data.supplierId,
      poId: data.poId,
      grnId: data.grnId,
      reason: data.reason,
      status: 'DRAFT_RETURN',
      totalAmount,
      notes: data.notes,
      createdById,
      items: {
        create: items,
      },
    },
    include: {
      items: true,
      supplier: { select: { id: true, companyName: true, code: true } },
    },
  });
}

export async function listReturns(hospitalId: string, params: {
  status?: ReturnStatus;
  supplierId?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const where: any = { hospitalId };

  if (params.status) where.status = params.status;
  if (params.supplierId) where.supplierId = params.supplierId;
  if (params.search) {
    where.OR = [
      { returnNumber: { contains: params.search, mode: 'insensitive' } },
      { supplier: { companyName: { contains: params.search, mode: 'insensitive' } } },
    ];
  }

  const page = params.page || 1;
  const limit = params.limit || 20;
  const skip = (page - 1) * limit;

  const [returns, total] = await Promise.all([
    prisma.supplierReturn.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        supplier: { select: { id: true, companyName: true, code: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.supplierReturn.count({ where }),
  ]);

  return { returns, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getReturnById(hospitalId: string, returnId: string) {
  const returnRecord = await prisma.supplierReturn.findFirst({
    where: { id: returnId, hospitalId },
    include: {
      items: true,
      supplier: { select: { id: true, companyName: true, code: true, email: true } },
    },
  });

  if (!returnRecord) throw new NotFoundError('Return not found');
  return returnRecord;
}

// ==================== Return Workflow ====================

export async function approveReturn(hospitalId: string, returnId: string, approvedById: string) {
  const returnRecord = await prisma.supplierReturn.findFirst({
    where: { id: returnId, hospitalId },
  });
  if (!returnRecord) throw new NotFoundError('Return not found');
  if (returnRecord.status !== 'DRAFT_RETURN' && returnRecord.status !== 'PENDING_APPROVAL_RETURN') {
    throw new AppError('Return is not in a state that can be approved', 400);
  }

  return prisma.supplierReturn.update({
    where: { id: returnId },
    data: {
      status: 'APPROVED_RETURN',
      approvedById,
      approvedAt: new Date(),
    },
    include: {
      items: true,
      supplier: { select: { id: true, companyName: true } },
    },
  });
}

export async function markReturnShipped(hospitalId: string, returnId: string) {
  const returnRecord = await prisma.supplierReturn.findFirst({
    where: { id: returnId, hospitalId },
  });
  if (!returnRecord) throw new NotFoundError('Return not found');
  if (returnRecord.status !== 'APPROVED_RETURN') {
    throw new AppError('Return must be approved before shipping', 400);
  }

  return prisma.supplierReturn.update({
    where: { id: returnId },
    data: {
      status: 'SHIPPED',
      shippedAt: new Date(),
    },
  });
}

export async function recordCreditNote(hospitalId: string, returnId: string, data: {
  creditNoteRef: string;
  creditAmount: number;
}) {
  const returnRecord = await prisma.supplierReturn.findFirst({
    where: { id: returnId, hospitalId },
  });
  if (!returnRecord) throw new NotFoundError('Return not found');
  if (returnRecord.status !== 'SHIPPED' && returnRecord.status !== 'APPROVED_RETURN') {
    throw new AppError('Return must be shipped or approved to record credit note', 400);
  }

  return prisma.supplierReturn.update({
    where: { id: returnId },
    data: {
      status: 'CREDIT_RECEIVED',
      creditNoteRef: data.creditNoteRef,
      creditAmount: data.creditAmount,
    },
    include: {
      items: true,
      supplier: { select: { id: true, companyName: true } },
    },
  });
}
