import prisma from '../config/database';
import { NotFoundError } from '../middleware/errorHandler';
import { Prisma } from '@prisma/client';

export interface PayerInput {
  name: string;
  code: string;
  regulator?: string;
  claimPlatform?: string;
  claimSubmissionDeadline?: number;
  appealDeadline?: number;
  preAuthRequired?: boolean;
  preAuthPhone?: string;
  preAuthEmail?: string;
  preAuthPortal?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  paymentTerms?: number;
  isActive?: boolean;
  notes?: string;
}

export interface PayerSearchParams {
  page?: number;
  limit?: number;
  search?: string;
  regulator?: string;
  isActive?: boolean;
}

export class PayerService {
  /**
   * Create a new insurance payer
   */
  async create(hospitalId: string, data: PayerInput, createdBy?: string) {
    return prisma.insurancePayer.create({
      data: {
        hospitalId,
        name: data.name,
        code: data.code.toUpperCase(),
        regulator: data.regulator,
        claimPlatform: data.claimPlatform,
        claimSubmissionDeadline: data.claimSubmissionDeadline,
        appealDeadline: data.appealDeadline,
        preAuthRequired: data.preAuthRequired ?? false,
        preAuthPhone: data.preAuthPhone,
        preAuthEmail: data.preAuthEmail,
        preAuthPortal: data.preAuthPortal,
        contactPhone: data.contactPhone,
        contactEmail: data.contactEmail,
        address: data.address,
        paymentTerms: data.paymentTerms,
        isActive: data.isActive ?? true,
        notes: data.notes,
        createdBy,
      },
    });
  }

  /**
   * Get all payers with pagination and filtering
   */
  async getAll(hospitalId: string, params: PayerSearchParams) {
    const { page = 1, limit = 50, search, regulator, isActive } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.InsurancePayerWhereInput = { hospitalId };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search.toUpperCase(), mode: 'insensitive' } },
      ];
    }

    if (regulator) where.regulator = regulator;
    if (typeof isActive === 'boolean') where.isActive = isActive;

    const [payers, total] = await Promise.all([
      prisma.insurancePayer.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ name: 'asc' }],
        include: {
          _count: {
            select: {
              icdRules: true,
              cptRules: true,
            },
          },
        },
      }),
      prisma.insurancePayer.count({ where }),
    ]);

    return {
      payers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get a single payer by ID
   */
  async getById(id: string, hospitalId: string) {
    const payer = await prisma.insurancePayer.findFirst({
      where: { id, hospitalId },
      include: {
        _count: {
          select: {
            icdRules: true,
            cptRules: true,
          },
        },
      },
    });

    if (!payer) throw new NotFoundError('Insurance payer not found');
    return payer;
  }

  /**
   * Update a payer
   */
  async update(id: string, hospitalId: string, data: Partial<PayerInput>) {
    const existing = await prisma.insurancePayer.findFirst({
      where: { id, hospitalId },
    });

    if (!existing) throw new NotFoundError('Insurance payer not found');

    return prisma.insurancePayer.update({
      where: { id },
      data: {
        ...data,
        code: data.code?.toUpperCase(),
      },
    });
  }

  /**
   * Soft delete a payer
   */
  async delete(id: string, hospitalId: string) {
    const existing = await prisma.insurancePayer.findFirst({
      where: { id, hospitalId },
    });

    if (!existing) throw new NotFoundError('Insurance payer not found');

    return prisma.insurancePayer.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Get distinct regulators
   */
  async getRegulators(hospitalId: string) {
    const regulators = await prisma.insurancePayer.findMany({
      where: { hospitalId, regulator: { not: null } },
      distinct: ['regulator'],
      select: { regulator: true },
      orderBy: { regulator: 'asc' },
    });

    return regulators.map((r) => r.regulator).filter(Boolean);
  }
}

export const payerService = new PayerService();
