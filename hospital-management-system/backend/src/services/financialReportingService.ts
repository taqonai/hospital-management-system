import prisma from '../config/database';
import { NotFoundError, AppError } from '../middleware/errorHandler';
import { Prisma } from '@prisma/client';

interface ARAgingBucket {
  current: number;
  days30to60: number;
  days60to90: number;
  days90plus: number;
}

interface ARAgingReport {
  asOfDate: Date;
  buckets: ARAgingBucket;
  totalOutstanding: number;
  invoiceCount: number;
  details: Array<{
    invoiceNumber: string;
    patientName: string;
    invoiceDate: Date;
    dueDate: Date | null;
    totalAmount: number;
    balanceAmount: number;
    daysOverdue: number;
    bucket: string;
  }>;
}

interface RevenueBreakdownItem {
  name: string;
  code?: string;
  revenue: number;
  invoiceCount: number;
  percentage: number;
}

interface CollectionRateData {
  period: string;
  totalBilled: number;
  totalCollected: number;
  collectionRate: number;
}

interface CollectionRateReport {
  startDate: Date;
  endDate: Date;
  totalBilled: number;
  totalCollected: number;
  overallCollectionRate: number;
  trend: CollectionRateData[];
}

interface TaxSummary {
  startDate: Date;
  endDate: Date;
  totalTax: number;
  invoiceCount: number;
  breakdown: Array<{
    taxRate: number;
    taxAmount: number;
    invoiceCount: number;
  }>;
}

interface WriteOffSummary {
  startDate: Date;
  endDate: Date;
  totalWriteOff: number;
  writeOffCount: number;
  byCategory: Array<{
    category: string;
    amount: number;
    count: number;
  }>;
  byStatus: Array<{
    status: string;
    amount: number;
    count: number;
  }>;
}

export class FinancialReportingService {
  /**
   * Generate AR Aging Report
   * Buckets: Current (0-30 days), 30-60, 60-90, 90+ days
   */
  async getARAgingReport(
    hospitalId: string,
    asOfDate: Date = new Date()
  ): Promise<ARAgingReport> {
    const invoices = await prisma.invoice.findMany({
      where: {
        hospitalId,
        balanceAmount: { gt: 0 },
        status: { notIn: ['CANCELLED', 'REFUNDED'] },
      },
      include: {
        patient: {
          select: {
            firstName: true,
            lastName: true,
            mrn: true,
          },
        },
      },
      orderBy: {
        dueDate: 'asc',
      },
    });

    const buckets: ARAgingBucket = {
      current: 0,
      days30to60: 0,
      days60to90: 0,
      days90plus: 0,
    };

    const details = invoices.map((invoice) => {
      const dueDate = invoice.dueDate || invoice.invoiceDate;
      const daysOverdue = Math.floor(
        (asOfDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      const balanceAmount = Number(invoice.balanceAmount);

      let bucket = 'current';
      if (daysOverdue <= 30) {
        buckets.current += balanceAmount;
        bucket = 'current';
      } else if (daysOverdue <= 60) {
        buckets.days30to60 += balanceAmount;
        bucket = '30-60 days';
      } else if (daysOverdue <= 90) {
        buckets.days60to90 += balanceAmount;
        bucket = '60-90 days';
      } else {
        buckets.days90plus += balanceAmount;
        bucket = '90+ days';
      }

      return {
        invoiceNumber: invoice.invoiceNumber,
        patientName: `${invoice.patient.firstName} ${invoice.patient.lastName}`,
        invoiceDate: invoice.invoiceDate,
        dueDate: invoice.dueDate,
        totalAmount: Number(invoice.totalAmount),
        balanceAmount,
        daysOverdue: Math.max(0, daysOverdue),
        bucket,
      };
    });

    const totalOutstanding =
      buckets.current + buckets.days30to60 + buckets.days60to90 + buckets.days90plus;

    return {
      asOfDate,
      buckets,
      totalOutstanding,
      invoiceCount: invoices.length,
      details,
    };
  }

  /**
   * Get revenue breakdown by department
   */
  async getRevenueByDepartment(
    hospitalId: string,
    startDate: Date,
    endDate: Date
  ): Promise<RevenueBreakdownItem[]> {
    const result = await prisma.$queryRaw<
      Array<{ departmentId: string; name: string; code: string; revenue: Prisma.Decimal; invoiceCount: bigint }>
    >`
      SELECT 
        d.id as "departmentId",
        d.name,
        d.code,
        SUM(i.total_amount) as revenue,
        COUNT(DISTINCT i.id) as "invoiceCount"
      FROM invoices i
      INNER JOIN appointments a ON i.patient_id = a.patient_id 
        AND DATE(i.invoice_date) = DATE(a.appointment_date)
      INNER JOIN doctors doc ON a.doctor_id = doc.id
      INNER JOIN departments d ON doc.department_id = d.id
      WHERE i.hospital_id = ${hospitalId}::uuid
        AND i.invoice_date >= ${startDate}
        AND i.invoice_date <= ${endDate}
        AND i.status != 'CANCELLED'
      GROUP BY d.id, d.name, d.code
      ORDER BY revenue DESC
    `;

    const totalRevenue = result.reduce((sum, item) => sum + Number(item.revenue), 0);

    return result.map((item) => ({
      name: item.name,
      code: item.code,
      revenue: Number(item.revenue),
      invoiceCount: Number(item.invoiceCount),
      percentage: totalRevenue > 0 ? (Number(item.revenue) / totalRevenue) * 100 : 0,
    }));
  }

  /**
   * Get revenue breakdown by doctor
   */
  async getRevenueByDoctor(
    hospitalId: string,
    startDate: Date,
    endDate: Date,
    limit: number = 20
  ): Promise<RevenueBreakdownItem[]> {
    const result = await prisma.$queryRaw<
      Array<{ 
        doctorId: string; 
        firstName: string; 
        lastName: string; 
        specialization: string;
        revenue: Prisma.Decimal; 
        invoiceCount: bigint;
      }>
    >`
      SELECT 
        doc.id as "doctorId",
        u.first_name as "firstName",
        u.last_name as "lastName",
        doc.specialization,
        SUM(i.total_amount) as revenue,
        COUNT(DISTINCT i.id) as "invoiceCount"
      FROM invoices i
      INNER JOIN appointments a ON i.patient_id = a.patient_id 
        AND DATE(i.invoice_date) = DATE(a.appointment_date)
      INNER JOIN doctors doc ON a.doctor_id = doc.id
      INNER JOIN users u ON doc.user_id = u.id
      WHERE i.hospital_id = ${hospitalId}::uuid
        AND i.invoice_date >= ${startDate}
        AND i.invoice_date <= ${endDate}
        AND i.status != 'CANCELLED'
      GROUP BY doc.id, u.first_name, u.last_name, doc.specialization
      ORDER BY revenue DESC
      LIMIT ${limit}
    `;

    const totalRevenue = result.reduce((sum, item) => sum + Number(item.revenue), 0);

    return result.map((item) => ({
      name: `Dr. ${item.firstName} ${item.lastName}`,
      code: item.specialization,
      revenue: Number(item.revenue),
      invoiceCount: Number(item.invoiceCount),
      percentage: totalRevenue > 0 ? (Number(item.revenue) / totalRevenue) * 100 : 0,
    }));
  }

  /**
   * Get revenue breakdown by payer (Insurance vs Self-Pay)
   */
  async getRevenueByPayer(
    hospitalId: string,
    startDate: Date,
    endDate: Date
  ): Promise<RevenueBreakdownItem[]> {
    // Get insurance revenue
    const insuranceRevenue = await prisma.invoice.aggregate({
      where: {
        hospitalId,
        invoiceDate: { gte: startDate, lte: endDate },
        status: { notIn: ['CANCELLED', 'REFUNDED'] },
        claims: { some: {} },
      },
      _sum: { totalAmount: true },
      _count: true,
    });

    // Get self-pay revenue
    const selfPayRevenue = await prisma.invoice.aggregate({
      where: {
        hospitalId,
        invoiceDate: { gte: startDate, lte: endDate },
        status: { notIn: ['CANCELLED', 'REFUNDED'] },
        claims: { none: {} },
      },
      _sum: { totalAmount: true },
      _count: true,
    });

    const insuranceAmount = Number(insuranceRevenue._sum.totalAmount || 0);
    const selfPayAmount = Number(selfPayRevenue._sum.totalAmount || 0);
    const totalRevenue = insuranceAmount + selfPayAmount;

    return [
      {
        name: 'Insurance',
        revenue: insuranceAmount,
        invoiceCount: insuranceRevenue._count,
        percentage: totalRevenue > 0 ? (insuranceAmount / totalRevenue) * 100 : 0,
      },
      {
        name: 'Self-Pay',
        revenue: selfPayAmount,
        invoiceCount: selfPayRevenue._count,
        percentage: totalRevenue > 0 ? (selfPayAmount / totalRevenue) * 100 : 0,
      },
    ];
  }

  /**
   * Get collection rate analytics with trend
   */
  async getCollectionRate(
    hospitalId: string,
    startDate: Date,
    endDate: Date,
    groupBy: 'day' | 'week' | 'month' = 'month'
  ): Promise<CollectionRateReport> {
    // Get overall totals
    const overallStats = await prisma.invoice.aggregate({
      where: {
        hospitalId,
        invoiceDate: { gte: startDate, lte: endDate },
        status: { notIn: ['CANCELLED', 'REFUNDED'] },
      },
      _sum: {
        totalAmount: true,
        paidAmount: true,
      },
    });

    const totalBilled = Number(overallStats._sum.totalAmount || 0);
    const totalCollected = Number(overallStats._sum.paidAmount || 0);
    const overallCollectionRate = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0;

    // Get trend data
    const dateFormat = groupBy === 'day' ? 'YYYY-MM-DD' : groupBy === 'week' ? 'YYYY-"W"WW' : 'YYYY-MM';
    
    const trendData = await prisma.$queryRaw<
      Array<{ period: string; billed: Prisma.Decimal; collected: Prisma.Decimal }>
    >`
      SELECT 
        TO_CHAR(invoice_date, ${dateFormat}) as period,
        SUM(total_amount) as billed,
        SUM(paid_amount) as collected
      FROM invoices
      WHERE hospital_id = ${hospitalId}::uuid
        AND invoice_date >= ${startDate}
        AND invoice_date <= ${endDate}
        AND status NOT IN ('CANCELLED', 'REFUNDED')
      GROUP BY TO_CHAR(invoice_date, ${dateFormat})
      ORDER BY period ASC
    `;

    const trend: CollectionRateData[] = trendData.map((item) => {
      const billed = Number(item.billed);
      const collected = Number(item.collected);
      return {
        period: item.period,
        totalBilled: billed,
        totalCollected: collected,
        collectionRate: billed > 0 ? (collected / billed) * 100 : 0,
      };
    });

    return {
      startDate,
      endDate,
      totalBilled,
      totalCollected,
      overallCollectionRate,
      trend,
    };
  }

  /**
   * Get tax summary
   */
  async getTaxSummary(hospitalId: string, startDate: Date, endDate: Date): Promise<TaxSummary> {
    const invoices = await prisma.invoice.findMany({
      where: {
        hospitalId,
        invoiceDate: { gte: startDate, lte: endDate },
        status: { notIn: ['CANCELLED', 'REFUNDED'] },
        tax: { gt: 0 },
      },
      select: {
        tax: true,
        subtotal: true,
      },
    });

    const totalTax = invoices.reduce((sum, inv) => sum + Number(inv.tax), 0);

    // Group by tax rate (calculated as tax / subtotal * 100)
    const taxRateMap = new Map<number, { amount: number; count: number }>();

    invoices.forEach((inv) => {
      const taxAmount = Number(inv.tax);
      const subtotal = Number(inv.subtotal);
      const taxRate = subtotal > 0 ? Math.round((taxAmount / subtotal) * 100) : 0;

      const existing = taxRateMap.get(taxRate) || { amount: 0, count: 0 };
      taxRateMap.set(taxRate, {
        amount: existing.amount + taxAmount,
        count: existing.count + 1,
      });
    });

    const breakdown = Array.from(taxRateMap.entries())
      .map(([taxRate, data]) => ({
        taxRate,
        taxAmount: data.amount,
        invoiceCount: data.count,
      }))
      .sort((a, b) => b.taxAmount - a.taxAmount);

    return {
      startDate,
      endDate,
      totalTax,
      invoiceCount: invoices.length,
      breakdown,
    };
  }

  /**
   * Get write-off summary
   */
  async getWriteOffSummary(
    hospitalId: string,
    startDate: Date,
    endDate: Date
  ): Promise<WriteOffSummary> {
    const writeOffs = await prisma.writeOff.findMany({
      where: {
        hospitalId,
        createdAt: { gte: startDate, lte: endDate },
      },
      select: {
        amount: true,
        category: true,
        status: true,
      },
    });

    const totalWriteOff = writeOffs.reduce((sum, wo) => sum + Number(wo.amount), 0);

    // Group by category
    const categoryMap = new Map<string, { amount: number; count: number }>();
    writeOffs.forEach((wo) => {
      const category = wo.category;
      const existing = categoryMap.get(category) || { amount: 0, count: 0 };
      categoryMap.set(category, {
        amount: existing.amount + Number(wo.amount),
        count: existing.count + 1,
      });
    });

    // Group by status
    const statusMap = new Map<string, { amount: number; count: number }>();
    writeOffs.forEach((wo) => {
      const status = wo.status;
      const existing = statusMap.get(status) || { amount: 0, count: 0 };
      statusMap.set(status, {
        amount: existing.amount + Number(wo.amount),
        count: existing.count + 1,
      });
    });

    return {
      startDate,
      endDate,
      totalWriteOff,
      writeOffCount: writeOffs.length,
      byCategory: Array.from(categoryMap.entries()).map(([category, data]) => ({
        category,
        amount: data.amount,
        count: data.count,
      })),
      byStatus: Array.from(statusMap.entries()).map(([status, data]) => ({
        status,
        amount: data.amount,
        count: data.count,
      })),
    };
  }

  /**
   * Create a write-off request
   */
  async createWriteOff(
    hospitalId: string,
    data: {
      invoiceId: string;
      amount: number;
      reason: string;
      category: string;
      notes?: string;
      requestedBy: string;
    }
  ) {
    // Verify invoice exists and belongs to hospital
    const invoice = await prisma.invoice.findFirst({
      where: { id: data.invoiceId, hospitalId },
    });

    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    // Validate amount doesn't exceed balance
    if (data.amount > Number(invoice.balanceAmount)) {
      throw new AppError('Write-off amount cannot exceed invoice balance');
    }

    return prisma.writeOff.create({
      data: {
        hospitalId,
        invoiceId: data.invoiceId,
        amount: data.amount,
        reason: data.reason,
        category: data.category as any,
        notes: data.notes,
        requestedBy: data.requestedBy,
        status: 'PENDING',
      },
      include: {
        invoice: {
          include: {
            patient: {
              select: { firstName: true, lastName: true, mrn: true },
            },
          },
        },
      },
    });
  }

  /**
   * Approve or reject a write-off
   */
  async updateWriteOffStatus(
    id: string,
    hospitalId: string,
    status: 'APPROVED' | 'REJECTED',
    approvedBy: string,
    notes?: string
  ) {
    const writeOff = await prisma.writeOff.findFirst({
      where: { id, hospitalId },
      include: { invoice: true },
    });

    if (!writeOff) {
      throw new NotFoundError('Write-off not found');
    }

    if (writeOff.status !== 'PENDING') {
      throw new AppError('Write-off has already been processed');
    }

    // If approving, update invoice balance
    if (status === 'APPROVED') {
      return prisma.$transaction(async (tx) => {
        // Update write-off status
        const updatedWriteOff = await tx.writeOff.update({
          where: { id },
          data: {
            status,
            approvedBy,
            approvedAt: new Date(),
            notes,
          },
        });

        // Update invoice balance
        await tx.invoice.update({
          where: { id: writeOff.invoiceId },
          data: {
            balanceAmount: {
              decrement: Number(writeOff.amount),
            },
          },
        });

        return updatedWriteOff;
      });
    } else {
      // Just update status for rejection
      return prisma.writeOff.update({
        where: { id },
        data: {
          status,
          approvedBy,
          approvedAt: new Date(),
          notes,
        },
      });
    }
  }

  /**
   * Get write-offs list
   */
  async getWriteOffs(
    hospitalId: string,
    params: {
      page?: number;
      limit?: number;
      status?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ) {
    const { page = 1, limit = 20, status, startDate, endDate } = params;

    const where: any = { hospitalId };

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [data, total] = await Promise.all([
      prisma.writeOff.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          invoice: {
            select: {
              invoiceNumber: true,
              totalAmount: true,
              balanceAmount: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.writeOff.count({ where }),
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
   * Export report data to CSV format
   */
  exportToCSV(data: any[], filename: string): string {
    if (!data || data.length === 0) {
      return '';
    }

    // Extract headers from first object
    const headers = Object.keys(data[0]);
    const csvRows: string[] = [];

    // Add header row
    csvRows.push(headers.join(','));

    // Add data rows
    for (const row of data) {
      const values = headers.map((header) => {
        const value = row[header];
        // Escape quotes and wrap in quotes if contains comma
        const escaped = String(value).replace(/"/g, '""');
        return /[,\n"]/.test(escaped) ? `"${escaped}"` : escaped;
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }
}

export const financialReportingService = new FinancialReportingService();
