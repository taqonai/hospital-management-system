import prisma from '../config/database';
import { NotFoundError, AppError } from '../middleware/errorHandler';

interface CreateInsuranceProviderDto {
  name: string;
  licenseNumber: string;
  tpaName?: string;
  contactPhone?: string;
  email?: string;
  emirate?: string;
}

interface UpdateInsuranceProviderDto {
  name?: string;
  licenseNumber?: string;
  tpaName?: string;
  contactPhone?: string;
  email?: string;
  emirate?: string;
  isActive?: boolean;
}

export class InsuranceProviderService {
  // ==================== INSURANCE PROVIDER CRUD ====================

  /**
   * Get all insurance providers (staff view with pagination and filters)
   */
  async getAllProviders(
    hospitalId: string,
    page = 1,
    limit = 50,
    search?: string,
    includeInactive = false
  ) {
    const skip = (page - 1) * limit;

    const where: any = {
      hospitalId,
      ...(includeInactive ? {} : { isActive: true }),
    };

    // Search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { licenseNumber: { contains: search, mode: 'insensitive' } },
        { tpaName: { contains: search, mode: 'insensitive' } },
        { emirate: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [providers, total] = await Promise.all([
      prisma.insuranceProvider.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      prisma.insuranceProvider.count({ where }),
    ]);

    return {
      data: providers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get active insurance providers (minimal fields for dropdowns)
   */
  async getActiveProviders(hospitalId: string) {
    const providers = await prisma.insuranceProvider.findMany({
      where: {
        hospitalId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        licenseNumber: true,
        tpaName: true,
        emirate: true,
      },
      orderBy: { name: 'asc' },
    });

    return providers;
  }

  /**
   * Get insurance provider by ID
   */
  async getProviderById(hospitalId: string, providerId: string) {
    const provider = await prisma.insuranceProvider.findFirst({
      where: {
        id: providerId,
        hospitalId,
      },
    });

    if (!provider) {
      throw new NotFoundError('Insurance provider not found');
    }

    return provider;
  }

  /**
   * Create insurance provider
   */
  async createProvider(hospitalId: string, userId: string, data: CreateInsuranceProviderDto) {
    // Check for duplicate license number in this hospital
    const existing = await prisma.insuranceProvider.findFirst({
      where: {
        hospitalId,
        licenseNumber: data.licenseNumber,
      },
    });

    if (existing) {
      throw new AppError(
        `Insurance provider with license number "${data.licenseNumber}" already exists`,
        400
      );
    }

    const provider = await prisma.insuranceProvider.create({
      data: {
        hospitalId,
        name: data.name,
        licenseNumber: data.licenseNumber,
        tpaName: data.tpaName,
        contactPhone: data.contactPhone,
        email: data.email,
        emirate: data.emirate,
        createdById: userId,
        updatedById: userId,
      },
    });

    return provider;
  }

  /**
   * Update insurance provider
   */
  async updateProvider(
    hospitalId: string,
    providerId: string,
    userId: string,
    data: UpdateInsuranceProviderDto
  ) {
    const provider = await prisma.insuranceProvider.findFirst({
      where: {
        id: providerId,
        hospitalId,
      },
    });

    if (!provider) {
      throw new NotFoundError('Insurance provider not found');
    }

    // Check for duplicate license number if being changed
    if (data.licenseNumber && data.licenseNumber !== provider.licenseNumber) {
      const existing = await prisma.insuranceProvider.findFirst({
        where: {
          hospitalId,
          licenseNumber: data.licenseNumber,
          NOT: { id: providerId },
        },
      });

      if (existing) {
        throw new AppError(
          `Insurance provider with license number "${data.licenseNumber}" already exists`,
          400
        );
      }
    }

    const updated = await prisma.insuranceProvider.update({
      where: { id: providerId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.licenseNumber !== undefined && { licenseNumber: data.licenseNumber }),
        ...(data.tpaName !== undefined && { tpaName: data.tpaName }),
        ...(data.contactPhone !== undefined && { contactPhone: data.contactPhone }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.emirate !== undefined && { emirate: data.emirate }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        updatedById: userId,
      },
    });

    return updated;
  }

  /**
   * Soft delete insurance provider
   */
  async deleteProvider(hospitalId: string, providerId: string) {
    const provider = await prisma.insuranceProvider.findFirst({
      where: {
        id: providerId,
        hospitalId,
      },
    });

    if (!provider) {
      throw new NotFoundError('Insurance provider not found');
    }

    // Soft delete by setting isActive to false
    await prisma.insuranceProvider.update({
      where: { id: providerId },
      data: { isActive: false },
    });

    return { message: 'Insurance provider deactivated successfully' };
  }
}

export const insuranceProviderService = new InsuranceProviderService();
