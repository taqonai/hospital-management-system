import prisma from '../config/database';
import { NotFoundError } from '../middleware/errorHandler';
import { Decimal } from '@prisma/client/runtime/library';

export class ChargeManagementService {
  // ==================== CHARGE MASTER CRUD ====================

  async listCharges(hospitalId: string, params: {
    page?: number;
    limit?: number;
    category?: string;
    isActive?: boolean;
    search?: string;
  }) {
    const { page = 1, limit = 50, category, isActive, search } = params;
    const skip = (page - 1) * limit;

    const where: any = { hospitalId };
    
    if (category) where.category = category;
    if (isActive !== undefined) where.isActive = isActive;
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [charges, total] = await Promise.all([
      prisma.chargeMaster.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ category: 'asc' }, { code: 'asc' }],
      }),
      prisma.chargeMaster.count({ where }),
    ]);

    return {
      charges,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getChargeById(id: string, hospitalId: string) {
    const charge = await prisma.chargeMaster.findFirst({
      where: { id, hospitalId },
      include: {
        feeSchedules: {
          include: {
            insurancePayer: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
      },
    });

    if (!charge) throw new NotFoundError('Charge not found');
    return charge;
  }

  async createCharge(hospitalId: string, data: {
    code: string;
    description: string;
    category: string;
    defaultPrice: number;
    currency?: string;
    unit?: string;
    effectiveFrom?: Date;
    effectiveTo?: Date;
    createdBy: string;
  }) {
    // Check for duplicate code
    const existing = await prisma.chargeMaster.findUnique({
      where: {
        hospitalId_code: {
          hospitalId,
          code: data.code,
        },
      },
    });

    if (existing) {
      throw new Error(`Charge code ${data.code} already exists in this hospital`);
    }

    return prisma.chargeMaster.create({
      data: {
        hospitalId,
        code: data.code,
        description: data.description,
        category: data.category,
        defaultPrice: data.defaultPrice,
        currency: data.currency || 'AED',
        unit: data.unit,
        effectiveFrom: data.effectiveFrom || new Date(),
        effectiveTo: data.effectiveTo,
        createdBy: data.createdBy,
      },
    });
  }

  async updateCharge(id: string, hospitalId: string, data: {
    code?: string;
    description?: string;
    category?: string;
    defaultPrice?: number;
    currency?: string;
    unit?: string;
    effectiveFrom?: Date;
    effectiveTo?: Date;
  }) {
    const charge = await prisma.chargeMaster.findFirst({
      where: { id, hospitalId },
    });

    if (!charge) throw new NotFoundError('Charge not found');

    // If updating code, check for duplicates
    if (data.code && data.code !== charge.code) {
      const existing = await prisma.chargeMaster.findUnique({
        where: {
          hospitalId_code: {
            hospitalId,
            code: data.code,
          },
        },
      });

      if (existing) {
        throw new Error(`Charge code ${data.code} already exists in this hospital`);
      }
    }

    return prisma.chargeMaster.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  async deactivateCharge(id: string, hospitalId: string) {
    const charge = await prisma.chargeMaster.findFirst({
      where: { id, hospitalId },
    });

    if (!charge) throw new NotFoundError('Charge not found');

    return prisma.chargeMaster.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ==================== FEE SCHEDULE CRUD ====================

  async listFeeSchedules(hospitalId: string, params: {
    page?: number;
    limit?: number;
    chargeId?: string;
    payerId?: string;
  }) {
    const { page = 1, limit = 50, chargeId, payerId } = params;
    const skip = (page - 1) * limit;

    const where: any = { hospitalId };
    if (chargeId) where.chargeId = chargeId;
    if (payerId) where.payerId = payerId;

    const [schedules, total] = await Promise.all([
      prisma.feeSchedule.findMany({
        where,
        skip,
        take: limit,
        include: {
          charge: {
            select: {
              id: true,
              code: true,
              description: true,
              category: true,
              defaultPrice: true,
            },
          },
          insurancePayer: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.feeSchedule.count({ where }),
    ]);

    return {
      schedules,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async createFeeSchedule(hospitalId: string, data: {
    chargeId: string;
    payerId?: string;
    price: number;
    discount?: number;
    effectiveFrom?: Date;
    effectiveTo?: Date;
    createdBy: string;
  }) {
    // Verify charge exists
    const charge = await prisma.chargeMaster.findFirst({
      where: { id: data.chargeId, hospitalId },
    });

    if (!charge) throw new NotFoundError('Charge not found');

    // Verify payer exists if provided
    if (data.payerId) {
      const payer = await prisma.insurancePayer.findFirst({
        where: { id: data.payerId, hospitalId },
      });

      if (!payer) throw new NotFoundError('Insurance payer not found');
    }

    // Check for duplicate schedule
    const existing = await prisma.feeSchedule.findUnique({
      where: {
        hospitalId_chargeId_payerId: {
          hospitalId,
          chargeId: data.chargeId,
          payerId: data.payerId || null,
        },
      },
    });

    if (existing) {
      throw new Error('Fee schedule already exists for this charge and payer combination');
    }

    return prisma.feeSchedule.create({
      data: {
        hospitalId,
        chargeId: data.chargeId,
        payerId: data.payerId,
        price: data.price,
        discount: data.discount,
        effectiveFrom: data.effectiveFrom || new Date(),
        effectiveTo: data.effectiveTo,
        createdBy: data.createdBy,
      },
      include: {
        charge: true,
        insurancePayer: true,
      },
    });
  }

  async updateFeeSchedule(id: string, hospitalId: string, data: {
    price?: number;
    discount?: number;
    effectiveFrom?: Date;
    effectiveTo?: Date;
  }) {
    const schedule = await prisma.feeSchedule.findFirst({
      where: { id, hospitalId },
    });

    if (!schedule) throw new NotFoundError('Fee schedule not found');

    return prisma.feeSchedule.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
      include: {
        charge: true,
        insurancePayer: true,
      },
    });
  }

  // ==================== PRICE LOOKUP ====================

  async lookupPrice(hospitalId: string, chargeCode: string, payerId?: string): Promise<{
    chargeId: string;
    code: string;
    description: string;
    category: string;
    basePrice: number;
    finalPrice: number;
    discount: number | null;
    payerName: string | null;
    currency: string;
    unit: string | null;
  } | null> {
    // Find the charge
    const charge = await prisma.chargeMaster.findUnique({
      where: {
        hospitalId_code: {
          hospitalId,
          code: chargeCode,
        },
      },
    });

    if (!charge || !charge.isActive) return null;

    const now = new Date();

    // Check if charge is currently effective
    if (charge.effectiveTo && charge.effectiveTo < now) return null;

    let finalPrice = Number(charge.defaultPrice);
    let discount: number | null = null;
    let payerName: string | null = null;

    // If payerId is provided, look for a specific fee schedule
    if (payerId) {
      const feeSchedule = await prisma.feeSchedule.findFirst({
        where: {
          hospitalId,
          chargeId: charge.id,
          payerId,
          effectiveFrom: { lte: now },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: now } },
          ],
        },
        include: {
          insurancePayer: {
            select: { name: true },
          },
        },
      });

      if (feeSchedule) {
        finalPrice = Number(feeSchedule.price);
        discount = feeSchedule.discount ? Number(feeSchedule.discount) : null;
        payerName = feeSchedule.insurancePayer?.name || null;
      }
    }

    return {
      chargeId: charge.id,
      code: charge.code,
      description: charge.description,
      category: charge.category,
      basePrice: Number(charge.defaultPrice),
      finalPrice,
      discount,
      payerName,
      currency: charge.currency,
      unit: charge.unit,
    };
  }

  // ==================== SEED/MIGRATION SCRIPT ====================

  async seedHardcodedCharges(hospitalId: string, createdBy: string): Promise<{
    created: number;
    skipped: number;
    errors: string[];
  }> {
    const hardcodedCharges = [
      // Consultations
      { code: '99201', description: 'Initial Office Visit', category: 'CONSULTATION', price: 150, unit: 'per visit' },
      { code: '99211', description: 'Follow-up Visit', category: 'CONSULTATION', price: 75, unit: 'per visit' },
      { code: '99281', description: 'Emergency Consultation', category: 'EMERGENCY', price: 250, unit: 'per visit' },
      { code: '99241', description: 'Specialist Consultation', category: 'CONSULTATION', price: 200, unit: 'per visit' },

      // Procedures
      { code: '97602', description: 'Wound Care Management', category: 'PROCEDURE', price: 100, unit: 'per procedure' },
      { code: '12001', description: 'Simple Wound Repair', category: 'PROCEDURE', price: 150, unit: 'per procedure' },
      { code: '96365', description: 'IV Infusion Therapy', category: 'PROCEDURE', price: 80, unit: 'per session' },
      { code: '51702', description: 'Bladder Catheterization', category: 'PROCEDURE', price: 75, unit: 'per procedure' },
      { code: '94640', description: 'Nebulizer Treatment', category: 'PROCEDURE', price: 50, unit: 'per treatment' },
      { code: '93000', description: 'Electrocardiogram', category: 'DIAGNOSTIC', price: 100, unit: 'per test' },
      { code: '36415', description: 'Venipuncture', category: 'LAB', price: 25, unit: 'per draw' },

      // Imaging
      { code: '71046', description: 'Chest X-Ray', category: 'IMAGING', price: 150, unit: 'per image' },
      { code: '73030', description: 'Extremity X-Ray', category: 'IMAGING', price: 100, unit: 'per image' },
      { code: '70450', description: 'CT Scan', category: 'IMAGING', price: 500, unit: 'per scan' },
      { code: '70551', description: 'MRI Scan', category: 'IMAGING', price: 800, unit: 'per scan' },
      { code: '76700', description: 'Ultrasound', category: 'IMAGING', price: 200, unit: 'per scan' },

      // Lab
      { code: '85025', description: 'Complete Blood Count', category: 'LAB', price: 30, unit: 'per test' },
      { code: '80053', description: 'Comprehensive Metabolic Panel', category: 'LAB', price: 50, unit: 'per test' },
      { code: '80061', description: 'Lipid Panel', category: 'LAB', price: 40, unit: 'per test' },
      { code: '81003', description: 'Urinalysis', category: 'LAB', price: 20, unit: 'per test' },
      { code: '87040', description: 'Blood Culture', category: 'LAB', price: 75, unit: 'per culture' },

      // Medications
      { code: '96372', description: 'Intramuscular Injection', category: 'MEDICATION', price: 25, unit: 'per injection' },
      { code: '96374', description: 'IV Push Medication', category: 'MEDICATION', price: 35, unit: 'per dose' },

      // Room Charges
      { code: 'ROOM-GEN', description: 'General Ward (per day)', category: 'ACCOMMODATION', price: 300, unit: 'per day' },
      { code: 'ROOM-PVT', description: 'Private Room (per day)', category: 'ACCOMMODATION', price: 600, unit: 'per day' },
      { code: 'ROOM-ICU', description: 'ICU (per day)', category: 'ACCOMMODATION', price: 1500, unit: 'per day' },

      // Surgery
      { code: 'SURG-MIN', description: 'Minor Surgical Procedure', category: 'SURGERY', price: 1000, unit: 'per procedure' },
      { code: 'SURG-MAJ', description: 'Major Surgical Procedure', category: 'SURGERY', price: 5000, unit: 'per procedure' },
      { code: '00300', description: 'Local Anesthesia', category: 'ANESTHESIA', price: 100, unit: 'per procedure' },
      { code: '00100', description: 'General Anesthesia', category: 'ANESTHESIA', price: 800, unit: 'per procedure' },
    ];

    const results = {
      created: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const chargeData of hardcodedCharges) {
      try {
        // Check if already exists
        const existing = await prisma.chargeMaster.findUnique({
          where: {
            hospitalId_code: {
              hospitalId,
              code: chargeData.code,
            },
          },
        });

        if (existing) {
          results.skipped++;
          continue;
        }

        // Create charge
        await prisma.chargeMaster.create({
          data: {
            hospitalId,
            code: chargeData.code,
            description: chargeData.description,
            category: chargeData.category,
            defaultPrice: chargeData.price,
            currency: 'AED',
            unit: chargeData.unit,
            createdBy,
          },
        });

        results.created++;
      } catch (error: any) {
        results.errors.push(`${chargeData.code}: ${error.message}`);
      }
    }

    return results;
  }

  // Get charge categories
  async getCategories(hospitalId: string): Promise<string[]> {
    const charges = await prisma.chargeMaster.findMany({
      where: { hospitalId, isActive: true },
      select: { category: true },
      distinct: ['category'],
    });

    return charges.map(c => c.category).sort();
  }
}

export const chargeManagementService = new ChargeManagementService();
