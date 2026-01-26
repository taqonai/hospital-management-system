import prisma from '../config/database';
import { NotFoundError, AppError } from '../middleware/errorHandler';
import { POType, POStatus, PaymentTerms, ProcurementItemType, ApprovalStatus } from '@prisma/client';

// Helper function to create notification
async function createNotification(userId: string, title: string, message: string, data?: any) {
  try {
    await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type: 'SYSTEM',
        data,
        isRead: false,
      },
    });
  } catch (error) {
    console.error('[NOTIFICATION] Failed to create notification:', error);
    // Don't throw - notification failure shouldn't block main operation
  }
}

// ==================== Purchase Order CRUD ====================

export async function createPO(hospitalId: string, createdById: string, data: {
  supplierId: string;
  prId?: string;
  type?: POType;
  expectedDate?: Date;
  paymentTerms?: PaymentTerms;
  shippingTerms?: string;
  deliveryAddress?: string;
  specialInstructions?: string;
  discount?: number;
  tax?: number;
  notes?: string;
  items: Array<{
    prItemId?: string;
    itemType: ProcurementItemType;
    itemReferenceId?: string;
    itemName: string;
    itemCode?: string;
    unit: string;
    orderedQty: number;
    unitPrice: number;
    notes?: string;
  }>;
}) {
  // Generate PO number
  const year = new Date().getFullYear();
  const hospital = await prisma.hospital.findUnique({
    where: { id: hospitalId },
    select: { code: true },
  });

  const count = await prisma.purchaseOrder.count({
    where: { hospitalId, createdAt: { gte: new Date(`${year}-01-01`) } },
  });
  const seq = String(count + 1).padStart(5, '0');
  const poNumber = `PO-${hospital?.code || 'HOS'}-${year}-${seq}`;

  // Check for active contracts with this supplier
  const activeContracts = await prisma.supplierContract.findMany({
    where: {
      hospitalId,
      supplierId: data.supplierId,
      status: 'ACTIVE',
      startDate: { lte: new Date() },
      endDate: { gte: new Date() },
    },
    include: {
      contractItems: true,
    },
  });

  // Build a map of contracted rates by itemCode and itemName
  const contractRatesMap = new Map<string, number>();
  for (const contract of activeContracts) {
    for (const contractItem of contract.contractItems) {
      // Map by both code and name for flexible matching
      if (contractItem.itemCode) {
        contractRatesMap.set(contractItem.itemCode.toLowerCase(), Number(contractItem.agreedPrice));
      }
      contractRatesMap.set(contractItem.itemName.toLowerCase(), Number(contractItem.agreedPrice));
    }
  }

  // Calculate amounts and apply contract rates where available
  const items = data.items.map(item => {
    let unitPrice = item.unitPrice;

    // Try to find contracted rate
    const codeMatch = item.itemCode ? contractRatesMap.get(item.itemCode.toLowerCase()) : undefined;
    const nameMatch = contractRatesMap.get(item.itemName.toLowerCase());
    const contractRate = codeMatch || nameMatch;

    if (contractRate) {
      unitPrice = contractRate;
      console.log(`[PO] Applied contract rate ${contractRate} for item ${item.itemName}`);
    }

    return {
      ...item,
      unitPrice,
      totalPrice: item.orderedQty * unitPrice,
    };
  });
  const subtotal = items.reduce((sum, i) => sum + i.totalPrice, 0);
  const discount = data.discount || 0;
  const tax = data.tax || 0;
  const totalAmount = subtotal - discount + tax;

  return prisma.purchaseOrder.create({
    data: {
      hospitalId,
      poNumber,
      supplierId: data.supplierId,
      prId: data.prId,
      type: data.type || 'STANDARD',
      status: 'DRAFT_PO',
      expectedDate: data.expectedDate,
      paymentTerms: data.paymentTerms || 'NET_30',
      shippingTerms: data.shippingTerms,
      deliveryAddress: data.deliveryAddress,
      specialInstructions: data.specialInstructions,
      subtotal,
      discount,
      tax,
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
      requisition: { select: { id: true, prNumber: true } },
    },
  });
}

export async function listPOs(hospitalId: string, params: {
  status?: POStatus;
  supplierId?: string;
  type?: POType;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
}) {
  const where: any = { hospitalId };

  if (params.status) where.status = params.status;
  if (params.supplierId) where.supplierId = params.supplierId;
  if (params.type) where.type = params.type;
  if (params.search) {
    where.OR = [
      { poNumber: { contains: params.search, mode: 'insensitive' } },
      { supplier: { companyName: { contains: params.search, mode: 'insensitive' } } },
    ];
  }
  if (params.dateFrom || params.dateTo) {
    where.orderDate = {};
    if (params.dateFrom) where.orderDate.gte = params.dateFrom;
    if (params.dateTo) where.orderDate.lte = params.dateTo;
  }

  const page = params.page || 1;
  const limit = params.limit || 20;
  const skip = (page - 1) * limit;

  const [orders, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        supplier: { select: { id: true, companyName: true, code: true } },
        _count: { select: { items: true, grns: true } },
      },
    }),
    prisma.purchaseOrder.count({ where }),
  ]);

  return { orders, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getPOById(hospitalId: string, poId: string) {
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: poId, hospitalId },
    include: {
      items: {
        include: {
          prItem: { select: { id: true, itemName: true } },
          grnItems: { select: { id: true, receivedQty: true, acceptedQty: true, rejectedQty: true } },
        },
      },
      supplier: {
        select: { id: true, companyName: true, code: true, email: true, phone: true, contactPerson: true },
      },
      requisition: { select: { id: true, prNumber: true, status: true } },
      grns: { select: { id: true, grnNumber: true, status: true, receiptDate: true } },
      invoices: { select: { id: true, invoiceNumber: true, totalAmount: true, matchStatus: true } },
      approvals: {
        include: {
          approver: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { level: 'asc' },
      },
    },
  });

  if (!po) throw new NotFoundError('Purchase order not found');
  return po;
}

export async function updatePO(hospitalId: string, poId: string, data: {
  expectedDate?: Date;
  paymentTerms?: PaymentTerms;
  shippingTerms?: string;
  deliveryAddress?: string;
  specialInstructions?: string;
  discount?: number;
  tax?: number;
  notes?: string;
}) {
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: poId, hospitalId },
  });
  if (!po) throw new NotFoundError('Purchase order not found');
  if (po.status !== 'DRAFT_PO') {
    throw new AppError('Can only edit draft purchase orders', 400);
  }

  const updateData: any = { ...data };

  // Recalculate total if discount/tax changed
  if (data.discount !== undefined || data.tax !== undefined) {
    const subtotal = Number(po.subtotal);
    const discount = data.discount ?? Number(po.discount);
    const tax = data.tax ?? Number(po.tax);
    updateData.totalAmount = subtotal - discount + tax;
  }

  return prisma.purchaseOrder.update({
    where: { id: poId },
    data: updateData,
    include: {
      items: true,
      supplier: { select: { id: true, companyName: true, code: true } },
    },
  });
}

// ==================== PO Workflow ====================

export async function submitPO(hospitalId: string, poId: string) {
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: poId, hospitalId },
    include: { items: true },
  });
  if (!po) throw new NotFoundError('Purchase order not found');
  if (po.status !== 'DRAFT_PO') {
    throw new AppError('Can only submit draft purchase orders', 400);
  }
  if (!po.items.length) {
    throw new AppError('Cannot submit purchase order with no items', 400);
  }

  return prisma.$transaction(async (tx) => {
    const workflow = await tx.approvalWorkflow.findFirst({
      where: { hospitalId, type: 'PO_WORKFLOW', isActive: true },
      include: { levels: { orderBy: { level: 'asc' } } },
    });

    const approverIds: string[] = [];
    if (workflow?.levels.length) {
      for (const level of workflow.levels) {
        if (level.approverId) {
          await tx.pOApproval.create({
            data: {
              poId,
              approverId: level.approverId,
              level: level.level,
              status: 'PENDING_APPROVAL_STATUS',
            },
          });
          approverIds.push(level.approverId);
        }
      }
    }

    const updated = await tx.purchaseOrder.update({
      where: { id: poId },
      data: { status: 'PENDING_APPROVAL_PO' },
      include: {
        items: true,
        supplier: { select: { id: true, companyName: true, code: true } },
      },
    });

    // Send notifications to approvers
    for (const approverId of approverIds) {
      await createNotification(
        approverId,
        'New Purchase Order for Approval',
        `Purchase Order ${po.poNumber} has been submitted and requires your approval.`,
        { poId, poNumber: po.poNumber, action: 'PO_SUBMITTED' }
      );
    }

    return updated;
  });
}

export async function approvePO(hospitalId: string, poId: string, approverId: string, comments?: string) {
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: poId, hospitalId },
    include: { approvals: true },
  });
  if (!po) throw new NotFoundError('Purchase order not found');
  if (po.status !== 'PENDING_APPROVAL_PO') {
    throw new AppError('Purchase order is not pending approval', 400);
  }

  return prisma.$transaction(async (tx) => {
    const existingApproval = po.approvals.find(a => a.approverId === approverId);
    if (existingApproval) {
      await tx.pOApproval.update({
        where: { id: existingApproval.id },
        data: { status: 'APPROVED_STATUS', comments, actedAt: new Date() },
      });
    } else {
      await tx.pOApproval.create({
        data: {
          poId,
          approverId,
          level: 1,
          status: 'APPROVED_STATUS',
          comments,
          actedAt: new Date(),
        },
      });
    }

    const pendingApprovals = await tx.pOApproval.count({
      where: { poId, status: 'PENDING_APPROVAL_STATUS' },
    });

    const newStatus = pendingApprovals === 0 ? 'APPROVED_PO' : 'PENDING_APPROVAL_PO';

    const updated = await tx.purchaseOrder.update({
      where: { id: poId },
      data: {
        status: newStatus as POStatus,
        ...(newStatus === 'APPROVED_PO' ? {
          approvedAt: new Date(),
          approvedById: approverId,
        } : {}),
      },
      include: {
        items: true,
        supplier: { select: { id: true, companyName: true, code: true } },
      },
    });

    // Send notification to creator when fully approved
    if (newStatus === 'APPROVED_PO') {
      const approver = await tx.user.findUnique({
        where: { id: approverId },
        select: { firstName: true, lastName: true },
      });
      const approverName = approver ? `${approver.firstName} ${approver.lastName}` : 'Admin';

      await createNotification(
        po.createdById,
        'Purchase Order Approved',
        `Purchase Order ${po.poNumber} has been approved by ${approverName}.`,
        { poId, poNumber: po.poNumber, action: 'PO_APPROVED' }
      );
    }

    // Update PR status if linked
    if (updated.prId && newStatus === 'APPROVED_PO') {
      // Check if all items from the PR are now ordered
      const prItems = await tx.pRItem.findMany({ where: { prId: updated.prId } });
      const orderedPRItemIds = await tx.pOItem.findMany({
        where: {
          purchaseOrder: { prId: updated.prId, status: { notIn: ['CANCELLED_PO', 'DRAFT_PO'] } },
          prItemId: { not: null },
        },
        select: { prItemId: true },
      });

      const orderedIds = new Set(orderedPRItemIds.map(i => i.prItemId));
      const allOrdered = prItems.every(item => orderedIds.has(item.id));

      await tx.purchaseRequisition.update({
        where: { id: updated.prId },
        data: { status: allOrdered ? 'FULLY_ORDERED' : 'PARTIALLY_ORDERED' },
      });
    }

    return updated;
  });
}

export async function sendPOToSupplier(hospitalId: string, poId: string) {
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: poId, hospitalId },
  });
  if (!po) throw new NotFoundError('Purchase order not found');
  if (po.status !== 'APPROVED_PO') {
    throw new AppError('PO must be approved before sending to supplier', 400);
  }

  // TODO: Integrate email service to send PO PDF to supplier
  return prisma.purchaseOrder.update({
    where: { id: poId },
    data: { status: 'SENT_TO_SUPPLIER' },
    include: {
      items: true,
      supplier: { select: { id: true, companyName: true, code: true, email: true } },
    },
  });
}

export async function cancelPO(hospitalId: string, poId: string, cancelledById: string, reason: string) {
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: poId, hospitalId },
  });
  if (!po) throw new NotFoundError('Purchase order not found');
  if (po.status === 'FULLY_RECEIVED' || po.status === 'CLOSED_PO' || po.status === 'CANCELLED_PO') {
    throw new AppError('Cannot cancel this purchase order', 400);
  }

  return prisma.purchaseOrder.update({
    where: { id: poId },
    data: {
      status: 'CANCELLED_PO',
      cancelledAt: new Date(),
      cancelledById,
      cancellationReason: reason,
    },
  });
}

export async function amendPO(hospitalId: string, poId: string, createdById: string, changes: {
  items?: Array<{
    prItemId?: string;
    itemType: ProcurementItemType;
    itemReferenceId?: string;
    itemName: string;
    itemCode?: string;
    unit: string;
    orderedQty: number;
    unitPrice: number;
    notes?: string;
  }>;
  expectedDate?: Date;
  discount?: number;
  tax?: number;
  notes?: string;
}) {
  const originalPO = await prisma.purchaseOrder.findFirst({
    where: { id: poId, hospitalId },
    include: { items: true },
  });
  if (!originalPO) throw new NotFoundError('Purchase order not found');
  if (originalPO.status === 'CANCELLED_PO' || originalPO.status === 'CLOSED_PO') {
    throw new AppError('Cannot amend a cancelled or closed PO', 400);
  }

  // Mark original as amended
  await prisma.purchaseOrder.update({
    where: { id: poId },
    data: { status: 'AMENDED', isAmended: true },
  });

  // Create new version
  const items = (changes.items || originalPO.items.map(i => ({
    prItemId: i.prItemId,
    itemType: i.itemType,
    itemReferenceId: i.itemReferenceId,
    itemName: i.itemName,
    itemCode: i.itemCode,
    unit: i.unit,
    orderedQty: i.orderedQty,
    unitPrice: Number(i.unitPrice),
    notes: i.notes,
  }))).map(item => ({
    ...item,
    totalPrice: item.orderedQty * item.unitPrice,
  }));

  const subtotal = items.reduce((sum, i) => sum + i.totalPrice, 0);
  const discount = changes.discount ?? Number(originalPO.discount);
  const tax = changes.tax ?? Number(originalPO.tax);
  const totalAmount = subtotal - discount + tax;

  // Generate new PO number with version
  const newVersion = originalPO.version + 1;
  const poNumber = `${originalPO.poNumber}-V${newVersion}`;

  return prisma.purchaseOrder.create({
    data: {
      hospitalId,
      poNumber,
      supplierId: originalPO.supplierId,
      prId: originalPO.prId,
      type: originalPO.type,
      status: 'DRAFT_PO',
      expectedDate: changes.expectedDate || originalPO.expectedDate,
      paymentTerms: originalPO.paymentTerms,
      shippingTerms: originalPO.shippingTerms,
      deliveryAddress: originalPO.deliveryAddress,
      specialInstructions: originalPO.specialInstructions,
      subtotal,
      discount,
      tax,
      totalAmount,
      notes: changes.notes || originalPO.notes,
      createdById,
      version: newVersion,
      isAmended: false,
      parentPOId: originalPO.id,
      items: { create: items },
    },
    include: {
      items: true,
      supplier: { select: { id: true, companyName: true, code: true } },
    },
  });
}

// ==================== PO PDF Generation ====================

export async function generatePOPdf(hospitalId: string, poId: string) {
  const po = await getPOById(hospitalId, poId);

  // Get hospital details
  const hospital = await prisma.hospital.findUnique({
    where: { id: hospitalId },
    select: { name: true, address: true, phone: true, email: true, code: true },
  });

  // Generate HTML that can be converted to PDF on frontend or via puppeteer
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Purchase Order - ${po.poNumber}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 40px;
      color: #333;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      border-bottom: 3px solid #2563eb;
      padding-bottom: 20px;
    }
    .header h1 {
      margin: 0;
      color: #2563eb;
      font-size: 28px;
    }
    .header p {
      margin: 5px 0;
      color: #666;
    }
    .section {
      margin-bottom: 25px;
    }
    .section-title {
      font-weight: bold;
      font-size: 16px;
      margin-bottom: 10px;
      color: #2563eb;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 5px;
    }
    .info-row {
      display: flex;
      margin-bottom: 8px;
    }
    .info-label {
      font-weight: bold;
      width: 150px;
    }
    .info-value {
      flex: 1;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
    }
    th {
      background-color: #2563eb;
      color: white;
      padding: 12px;
      text-align: left;
      font-weight: bold;
    }
    td {
      padding: 10px;
      border-bottom: 1px solid #e5e7eb;
    }
    tr:nth-child(even) {
      background-color: #f9fafb;
    }
    .text-right {
      text-align: right;
    }
    .totals {
      margin-top: 20px;
      float: right;
      width: 300px;
    }
    .totals table {
      margin-top: 0;
    }
    .totals td {
      padding: 8px;
    }
    .totals .total-row {
      font-weight: bold;
      font-size: 16px;
      background-color: #2563eb;
      color: white;
    }
    .footer {
      clear: both;
      margin-top: 50px;
      padding-top: 20px;
      border-top: 2px solid #e5e7eb;
      font-size: 12px;
      color: #666;
    }
    .status-badge {
      display: inline-block;
      padding: 5px 15px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: bold;
      margin-left: 10px;
    }
    .status-approved {
      background-color: #10b981;
      color: white;
    }
    .status-pending {
      background-color: #f59e0b;
      color: white;
    }
    .status-draft {
      background-color: #6b7280;
      color: white;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${hospital?.name || 'Hospital'}</h1>
    <p>${hospital?.address || ''}</p>
    <p>Phone: ${hospital?.phone || ''} | Email: ${hospital?.email || ''}</p>
  </div>

  <div class="section">
    <div class="section-title">Purchase Order Details</div>
    <div class="info-row">
      <div class="info-label">PO Number:</div>
      <div class="info-value">
        ${po.poNumber}
        <span class="status-badge status-${po.status.toLowerCase().replace('_', '-')}">${po.status.replace(/_/g, ' ')}</span>
      </div>
    </div>
    <div class="info-row">
      <div class="info-label">Order Date:</div>
      <div class="info-value">${new Date(po.orderDate).toLocaleDateString()}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Expected Delivery:</div>
      <div class="info-value">${po.expectedDate ? new Date(po.expectedDate).toLocaleDateString() : 'N/A'}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Payment Terms:</div>
      <div class="info-value">${po.paymentTerms.replace(/_/g, ' ')}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Supplier Information</div>
    <div class="info-row">
      <div class="info-label">Company:</div>
      <div class="info-value">${po.supplier.companyName}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Contact Person:</div>
      <div class="info-value">${po.supplier.contactPerson || 'N/A'}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Email:</div>
      <div class="info-value">${po.supplier.email || 'N/A'}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Phone:</div>
      <div class="info-value">${po.supplier.phone || 'N/A'}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Line Items</div>
    <table>
      <thead>
        <tr>
          <th>Item Code</th>
          <th>Item Name</th>
          <th>Unit</th>
          <th class="text-right">Quantity</th>
          <th class="text-right">Unit Price</th>
          <th class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${po.items.map(item => `
        <tr>
          <td>${item.itemCode || 'N/A'}</td>
          <td>${item.itemName}</td>
          <td>${item.unit}</td>
          <td class="text-right">${item.orderedQty}</td>
          <td class="text-right">${Number(item.unitPrice).toFixed(2)}</td>
          <td class="text-right">${Number(item.totalPrice).toFixed(2)}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="totals">
    <table>
      <tr>
        <td>Subtotal:</td>
        <td class="text-right">${Number(po.subtotal).toFixed(2)}</td>
      </tr>
      <tr>
        <td>Discount:</td>
        <td class="text-right">-${Number(po.discount).toFixed(2)}</td>
      </tr>
      <tr>
        <td>Tax:</td>
        <td class="text-right">${Number(po.tax).toFixed(2)}</td>
      </tr>
      <tr class="total-row">
        <td>Total Amount:</td>
        <td class="text-right">${Number(po.totalAmount).toFixed(2)}</td>
      </tr>
    </table>
  </div>

  ${po.deliveryAddress ? `
  <div class="section" style="clear: both;">
    <div class="section-title">Delivery Address</div>
    <p>${po.deliveryAddress}</p>
  </div>
  ` : ''}

  ${po.specialInstructions ? `
  <div class="section">
    <div class="section-title">Special Instructions</div>
    <p>${po.specialInstructions}</p>
  </div>
  ` : ''}

  ${po.notes ? `
  <div class="section">
    <div class="section-title">Notes</div>
    <p>${po.notes}</p>
  </div>
  ` : ''}

  ${po.approvals && po.approvals.length > 0 ? `
  <div class="section">
    <div class="section-title">Approval History</div>
    <table>
      <thead>
        <tr>
          <th>Level</th>
          <th>Approver</th>
          <th>Status</th>
          <th>Date</th>
          <th>Comments</th>
        </tr>
      </thead>
      <tbody>
        ${po.approvals.map(approval => `
        <tr>
          <td>${approval.level}</td>
          <td>${approval.approver.firstName} ${approval.approver.lastName}</td>
          <td>${approval.status.replace(/_/g, ' ')}</td>
          <td>${approval.actedAt ? new Date(approval.actedAt).toLocaleDateString() : 'Pending'}</td>
          <td>${approval.comments || '-'}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  ` : ''}

  <div class="footer">
    <p>This is a computer-generated document. No signature is required.</p>
    <p>Generated on: ${new Date().toLocaleString()}</p>
    <p>Purchase Order Reference: ${po.poNumber}</p>
  </div>
</body>
</html>
  `;

  return {
    message: 'PO PDF HTML generated successfully',
    html,
    data: {
      poNumber: po.poNumber,
      supplier: po.supplier,
      items: po.items.map(i => ({
        itemName: i.itemName,
        itemCode: i.itemCode,
        unit: i.unit,
        quantity: i.orderedQty,
        unitPrice: Number(i.unitPrice),
        total: Number(i.totalPrice),
      })),
      subtotal: Number(po.subtotal),
      discount: Number(po.discount),
      tax: Number(po.tax),
      totalAmount: Number(po.totalAmount),
      paymentTerms: po.paymentTerms,
      expectedDate: po.expectedDate,
      notes: po.notes,
      generatedAt: new Date().toISOString(),
    },
  };
}
