import prisma from '../config/database';
import { NotFoundError, AppError } from '../middleware/errorHandler';
import { Prisma } from '@prisma/client';
import { accountingService } from './accountingService';

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
        SUM(i."totalAmount") as revenue,
        COUNT(DISTINCT i.id) as "invoiceCount"
      FROM invoices i
      INNER JOIN appointments a ON i."patientId" = a."patientId"
        AND DATE(i."invoiceDate") = DATE(a."appointmentDate")
      INNER JOIN doctors doc ON a."doctorId" = doc.id
      INNER JOIN departments d ON doc."departmentId" = d.id
      WHERE i."hospitalId" = ${hospitalId}        AND i."invoiceDate" >= ${startDate}
        AND i."invoiceDate" <= ${endDate}
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
        u."firstName",
        u."lastName",
        doc.specialization,
        SUM(i."totalAmount") as revenue,
        COUNT(DISTINCT i.id) as "invoiceCount"
      FROM invoices i
      INNER JOIN appointments a ON i."patientId" = a."patientId"
        AND DATE(i."invoiceDate") = DATE(a."appointmentDate")
      INNER JOIN doctors doc ON a."doctorId" = doc.id
      INNER JOIN users u ON doc."userId" = u.id
      WHERE i."hospitalId" = ${hospitalId}        AND i."invoiceDate" >= ${startDate}
        AND i."invoiceDate" <= ${endDate}
        AND i.status != 'CANCELLED'
      GROUP BY doc.id, u."firstName", u."lastName", doc.specialization
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
        TO_CHAR("invoiceDate", ${dateFormat}) as period,
        SUM("totalAmount") as billed,
        SUM("paidAmount") as collected
      FROM invoices
      WHERE "hospitalId" = ${hospitalId}        AND "invoiceDate" >= ${startDate}
        AND "invoiceDate" <= ${endDate}
        AND status NOT IN ('CANCELLED', 'REFUNDED')
      GROUP BY TO_CHAR("invoiceDate", ${dateFormat})
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
      const updatedWriteOff = await prisma.$transaction(async (tx) => {
        // Update write-off status
        const result = await tx.writeOff.update({
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

        return result;
      });

      // Post write-off to GL
      try {
        await accountingService.recordWriteOffGL({
          hospitalId,
          writeOffId: updatedWriteOff.id,
          amount: Number(writeOff.amount),
          description: `Write-off: ${writeOff.category} - ${writeOff.reason || ''}`,
          createdBy: approvedBy,
        });
      } catch (glError) {
        console.error('[GL] Failed to post write-off GL entry:', glError);
      }

      return updatedWriteOff;
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
   * Generate Income Statement from GL entries
   * Revenue = sum credits - sum debits for REVENUE accounts
   * Expenses = sum debits - sum credits for EXPENSE accounts
   */
  async getIncomeStatement(hospitalId: string, startDate: Date, endDate: Date) {
    const rows = await prisma.$queryRaw<
      Array<{
        accountCode: string;
        accountName: string;
        accountType: string;
        totalDebits: Prisma.Decimal;
        totalCredits: Prisma.Decimal;
      }>
    >`
      SELECT
        ga."accountCode",
        ga."accountName",
        ga."accountType",
        COALESCE(SUM(ge."debitAmount"), 0) as "totalDebits",
        COALESCE(SUM(ge."creditAmount"), 0) as "totalCredits"
      FROM gl_entries ge
      INNER JOIN gl_accounts ga ON ge."glAccountId" = ga.id
      WHERE ge."hospitalId" = ${hospitalId}        AND ge."transactionDate" >= ${startDate}
        AND ge."transactionDate" <= ${endDate}
        AND ga."accountType" IN ('REVENUE', 'EXPENSE')
      GROUP BY ga.id, ga."accountCode", ga."accountName", ga."accountType"
      ORDER BY ga."accountCode" ASC
    `;

    const revenue: Array<{ accountCode: string; accountName: string; amount: number }> = [];
    const expenses: Array<{ accountCode: string; accountName: string; amount: number }> = [];

    for (const row of rows) {
      const debits = Number(row.totalDebits);
      const credits = Number(row.totalCredits);

      if (row.accountType === 'REVENUE') {
        const amount = credits - debits; // net credit = revenue
        if (amount !== 0) {
          revenue.push({ accountCode: row.accountCode, accountName: row.accountName, amount });
        }
      } else if (row.accountType === 'EXPENSE') {
        const amount = debits - credits; // net debit = expense
        if (amount !== 0) {
          expenses.push({ accountCode: row.accountCode, accountName: row.accountName, amount });
        }
      }
    }

    const totalRevenue = revenue.reduce((sum, r) => sum + r.amount, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const netIncome = totalRevenue - totalExpenses;

    return { revenue, expenses, totalRevenue, totalExpenses, netIncome, startDate, endDate };
  }

  /**
   * Generate Balance Sheet from GL entries (all entries up to asOfDate)
   * Assets = sum debits - sum credits (net debit balance)
   * Liabilities = sum credits - sum debits (net credit balance)
   * Equity = sum credits - sum debits (net credit balance)
   */
  async getBalanceSheet(hospitalId: string, asOfDate: Date) {
    const rows = await prisma.$queryRaw<
      Array<{
        accountCode: string;
        accountName: string;
        accountType: string;
        totalDebits: Prisma.Decimal;
        totalCredits: Prisma.Decimal;
      }>
    >`
      SELECT
        ga."accountCode",
        ga."accountName",
        ga."accountType",
        COALESCE(SUM(ge."debitAmount"), 0) as "totalDebits",
        COALESCE(SUM(ge."creditAmount"), 0) as "totalCredits"
      FROM gl_entries ge
      INNER JOIN gl_accounts ga ON ge."glAccountId" = ga.id
      WHERE ge."hospitalId" = ${hospitalId}        AND ge."transactionDate" <= ${asOfDate}
        AND ga."accountType" IN ('ASSET', 'LIABILITY', 'EQUITY')
      GROUP BY ga.id, ga."accountCode", ga."accountName", ga."accountType"
      ORDER BY ga."accountCode" ASC
    `;

    const assets: Array<{ accountCode: string; accountName: string; balance: number }> = [];
    const liabilities: Array<{ accountCode: string; accountName: string; balance: number }> = [];
    const equity: Array<{ accountCode: string; accountName: string; balance: number }> = [];

    for (const row of rows) {
      const debits = Number(row.totalDebits);
      const credits = Number(row.totalCredits);

      if (row.accountType === 'ASSET') {
        const balance = debits - credits;
        if (balance !== 0) {
          assets.push({ accountCode: row.accountCode, accountName: row.accountName, balance });
        }
      } else if (row.accountType === 'LIABILITY') {
        const balance = credits - debits;
        if (balance !== 0) {
          liabilities.push({ accountCode: row.accountCode, accountName: row.accountName, balance });
        }
      } else if (row.accountType === 'EQUITY') {
        const balance = credits - debits;
        if (balance !== 0) {
          equity.push({ accountCode: row.accountCode, accountName: row.accountName, balance });
        }
      }
    }

    const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);
    const totalLiabilities = liabilities.reduce((sum, l) => sum + l.balance, 0);
    const totalEquity = equity.reduce((sum, e) => sum + e.balance, 0);
    const isBalanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01;

    return {
      assets,
      liabilities,
      equity,
      totalAssets,
      totalLiabilities,
      totalEquity,
      isBalanced,
      asOfDate,
    };
  }

  /**
   * Get Revenue by Department Report with GL-based cost center tracking
   */
  async getRevenueByDepartmentGL(
    hospitalId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{
    department: string;
    totalRevenue: number;
    totalExpenses: number;
    netIncome: number;
  }>> {
    // Query GL entries grouped by cost center (department)
    const entries = await prisma.$queryRaw<
      Array<{
        costCenter: string;
        accountType: string;
        totalDebits: Prisma.Decimal;
        totalCredits: Prisma.Decimal;
      }>
    >`
      SELECT
        COALESCE(ge."costCenter", 'Unassigned') as "costCenter",
        ga."accountType",
        SUM(ge."debitAmount") as "totalDebits",
        SUM(ge."creditAmount") as "totalCredits"
      FROM gl_entries ge
      INNER JOIN gl_accounts ga ON ge."glAccountId" = ga.id
      WHERE ge."hospitalId" = ${hospitalId}        AND ge."transactionDate" >= ${startDate}
        AND ge."transactionDate" <= ${endDate}
        AND ga."accountType" IN ('REVENUE', 'EXPENSE')
      GROUP BY ge."costCenter", ga."accountType"
      ORDER BY "costCenter" ASC
    `;

    // Group by cost center
    const departmentMap = new Map<string, { revenue: number; expenses: number }>();

    for (const entry of entries) {
      const dept = entry.costCenter || 'Unassigned';
      const existing = departmentMap.get(dept) || { revenue: 0, expenses: 0 };

      const debits = Number(entry.totalDebits);
      const credits = Number(entry.totalCredits);

      if (entry.accountType === 'REVENUE') {
        existing.revenue += credits - debits; // Net credit = revenue
      } else if (entry.accountType === 'EXPENSE') {
        existing.expenses += debits - credits; // Net debit = expense
      }

      departmentMap.set(dept, existing);
    }

    return Array.from(departmentMap.entries())
      .map(([department, data]) => ({
        department,
        totalRevenue: data.revenue,
        totalExpenses: data.expenses,
        netIncome: data.revenue - data.expenses,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue);
  }

  /**
   * Get A/R Aging Report with separate Patient and Insurance buckets
   */
  async getARAgingReportDetailed(
    hospitalId: string,
    asOfDate: Date = new Date()
  ): Promise<{
    asOfDate: Date;
    patientAR: {
      current: number;
      days30to60: number;
      days60to90: number;
      days90plus: number;
      total: number;
    };
    insuranceAR: {
      current: number;
      days30to60: number;
      days60to90: number;
      days90plus: number;
      total: number;
    };
    grandTotal: number;
    details: Array<{
      invoiceNumber: string;
      patientName: string;
      invoiceDate: Date;
      dueDate: Date | null;
      totalAmount: number;
      balanceAmount: number;
      daysOverdue: number;
      bucket: string;
      type: 'PATIENT' | 'INSURANCE';
    }>;
  }> {
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
        primaryInsurance: true,
      },
      orderBy: {
        dueDate: 'asc',
      },
    });

    const patientBuckets = { current: 0, days30to60: 0, days60to90: 0, days90plus: 0, total: 0 };
    const insuranceBuckets = { current: 0, days30to60: 0, days60to90: 0, days90plus: 0, total: 0 };

    const details = invoices.map((invoice) => {
      const dueDate = invoice.dueDate || invoice.invoiceDate;
      const daysOverdue = Math.floor(
        (asOfDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      const balanceAmount = Number(invoice.balanceAmount);
      const isInsurance = !!invoice.primaryInsurance;
      const type: 'PATIENT' | 'INSURANCE' = isInsurance ? 'INSURANCE' : 'PATIENT';

      let bucket = 'current';
      const buckets = isInsurance ? insuranceBuckets : patientBuckets;

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

      buckets.total += balanceAmount;

      return {
        invoiceNumber: invoice.invoiceNumber,
        patientName: `${invoice.patient.firstName} ${invoice.patient.lastName}`,
        invoiceDate: invoice.invoiceDate,
        dueDate: invoice.dueDate,
        totalAmount: Number(invoice.totalAmount),
        balanceAmount,
        daysOverdue: Math.max(0, daysOverdue),
        bucket,
        type,
      };
    });

    return {
      asOfDate,
      patientAR: patientBuckets,
      insuranceAR: insuranceBuckets,
      grandTotal: patientBuckets.total + insuranceBuckets.total,
      details,
    };
  }

  /**
   * Get Claim Status Analytics Report
   */
  async getClaimAnalytics(
    hospitalId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    startDate: Date;
    endDate: Date;
    totalClaims: number;
    totalClaimedAmount: number;
    totalApprovedAmount: number;
    approvalRate: number;
    averageProcessingDays: number;
    byStatus: Array<{
      status: string;
      count: number;
      totalAmount: number;
      percentage: number;
    }>;
    denialReasons: Array<{
      reason: string;
      count: number;
      totalAmount: number;
    }>;
  }> {
    const claims = await prisma.insuranceClaim.findMany({
      where: {
        invoice: { hospitalId },
        submittedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        status: true,
        claimAmount: true,
        approvedAmount: true,
        submittedAt: true,
        processedAt: true,
        denialReasonCode: true,
      },
    });

    const totalClaims = claims.length;
    const totalClaimedAmount = claims.reduce((sum, c) => sum + Number(c.claimAmount), 0);
    const totalApprovedAmount = claims.reduce(
      (sum, c) => sum + Number(c.approvedAmount || 0),
      0
    );

    const approvedClaims = claims.filter((c) => c.status === 'APPROVED' || c.status === 'PAID');
    const approvalRate =
      totalClaims > 0 ? (approvedClaims.length / totalClaims) * 100 : 0;

    // Calculate average processing time for processed claims
    const processedClaims = claims.filter((c) => c.processedAt && c.submittedAt);
    const totalProcessingDays = processedClaims.reduce((sum, c) => {
      const days = Math.floor(
        (c.processedAt!.getTime() - c.submittedAt!.getTime()) / (1000 * 60 * 60 * 24)
      );
      return sum + days;
    }, 0);
    const averageProcessingDays =
      processedClaims.length > 0 ? totalProcessingDays / processedClaims.length : 0;

    // Group by status
    const statusMap = new Map<string, { count: number; amount: number }>();
    claims.forEach((claim) => {
      const status = claim.status;
      const existing = statusMap.get(status) || { count: 0, amount: 0 };
      statusMap.set(status, {
        count: existing.count + 1,
        amount: existing.amount + Number(claim.claimAmount),
      });
    });

    const byStatus = Array.from(statusMap.entries()).map(([status, data]) => ({
      status,
      count: data.count,
      totalAmount: data.amount,
      percentage: totalClaims > 0 ? (data.count / totalClaims) * 100 : 0,
    }));

    // Group by denial reason
    const denialReasonMap = new Map<string, { count: number; amount: number }>();
    claims
      .filter((c) => c.status === 'REJECTED' && c.denialReasonCode)
      .forEach((claim) => {
        const reason = claim.denialReasonCode || 'Unknown';
        const existing = denialReasonMap.get(reason) || { count: 0, amount: 0 };
        denialReasonMap.set(reason, {
          count: existing.count + 1,
          amount: existing.amount + Number(claim.claimAmount),
        });
      });

    const denialReasons = Array.from(denialReasonMap.entries())
      .map(([reason, data]) => ({
        reason,
        count: data.count,
        totalAmount: data.amount,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      startDate,
      endDate,
      totalClaims,
      totalClaimedAmount,
      totalApprovedAmount,
      approvalRate,
      averageProcessingDays,
      byStatus,
      denialReasons,
    };
  }

  /**
   * Get denial analytics
   * Top denial reasons, denial rate by payer, trend over time
   */
  async getDenialAnalytics(
    hospitalId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    startDate: Date;
    endDate: Date;
    totalClaims: number;
    deniedClaims: number;
    denialRate: number;
    totalDeniedAmount: number;
    topDenialReasons: Array<{
      reason: string;
      code: string;
      count: number;
      totalAmount: number;
      percentage: number;
    }>;
    denialRateByPayer: Array<{
      payerId: string;
      payerName: string;
      totalClaims: number;
      deniedClaims: number;
      denialRate: number;
    }>;
    monthlyTrend: Array<{
      month: string;
      totalClaims: number;
      deniedClaims: number;
      denialRate: number;
    }>;
  }> {
    // Get all claims in date range
    const claims = await prisma.insuranceClaim.findMany({
      where: {
        invoice: { hospitalId },
        submittedAt: { gte: startDate, lte: endDate },
      },
      include: {
        insurancePayer: true,
        invoice: true,
      },
    });

    const totalClaims = claims.length;
    const deniedClaims = claims.filter((c) => c.status === 'REJECTED').length;
    const denialRate = totalClaims > 0 ? (deniedClaims / totalClaims) * 100 : 0;
    const totalDeniedAmount = claims
      .filter((c) => c.status === 'REJECTED')
      .reduce((sum, c) => sum + Number(c.claimAmount), 0);

    // Top denial reasons
    const denialReasonMap = new Map<
      string,
      { code: string; count: number; amount: number }
    >();

    claims
      .filter((c) => c.status === 'REJECTED' && c.denialReasonCode)
      .forEach((claim) => {
        const code = claim.denialReasonCode || 'UNKNOWN';
        const reason = claim.denialReasonCode || 'Unknown reason';
        const key = `${code}|${reason}`;
        const existing = denialReasonMap.get(key) || { code, count: 0, amount: 0 };
        denialReasonMap.set(key, {
          code,
          count: existing.count + 1,
          amount: existing.amount + Number(claim.claimAmount),
        });
      });

    const topDenialReasons = Array.from(denialReasonMap.entries())
      .map(([key, data]) => {
        const [code, reason] = key.split('|');
        return {
          reason,
          code,
          count: data.count,
          totalAmount: data.amount,
          percentage: deniedClaims > 0 ? (data.count / deniedClaims) * 100 : 0,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Denial rate by payer
    const payerMap = new Map<
      string,
      { payerName: string; total: number; denied: number }
    >();

    claims.forEach((claim) => {
      const payerId = claim.insurancePayerId;
      const payerName = claim.insurancePayer?.name || 'Unknown';
      const existing = payerMap.get(payerId) || {
        payerName,
        total: 0,
        denied: 0,
      };
      payerMap.set(payerId, {
        payerName,
        total: existing.total + 1,
        denied: existing.denied + (claim.status === 'REJECTED' ? 1 : 0),
      });
    });

    const denialRateByPayer = Array.from(payerMap.entries())
      .map(([payerId, data]) => ({
        payerId,
        payerName: data.payerName,
        totalClaims: data.total,
        deniedClaims: data.denied,
        denialRate: data.total > 0 ? (data.denied / data.total) * 100 : 0,
      }))
      .sort((a, b) => b.denialRate - a.denialRate);

    // Monthly trend
    const monthMap = new Map<string, { total: number; denied: number }>();

    claims.forEach((claim) => {
      const month = claim.submittedAt
        ? claim.submittedAt.toISOString().slice(0, 7)
        : '';
      if (!month) return;

      const existing = monthMap.get(month) || { total: 0, denied: 0 };
      monthMap.set(month, {
        total: existing.total + 1,
        denied: existing.denied + (claim.status === 'REJECTED' ? 1 : 0),
      });
    });

    const monthlyTrend = Array.from(monthMap.entries())
      .map(([month, data]) => ({
        month,
        totalClaims: data.total,
        deniedClaims: data.denied,
        denialRate: data.total > 0 ? (data.denied / data.total) * 100 : 0,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return {
      startDate,
      endDate,
      totalClaims,
      deniedClaims,
      denialRate,
      totalDeniedAmount,
      topDenialReasons,
      denialRateByPayer,
      monthlyTrend,
    };
  }

  /**
   * Get collection effectiveness analytics
   * Collection ratio, average days to collect, by payer
   */
  async getCollectionEffectiveness(
    hospitalId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    startDate: Date;
    endDate: Date;
    overallCollectionRatio: number;
    averageDaysToCollect: number;
    byPayer: Array<{
      payerId: string;
      payerName: string;
      totalBilled: number;
      totalCollected: number;
      collectionRatio: number;
      averageDaysToCollect: number;
      outstandingBalance: number;
    }>;
  }> {
    // Get all claims with invoices
    const claims = await prisma.insuranceClaim.findMany({
      where: {
        invoice: {
          hospitalId,
          invoiceDate: { gte: startDate, lte: endDate },
        },
      },
      include: {
        insurancePayer: true,
        invoice: {
          include: {
            payments: true,
          },
        },
      },
    });

    let totalBilled = 0;
    let totalCollected = 0;
    let totalDaysToCollect = 0;
    let collectedCount = 0;

    const payerMap = new Map<
      string,
      {
        payerName: string;
        billed: number;
        collected: number;
        daysToCollect: number;
        collectedCount: number;
      }
    >();

    claims.forEach((claim) => {
      const claimAmount = Number(claim.claimAmount);
      const approvedAmount = Number(claim.approvedAmount || 0);
      const paidAmount = Number(claim.approvedAmount || 0);

      totalBilled += claimAmount;
      totalCollected += paidAmount;

      // Calculate days to collect if payment received
      if (paidAmount > 0 && claim.submittedAt && claim.invoice.payments.length > 0) {
        const firstPayment = claim.invoice.payments[0];
        const daysToCollect = Math.floor(
          (firstPayment.paymentDate.getTime() - claim.submittedAt.getTime()) /
            (1000 * 60 * 60 * 24)
        );
        totalDaysToCollect += daysToCollect;
        collectedCount++;

        // Update payer stats
        const payerId = claim.insurancePayerId;
        const payerName = claim.insurancePayer?.name || 'Unknown';
        const existing = payerMap.get(payerId) || {
          payerName,
          billed: 0,
          collected: 0,
          daysToCollect: 0,
          collectedCount: 0,
        };

        payerMap.set(payerId, {
          payerName,
          billed: existing.billed + claimAmount,
          collected: existing.collected + paidAmount,
          daysToCollect: existing.daysToCollect + daysToCollect,
          collectedCount: existing.collectedCount + 1,
        });
      } else {
        // Update payer totals even if not collected
        const payerId = claim.insurancePayerId;
        const payerName = claim.insurancePayer?.name || 'Unknown';
        const existing = payerMap.get(payerId) || {
          payerName,
          billed: 0,
          collected: 0,
          daysToCollect: 0,
          collectedCount: 0,
        };

        payerMap.set(payerId, {
          ...existing,
          billed: existing.billed + claimAmount,
          collected: existing.collected + paidAmount,
        });
      }
    });

    const overallCollectionRatio =
      totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0;
    const averageDaysToCollect =
      collectedCount > 0 ? totalDaysToCollect / collectedCount : 0;

    const byPayer = Array.from(payerMap.entries())
      .map(([payerId, data]) => ({
        payerId,
        payerName: data.payerName,
        totalBilled: data.billed,
        totalCollected: data.collected,
        collectionRatio: data.billed > 0 ? (data.collected / data.billed) * 100 : 0,
        averageDaysToCollect:
          data.collectedCount > 0 ? data.daysToCollect / data.collectedCount : 0,
        outstandingBalance: data.billed - data.collected,
      }))
      .sort((a, b) => b.totalBilled - a.totalBilled);

    return {
      startDate,
      endDate,
      overallCollectionRatio,
      averageDaysToCollect,
      byPayer,
    };
  }

  /**
   * Get claim turnaround time analytics
   * Average time from submission to payment, by payer
   */
  async getClaimTurnaroundTime(
    hospitalId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    startDate: Date;
    endDate: Date;
    overallAverageDays: number;
    medianDays: number;
    byPayer: Array<{
      payerId: string;
      payerName: string;
      claimCount: number;
      averageDays: number;
      medianDays: number;
      minDays: number;
      maxDays: number;
    }>;
    byStatus: Array<{
      status: string;
      claimCount: number;
      averageDays: number;
    }>;
  }> {
    // Get all processed claims
    const claims = await prisma.insuranceClaim.findMany({
      where: {
        invoice: { hospitalId },
        submittedAt: { gte: startDate, lte: endDate },
        processedAt: { not: null },
      },
      include: {
        insurancePayer: true,
        invoice: true,
      },
    });

    const turnaroundTimes: number[] = [];
    const payerMap = new Map<string, { payerName: string; times: number[] }>();
    const statusMap = new Map<string, number[]>();

    claims.forEach((claim) => {
      if (!claim.submittedAt || !claim.processedAt) return;

      const days = Math.floor(
        (claim.processedAt.getTime() - claim.submittedAt.getTime()) /
          (1000 * 60 * 60 * 24)
      );

      turnaroundTimes.push(days);

      // By payer
      const payerId = claim.insurancePayerId;
      const payerName = claim.insurancePayer?.name || 'Unknown';
      const existing = payerMap.get(payerId) || { payerName, times: [] };
      existing.times.push(days);
      payerMap.set(payerId, existing);

      // By status
      const status = claim.status;
      const statusTimes = statusMap.get(status) || [];
      statusTimes.push(days);
      statusMap.set(status, statusTimes);
    });

    // Calculate overall average and median
    const overallAverageDays =
      turnaroundTimes.length > 0
        ? turnaroundTimes.reduce((sum, t) => sum + t, 0) / turnaroundTimes.length
        : 0;

    const sortedTimes = [...turnaroundTimes].sort((a, b) => a - b);
    const medianDays =
      sortedTimes.length > 0
        ? sortedTimes[Math.floor(sortedTimes.length / 2)]
        : 0;

    // By payer
    const byPayer = Array.from(payerMap.entries())
      .map(([payerId, data]) => {
        const times = data.times.sort((a, b) => a - b);
        return {
          payerId,
          payerName: data.payerName,
          claimCount: times.length,
          averageDays: times.reduce((sum, t) => sum + t, 0) / times.length,
          medianDays: times[Math.floor(times.length / 2)],
          minDays: times[0],
          maxDays: times[times.length - 1],
        };
      })
      .sort((a, b) => b.claimCount - a.claimCount);

    // By status
    const byStatus = Array.from(statusMap.entries())
      .map(([status, times]) => ({
        status,
        claimCount: times.length,
        averageDays: times.reduce((sum, t) => sum + t, 0) / times.length,
      }))
      .sort((a, b) => b.claimCount - a.claimCount);

    return {
      startDate,
      endDate,
      overallAverageDays,
      medianDays,
      byPayer,
      byStatus,
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
