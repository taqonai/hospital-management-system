import prisma from '../config/database';
import { NotFoundError, AppError } from '../middleware/errorHandler';

interface CreateDepartmentDto {
  name: string;
  code: string;
  description?: string;
  floor?: string;
  phone?: string;
  email?: string;
  headDoctorId?: string;
}

interface UpdateDepartmentDto {
  name?: string;
  code?: string;
  description?: string;
  floor?: string;
  phone?: string;
  email?: string;
  headDoctorId?: string;
  isActive?: boolean;
}

interface CreateSpecializationDto {
  name: string;
  code: string;
  description?: string;
}

interface UpdateSpecializationDto {
  name?: string;
  code?: string;
  description?: string;
  isActive?: boolean;
}

export class DepartmentService {
  // ==================== DEPARTMENT CRUD ====================

  async getAllDepartments(hospitalId: string, includeInactive = false) {
    const departments = await prisma.department.findMany({
      where: {
        hospitalId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        _count: {
          select: {
            doctors: true,
            nurses: true,
            specializations: true,
          },
        },
        specializations: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    return departments.map(dept => ({
      ...dept,
      doctorCount: dept._count.doctors,
      nurseCount: dept._count.nurses,
      specializationCount: dept._count.specializations,
    }));
  }

  async getDepartmentById(hospitalId: string, departmentId: string) {
    const department = await prisma.department.findFirst({
      where: {
        id: departmentId,
        hospitalId,
      },
      include: {
        _count: {
          select: {
            doctors: true,
            nurses: true,
          },
        },
        specializations: {
          orderBy: { name: 'asc' },
        },
        doctors: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            specializationRef: true,
          },
        },
      },
    });

    if (!department) {
      throw new NotFoundError('Department not found');
    }

    return {
      ...department,
      doctorCount: department._count.doctors,
      nurseCount: department._count.nurses,
    };
  }

  async createDepartment(hospitalId: string, data: CreateDepartmentDto) {
    // Check for duplicate code
    const existing = await prisma.department.findFirst({
      where: {
        hospitalId,
        code: data.code,
      },
    });

    if (existing) {
      throw new AppError(`Department with code "${data.code}" already exists`, 400);
    }

    const department = await prisma.department.create({
      data: {
        hospitalId,
        name: data.name,
        code: data.code.toUpperCase(),
        description: data.description,
        floor: data.floor,
        phone: data.phone,
        email: data.email,
        headDoctorId: data.headDoctorId,
      },
      include: {
        specializations: true,
      },
    });

    return department;
  }

  async updateDepartment(hospitalId: string, departmentId: string, data: UpdateDepartmentDto) {
    const department = await prisma.department.findFirst({
      where: {
        id: departmentId,
        hospitalId,
      },
    });

    if (!department) {
      throw new NotFoundError('Department not found');
    }

    // Check for duplicate code if code is being changed
    if (data.code && data.code !== department.code) {
      const existing = await prisma.department.findFirst({
        where: {
          hospitalId,
          code: data.code,
          NOT: { id: departmentId },
        },
      });

      if (existing) {
        throw new AppError(`Department with code "${data.code}" already exists`, 400);
      }
    }

    const updated = await prisma.department.update({
      where: { id: departmentId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.code && { code: data.code.toUpperCase() }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.floor !== undefined && { floor: data.floor }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.headDoctorId !== undefined && { headDoctorId: data.headDoctorId }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      include: {
        specializations: true,
      },
    });

    return updated;
  }

  async deleteDepartment(hospitalId: string, departmentId: string) {
    const department = await prisma.department.findFirst({
      where: {
        id: departmentId,
        hospitalId,
      },
      include: {
        _count: {
          select: {
            doctors: true,
            nurses: true,
          },
        },
      },
    });

    if (!department) {
      throw new NotFoundError('Department not found');
    }

    // Prevent deletion if department has doctors or nurses
    if (department._count.doctors > 0 || department._count.nurses > 0) {
      throw new AppError(
        `Cannot delete department with ${department._count.doctors} doctors and ${department._count.nurses} nurses. Reassign them first.`,
        400
      );
    }

    // Soft delete by setting isActive to false
    await prisma.department.update({
      where: { id: departmentId },
      data: { isActive: false },
    });

    return { message: 'Department deactivated successfully' };
  }

  // ==================== SPECIALIZATION CRUD ====================

  async getSpecializations(hospitalId: string, departmentId: string) {
    // Verify department belongs to hospital
    const department = await prisma.department.findFirst({
      where: {
        id: departmentId,
        hospitalId,
      },
    });

    if (!department) {
      throw new NotFoundError('Department not found');
    }

    const specializations = await prisma.specialization.findMany({
      where: {
        departmentId,
      },
      include: {
        _count: {
          select: {
            doctors: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return specializations.map(spec => ({
      ...spec,
      doctorCount: spec._count.doctors,
    }));
  }

  async createSpecialization(hospitalId: string, departmentId: string, data: CreateSpecializationDto) {
    // Verify department belongs to hospital
    const department = await prisma.department.findFirst({
      where: {
        id: departmentId,
        hospitalId,
      },
    });

    if (!department) {
      throw new NotFoundError('Department not found');
    }

    // Check for duplicate code in department
    const existing = await prisma.specialization.findFirst({
      where: {
        departmentId,
        code: data.code.toUpperCase(),
      },
    });

    if (existing) {
      throw new AppError(`Specialization with code "${data.code}" already exists in this department`, 400);
    }

    const specialization = await prisma.specialization.create({
      data: {
        departmentId,
        name: data.name,
        code: data.code.toUpperCase(),
        description: data.description,
      },
    });

    return specialization;
  }

  async updateSpecialization(
    hospitalId: string,
    departmentId: string,
    specializationId: string,
    data: UpdateSpecializationDto
  ) {
    // Verify department belongs to hospital
    const department = await prisma.department.findFirst({
      where: {
        id: departmentId,
        hospitalId,
      },
    });

    if (!department) {
      throw new NotFoundError('Department not found');
    }

    const specialization = await prisma.specialization.findFirst({
      where: {
        id: specializationId,
        departmentId,
      },
    });

    if (!specialization) {
      throw new NotFoundError('Specialization not found');
    }

    // Check for duplicate code if code is being changed
    if (data.code && data.code !== specialization.code) {
      const existing = await prisma.specialization.findFirst({
        where: {
          departmentId,
          code: data.code.toUpperCase(),
          NOT: { id: specializationId },
        },
      });

      if (existing) {
        throw new AppError(`Specialization with code "${data.code}" already exists in this department`, 400);
      }
    }

    const updated = await prisma.specialization.update({
      where: { id: specializationId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.code && { code: data.code.toUpperCase() }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });

    return updated;
  }

  async deleteSpecialization(hospitalId: string, departmentId: string, specializationId: string) {
    // Verify department belongs to hospital
    const department = await prisma.department.findFirst({
      where: {
        id: departmentId,
        hospitalId,
      },
    });

    if (!department) {
      throw new NotFoundError('Department not found');
    }

    const specialization = await prisma.specialization.findFirst({
      where: {
        id: specializationId,
        departmentId,
      },
      include: {
        _count: {
          select: {
            doctors: true,
          },
        },
      },
    });

    if (!specialization) {
      throw new NotFoundError('Specialization not found');
    }

    // Prevent deletion if specialization has doctors
    if (specialization._count.doctors > 0) {
      throw new AppError(
        `Cannot delete specialization with ${specialization._count.doctors} doctors assigned. Reassign them first.`,
        400
      );
    }

    // Soft delete by setting isActive to false
    await prisma.specialization.update({
      where: { id: specializationId },
      data: { isActive: false },
    });

    return { message: 'Specialization deactivated successfully' };
  }

  // ==================== UTILITY METHODS ====================

  async getAllSpecializationsForHospital(hospitalId: string) {
    // Get all active specializations for all departments in the hospital
    const specializations = await prisma.specialization.findMany({
      where: {
        isActive: true,
        department: {
          hospitalId,
          isActive: true,
        },
      },
      include: {
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: [
        { department: { name: 'asc' } },
        { name: 'asc' },
      ],
    });

    return specializations;
  }
}

export const departmentService = new DepartmentService();
