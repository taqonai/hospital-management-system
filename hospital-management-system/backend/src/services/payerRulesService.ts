import prisma from '../config/database';
import { NotFoundError } from '../middleware/errorHandler';
import { Prisma } from '@prisma/client';

export interface ICD10PayerRuleInput {
  icd10CodeId: string;
  isCovered?: boolean;
  requiresPreAuth?: boolean;
  maxVisitsPerYear?: number;
  waitingPeriodDays?: number;
  copayAmount?: number;
  copayPercentage?: number;
  deductibleApplies?: boolean;
  ageMinimum?: number;
  ageMaximum?: number;
  genderRestriction?: string;
  priorDiagRequired?: string;
  documentationNotes?: string;
  effectiveDate?: Date;
  terminationDate?: Date;
  isActive?: boolean;
}

export interface CPTPayerRuleInput {
  cptCodeId: string;
  isCovered?: boolean;
  requiresPreAuth?: boolean;
  priceOverride?: number;
  maxUnitsPerVisit?: number;
  maxUnitsPerYear?: number;
  frequencyLimit?: string;
  ageMinimum?: number;
  ageMaximum?: number;
  genderRestriction?: string;
  placeOfService?: string[];
  requiresModifier?: string[];
  documentationNotes?: string;
  effectiveDate?: Date;
  terminationDate?: Date;
  isActive?: boolean;
}

export class PayerRulesService {
  // ==================== ICD-10 Payer Rules ====================

  /**
   * Create an ICD-10 payer rule
   */
  async createICDRule(payerId: string, data: ICD10PayerRuleInput) {
    return prisma.iCD10PayerRule.create({
      data: {
        payerId,
        icd10CodeId: data.icd10CodeId,
        isCovered: data.isCovered ?? true,
        requiresPreAuth: data.requiresPreAuth ?? false,
        maxVisitsPerYear: data.maxVisitsPerYear,
        waitingPeriodDays: data.waitingPeriodDays,
        copayAmount: data.copayAmount,
        copayPercentage: data.copayPercentage,
        deductibleApplies: data.deductibleApplies ?? true,
        ageMinimum: data.ageMinimum,
        ageMaximum: data.ageMaximum,
        genderRestriction: data.genderRestriction,
        priorDiagRequired: data.priorDiagRequired,
        documentationNotes: data.documentationNotes,
        effectiveDate: data.effectiveDate ?? new Date(),
        terminationDate: data.terminationDate,
        isActive: data.isActive ?? true,
      },
      include: {
        icd10Code: { select: { id: true, code: true, description: true } },
      },
    });
  }

  /**
   * Get all ICD-10 rules for a payer
   */
  async getICDRulesForPayer(payerId: string, params?: { search?: string; isActive?: boolean }) {
    const where: Prisma.ICD10PayerRuleWhereInput = { payerId };

    if (params?.isActive !== undefined) where.isActive = params.isActive;

    if (params?.search) {
      where.icd10Code = {
        OR: [
          { code: { contains: params.search.toUpperCase(), mode: 'insensitive' } },
          { description: { contains: params.search, mode: 'insensitive' } },
        ],
      };
    }

    return prisma.iCD10PayerRule.findMany({
      where,
      include: {
        icd10Code: {
          select: {
            id: true,
            code: true,
            description: true,
            category: true,
            dhaApproved: true,
          },
        },
      },
      orderBy: { icd10Code: { code: 'asc' } },
    });
  }

  /**
   * Get ICD-10 rule for specific payer and code
   */
  async getICDRule(payerId: string, icdCodeId: string) {
    const rule = await prisma.iCD10PayerRule.findFirst({
      where: { payerId, icd10CodeId: icdCodeId },
      include: {
        payer: { select: { id: true, name: true, code: true } },
        icd10Code: { select: { id: true, code: true, description: true, category: true } },
      },
    });

    return rule;
  }

  /**
   * Update an ICD-10 payer rule
   */
  async updateICDRule(ruleId: string, data: Partial<ICD10PayerRuleInput>) {
    const existing = await prisma.iCD10PayerRule.findUnique({ where: { id: ruleId } });
    if (!existing) throw new NotFoundError('ICD-10 payer rule not found');

    return prisma.iCD10PayerRule.update({
      where: { id: ruleId },
      data,
      include: {
        icd10Code: { select: { id: true, code: true, description: true } },
      },
    });
  }

  /**
   * Delete an ICD-10 payer rule
   */
  async deleteICDRule(ruleId: string) {
    const existing = await prisma.iCD10PayerRule.findUnique({ where: { id: ruleId } });
    if (!existing) throw new NotFoundError('ICD-10 payer rule not found');

    return prisma.iCD10PayerRule.delete({ where: { id: ruleId } });
  }

  // ==================== CPT Payer Rules ====================

  /**
   * Create a CPT payer rule
   */
  async createCPTRule(payerId: string, data: CPTPayerRuleInput) {
    return prisma.cPTPayerRule.create({
      data: {
        payerId,
        cptCodeId: data.cptCodeId,
        isCovered: data.isCovered ?? true,
        requiresPreAuth: data.requiresPreAuth ?? false,
        priceOverride: data.priceOverride,
        maxUnitsPerVisit: data.maxUnitsPerVisit,
        maxUnitsPerYear: data.maxUnitsPerYear,
        frequencyLimit: data.frequencyLimit,
        ageMinimum: data.ageMinimum,
        ageMaximum: data.ageMaximum,
        genderRestriction: data.genderRestriction,
        placeOfService: data.placeOfService ?? [],
        requiresModifier: data.requiresModifier ?? [],
        documentationNotes: data.documentationNotes,
        effectiveDate: data.effectiveDate ?? new Date(),
        terminationDate: data.terminationDate,
        isActive: data.isActive ?? true,
      },
      include: {
        cptCode: { select: { id: true, code: true, description: true, basePrice: true } },
      },
    });
  }

  /**
   * Get all CPT rules for a payer
   */
  async getCPTRulesForPayer(payerId: string, params?: { search?: string; isActive?: boolean }) {
    const where: Prisma.CPTPayerRuleWhereInput = { payerId };

    if (params?.isActive !== undefined) where.isActive = params.isActive;

    if (params?.search) {
      where.cptCode = {
        OR: [
          { code: { contains: params.search, mode: 'insensitive' } },
          { description: { contains: params.search, mode: 'insensitive' } },
        ],
      };
    }

    return prisma.cPTPayerRule.findMany({
      where,
      include: {
        cptCode: {
          select: {
            id: true,
            code: true,
            description: true,
            category: true,
            basePrice: true,
            dhaPrice: true,
            requiresPreAuth: true,
          },
        },
      },
      orderBy: { cptCode: { code: 'asc' } },
    });
  }

  /**
   * Get CPT rule for specific payer and code
   */
  async getCPTRule(payerId: string, cptCodeId: string) {
    const rule = await prisma.cPTPayerRule.findFirst({
      where: { payerId, cptCodeId },
      include: {
        payer: { select: { id: true, name: true, code: true } },
        cptCode: { select: { id: true, code: true, description: true, category: true, basePrice: true } },
      },
    });

    return rule;
  }

  /**
   * Update a CPT payer rule
   */
  async updateCPTRule(ruleId: string, data: Partial<CPTPayerRuleInput>) {
    const existing = await prisma.cPTPayerRule.findUnique({ where: { id: ruleId } });
    if (!existing) throw new NotFoundError('CPT payer rule not found');

    return prisma.cPTPayerRule.update({
      where: { id: ruleId },
      data,
      include: {
        cptCode: { select: { id: true, code: true, description: true, basePrice: true } },
      },
    });
  }

  /**
   * Delete a CPT payer rule
   */
  async deleteCPTRule(ruleId: string) {
    const existing = await prisma.cPTPayerRule.findUnique({ where: { id: ruleId } });
    if (!existing) throw new NotFoundError('CPT payer rule not found');

    return prisma.cPTPayerRule.delete({ where: { id: ruleId } });
  }

  // ==================== Coverage Checks ====================

  /**
   * Check if an ICD code is covered by a payer
   */
  async checkICDCoverage(payerId: string, icdCode: string, patientAge?: number, patientGender?: string) {
    const rule = await prisma.iCD10PayerRule.findFirst({
      where: {
        payerId,
        icd10Code: { code: icdCode.toUpperCase() },
        isActive: true,
      },
      include: {
        icd10Code: { select: { code: true, description: true } },
        payer: { select: { name: true } },
      },
    });

    if (!rule) {
      return {
        covered: true, // Default to covered if no rule exists
        hasRule: false,
        message: 'No specific payer rule found for this diagnosis',
      };
    }

    // Check age restrictions
    if (patientAge !== undefined) {
      if (rule.ageMinimum && patientAge < rule.ageMinimum) {
        return {
          covered: false,
          hasRule: true,
          rule,
          message: `Age restriction: Patient must be at least ${rule.ageMinimum} years old`,
        };
      }
      if (rule.ageMaximum && patientAge > rule.ageMaximum) {
        return {
          covered: false,
          hasRule: true,
          rule,
          message: `Age restriction: Patient must be under ${rule.ageMaximum} years old`,
        };
      }
    }

    // Check gender restrictions
    if (rule.genderRestriction && patientGender && rule.genderRestriction !== patientGender) {
      return {
        covered: false,
        hasRule: true,
        rule,
        message: `Gender restriction: Only for ${rule.genderRestriction === 'M' ? 'Male' : 'Female'} patients`,
      };
    }

    return {
      covered: rule.isCovered,
      hasRule: true,
      rule,
      requiresPreAuth: rule.requiresPreAuth,
      copayAmount: rule.copayAmount,
      copayPercentage: rule.copayPercentage,
      documentationNotes: rule.documentationNotes,
    };
  }

  /**
   * Check if a CPT code is covered by a payer
   */
  async checkCPTCoverage(
    payerId: string,
    cptCode: string,
    patientAge?: number,
    patientGender?: string,
    placeOfService?: string
  ) {
    const rule = await prisma.cPTPayerRule.findFirst({
      where: {
        payerId,
        cptCode: { code: cptCode },
        isActive: true,
      },
      include: {
        cptCode: { select: { code: true, description: true, basePrice: true } },
        payer: { select: { name: true } },
      },
    });

    if (!rule) {
      return {
        covered: true, // Default to covered if no rule exists
        hasRule: false,
        message: 'No specific payer rule found for this procedure',
      };
    }

    // Check age restrictions
    if (patientAge !== undefined) {
      if (rule.ageMinimum && patientAge < rule.ageMinimum) {
        return {
          covered: false,
          hasRule: true,
          rule,
          message: `Age restriction: Patient must be at least ${rule.ageMinimum} years old`,
        };
      }
      if (rule.ageMaximum && patientAge > rule.ageMaximum) {
        return {
          covered: false,
          hasRule: true,
          rule,
          message: `Age restriction: Patient must be under ${rule.ageMaximum} years old`,
        };
      }
    }

    // Check gender restrictions
    if (rule.genderRestriction && patientGender && rule.genderRestriction !== patientGender) {
      return {
        covered: false,
        hasRule: true,
        rule,
        message: `Gender restriction: Only for ${rule.genderRestriction === 'M' ? 'Male' : 'Female'} patients`,
      };
    }

    // Check place of service
    if (placeOfService && rule.placeOfService.length > 0) {
      if (!rule.placeOfService.includes(placeOfService)) {
        return {
          covered: false,
          hasRule: true,
          rule,
          message: `Place of service restriction: Only allowed in ${rule.placeOfService.join(', ')}`,
        };
      }
    }

    return {
      covered: rule.isCovered,
      hasRule: true,
      rule,
      requiresPreAuth: rule.requiresPreAuth,
      priceOverride: rule.priceOverride,
      maxUnitsPerVisit: rule.maxUnitsPerVisit,
      requiredModifiers: rule.requiresModifier,
      documentationNotes: rule.documentationNotes,
    };
  }

  /**
   * Bulk import ICD rules for a payer
   */
  async bulkImportICDRules(payerId: string, rules: ICD10PayerRuleInput[]) {
    const results = { created: 0, updated: 0, errors: [] as { code: string; error: string }[] };

    for (const rule of rules) {
      try {
        const existing = await prisma.iCD10PayerRule.findFirst({
          where: { payerId, icd10CodeId: rule.icd10CodeId },
        });

        if (existing) {
          await prisma.iCD10PayerRule.update({
            where: { id: existing.id },
            data: rule,
          });
          results.updated++;
        } else {
          await this.createICDRule(payerId, rule);
          results.created++;
        }
      } catch (error: any) {
        results.errors.push({
          code: rule.icd10CodeId,
          error: error.message || 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Bulk import CPT rules for a payer
   */
  async bulkImportCPTRules(payerId: string, rules: CPTPayerRuleInput[]) {
    const results = { created: 0, updated: 0, errors: [] as { code: string; error: string }[] };

    for (const rule of rules) {
      try {
        const existing = await prisma.cPTPayerRule.findFirst({
          where: { payerId, cptCodeId: rule.cptCodeId },
        });

        if (existing) {
          await prisma.cPTPayerRule.update({
            where: { id: existing.id },
            data: rule,
          });
          results.updated++;
        } else {
          await this.createCPTRule(payerId, rule);
          results.created++;
        }
      } catch (error: any) {
        results.errors.push({
          code: rule.cptCodeId,
          error: error.message || 'Unknown error',
        });
      }
    }

    return results;
  }
}

export const payerRulesService = new PayerRulesService();
