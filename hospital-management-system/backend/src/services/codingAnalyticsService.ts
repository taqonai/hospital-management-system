import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import logger from '../utils/logger';

interface DateRange {
  startDate: Date;
  endDate: Date;
}

interface CodeUsageItem {
  code: string;
  description: string;
  count: number;
  percentage: number;
  revenue?: number;
}

interface PayerStats {
  payerId: string;
  payerName: string;
  claimCount: number;
  acceptanceRate: number;
  avgPaymentDays: number;
  totalBilled: number;
  totalPaid: number;
}

interface RejectionReason {
  reason: string;
  count: number;
  percentage: number;
  commonCodes: string[];
}

export class CodingAnalyticsService {
  /**
   * Get ICD-10 code usage distribution
   */
  async getICD10Usage(hospitalId: string, dateRange?: DateRange, limit: number = 20) {
    const where: Prisma.ConsultationDiagnosisWhereInput = {
      consultation: {
        appointment: { hospitalId },
      },
    };

    if (dateRange) {
      where.createdAt = {
        gte: dateRange.startDate,
        lte: dateRange.endDate,
      };
    }

    const diagnoses = await prisma.consultationDiagnosis.groupBy({
      by: ['icd10CodeId'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    });

    const total = diagnoses.reduce((sum, d) => sum + d._count.id, 0);

    // Get code details
    const codeIds = diagnoses.map((d) => d.icd10CodeId);
    const codes = await prisma.iCD10Code.findMany({
      where: { id: { in: codeIds } },
      select: { id: true, code: true, description: true },
    });

    const codeMap = new Map(codes.map((c) => [c.id, c]));

    return diagnoses.map((d) => {
      const codeInfo = codeMap.get(d.icd10CodeId);
      return {
        code: codeInfo?.code || 'Unknown',
        description: codeInfo?.description || 'Unknown',
        count: d._count.id,
        percentage: total > 0 ? (d._count.id / total) * 100 : 0,
      };
    });
  }

  /**
   * Get CPT code usage distribution
   */
  async getCPTUsage(hospitalId: string, dateRange?: DateRange, limit: number = 20) {
    const where: Prisma.ConsultationProcedureWhereInput = {
      consultation: {
        appointment: { hospitalId },
      },
    };

    if (dateRange) {
      where.createdAt = {
        gte: dateRange.startDate,
        lte: dateRange.endDate,
      };
    }

    const procedures = await prisma.consultationProcedure.groupBy({
      by: ['cptCodeId'],
      where,
      _count: { id: true },
      _sum: { price: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    });

    const total = procedures.reduce((sum, p) => sum + p._count.id, 0);

    // Get code details
    const codeIds = procedures.map((p) => p.cptCodeId);
    const codes = await prisma.cPTCode.findMany({
      where: { id: { in: codeIds } },
      select: { id: true, code: true, description: true },
    });

    const codeMap = new Map(codes.map((c) => [c.id, c]));

    return procedures.map((p) => {
      const codeInfo = codeMap.get(p.cptCodeId);
      return {
        code: codeInfo?.code || 'Unknown',
        description: codeInfo?.description || 'Unknown',
        count: p._count.id,
        percentage: total > 0 ? (p._count.id / total) * 100 : 0,
        revenue: Number(p._sum.price || 0),
      };
    });
  }

  /**
   * Get revenue breakdown by CPT category
   */
  async getRevenueByCategory(hospitalId: string, dateRange?: DateRange) {
    const where: Prisma.ConsultationProcedureWhereInput = {
      consultation: {
        appointment: { hospitalId },
      },
    };

    if (dateRange) {
      where.createdAt = {
        gte: dateRange.startDate,
        lte: dateRange.endDate,
      };
    }

    const procedures = await prisma.consultationProcedure.findMany({
      where,
      include: {
        cptCode: {
          select: { category: true },
        },
      },
    });

    const categoryRevenue: Record<string, { count: number; revenue: number }> = {};

    for (const proc of procedures) {
      const category = proc.cptCode.category || 'Other';
      if (!categoryRevenue[category]) {
        categoryRevenue[category] = { count: 0, revenue: 0 };
      }
      categoryRevenue[category].count += proc.units;
      categoryRevenue[category].revenue += Number(proc.price) * proc.units;
    }

    const totalRevenue = Object.values(categoryRevenue).reduce((sum, c) => sum + c.revenue, 0);

    return Object.entries(categoryRevenue)
      .map(([category, stats]) => ({
        category,
        count: stats.count,
        revenue: stats.revenue,
        percentage: totalRevenue > 0 ? (stats.revenue / totalRevenue) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }

  /**
   * Get AI adoption metrics
   */
  async getAIAdoptionMetrics(hospitalId: string, dateRange?: DateRange) {
    const diagnosisWhere: Prisma.ConsultationDiagnosisWhereInput = {
      consultation: {
        appointment: { hospitalId },
      },
    };

    const procedureWhere: Prisma.ConsultationProcedureWhereInput = {
      consultation: {
        appointment: { hospitalId },
      },
    };

    if (dateRange) {
      diagnosisWhere.createdAt = {
        gte: dateRange.startDate,
        lte: dateRange.endDate,
      };
      procedureWhere.createdAt = {
        gte: dateRange.startDate,
        lte: dateRange.endDate,
      };
    }

    const [totalDiagnoses, aiDiagnoses, totalProcedures, aiProcedures] = await Promise.all([
      prisma.consultationDiagnosis.count({ where: diagnosisWhere }),
      prisma.consultationDiagnosis.count({
        where: { ...diagnosisWhere, aiSuggested: true },
      }),
      prisma.consultationProcedure.count({ where: procedureWhere }),
      prisma.consultationProcedure.count({
        where: { ...procedureWhere, aiSuggested: true },
      }),
    ]);

    // Get average AI confidence
    const aiDiagnosesWithConfidence = await prisma.consultationDiagnosis.aggregate({
      where: { ...diagnosisWhere, aiSuggested: true, aiConfidence: { not: null } },
      _avg: { aiConfidence: true },
    });

    const aiProceduresWithConfidence = await prisma.consultationProcedure.aggregate({
      where: { ...procedureWhere, aiSuggested: true, aiConfidence: { not: null } },
      _avg: { aiConfidence: true },
    });

    return {
      diagnoses: {
        total: totalDiagnoses,
        aiSuggested: aiDiagnoses,
        adoptionRate: totalDiagnoses > 0 ? (aiDiagnoses / totalDiagnoses) * 100 : 0,
        avgConfidence: Number(aiDiagnosesWithConfidence._avg.aiConfidence || 0),
      },
      procedures: {
        total: totalProcedures,
        aiSuggested: aiProcedures,
        adoptionRate: totalProcedures > 0 ? (aiProcedures / totalProcedures) * 100 : 0,
        avgConfidence: Number(aiProceduresWithConfidence._avg.aiConfidence || 0),
      },
      overall: {
        totalCodes: totalDiagnoses + totalProcedures,
        aiSuggestedCodes: aiDiagnoses + aiProcedures,
        overallAdoptionRate:
          totalDiagnoses + totalProcedures > 0
            ? ((aiDiagnoses + aiProcedures) / (totalDiagnoses + totalProcedures)) * 100
            : 0,
      },
    };
  }

  /**
   * Get coding volume trends over time
   */
  async getCodingTrends(hospitalId: string, dateRange: DateRange, granularity: 'day' | 'week' | 'month' = 'day') {
    const diagnosisWhere: Prisma.ConsultationDiagnosisWhereInput = {
      consultation: {
        appointment: { hospitalId },
      },
      createdAt: {
        gte: dateRange.startDate,
        lte: dateRange.endDate,
      },
    };

    const diagnoses = await prisma.consultationDiagnosis.findMany({
      where: diagnosisWhere,
      select: {
        createdAt: true,
        aiSuggested: true,
      },
    });

    const procedureWhere: Prisma.ConsultationProcedureWhereInput = {
      consultation: {
        appointment: { hospitalId },
      },
      createdAt: {
        gte: dateRange.startDate,
        lte: dateRange.endDate,
      },
    };

    const procedures = await prisma.consultationProcedure.findMany({
      where: procedureWhere,
      select: {
        createdAt: true,
        aiSuggested: true,
        price: true,
        units: true,
      },
    });

    // Group by date
    const formatDate = (date: Date): string => {
      if (granularity === 'month') {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      } else if (granularity === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return weekStart.toISOString().split('T')[0];
      }
      return date.toISOString().split('T')[0];
    };

    const trends: Record<string, {
      date: string;
      diagnoses: number;
      procedures: number;
      aiDiagnoses: number;
      aiProcedures: number;
      revenue: number;
    }> = {};

    for (const d of diagnoses) {
      const key = formatDate(d.createdAt);
      if (!trends[key]) {
        trends[key] = { date: key, diagnoses: 0, procedures: 0, aiDiagnoses: 0, aiProcedures: 0, revenue: 0 };
      }
      trends[key].diagnoses++;
      if (d.aiSuggested) trends[key].aiDiagnoses++;
    }

    for (const p of procedures) {
      const key = formatDate(p.createdAt);
      if (!trends[key]) {
        trends[key] = { date: key, diagnoses: 0, procedures: 0, aiDiagnoses: 0, aiProcedures: 0, revenue: 0 };
      }
      trends[key].procedures++;
      if (p.aiSuggested) trends[key].aiProcedures++;
      trends[key].revenue += Number(p.price) * p.units;
    }

    return Object.values(trends).sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get top ICD-CPT code pairs
   */
  async getTopCodePairs(hospitalId: string, dateRange?: DateRange, limit: number = 10) {
    // Get consultations with both diagnoses and procedures
    const consultationWhere: Prisma.ConsultationWhereInput = {
      appointment: { hospitalId },
    };

    if (dateRange) {
      consultationWhere.createdAt = {
        gte: dateRange.startDate,
        lte: dateRange.endDate,
      };
    }

    const consultations = await prisma.consultation.findMany({
      where: consultationWhere,
      include: {
        consultationDiagnoses: {
          include: {
            icd10Code: { select: { code: true, description: true } },
          },
        },
        consultationProcedures: {
          include: {
            cptCode: { select: { code: true, description: true } },
          },
        },
      },
    });

    // Count code pairs
    const pairCounts: Record<string, {
      icdCode: string;
      icdDescription: string;
      cptCode: string;
      cptDescription: string;
      count: number;
    }> = {};

    for (const consultation of consultations) {
      for (const diag of consultation.consultationDiagnoses) {
        for (const proc of consultation.consultationProcedures) {
          const key = `${diag.icd10Code.code}|${proc.cptCode.code}`;
          if (!pairCounts[key]) {
            pairCounts[key] = {
              icdCode: diag.icd10Code.code,
              icdDescription: diag.icd10Code.description,
              cptCode: proc.cptCode.code,
              cptDescription: proc.cptCode.description,
              count: 0,
            };
          }
          pairCounts[key].count++;
        }
      }
    }

    return Object.values(pairCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Get specificity analysis for ICD codes
   */
  async getSpecificityAnalysis(hospitalId: string, dateRange?: DateRange) {
    const where: Prisma.ConsultationDiagnosisWhereInput = {
      consultation: {
        appointment: { hospitalId },
      },
    };

    if (dateRange) {
      where.createdAt = {
        gte: dateRange.startDate,
        lte: dateRange.endDate,
      };
    }

    const diagnoses = await prisma.consultationDiagnosis.findMany({
      where,
      include: {
        icd10Code: {
          select: {
            code: true,
            description: true,
            specificityLevel: true,
            isUnspecified: true,
          },
        },
      },
    });

    const specificityCounts: Record<string, number> = {
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      UNSPECIFIED: 0,
    };

    const unspecifiedCodes: Array<{ code: string; description: string; count: number }> = [];
    const unspecifiedMap: Record<string, { code: string; description: string; count: number }> = {};

    for (const diag of diagnoses) {
      const level = diag.icd10Code.specificityLevel || 'LOW';
      if (diag.icd10Code.isUnspecified) {
        specificityCounts.UNSPECIFIED++;
        if (!unspecifiedMap[diag.icd10Code.code]) {
          unspecifiedMap[diag.icd10Code.code] = {
            code: diag.icd10Code.code,
            description: diag.icd10Code.description,
            count: 0,
          };
        }
        unspecifiedMap[diag.icd10Code.code].count++;
      } else {
        specificityCounts[level]++;
      }
    }

    const total = diagnoses.length;

    return {
      distribution: Object.entries(specificityCounts).map(([level, count]) => ({
        level,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      })),
      unspecifiedCodes: Object.values(unspecifiedMap)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      recommendations: specificityCounts.UNSPECIFIED > total * 0.1
        ? ['High usage of unspecified codes detected. Consider using more specific ICD-10 codes to improve claim acceptance.']
        : [],
    };
  }

  /**
   * Get summary dashboard metrics
   */
  async getDashboardMetrics(hospitalId: string, dateRange?: DateRange) {
    const diagnosisWhere: Prisma.ConsultationDiagnosisWhereInput = {
      consultation: {
        appointment: { hospitalId },
      },
    };

    const procedureWhere: Prisma.ConsultationProcedureWhereInput = {
      consultation: {
        appointment: { hospitalId },
      },
    };

    if (dateRange) {
      diagnosisWhere.createdAt = {
        gte: dateRange.startDate,
        lte: dateRange.endDate,
      };
      procedureWhere.createdAt = {
        gte: dateRange.startDate,
        lte: dateRange.endDate,
      };
    }

    const [
      totalDiagnoses,
      totalProcedures,
      uniqueIcdCodes,
      uniqueCptCodes,
      revenueAgg,
      aiAdoption,
    ] = await Promise.all([
      prisma.consultationDiagnosis.count({ where: diagnosisWhere }),
      prisma.consultationProcedure.count({ where: procedureWhere }),
      prisma.consultationDiagnosis.findMany({
        where: diagnosisWhere,
        distinct: ['icd10CodeId'],
        select: { icd10CodeId: true },
      }),
      prisma.consultationProcedure.findMany({
        where: procedureWhere,
        distinct: ['cptCodeId'],
        select: { cptCodeId: true },
      }),
      prisma.consultationProcedure.aggregate({
        where: procedureWhere,
        _sum: { price: true },
      }),
      this.getAIAdoptionMetrics(hospitalId, dateRange),
    ]);

    return {
      totalDiagnoses,
      totalProcedures,
      uniqueIcdCodes: uniqueIcdCodes.length,
      uniqueCptCodes: uniqueCptCodes.length,
      totalRevenue: Number(revenueAgg._sum.price || 0),
      aiAdoptionRate: aiAdoption.overall.overallAdoptionRate,
      avgCodesPerEncounter: totalDiagnoses > 0 || totalProcedures > 0
        ? (totalDiagnoses + totalProcedures) / Math.max(totalDiagnoses, totalProcedures, 1)
        : 0,
    };
  }

  /**
   * Get discharge coding analytics
   */
  async getDischargeCodingAnalytics(hospitalId: string, dateRange?: DateRange) {
    const where: Prisma.DischargeCodingWhereInput = {
      admission: { hospitalId },
    };

    if (dateRange) {
      where.createdAt = {
        gte: dateRange.startDate,
        lte: dateRange.endDate,
      };
    }

    const [total, byStatus, avgCharges, avgAcceptance] = await Promise.all([
      prisma.dischargeCoding.count({ where }),
      prisma.dischargeCoding.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
      }),
      prisma.dischargeCoding.aggregate({
        where,
        _avg: { totalCharges: true },
      }),
      prisma.dischargeCoding.aggregate({
        where: { ...where, acceptancePrediction: { not: null } },
        _avg: { acceptancePrediction: true },
      }),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const s of byStatus) {
      statusCounts[s.status] = s._count.id;
    }

    return {
      total,
      byStatus: statusCounts,
      avgTotalCharges: Number(avgCharges._avg.totalCharges || 0),
      avgAcceptancePrediction: Number(avgAcceptance._avg.acceptancePrediction || 0),
      completionRate: total > 0
        ? ((statusCounts['FINALIZED'] || 0) + (statusCounts['SUBMITTED'] || 0)) / total * 100
        : 0,
    };
  }
}

export const codingAnalyticsService = new CodingAnalyticsService();
