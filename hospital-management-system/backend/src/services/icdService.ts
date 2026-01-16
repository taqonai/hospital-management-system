import prisma from '../config/database';
import { NotFoundError } from '../middleware/errorHandler';
import { Prisma } from '@prisma/client';

export interface ICD10CodeInput {
  code: string;
  description: string;
  shortDescription?: string;
  category: string;
  subcategory?: string;
  dhaApproved?: boolean;
  specificityLevel?: number;
  isUnspecified?: boolean;
  preferredCode?: string;
  isActive?: boolean;
  isBillable?: boolean;
  effectiveDate?: Date;
  terminationDate?: Date;
  notes?: string;
}

export interface ICD10SearchParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  dhaApproved?: boolean;
  isActive?: boolean;
  isBillable?: boolean;
  specificityLevel?: number;
}

export class ICDService {
  /**
   * Create a new ICD-10 code
   */
  async create(hospitalId: string, data: ICD10CodeInput, createdBy?: string) {
    return prisma.iCD10Code.create({
      data: {
        hospitalId,
        code: data.code.toUpperCase(),
        description: data.description,
        shortDescription: data.shortDescription,
        category: data.category,
        subcategory: data.subcategory,
        dhaApproved: data.dhaApproved ?? true,
        specificityLevel: data.specificityLevel ?? 3,
        isUnspecified: data.isUnspecified ?? false,
        preferredCode: data.preferredCode,
        isActive: data.isActive ?? true,
        isBillable: data.isBillable ?? true,
        effectiveDate: data.effectiveDate ?? new Date(),
        terminationDate: data.terminationDate,
        notes: data.notes,
        createdBy,
      },
    });
  }

  /**
   * Get all ICD-10 codes with pagination and filtering
   */
  async getAll(hospitalId: string, params: ICD10SearchParams) {
    const {
      page = 1,
      limit = 50,
      search,
      category,
      dhaApproved,
      isActive,
      isBillable,
      specificityLevel,
    } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.ICD10CodeWhereInput = { hospitalId };

    // Text search on code and description
    if (search) {
      where.OR = [
        { code: { contains: search.toUpperCase(), mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { shortDescription: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (category) where.category = category;
    if (typeof dhaApproved === 'boolean') where.dhaApproved = dhaApproved;
    if (typeof isActive === 'boolean') where.isActive = isActive;
    if (typeof isBillable === 'boolean') where.isBillable = isBillable;
    if (specificityLevel) where.specificityLevel = specificityLevel;

    const [codes, total] = await Promise.all([
      prisma.iCD10Code.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ code: 'asc' }],
      }),
      prisma.iCD10Code.count({ where }),
    ]);

    return {
      codes,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get a single ICD-10 code by ID
   */
  async getById(id: string, hospitalId: string) {
    const code = await prisma.iCD10Code.findFirst({
      where: { id, hospitalId },
      include: {
        payerRules: {
          include: {
            payer: { select: { id: true, name: true, code: true } },
          },
        },
        icdCptMappings: {
          include: {
            cptCode: { select: { id: true, code: true, description: true } },
          },
        },
      },
    });

    if (!code) throw new NotFoundError('ICD-10 code not found');
    return code;
  }

  /**
   * Get ICD-10 code by code string
   */
  async getByCode(code: string, hospitalId: string) {
    const icdCode = await prisma.iCD10Code.findFirst({
      where: { code: code.toUpperCase(), hospitalId },
    });

    if (!icdCode) throw new NotFoundError(`ICD-10 code ${code} not found`);
    return icdCode;
  }

  /**
   * Update an ICD-10 code
   */
  async update(id: string, hospitalId: string, data: Partial<ICD10CodeInput>) {
    const existing = await prisma.iCD10Code.findFirst({
      where: { id, hospitalId },
    });

    if (!existing) throw new NotFoundError('ICD-10 code not found');

    return prisma.iCD10Code.update({
      where: { id },
      data: {
        ...data,
        code: data.code?.toUpperCase(),
      },
    });
  }

  /**
   * Soft delete an ICD-10 code
   */
  async delete(id: string, hospitalId: string) {
    const existing = await prisma.iCD10Code.findFirst({
      where: { id, hospitalId },
    });

    if (!existing) throw new NotFoundError('ICD-10 code not found');

    return prisma.iCD10Code.update({
      where: { id },
      data: { isActive: false, terminationDate: new Date() },
    });
  }

  /**
   * Bulk import ICD-10 codes
   */
  async bulkImport(
    hospitalId: string,
    codes: ICD10CodeInput[],
    createdBy?: string
  ) {
    const results = {
      created: 0,
      updated: 0,
      errors: [] as { code: string; error: string }[],
    };

    for (const codeData of codes) {
      try {
        const existing = await prisma.iCD10Code.findFirst({
          where: { hospitalId, code: codeData.code.toUpperCase() },
        });

        if (existing) {
          await prisma.iCD10Code.update({
            where: { id: existing.id },
            data: {
              description: codeData.description,
              shortDescription: codeData.shortDescription,
              category: codeData.category,
              subcategory: codeData.subcategory,
              dhaApproved: codeData.dhaApproved,
              specificityLevel: codeData.specificityLevel,
              isUnspecified: codeData.isUnspecified,
              preferredCode: codeData.preferredCode,
              isActive: codeData.isActive ?? true,
              isBillable: codeData.isBillable,
              notes: codeData.notes,
            },
          });
          results.updated++;
        } else {
          await this.create(hospitalId, codeData, createdBy);
          results.created++;
        }
      } catch (error: any) {
        results.errors.push({
          code: codeData.code,
          error: error.message || 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Get distinct categories
   */
  async getCategories(hospitalId: string) {
    const categories = await prisma.iCD10Code.findMany({
      where: { hospitalId, isActive: true },
      distinct: ['category'],
      select: { category: true },
      orderBy: { category: 'asc' },
    });

    return categories.map((c) => c.category);
  }

  /**
   * Search ICD-10 codes for autocomplete
   */
  async search(hospitalId: string, query: string, limit = 20) {
    if (!query || query.length < 2) return [];

    return prisma.iCD10Code.findMany({
      where: {
        hospitalId,
        isActive: true,
        OR: [
          { code: { startsWith: query.toUpperCase() } },
          { code: { contains: query.toUpperCase() } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        code: true,
        description: true,
        shortDescription: true,
        category: true,
        dhaApproved: true,
        specificityLevel: true,
        isUnspecified: true,
        preferredCode: true,
      },
      take: limit,
      orderBy: [
        { code: 'asc' },
      ],
    });
  }

  /**
   * Get usage statistics for ICD-10 codes
   */
  async getUsageStats(hospitalId: string, codeId: string, startDate?: Date, endDate?: Date) {
    const where: Prisma.ConsultationDiagnosisWhereInput = {
      icd10CodeId: codeId,
      consultation: {
        appointment: {
          hospitalId,
        },
      },
    };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [consultationCount, dischargeCount] = await Promise.all([
      prisma.consultationDiagnosis.count({ where }),
      prisma.dischargeDiagnosis.count({
        where: {
          icd10CodeId: codeId,
          dischargeCoding: {
            admission: {
              hospitalId,
            },
          },
        },
      }),
    ]);

    return {
      totalUsage: consultationCount + dischargeCount,
      consultationUsage: consultationCount,
      dischargeUsage: dischargeCount,
    };
  }

  /**
   * Find more specific codes for an unspecified code
   */
  async findMoreSpecificCodes(hospitalId: string, code: string) {
    // If code is like J18.9, find J18.0, J18.1, etc.
    const baseCode = code.split('.')[0];

    return prisma.iCD10Code.findMany({
      where: {
        hospitalId,
        isActive: true,
        code: { startsWith: baseCode },
        isUnspecified: false,
        NOT: { code },
      },
      orderBy: { code: 'asc' },
    });
  }
}

export const icdService = new ICDService();
