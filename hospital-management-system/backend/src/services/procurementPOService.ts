import prisma from '../config/database';
import { NotFoundError, AppError } from '../middleware/errorHandler';
import { POType, POStatus, PaymentTerms, ProcurementItemType, ApprovalStatus } from '@prisma/client';
import { sendEmail } from './emailService';

// Helper function to create notification and send email
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

// Helper function to send email notification
async function sendEmailNotification(userId: string, subject: string, htmlContent: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true, lastName: true },
    });

    if (user?.email) {
      await sendEmail({
        to: user.email,
        subject,
        html: htmlContent,
        text: htmlContent.replace(/<[^>]*>/g, ''), // Strip HTML for plain text version
      });
      console.log(`[EMAIL] Sent to ${user.email}: ${subject}`);
    }
  } catch (error) {
    console.error('[EMAIL] Failed to send email:', error);
    // Don't throw - email failure shouldn't block main operation
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

      // Send email notification
      const emailHtml = `
        <h2>New Purchase Order for Approval</h2>
        <p>A new Purchase Order has been submitted and requires your approval.</p>
        <p><strong>PO Number:</strong> ${po.poNumber}</p>
        <p><strong>Total Amount:</strong> ${Number(updated.totalAmount).toFixed(2)}</p>
        <p><strong>Supplier:</strong> ${updated.supplier.companyName}</p>
        <p><strong>Items:</strong> ${updated.items.length}</p>
        <p>Please log in to the procurement system to review and approve this purchase order.</p>
      `;
      await sendEmailNotification(approverId, `New Purchase Order for Approval - ${po.poNumber}`, emailHtml);
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

      // Send email notification
      const emailHtml = `
        <h2>Purchase Order Approved</h2>
        <p>Your Purchase Order has been fully approved and is ready to be sent to the supplier.</p>
        <p><strong>PO Number:</strong> ${po.poNumber}</p>
        <p><strong>Approved By:</strong> ${approverName}</p>
        <p><strong>Total Amount:</strong> ${Number(updated.totalAmount).toFixed(2)}</p>
        <p><strong>Supplier:</strong> ${updated.supplier.companyName}</p>
        <p>You can now proceed to send this purchase order to the supplier.</p>
      `;
      await sendEmailNotification(po.createdById, `Purchase Order Approved - ${po.poNumber}`, emailHtml);
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

export async function generatePOPdf(hospitalId: string, poId: string): Promise<Buffer> {
  const po = await getPOById(hospitalId, poId);

  // Get hospital details
  const hospital = await prisma.hospital.findUnique({
    where: { id: hospitalId },
    select: { name: true, address: true, phone: true, email: true, code: true },
  });

  // Import PDFKit dynamically
  const PDFDocument = require('pdfkit');

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      // Collect PDF data
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Define colors
      const primaryColor = '#2563eb';
      const textColor = '#333333';
      const grayColor = '#666666';
      const lightGray = '#e5e7eb';

      // Header with hospital info
      doc.fontSize(24).fillColor(primaryColor).text(hospital?.name || 'Hospital', { align: 'center' });
      doc.fontSize(10).fillColor(grayColor);
      if (hospital?.address) doc.text(hospital.address, { align: 'center' });
      doc.text(`Phone: ${hospital?.phone || 'N/A'} | Email: ${hospital?.email || 'N/A'}`, { align: 'center' });

      doc.moveTo(50, doc.y + 10).lineTo(545, doc.y + 10).strokeColor(primaryColor).lineWidth(2).stroke();
      doc.moveDown(2);

      // Title
      doc.fontSize(18).fillColor(primaryColor).text('PURCHASE ORDER', { align: 'center' });
      doc.moveDown(1);

      // PO Details section
      doc.fontSize(12).fillColor(primaryColor).text('Purchase Order Details', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor(textColor);

      const startY = doc.y;
      doc.text(`PO Number: `, 50, startY, { continued: true }).font('Helvetica-Bold').text(po.poNumber);
      doc.font('Helvetica').text(`Status: `, 50, doc.y, { continued: true }).font('Helvetica-Bold').text(po.status.replace(/_/g, ' '));
      doc.font('Helvetica').text(`Order Date: ${new Date(po.orderDate).toLocaleDateString()}`, 50, doc.y);
      doc.text(`Expected Delivery: ${po.expectedDate ? new Date(po.expectedDate).toLocaleDateString() : 'N/A'}`, 50, doc.y);
      doc.text(`Payment Terms: ${po.paymentTerms.replace(/_/g, ' ')}`, 50, doc.y);
      doc.moveDown(1.5);

      // Supplier Information
      doc.fontSize(12).fillColor(primaryColor).text('Supplier Information', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor(textColor);
      doc.text(`Company: ${po.supplier.companyName}`, 50, doc.y);
      if (po.supplier.contactPerson) doc.text(`Contact Person: ${po.supplier.contactPerson}`, 50, doc.y);
      if (po.supplier.email) doc.text(`Email: ${po.supplier.email}`, 50, doc.y);
      if (po.supplier.phone) doc.text(`Phone: ${po.supplier.phone}`, 50, doc.y);
      doc.moveDown(1.5);

      // Line Items Table
      doc.fontSize(12).fillColor(primaryColor).text('Line Items', { underline: true });
      doc.moveDown(0.5);

      // Table header
      const tableTop = doc.y;
      const colWidths = [70, 150, 60, 60, 70, 80];
      const colPositions = [50, 120, 270, 330, 390, 460];

      doc.rect(50, tableTop, 495, 25).fillColor(primaryColor).fill();
      doc.fontSize(9).fillColor('white');
      doc.text('Item Code', colPositions[0] + 5, tableTop + 8, { width: colWidths[0] });
      doc.text('Item Name', colPositions[1] + 5, tableTop + 8, { width: colWidths[1] });
      doc.text('Unit', colPositions[2] + 5, tableTop + 8, { width: colWidths[2] });
      doc.text('Quantity', colPositions[3] + 5, tableTop + 8, { width: colWidths[3], align: 'right' });
      doc.text('Unit Price', colPositions[4] + 5, tableTop + 8, { width: colWidths[4], align: 'right' });
      doc.text('Total', colPositions[5] + 5, tableTop + 8, { width: colWidths[5], align: 'right' });

      // Table rows
      let y = tableTop + 25;
      doc.fillColor(textColor).fontSize(9);

      for (const item of po.items) {
        // Check if we need a new page
        if (y > 700) {
          doc.addPage();
          y = 50;
        }

        doc.text(item.itemCode || 'N/A', colPositions[0] + 5, y, { width: colWidths[0] });
        doc.text(item.itemName, colPositions[1] + 5, y, { width: colWidths[1] });
        doc.text(item.unit, colPositions[2] + 5, y, { width: colWidths[2] });
        doc.text(String(item.orderedQty), colPositions[3] + 5, y, { width: colWidths[3], align: 'right' });
        doc.text(Number(item.unitPrice).toFixed(2), colPositions[4] + 5, y, { width: colWidths[4], align: 'right' });
        doc.text(Number(item.totalPrice).toFixed(2), colPositions[5] + 5, y, { width: colWidths[5], align: 'right' });

        y += 20;
        doc.moveTo(50, y).lineTo(545, y).strokeColor(lightGray).lineWidth(0.5).stroke();
      }

      // Totals
      doc.moveDown(2);
      const totalsX = 400;
      doc.fontSize(10).fillColor(textColor);
      doc.text(`Subtotal:`, totalsX, doc.y, { width: 80, align: 'left', continued: true });
      doc.text(Number(po.subtotal).toFixed(2), { width: 60, align: 'right' });
      doc.text(`Discount:`, totalsX, doc.y, { width: 80, align: 'left', continued: true });
      doc.text(`-${Number(po.discount).toFixed(2)}`, { width: 60, align: 'right' });
      doc.text(`Tax:`, totalsX, doc.y, { width: 80, align: 'left', continued: true });
      doc.text(Number(po.tax).toFixed(2), { width: 60, align: 'right' });

      doc.rect(totalsX, doc.y + 5, 145, 20).fillColor(primaryColor).fill();
      doc.fontSize(11).fillColor('white').font('Helvetica-Bold');
      doc.text(`Total Amount:`, totalsX + 5, doc.y + 10, { width: 80, align: 'left', continued: true });
      doc.text(Number(po.totalAmount).toFixed(2), { width: 55, align: 'right' });

      doc.font('Helvetica').fillColor(textColor);
      doc.moveDown(2);

      // Additional sections
      if (po.deliveryAddress) {
        doc.fontSize(11).fillColor(primaryColor).text('Delivery Address', { underline: true });
        doc.moveDown(0.3);
        doc.fontSize(9).fillColor(textColor).text(po.deliveryAddress);
        doc.moveDown(1);
      }

      if (po.specialInstructions) {
        doc.fontSize(11).fillColor(primaryColor).text('Special Instructions', { underline: true });
        doc.moveDown(0.3);
        doc.fontSize(9).fillColor(textColor).text(po.specialInstructions);
        doc.moveDown(1);
      }

      if (po.notes) {
        doc.fontSize(11).fillColor(primaryColor).text('Notes', { underline: true });
        doc.moveDown(0.3);
        doc.fontSize(9).fillColor(textColor).text(po.notes);
        doc.moveDown(1);
      }

      // Approval History
      if (po.approvals && po.approvals.length > 0) {
        if (doc.y > 600) doc.addPage();
        doc.fontSize(11).fillColor(primaryColor).text('Approval History', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(9).fillColor(textColor);

        for (const approval of po.approvals) {
          doc.text(
            `Level ${approval.level}: ${approval.approver.firstName} ${approval.approver.lastName} - ` +
            `${approval.status.replace(/_/g, ' ')} - ` +
            `${approval.actedAt ? new Date(approval.actedAt).toLocaleDateString() : 'Pending'}` +
            (approval.comments ? ` - ${approval.comments}` : '')
          );
        }
        doc.moveDown(1);
      }

      // Footer
      doc.fontSize(8).fillColor(grayColor);
      doc.text('This is a computer-generated document. No signature is required.', 50, 750, { align: 'center' });
      doc.text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });
      doc.text(`Purchase Order Reference: ${po.poNumber}`, { align: 'center' });

      // Finalize PDF
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
