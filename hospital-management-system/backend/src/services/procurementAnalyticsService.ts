import prisma from '../config/database';
import { Prisma } from '@prisma/client';

// ==================== Dashboard Metrics ====================

export async function getDashboardMetrics(hospitalId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const [
    totalSuppliers,
    activeSuppliers,
    pendingPRs,
    pendingPOs,
    openPOs,
    monthlySpend,
    yearlySpend,
    overdueDeliveries,
    pendingInvoices,
    overduePayments,
  ] = await Promise.all([
    // Suppliers
    prisma.supplier.count({ where: { hospitalId } }),
    prisma.supplier.count({ where: { hospitalId, status: 'APPROVED' } }),

    // Pending PRs
    prisma.purchaseRequisition.count({
      where: { hospitalId, status: { in: ['SUBMITTED', 'PENDING_APPROVAL'] } },
    }),

    // Pending PO approvals
    prisma.purchaseOrder.count({
      where: { hospitalId, status: 'PENDING_APPROVAL_PO' },
    }),

    // Open POs (not yet fully received)
    prisma.purchaseOrder.count({
      where: {
        hospitalId,
        status: { in: ['APPROVED_PO', 'SENT_TO_SUPPLIER', 'PARTIALLY_RECEIVED'] },
      },
    }),

    // Monthly spend (sum of PO totals)
    prisma.purchaseOrder.aggregate({
      where: {
        hospitalId,
        status: { notIn: ['DRAFT_PO', 'CANCELLED_PO'] },
        orderDate: { gte: startOfMonth },
      },
      _sum: { totalAmount: true },
    }),

    // Yearly spend
    prisma.purchaseOrder.aggregate({
      where: {
        hospitalId,
        status: { notIn: ['DRAFT_PO', 'CANCELLED_PO'] },
        orderDate: { gte: startOfYear },
      },
      _sum: { totalAmount: true },
    }),

    // Overdue deliveries
    prisma.purchaseOrder.count({
      where: {
        hospitalId,
        status: { in: ['APPROVED_PO', 'SENT_TO_SUPPLIER'] },
        expectedDate: { lt: now },
      },
    }),

    // Pending invoices (unmatched)
    prisma.supplierInvoice.count({
      where: { hospitalId, matchStatus: 'UNMATCHED' },
    }),

    // Overdue payments
    prisma.supplierInvoice.count({
      where: {
        hospitalId,
        paymentStatus: { in: ['PENDING', 'APPROVED_PAYMENT', 'PARTIALLY_PAID_INV'] },
        dueDate: { lt: now },
      },
    }),
  ]);

  return {
    suppliers: {
      total: totalSuppliers,
      active: activeSuppliers,
    },
    requisitions: {
      pendingApproval: pendingPRs,
    },
    purchaseOrders: {
      pendingApproval: pendingPOs,
      open: openPOs,
      overdueDeliveries,
    },
    invoices: {
      pendingMatch: pendingInvoices,
      overduePayments,
    },
    spend: {
      monthly: Number(monthlySpend._sum.totalAmount || 0),
      yearly: Number(yearlySpend._sum.totalAmount || 0),
    },
  };
}

// ==================== Spend Analysis ====================

export async function getSpendAnalysis(hospitalId: string, params: {
  dateFrom?: Date;
  dateTo?: Date;
  groupBy?: 'category' | 'department' | 'supplier' | 'month';
}) {
  const dateFilter: any = {};
  if (params.dateFrom) dateFilter.gte = params.dateFrom;
  if (params.dateTo) dateFilter.lte = params.dateTo;
  if (!params.dateFrom && !params.dateTo) {
    // Default to last 12 months
    dateFilter.gte = new Date(new Date().setMonth(new Date().getMonth() - 12));
  }

  const where: any = {
    hospitalId,
    status: { notIn: ['DRAFT_PO', 'CANCELLED_PO'] },
    orderDate: Object.keys(dateFilter).length > 0 ? dateFilter : undefined,
  };

  const groupBy = params.groupBy || 'supplier';

  switch (groupBy) {
    case 'supplier': {
      const orders = await prisma.purchaseOrder.findMany({
        where,
        select: {
          totalAmount: true,
          supplier: { select: { id: true, companyName: true, code: true, category: true } },
        },
      });

      const supplierSpend: Record<string, { supplier: any; total: number; count: number }> = {};
      for (const order of orders) {
        const sid = order.supplier.id;
        if (!supplierSpend[sid]) {
          supplierSpend[sid] = { supplier: order.supplier, total: 0, count: 0 };
        }
        supplierSpend[sid].total += Number(order.totalAmount);
        supplierSpend[sid].count++;
      }

      return Object.values(supplierSpend)
        .sort((a, b) => b.total - a.total)
        .map(s => ({
          ...s,
          total: Math.round(s.total * 100) / 100,
        }));
    }

    case 'category': {
      const orders = await prisma.purchaseOrder.findMany({
        where,
        select: {
          totalAmount: true,
          supplier: { select: { category: true } },
        },
      });

      const categorySpend: Record<string, { category: string; total: number; count: number }> = {};
      for (const order of orders) {
        const cat = order.supplier.category;
        if (!categorySpend[cat]) {
          categorySpend[cat] = { category: cat, total: 0, count: 0 };
        }
        categorySpend[cat].total += Number(order.totalAmount);
        categorySpend[cat].count++;
      }

      return Object.values(categorySpend)
        .sort((a, b) => b.total - a.total)
        .map(c => ({
          ...c,
          total: Math.round(c.total * 100) / 100,
        }));
    }

    case 'department': {
      const orders = await prisma.purchaseOrder.findMany({
        where,
        select: {
          totalAmount: true,
          requisition: {
            select: {
              department: { select: { id: true, name: true, code: true } },
            },
          },
        },
      });

      const deptSpend: Record<string, { department: any; total: number; count: number }> = {};
      for (const order of orders) {
        const dept = order.requisition?.department;
        const key = dept?.id || 'unassigned';
        if (!deptSpend[key]) {
          deptSpend[key] = { department: dept || { id: 'unassigned', name: 'Direct PO', code: 'DIR' }, total: 0, count: 0 };
        }
        deptSpend[key].total += Number(order.totalAmount);
        deptSpend[key].count++;
      }

      return Object.values(deptSpend)
        .sort((a, b) => b.total - a.total)
        .map(d => ({
          ...d,
          total: Math.round(d.total * 100) / 100,
        }));
    }

    case 'month': {
      const orders = await prisma.purchaseOrder.findMany({
        where,
        select: { totalAmount: true, orderDate: true },
        orderBy: { orderDate: 'asc' },
      });

      const monthlySpend: Record<string, { month: string; total: number; count: number }> = {};
      for (const order of orders) {
        const month = order.orderDate.toISOString().substring(0, 7); // YYYY-MM
        if (!monthlySpend[month]) {
          monthlySpend[month] = { month, total: 0, count: 0 };
        }
        monthlySpend[month].total += Number(order.totalAmount);
        monthlySpend[month].count++;
      }

      return Object.values(monthlySpend).map(m => ({
        ...m,
        total: Math.round(m.total * 100) / 100,
      }));
    }

    default:
      return [];
  }
}

// ==================== Supplier Performance Report ====================

export async function getSupplierPerformanceReport(hospitalId: string, params?: {
  limit?: number;
}) {
  const suppliers = await prisma.supplier.findMany({
    where: { hospitalId, status: { not: 'BLACKLISTED' } },
    select: {
      id: true,
      companyName: true,
      code: true,
      category: true,
      rating: true,
      deliveryScore: true,
      qualityScore: true,
      priceScore: true,
      totalOrders: true,
      isBlacklisted: true,
    },
    orderBy: { rating: 'desc' },
    take: params?.limit || 50,
  });

  // Enrich with order stats
  const enriched = await Promise.all(
    suppliers.map(async (supplier) => {
      const [totalPOs, totalSpend, avgDeliveryTime] = await Promise.all([
        prisma.purchaseOrder.count({
          where: { hospitalId, supplierId: supplier.id, status: { notIn: ['DRAFT_PO', 'CANCELLED_PO'] } },
        }),
        prisma.purchaseOrder.aggregate({
          where: { hospitalId, supplierId: supplier.id, status: { notIn: ['DRAFT_PO', 'CANCELLED_PO'] } },
          _sum: { totalAmount: true },
        }),
        // Get average days between order and delivery
        prisma.purchaseOrder.findMany({
          where: {
            hospitalId,
            supplierId: supplier.id,
            deliveryDate: { not: null },
          },
          select: { orderDate: true, deliveryDate: true },
        }),
      ]);

      let avgDays = 0;
      if (avgDeliveryTime.length > 0) {
        const totalDays = avgDeliveryTime.reduce((sum, po) => {
          if (po.deliveryDate) {
            const diff = (po.deliveryDate.getTime() - po.orderDate.getTime()) / (1000 * 60 * 60 * 24);
            return sum + diff;
          }
          return sum;
        }, 0);
        avgDays = Math.round(totalDays / avgDeliveryTime.length);
      }

      return {
        ...supplier,
        rating: Number(supplier.rating),
        deliveryScore: Number(supplier.deliveryScore),
        qualityScore: Number(supplier.qualityScore),
        priceScore: Number(supplier.priceScore),
        totalPOs,
        totalSpend: Number(totalSpend._sum.totalAmount || 0),
        avgDeliveryDays: avgDays,
      };
    })
  );

  return enriched;
}

// ==================== Pending Items Summary ====================

export async function getPendingItems(hospitalId: string) {
  const [pendingPRs, pendingPOApprovals, overdueDeliveries, unmatchedInvoices, pendingReturns] = await Promise.all([
    prisma.purchaseRequisition.findMany({
      where: { hospitalId, status: { in: ['SUBMITTED', 'PENDING_APPROVAL'] } },
      select: {
        id: true,
        prNumber: true,
        urgency: true,
        totalEstimated: true,
        createdAt: true,
        requestedBy: { select: { firstName: true, lastName: true } },
        department: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 20,
    }),
    prisma.purchaseOrder.findMany({
      where: { hospitalId, status: 'PENDING_APPROVAL_PO' },
      select: {
        id: true,
        poNumber: true,
        totalAmount: true,
        createdAt: true,
        supplier: { select: { companyName: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 20,
    }),
    prisma.purchaseOrder.findMany({
      where: {
        hospitalId,
        status: { in: ['APPROVED_PO', 'SENT_TO_SUPPLIER'] },
        expectedDate: { lt: new Date() },
      },
      select: {
        id: true,
        poNumber: true,
        expectedDate: true,
        totalAmount: true,
        supplier: { select: { companyName: true } },
      },
      orderBy: { expectedDate: 'asc' },
      take: 20,
    }),
    prisma.supplierInvoice.findMany({
      where: { hospitalId, matchStatus: 'UNMATCHED' },
      select: {
        id: true,
        invoiceNumber: true,
        totalAmount: true,
        invoiceDate: true,
        supplier: { select: { companyName: true } },
      },
      orderBy: { invoiceDate: 'asc' },
      take: 20,
    }),
    prisma.supplierReturn.findMany({
      where: { hospitalId, status: { in: ['DRAFT_RETURN', 'PENDING_APPROVAL_RETURN'] } },
      select: {
        id: true,
        returnNumber: true,
        totalAmount: true,
        reason: true,
        supplier: { select: { companyName: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 20,
    }),
  ]);

  return {
    pendingPRs,
    pendingPOApprovals,
    overdueDeliveries,
    unmatchedInvoices,
    pendingReturns,
  };
}

// ==================== PO Status Breakdown ====================

export async function getPOStatusBreakdown(hospitalId: string) {
  const poStatuses = await prisma.purchaseOrder.groupBy({
    by: ['status'],
    where: { hospitalId },
    _count: { id: true },
  });

  return poStatuses.map(item => ({
    status: item.status,
    count: item._count.id,
  }));
}

// ==================== Recent Purchase Orders ====================

export async function getRecentPOs(hospitalId: string, limit: number = 10) {
  const recentPOs = await prisma.purchaseOrder.findMany({
    where: { hospitalId },
    select: {
      id: true,
      poNumber: true,
      status: true,
      totalAmount: true,
      orderDate: true,
      expectedDate: true,
      supplier: {
        select: {
          companyName: true,
          code: true,
        },
      },
    },
    orderBy: { orderDate: 'desc' },
    take: limit,
  });

  return recentPOs.map(po => ({
    ...po,
    totalAmount: Number(po.totalAmount),
  }));
}

// ==================== Low Stock Alerts ====================

export async function getLowStockAlerts(hospitalId: string, limit: number = 20) {
  // Get items where quantity is at or below reorder level
  const lowStockItems = await prisma.inventoryItem.findMany({
    where: {
      hospitalId,
      reorderLevel: { gt: 0 },
    },
    select: {
      id: true,
      name: true,
      code: true,
      category: true,
      quantity: true,
      unit: true,
      reorderLevel: true,
    },
    orderBy: { quantity: 'asc' },
  });

  // Filter items where quantity <= reorderLevel
  const filteredItems = lowStockItems.filter(item => item.quantity <= item.reorderLevel);

  return filteredItems.slice(0, limit);
}

// ==================== My PRs (for staff dashboard) ====================

export async function getMyPRs(hospitalId: string, userId: string, limit: number = 10) {
  const myPRs = await prisma.purchaseRequisition.findMany({
    where: {
      hospitalId,
      requestedById: userId,
    },
    select: {
      id: true,
      prNumber: true,
      status: true,
      urgency: true,
      totalEstimated: true,
      createdAt: true,
      department: {
        select: {
          name: true,
          code: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return myPRs.map(pr => ({
    ...pr,
    totalEstimated: Number(pr.totalEstimated),
  }));
}

// ==================== Recent GRNs ====================

export async function getRecentGRNs(hospitalId: string, limit: number = 10) {
  const recentGRNs = await prisma.goodsReceiptNote.findMany({
    where: { hospitalId },
    select: {
      id: true,
      grnNumber: true,
      status: true,
      receiptDate: true,
      inspectionStatus: true,
      purchaseOrder: {
        select: {
          poNumber: true,
          supplier: {
            select: {
              companyName: true,
            },
          },
        },
      },
      receivedBy: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { receiptDate: 'desc' },
    take: limit,
  });

  return recentGRNs;
}
