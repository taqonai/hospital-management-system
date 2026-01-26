import prisma from '../config/database';
import { NotFoundError } from '../middleware/errorHandler';
import { SupplierCategory, SupplierClassification, SupplierStatus, SupplierDocType, PaymentTerms } from '@prisma/client';

// ==================== Supplier CRUD ====================

export async function createSupplier(hospitalId: string, data: {
  companyName: string;
  category: SupplierCategory;
  contactPerson: string;
  email: string;
  phone: string;
  addressLine1: string;
  city: string;
  country?: string;
  classification?: SupplierClassification;
  tradeLicenseNo?: string;
  taxRegistrationNo?: string;
  website?: string;
  addressLine2?: string;
  state?: string;
  postalCode?: string;
  bankName?: string;
  bankAccountNo?: string;
  iban?: string;
  swiftCode?: string;
  paymentTerms?: PaymentTerms;
  creditLimit?: number;
  currency?: string;
  leadTimeDays?: number;
  notes?: string;
  contacts?: Array<{
    name: string;
    designation?: string;
    email?: string;
    phone?: string;
    isPrimary?: boolean;
  }>;
}) {
  // Auto-generate supplier code
  const lastSupplier = await prisma.supplier.findFirst({
    where: { hospitalId },
    orderBy: { createdAt: 'desc' },
    select: { code: true },
  });

  let nextNum = 1;
  if (lastSupplier?.code) {
    const match = lastSupplier.code.match(/SUP-(\d+)/);
    if (match) nextNum = parseInt(match[1]) + 1;
  }
  const code = `SUP-${String(nextNum).padStart(4, '0')}`;

  const { contacts, ...supplierData } = data;

  return prisma.supplier.create({
    data: {
      ...supplierData,
      hospitalId,
      code,
      contacts: contacts?.length ? {
        create: contacts,
      } : undefined,
    },
    include: {
      contacts: true,
      documents: true,
    },
  });
}

export async function listSuppliers(hospitalId: string, params: {
  search?: string;
  category?: SupplierCategory;
  status?: SupplierStatus;
  classification?: SupplierClassification;
  isBlacklisted?: boolean;
  page?: number;
  limit?: number;
}) {
  const where: any = { hospitalId };

  if (params.search) {
    where.OR = [
      { companyName: { contains: params.search, mode: 'insensitive' } },
      { code: { contains: params.search, mode: 'insensitive' } },
      { contactPerson: { contains: params.search, mode: 'insensitive' } },
      { email: { contains: params.search, mode: 'insensitive' } },
    ];
  }
  if (params.category) where.category = params.category;
  if (params.status) where.status = params.status;
  if (params.classification) where.classification = params.classification;
  if (params.isBlacklisted !== undefined) where.isBlacklisted = params.isBlacklisted;

  const page = params.page || 1;
  const limit = params.limit || 20;
  const skip = (page - 1) * limit;

  const [suppliers, total] = await Promise.all([
    prisma.supplier.findMany({
      where,
      skip,
      take: limit,
      orderBy: { companyName: 'asc' },
      include: {
        contacts: { where: { isPrimary: true }, take: 1 },
        _count: { select: { purchaseOrders: true } },
      },
    }),
    prisma.supplier.count({ where }),
  ]);

  return { suppliers, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getSupplierById(hospitalId: string, supplierId: string) {
  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, hospitalId },
    include: {
      contacts: true,
      documents: true,
      contracts: { where: { status: 'ACTIVE' } },
      _count: {
        select: {
          purchaseOrders: true,
          invoices: true,
          returns: true,
        },
      },
    },
  });

  if (!supplier) throw new NotFoundError('Supplier not found');
  return supplier;
}

export async function updateSupplier(hospitalId: string, supplierId: string, data: {
  companyName?: string;
  category?: SupplierCategory;
  classification?: SupplierClassification;
  contactPerson?: string;
  email?: string;
  phone?: string;
  website?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  bankName?: string;
  bankAccountNo?: string;
  iban?: string;
  swiftCode?: string;
  paymentTerms?: PaymentTerms;
  creditLimit?: number;
  currency?: string;
  leadTimeDays?: number;
  notes?: string;
  tradeLicenseNo?: string;
  taxRegistrationNo?: string;
}) {
  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, hospitalId },
  });
  if (!supplier) throw new NotFoundError('Supplier not found');

  return prisma.supplier.update({
    where: { id: supplierId },
    data,
    include: { contacts: true, documents: true },
  });
}

export async function deactivateSupplier(hospitalId: string, supplierId: string) {
  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, hospitalId },
  });
  if (!supplier) throw new NotFoundError('Supplier not found');

  return prisma.supplier.update({
    where: { id: supplierId },
    data: { status: 'SUSPENDED' },
  });
}

// ==================== Supplier Contacts ====================

export async function addContact(supplierId: string, data: {
  name: string;
  designation?: string;
  email?: string;
  phone?: string;
  isPrimary?: boolean;
}) {
  if (data.isPrimary) {
    // Unset other primary contacts
    await prisma.supplierContact.updateMany({
      where: { supplierId, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  return prisma.supplierContact.create({
    data: { ...data, supplierId },
  });
}

export async function removeContact(contactId: string) {
  return prisma.supplierContact.delete({
    where: { id: contactId },
  });
}

// ==================== Supplier Documents ====================

export async function addDocument(supplierId: string, data: {
  type: SupplierDocType;
  name: string;
  filePath: string;
  expiryDate?: Date;
}) {
  return prisma.supplierDocument.create({
    data: { ...data, supplierId },
  });
}

export async function verifyDocument(documentId: string) {
  return prisma.supplierDocument.update({
    where: { id: documentId },
    data: { isVerified: true },
  });
}

export async function getExpiringDocuments(hospitalId: string, days: number = 30) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);

  return prisma.supplierDocument.findMany({
    where: {
      supplier: { hospitalId },
      expiryDate: { lte: futureDate, gt: new Date() },
    },
    include: {
      supplier: { select: { id: true, companyName: true, code: true } },
    },
    orderBy: { expiryDate: 'asc' },
  });
}

// ==================== Supplier Performance ====================

export async function getSupplierPerformance(hospitalId: string, supplierId: string) {
  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, hospitalId },
    select: {
      id: true,
      companyName: true,
      code: true,
      rating: true,
      deliveryScore: true,
      qualityScore: true,
      priceScore: true,
      totalOrders: true,
    },
  });

  if (!supplier) throw new NotFoundError('Supplier not found');

  // Get recent POs for delivery analysis
  const recentPOs = await prisma.purchaseOrder.findMany({
    where: {
      hospitalId,
      supplierId,
      status: { in: ['FULLY_RECEIVED', 'CLOSED_PO'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      expectedDate: true,
      deliveryDate: true,
      totalAmount: true,
    },
  });

  // Calculate on-time delivery rate
  let onTimeCount = 0;
  let totalDelivered = 0;
  for (const po of recentPOs) {
    if (po.deliveryDate) {
      totalDelivered++;
      if (po.expectedDate && po.deliveryDate <= po.expectedDate) {
        onTimeCount++;
      }
    }
  }

  const onTimeRate = totalDelivered > 0 ? (onTimeCount / totalDelivered) * 100 : 0;

  // Get GRN rejection stats
  const grnStats = await prisma.gRNItem.aggregate({
    where: {
      grn: {
        purchaseOrder: { hospitalId, supplierId },
      },
    },
    _sum: {
      receivedQty: true,
      rejectedQty: true,
    },
  });

  const totalReceived = Number(grnStats._sum.receivedQty || 0);
  const totalRejected = Number(grnStats._sum.rejectedQty || 0);
  const qualityRate = totalReceived > 0 ? ((totalReceived - totalRejected) / totalReceived) * 100 : 100;

  return {
    supplier,
    metrics: {
      onTimeDeliveryRate: Math.round(onTimeRate * 100) / 100,
      qualityAcceptanceRate: Math.round(qualityRate * 100) / 100,
      totalDelivered,
      totalRejected,
      recentOrders: recentPOs.length,
    },
  };
}

export async function updatePerformanceScores(hospitalId: string, supplierId: string, scores: {
  deliveryScore?: number;
  qualityScore?: number;
  priceScore?: number;
}) {
  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, hospitalId },
  });
  if (!supplier) throw new NotFoundError('Supplier not found');

  const deliveryScore = scores.deliveryScore ?? Number(supplier.deliveryScore);
  const qualityScore = scores.qualityScore ?? Number(supplier.qualityScore);
  const priceScore = scores.priceScore ?? Number(supplier.priceScore);

  // Composite rating: 40% delivery, 35% quality, 25% price
  const rating = (deliveryScore * 0.4) + (qualityScore * 0.35) + (priceScore * 0.25);

  return prisma.supplier.update({
    where: { id: supplierId },
    data: {
      deliveryScore,
      qualityScore,
      priceScore,
      rating: Math.round(rating * 100) / 100,
    },
  });
}

// ==================== Blacklisting ====================

export async function blacklistSupplier(hospitalId: string, supplierId: string, reason: string) {
  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, hospitalId },
  });
  if (!supplier) throw new NotFoundError('Supplier not found');

  return prisma.supplier.update({
    where: { id: supplierId },
    data: {
      isBlacklisted: true,
      blacklistReason: reason,
      status: 'BLACKLISTED',
    },
  });
}

export async function unblacklistSupplier(hospitalId: string, supplierId: string) {
  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, hospitalId },
  });
  if (!supplier) throw new NotFoundError('Supplier not found');

  return prisma.supplier.update({
    where: { id: supplierId },
    data: {
      isBlacklisted: false,
      blacklistReason: null,
      status: 'APPROVED',
    },
  });
}
