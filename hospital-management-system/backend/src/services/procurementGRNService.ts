import prisma from '../config/database';
import { NotFoundError, AppError } from '../middleware/errorHandler';
import { GRNStatus, InspectionStatus, ItemCondition } from '@prisma/client';

// ==================== GRN CRUD ====================

export async function createGRN(hospitalId: string, receivedById: string, data: {
  poId: string;
  deliveryNoteRef?: string;
  notes?: string;
  items: Array<{
    poItemId: string;
    receivedQty: number;
    acceptedQty: number;
    rejectedQty?: number;
    rejectionReason?: string;
    batchNumber?: string;
    expiryDate?: Date;
    manufacturingDate?: Date;
    storageLocation?: string;
    condition?: ItemCondition;
    notes?: string;
  }>;
}) {
  // Validate PO exists and is in correct status
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: data.poId, hospitalId },
    include: { items: true },
  });
  if (!po) throw new NotFoundError('Purchase order not found');
  if (!['APPROVED_PO', 'SENT_TO_SUPPLIER', 'PARTIALLY_RECEIVED'].includes(po.status)) {
    throw new AppError('PO is not in a receivable state', 400);
  }

  // Generate GRN number
  const year = new Date().getFullYear();
  const hospital = await prisma.hospital.findUnique({
    where: { id: hospitalId },
    select: { code: true },
  });
  const count = await prisma.goodsReceiptNote.count({
    where: { hospitalId, createdAt: { gte: new Date(`${year}-01-01`) } },
  });
  const seq = String(count + 1).padStart(5, '0');
  const grnNumber = `GRN-${hospital?.code || 'HOS'}-${year}-${seq}`;

  // Validate all poItemIds belong to this PO
  const poItemIds = new Set(po.items.map(i => i.id));
  for (const item of data.items) {
    if (!poItemIds.has(item.poItemId)) {
      throw new AppError(`PO item ${item.poItemId} does not belong to this PO`, 400);
    }
  }

  return prisma.goodsReceiptNote.create({
    data: {
      hospitalId,
      grnNumber,
      poId: data.poId,
      receivedById,
      status: 'DRAFT_GRN',
      deliveryNoteRef: data.deliveryNoteRef,
      notes: data.notes,
      items: {
        create: data.items.map(item => ({
          ...item,
          rejectedQty: item.rejectedQty || 0,
          condition: item.condition || 'GOOD',
        })),
      },
    },
    include: {
      items: {
        include: {
          poItem: { select: { id: true, itemName: true, orderedQty: true, unit: true } },
        },
      },
      purchaseOrder: { select: { id: true, poNumber: true } },
      receivedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

export async function listGRNs(hospitalId: string, params: {
  status?: GRNStatus;
  poId?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const where: any = { hospitalId };

  if (params.status) where.status = params.status;
  if (params.poId) where.poId = params.poId;
  if (params.search) {
    where.OR = [
      { grnNumber: { contains: params.search, mode: 'insensitive' } },
      { deliveryNoteRef: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  const page = params.page || 1;
  const limit = params.limit || 20;
  const skip = (page - 1) * limit;

  const [grns, total] = await Promise.all([
    prisma.goodsReceiptNote.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        purchaseOrder: {
          select: {
            id: true,
            poNumber: true,
            supplier: { select: { id: true, companyName: true } },
          },
        },
        receivedBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.goodsReceiptNote.count({ where }),
  ]);

  return { grns, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getGRNById(hospitalId: string, grnId: string) {
  const grn = await prisma.goodsReceiptNote.findFirst({
    where: { id: grnId, hospitalId },
    include: {
      items: {
        include: {
          poItem: {
            select: { id: true, itemName: true, itemCode: true, orderedQty: true, unit: true, itemType: true, itemReferenceId: true },
          },
        },
      },
      purchaseOrder: {
        select: {
          id: true,
          poNumber: true,
          supplier: { select: { id: true, companyName: true, code: true } },
        },
      },
      receivedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  if (!grn) throw new NotFoundError('GRN not found');
  return grn;
}

export async function updateGRN(hospitalId: string, grnId: string, data: {
  deliveryNoteRef?: string;
  notes?: string;
}) {
  const grn = await prisma.goodsReceiptNote.findFirst({
    where: { id: grnId, hospitalId },
  });
  if (!grn) throw new NotFoundError('GRN not found');
  if (grn.status !== 'DRAFT_GRN') {
    throw new AppError('Can only edit draft GRNs', 400);
  }

  return prisma.goodsReceiptNote.update({
    where: { id: grnId },
    data,
    include: {
      items: true,
      purchaseOrder: { select: { id: true, poNumber: true } },
    },
  });
}

// ==================== GRN Inspection ====================

export async function recordInspection(hospitalId: string, grnId: string, inspectedById: string, inspectionStatus: InspectionStatus) {
  const grn = await prisma.goodsReceiptNote.findFirst({
    where: { id: grnId, hospitalId },
  });
  if (!grn) throw new NotFoundError('GRN not found');

  return prisma.goodsReceiptNote.update({
    where: { id: grnId },
    data: {
      inspectedById,
      inspectedAt: new Date(),
      inspectionStatus,
      status: inspectionStatus === 'FAILED' ? 'REJECTED_GRN' : 'PENDING_INSPECTION',
    },
  });
}

// ==================== GRN Approval with Inventory Update ====================

export async function approveGRN(hospitalId: string, grnId: string) {
  const grn = await prisma.goodsReceiptNote.findFirst({
    where: { id: grnId, hospitalId },
    include: {
      items: {
        include: {
          poItem: true,
        },
      },
      purchaseOrder: {
        select: { id: true, supplierId: true },
      },
    },
  });

  if (!grn) throw new NotFoundError('GRN not found');
  if (grn.status === 'APPROVED_GRN') {
    throw new AppError('GRN is already approved', 400);
  }

  return prisma.$transaction(async (tx) => {
    // 1. Approve the GRN
    const approvedGRN = await tx.goodsReceiptNote.update({
      where: { id: grnId },
      data: { status: 'APPROVED_GRN' },
    });

    // 2. Update PO item received quantities
    for (const grnItem of grn.items) {
      await tx.pOItem.update({
        where: { id: grnItem.poItemId },
        data: {
          receivedQty: {
            increment: grnItem.acceptedQty,
          },
        },
      });
    }

    // 3. Update inventory based on item types
    for (const grnItem of grn.items) {
      const poItem = grnItem.poItem;
      if (!poItem || grnItem.acceptedQty <= 0) continue;

      switch (poItem.itemType) {
        case 'DRUG': {
          // Create new DrugInventory batch
          if (poItem.itemReferenceId) {
            await tx.drugInventory.create({
              data: {
                drugId: poItem.itemReferenceId,
                batchNumber: grnItem.batchNumber || `BATCH-${Date.now()}`,
                quantity: grnItem.acceptedQty,
                expiryDate: grnItem.expiryDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                location: grnItem.storageLocation || 'Main Pharmacy',
                costPrice: Number(poItem.unitPrice),
                sellingPrice: Number(poItem.unitPrice) * 1.2, // Default 20% markup
                supplierId: grn.purchaseOrder.supplierId,
                receivedDate: new Date(),
              },
            });
          }
          break;
        }

        case 'INVENTORY': {
          // Update InventoryItem quantity
          if (poItem.itemReferenceId) {
            await tx.inventoryItem.update({
              where: { id: poItem.itemReferenceId },
              data: {
                quantity: { increment: grnItem.acceptedQty },
                costPrice: Number(poItem.unitPrice),
              },
            });
          }
          break;
        }

        case 'HOUSEKEEPING_ITEM': {
          // Update HousekeepingInventory currentStock
          if (poItem.itemReferenceId) {
            await tx.housekeepingInventory.update({
              where: { id: poItem.itemReferenceId },
              data: {
                currentStock: { increment: grnItem.acceptedQty },
                lastRestocked: new Date(),
                costPerUnit: Number(poItem.unitPrice),
              },
            });
          }
          break;
        }

        // LAB_CONSUMABLE, ASSET, OTHER - no automatic inventory update
        default:
          break;
      }
    }

    // 4. Check if PO is fully received
    const poItems = await tx.pOItem.findMany({
      where: { poId: grn.poId },
    });
    const allReceived = poItems.every(item => item.receivedQty >= item.orderedQty);
    const someReceived = poItems.some(item => item.receivedQty > 0);

    if (allReceived) {
      await tx.purchaseOrder.update({
        where: { id: grn.poId },
        data: {
          status: 'FULLY_RECEIVED',
          deliveryDate: new Date(),
        },
      });
    } else if (someReceived) {
      await tx.purchaseOrder.update({
        where: { id: grn.poId },
        data: { status: 'PARTIALLY_RECEIVED' },
      });
    }

    // 5. Increment supplier total orders
    await tx.supplier.update({
      where: { id: grn.purchaseOrder.supplierId },
      data: { totalOrders: { increment: 1 } },
    });

    return approvedGRN;
  });
}
