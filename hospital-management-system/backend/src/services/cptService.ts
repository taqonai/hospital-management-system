import prisma from '../config/database';
import { NotFoundError } from '../middleware/errorHandler';
import { Prisma } from '@prisma/client';

export interface CPTCodeInput {
  code: string;
  description: string;
  shortDescription?: string;
  category: string;
  subcategory?: string;
  basePrice: number;
  dhaPrice?: number;
  cashPrice?: number;
  requiresPreAuth?: boolean;
  isActive?: boolean;
  workRVU?: number;
  facilityRVU?: number;
  malpracticeRVU?: number;
  globalPeriod?: number;
  professionalComponent?: boolean;
  technicalComponent?: boolean;
  bundledWith?: string[];
  excludedWith?: string[];
  requiresModifier?: string[];
  effectiveDate?: Date;
  terminationDate?: Date;
  notes?: string;
}

export interface CPTSearchParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  requiresPreAuth?: boolean;
  isActive?: boolean;
  minPrice?: number;
  maxPrice?: number;
}

export interface CPTModifierInput {
  code: string;
  description: string;
  priceImpact?: number;
  isActive?: boolean;
  notes?: string;
}

export class CPTService {
  /**
   * Create a new CPT code
   */
  async create(hospitalId: string, data: CPTCodeInput, createdBy?: string) {
    return prisma.cPTCode.create({
      data: {
        hospitalId,
        code: data.code,
        description: data.description,
        shortDescription: data.shortDescription,
        category: data.category,
        subcategory: data.subcategory,
        basePrice: data.basePrice,
        dhaPrice: data.dhaPrice,
        cashPrice: data.cashPrice,
        requiresPreAuth: data.requiresPreAuth ?? false,
        isActive: data.isActive ?? true,
        workRVU: data.workRVU,
        facilityRVU: data.facilityRVU,
        malpracticeRVU: data.malpracticeRVU,
        globalPeriod: data.globalPeriod,
        professionalComponent: data.professionalComponent ?? false,
        technicalComponent: data.technicalComponent ?? false,
        bundledWith: data.bundledWith ?? [],
        excludedWith: data.excludedWith ?? [],
        requiresModifier: data.requiresModifier ?? [],
        effectiveDate: data.effectiveDate ?? new Date(),
        terminationDate: data.terminationDate,
        notes: data.notes,
        createdBy,
      },
    });
  }

  /**
   * Get all CPT codes with pagination and filtering
   */
  async getAll(hospitalId: string, params: CPTSearchParams) {
    const {
      page = 1,
      limit = 50,
      search,
      category,
      requiresPreAuth,
      isActive,
      minPrice,
      maxPrice,
    } = params;
    const skip = (page - 1) * limit;

    const where: any = { hospitalId };

    // Text search on code and description
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { shortDescription: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (category) where.category = category;
    if (typeof requiresPreAuth === 'boolean') where.requiresPreAuth = requiresPreAuth;
    if (typeof isActive === 'boolean') where.isActive = isActive;

    if (minPrice || maxPrice) {
      where.basePrice = {};
      if (minPrice) where.basePrice.gte = minPrice;
      if (maxPrice) where.basePrice.lte = maxPrice;
    }

    const [codes, total] = await Promise.all([
      prisma.cPTCode.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ code: 'asc' }],
      }),
      prisma.cPTCode.count({ where }),
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
   * Get a single CPT code by ID
   */
  async getById(id: string, hospitalId: string) {
    const code = await prisma.cPTCode.findFirst({
      where: { id, hospitalId },
      include: {
        payerRules: {
          include: {
            payer: { select: { id: true, name: true, code: true } },
          },
        },
        icdCptMappings: {
          include: {
            icd10Code: { select: { id: true, code: true, description: true } },
          },
        },
      },
    });

    if (!code) throw new NotFoundError('CPT code not found');
    return code;
  }

  /**
   * Get CPT code by code string
   */
  async getByCode(code: string, hospitalId: string) {
    const cptCode = await prisma.cPTCode.findFirst({
      where: { code, hospitalId },
    });

    if (!cptCode) throw new NotFoundError(`CPT code ${code} not found`);
    return cptCode;
  }

  /**
   * Update a CPT code
   */
  async update(id: string, hospitalId: string, data: Partial<CPTCodeInput>) {
    const existing = await prisma.cPTCode.findFirst({
      where: { id, hospitalId },
    });

    if (!existing) throw new NotFoundError('CPT code not found');

    return prisma.cPTCode.update({
      where: { id },
      data,
    });
  }

  /**
   * Soft delete a CPT code
   */
  async delete(id: string, hospitalId: string) {
    const existing = await prisma.cPTCode.findFirst({
      where: { id, hospitalId },
    });

    if (!existing) throw new NotFoundError('CPT code not found');

    return prisma.cPTCode.update({
      where: { id },
      data: { isActive: false, terminationDate: new Date() },
    });
  }

  /**
   * Bulk import CPT codes
   */
  async bulkImport(
    hospitalId: string,
    codes: CPTCodeInput[],
    createdBy?: string
  ) {
    const results = {
      created: 0,
      updated: 0,
      errors: [] as { code: string; error: string }[],
    };

    for (const codeData of codes) {
      try {
        const existing = await prisma.cPTCode.findFirst({
          where: { hospitalId, code: codeData.code },
        });

        if (existing) {
          await prisma.cPTCode.update({
            where: { id: existing.id },
            data: {
              description: codeData.description,
              shortDescription: codeData.shortDescription,
              category: codeData.category,
              subcategory: codeData.subcategory,
              basePrice: codeData.basePrice,
              dhaPrice: codeData.dhaPrice,
              cashPrice: codeData.cashPrice,
              requiresPreAuth: codeData.requiresPreAuth,
              isActive: codeData.isActive ?? true,
              workRVU: codeData.workRVU,
              facilityRVU: codeData.facilityRVU,
              malpracticeRVU: codeData.malpracticeRVU,
              globalPeriod: codeData.globalPeriod,
              professionalComponent: codeData.professionalComponent,
              technicalComponent: codeData.technicalComponent,
              bundledWith: codeData.bundledWith,
              excludedWith: codeData.excludedWith,
              requiresModifier: codeData.requiresModifier,
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
    const categories = await prisma.cPTCode.findMany({
      where: { hospitalId, isActive: true },
      distinct: ['category'],
      select: { category: true },
      orderBy: { category: 'asc' },
    });

    return categories.map((c) => c.category);
  }

  /**
   * Search CPT codes for autocomplete
   */
  async search(hospitalId: string, query: string, limit = 20) {
    if (!query || query.length < 2) return [];

    return prisma.cPTCode.findMany({
      where: {
        hospitalId,
        isActive: true,
        OR: [
          { code: { startsWith: query } },
          { code: { contains: query } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        code: true,
        description: true,
        shortDescription: true,
        category: true,
        basePrice: true,
        dhaPrice: true,
        requiresPreAuth: true,
      },
      take: limit,
      orderBy: [{ code: 'asc' }],
    });
  }

  /**
   * Get CPT codes that are commonly used with a specific ICD-10 code
   */
  async getRelatedCPTCodes(hospitalId: string, icd10CodeId: string) {
    const mappings = await prisma.iCD10CPTMapping.findMany({
      where: {
        hospitalId,
        icd10CodeId,
        isActive: true,
      },
      include: {
        cptCode: true,
      },
      orderBy: { validityScore: 'desc' },
    });

    return mappings.map((m) => ({
      ...m.cptCode,
      validityScore: m.validityScore,
      isRequired: m.isRequired,
      isCommon: m.isCommon,
    }));
  }

  /**
   * Check bundling rules - returns codes that cannot be billed together
   */
  async checkBundlingConflicts(hospitalId: string, cptCodes: string[]) {
    const conflicts: { code1: string; code2: string; reason: string }[] = [];

    const codes = await prisma.cPTCode.findMany({
      where: {
        hospitalId,
        code: { in: cptCodes },
      },
    });

    for (const code of codes) {
      // Check if any other selected codes are in the excludedWith list
      for (const otherCodeStr of cptCodes) {
        if (code.code !== otherCodeStr && code.excludedWith.includes(otherCodeStr)) {
          conflicts.push({
            code1: code.code,
            code2: otherCodeStr,
            reason: 'NCCI edit - codes cannot be billed together',
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Get usage statistics for CPT codes
   */
  async getUsageStats(hospitalId: string, codeId: string, startDate?: Date, endDate?: Date) {
    const dateFilter: any = {};
    if (startDate || endDate) {
      if (startDate) dateFilter.gte = startDate;
      if (endDate) dateFilter.lte = endDate;
    }

    const [consultationCount, dischargeCount] = await Promise.all([
      prisma.consultationProcedure.count({
        where: {
          cptCodeId: codeId,
          ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
        },
      }),
      prisma.dischargeProcedure.count({
        where: {
          cptCodeId: codeId,
          ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
        },
      }),
    ]);

    return {
      totalUsage: consultationCount + dischargeCount,
      consultationUsage: consultationCount,
      dischargeUsage: dischargeCount,
    };
  }

  // ==================== CPT Modifiers ====================

  /**
   * Create a CPT modifier
   */
  async createModifier(hospitalId: string, data: CPTModifierInput) {
    return prisma.cPTModifier.create({
      data: {
        hospitalId,
        code: data.code.toUpperCase(),
        description: data.description,
        priceImpact: data.priceImpact,
        isActive: data.isActive ?? true,
        notes: data.notes,
      },
    });
  }

  /**
   * Get all CPT modifiers
   */
  async getModifiers(hospitalId: string) {
    return prisma.cPTModifier.findMany({
      where: { hospitalId },
      orderBy: { code: 'asc' },
    });
  }

  /**
   * Update a CPT modifier
   */
  async updateModifier(id: string, hospitalId: string, data: Partial<CPTModifierInput>) {
    const existing = await prisma.cPTModifier.findFirst({
      where: { id, hospitalId },
    });

    if (!existing) throw new NotFoundError('CPT modifier not found');

    return prisma.cPTModifier.update({
      where: { id },
      data: {
        ...data,
        code: data.code?.toUpperCase(),
      },
    });
  }

  /**
   * Delete a CPT modifier
   */
  async deleteModifier(id: string, hospitalId: string) {
    const existing = await prisma.cPTModifier.findFirst({
      where: { id, hospitalId },
    });

    if (!existing) throw new NotFoundError('CPT modifier not found');

    return prisma.cPTModifier.delete({
      where: { id },
    });
  }

  /**
   * Bulk import CPT modifiers
   */
  async bulkImportModifiers(hospitalId: string, modifiers: CPTModifierInput[]) {
    const results = {
      created: 0,
      updated: 0,
      errors: [] as { code: string; error: string }[],
    };

    for (const modData of modifiers) {
      try {
        const existing = await prisma.cPTModifier.findFirst({
          where: { hospitalId, code: modData.code.toUpperCase() },
        });

        if (existing) {
          await prisma.cPTModifier.update({
            where: { id: existing.id },
            data: {
              description: modData.description,
              priceImpact: modData.priceImpact,
              isActive: modData.isActive ?? true,
              notes: modData.notes,
            },
          });
          results.updated++;
        } else {
          await this.createModifier(hospitalId, modData);
          results.created++;
        }
      } catch (error: any) {
        results.errors.push({
          code: modData.code,
          error: error.message || 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Calculate price with modifier
   */
  calculatePriceWithModifier(basePrice: number, modifierPriceImpact: number | null): number {
    if (!modifierPriceImpact) return basePrice;
    return basePrice * Number(modifierPriceImpact);
  }
}

export const cptService = new CPTService();
