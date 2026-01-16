import prisma from '../config/database';
import { NotFoundError } from '../middleware/errorHandler';
import { Prisma } from '@prisma/client';

export interface ICD10CPTMappingInput {
  icd10CodeId: string;
  cptCodeId: string;
  validityScore?: number;
  isRequired?: boolean;
  isCommon?: boolean;
  documentation?: string;
  notes?: string;
  isActive?: boolean;
}

export interface MappingSearchParams {
  page?: number;
  limit?: number;
  search?: string;
  icd10CodeId?: string;
  cptCodeId?: string;
  isRequired?: boolean;
  isCommon?: boolean;
  isActive?: boolean;
}

export class MedicalNecessityService {
  /**
   * Create an ICD-10 to CPT mapping
   */
  async createMapping(hospitalId: string, data: ICD10CPTMappingInput, createdBy?: string) {
    return prisma.iCD10CPTMapping.create({
      data: {
        hospitalId,
        icd10CodeId: data.icd10CodeId,
        cptCodeId: data.cptCodeId,
        validityScore: data.validityScore ?? 1.0,
        isRequired: data.isRequired ?? false,
        isCommon: data.isCommon ?? true,
        documentation: data.documentation,
        notes: data.notes,
        isActive: data.isActive ?? true,
        createdBy,
      },
      include: {
        icd10Code: { select: { id: true, code: true, description: true } },
        cptCode: { select: { id: true, code: true, description: true, basePrice: true } },
      },
    });
  }

  /**
   * Get all mappings with pagination and filtering
   */
  async getMappings(hospitalId: string, params: MappingSearchParams) {
    const {
      page = 1,
      limit = 50,
      search,
      icd10CodeId,
      cptCodeId,
      isRequired,
      isCommon,
      isActive,
    } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.ICD10CPTMappingWhereInput = { hospitalId };

    if (icd10CodeId) where.icd10CodeId = icd10CodeId;
    if (cptCodeId) where.cptCodeId = cptCodeId;
    if (typeof isRequired === 'boolean') where.isRequired = isRequired;
    if (typeof isCommon === 'boolean') where.isCommon = isCommon;
    if (typeof isActive === 'boolean') where.isActive = isActive;

    if (search) {
      where.OR = [
        { icd10Code: { code: { contains: search.toUpperCase(), mode: 'insensitive' } } },
        { icd10Code: { description: { contains: search, mode: 'insensitive' } } },
        { cptCode: { code: { contains: search, mode: 'insensitive' } } },
        { cptCode: { description: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [mappings, total] = await Promise.all([
      prisma.iCD10CPTMapping.findMany({
        where,
        skip,
        take: limit,
        include: {
          icd10Code: { select: { id: true, code: true, description: true, category: true } },
          cptCode: { select: { id: true, code: true, description: true, category: true, basePrice: true } },
        },
        orderBy: [{ validityScore: 'desc' }, { icd10Code: { code: 'asc' } }],
      }),
      prisma.iCD10CPTMapping.count({ where }),
    ]);

    return {
      mappings,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get valid CPT codes for an ICD-10 code
   */
  async getValidCPTsForICD(hospitalId: string, icd10CodeId: string) {
    return prisma.iCD10CPTMapping.findMany({
      where: {
        hospitalId,
        icd10CodeId,
        isActive: true,
      },
      include: {
        cptCode: {
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
        },
      },
      orderBy: [{ isRequired: 'desc' }, { validityScore: 'desc' }],
    });
  }

  /**
   * Get valid ICD-10 codes for a CPT code (reverse lookup)
   */
  async getValidICDsForCPT(hospitalId: string, cptCodeId: string) {
    return prisma.iCD10CPTMapping.findMany({
      where: {
        hospitalId,
        cptCodeId,
        isActive: true,
      },
      include: {
        icd10Code: {
          select: {
            id: true,
            code: true,
            description: true,
            shortDescription: true,
            category: true,
            dhaApproved: true,
          },
        },
      },
      orderBy: [{ isRequired: 'desc' }, { validityScore: 'desc' }],
    });
  }

  /**
   * Validate an ICD-10 + CPT pair
   */
  async validatePair(hospitalId: string, icd10Code: string, cptCode: string) {
    // Find the ICD and CPT codes
    const icd = await prisma.iCD10Code.findFirst({
      where: { hospitalId, code: icd10Code.toUpperCase() },
    });

    const cpt = await prisma.cPTCode.findFirst({
      where: { hospitalId, code: cptCode },
    });

    if (!icd) {
      return {
        valid: false,
        reason: `ICD-10 code ${icd10Code} not found`,
        icd10Code,
        cptCode,
      };
    }

    if (!cpt) {
      return {
        valid: false,
        reason: `CPT code ${cptCode} not found`,
        icd10Code,
        cptCode,
      };
    }

    // Check for existing mapping
    const mapping = await prisma.iCD10CPTMapping.findFirst({
      where: {
        hospitalId,
        icd10CodeId: icd.id,
        cptCodeId: cpt.id,
        isActive: true,
      },
    });

    if (mapping) {
      return {
        valid: true,
        validityScore: Number(mapping.validityScore),
        isRequired: mapping.isRequired,
        isCommon: mapping.isCommon,
        documentation: mapping.documentation,
        icd10Code: icd.code,
        cptCode: cpt.code,
        mappingId: mapping.id,
      };
    }

    // No mapping found - could be valid but not explicitly mapped
    return {
      valid: true, // Allow by default if no mapping
      validityScore: 0.5, // Lower confidence
      isRequired: false,
      isCommon: false,
      reason: 'No explicit mapping found - manual verification recommended',
      icd10Code: icd.code,
      cptCode: cpt.code,
    };
  }

  /**
   * Update a mapping
   */
  async updateMapping(id: string, hospitalId: string, data: Partial<ICD10CPTMappingInput>) {
    const existing = await prisma.iCD10CPTMapping.findFirst({
      where: { id, hospitalId },
    });

    if (!existing) throw new NotFoundError('ICD-CPT mapping not found');

    return prisma.iCD10CPTMapping.update({
      where: { id },
      data,
      include: {
        icd10Code: { select: { id: true, code: true, description: true } },
        cptCode: { select: { id: true, code: true, description: true, basePrice: true } },
      },
    });
  }

  /**
   * Delete a mapping
   */
  async deleteMapping(id: string, hospitalId: string) {
    const existing = await prisma.iCD10CPTMapping.findFirst({
      where: { id, hospitalId },
    });

    if (!existing) throw new NotFoundError('ICD-CPT mapping not found');

    return prisma.iCD10CPTMapping.delete({ where: { id } });
  }

  /**
   * Bulk import mappings
   */
  async bulkImport(hospitalId: string, mappings: ICD10CPTMappingInput[], createdBy?: string) {
    const results = {
      created: 0,
      updated: 0,
      errors: [] as { icd10CodeId: string; cptCodeId: string; error: string }[],
    };

    for (const mapping of mappings) {
      try {
        const existing = await prisma.iCD10CPTMapping.findFirst({
          where: {
            hospitalId,
            icd10CodeId: mapping.icd10CodeId,
            cptCodeId: mapping.cptCodeId,
          },
        });

        if (existing) {
          await prisma.iCD10CPTMapping.update({
            where: { id: existing.id },
            data: {
              validityScore: mapping.validityScore,
              isRequired: mapping.isRequired,
              isCommon: mapping.isCommon,
              documentation: mapping.documentation,
              notes: mapping.notes,
              isActive: mapping.isActive ?? true,
            },
          });
          results.updated++;
        } else {
          await this.createMapping(hospitalId, mapping, createdBy);
          results.created++;
        }
      } catch (error: any) {
        results.errors.push({
          icd10CodeId: mapping.icd10CodeId,
          cptCodeId: mapping.cptCodeId,
          error: error.message || 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Get required CPT codes for a set of ICD-10 codes
   */
  async getRequiredCPTsForICDs(hospitalId: string, icd10CodeIds: string[]) {
    const mappings = await prisma.iCD10CPTMapping.findMany({
      where: {
        hospitalId,
        icd10CodeId: { in: icd10CodeIds },
        isRequired: true,
        isActive: true,
      },
      include: {
        icd10Code: { select: { id: true, code: true, description: true } },
        cptCode: { select: { id: true, code: true, description: true, basePrice: true } },
      },
    });

    // Group by ICD code
    const grouped = mappings.reduce((acc, m) => {
      const key = m.icd10CodeId;
      if (!acc[key]) acc[key] = [];
      acc[key].push(m);
      return acc;
    }, {} as Record<string, typeof mappings>);

    return grouped;
  }

  /**
   * Suggest CPT codes based on ICD-10 codes
   */
  async suggestCPTsForDiagnoses(hospitalId: string, icdCodes: string[]) {
    // Find ICD code IDs
    const icds = await prisma.iCD10Code.findMany({
      where: {
        hospitalId,
        code: { in: icdCodes.map((c) => c.toUpperCase()) },
      },
    });

    const icdIds = icds.map((i) => i.id);

    // Get all mappings for these ICDs
    const mappings = await prisma.iCD10CPTMapping.findMany({
      where: {
        hospitalId,
        icd10CodeId: { in: icdIds },
        isActive: true,
      },
      include: {
        icd10Code: { select: { id: true, code: true } },
        cptCode: {
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
        },
      },
      orderBy: [{ isRequired: 'desc' }, { validityScore: 'desc' }],
    });

    // Deduplicate CPT codes and aggregate scores
    const cptMap = new Map<string, {
      cptCode: typeof mappings[0]['cptCode'];
      maxScore: number;
      isRequired: boolean;
      supportingICDs: string[];
    }>();

    for (const m of mappings) {
      const existing = cptMap.get(m.cptCodeId);
      if (existing) {
        existing.maxScore = Math.max(existing.maxScore, Number(m.validityScore));
        existing.isRequired = existing.isRequired || m.isRequired;
        existing.supportingICDs.push(m.icd10Code.code);
      } else {
        cptMap.set(m.cptCodeId, {
          cptCode: m.cptCode,
          maxScore: Number(m.validityScore),
          isRequired: m.isRequired,
          supportingICDs: [m.icd10Code.code],
        });
      }
    }

    // Sort by required first, then score
    return Array.from(cptMap.values())
      .sort((a, b) => {
        if (a.isRequired !== b.isRequired) return a.isRequired ? -1 : 1;
        return b.maxScore - a.maxScore;
      });
  }
}

export const medicalNecessityService = new MedicalNecessityService();
