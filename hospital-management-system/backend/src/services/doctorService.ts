import prisma from '../config/database';
import bcrypt from 'bcryptjs';
import { CreateDoctorDto, SearchParams } from '../types';
import { NotFoundError, ConflictError, AppError } from '../middleware/errorHandler';
import { DayOfWeek } from '@prisma/client';
import { slotService } from './slotService';

export class DoctorService {
  async create(hospitalId: string, data: CreateDoctorDto & { specializationId?: string }) {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: {
        hospitalId_email: {
          hospitalId,
          email: data.email,
        },
      },
    });

    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    // Verify department exists
    const department = await prisma.department.findFirst({
      where: { id: data.departmentId, hospitalId },
    });

    if (!department) {
      throw new NotFoundError('Department not found');
    }

    // Validate specializationId if provided
    if (data.specializationId) {
      const specialization = await prisma.specialization.findFirst({
        where: {
          id: data.specializationId,
          departmentId: data.departmentId,
          isActive: true,
        },
      });

      if (!specialization) {
        throw new AppError('Invalid specialization for the selected department', 400);
      }
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);

    // Create user and doctor in transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          hospitalId,
          email: data.email,
          password: hashedPassword,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          role: 'DOCTOR',
        },
      });

      const doctor = await tx.doctor.create({
        data: {
          userId: user.id,
          departmentId: data.departmentId,
          specializationId: data.specializationId || undefined, // Convert empty string to undefined to avoid FK constraint error
          specialization: data.specialization,
          qualification: data.qualification,
          experience: data.experience,
          licenseNumber: data.licenseNumber,
          consultationFee: data.consultationFee,
          bio: data.bio,
          availableDays: data.availableDays,
          slotDuration: data.slotDuration || 30,
          maxPatientsPerDay: data.maxPatientsPerDay || 30,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
          department: true,
          specializationRef: true,
        },
      });

      return doctor;
    });

    // Generate slots for the next 30 days if schedules are provided
    // This is done asynchronously after doctor creation
    if (data.schedules && data.schedules.length > 0) {
      // First create the schedules
      await prisma.doctorSchedule.createMany({
        data: data.schedules.map((s: any) => ({
          doctorId: result.id,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          breakStart: s.breakStart || null,
          breakEnd: s.breakEnd || null,
          isActive: s.isActive !== false,
        })),
      });

      // Generate slots asynchronously
      slotService.generateSlotsForDoctor(result.id, hospitalId, 30).catch((err) => {
        console.error('Failed to generate slots for doctor:', err);
      });
    }

    return result;
  }

  async findAll(hospitalId: string, params: SearchParams & { departmentId?: string; specialization?: string }) {
    const { page = 1, limit = 10, search, sortBy = 'createdAt', sortOrder = 'desc', departmentId, specialization } = params;
    const skip = (page - 1) * limit;

    const where: any = {
      user: { hospitalId },
    };

    if (departmentId) where.departmentId = departmentId;
    if (specialization) where.specialization = { contains: specialization, mode: 'insensitive' };

    if (search) {
      where.OR = [
        { user: { firstName: { contains: search, mode: 'insensitive' } } },
        { user: { lastName: { contains: search, mode: 'insensitive' } } },
        { specialization: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [doctors, total] = await Promise.all([
      prisma.doctor.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
              avatar: true,
              isActive: true,
            },
          },
          department: {
            select: { id: true, name: true },
          },
          specializationRef: {
            select: { id: true, name: true, code: true },
          },
          _count: {
            select: {
              appointments: true,
              consultations: true,
            },
          },
        },
      }),
      prisma.doctor.count({ where }),
    ]);

    return { doctors, total };
  }

  async findById(id: string, hospitalId: string) {
    const doctor = await prisma.doctor.findFirst({
      where: {
        id,
        user: { hospitalId },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            avatar: true,
            isActive: true,
            lastLogin: true,
          },
        },
        department: true,
        specializationRef: true,
        schedules: {
          orderBy: { dayOfWeek: 'asc' },
        },
        _count: {
          select: {
            appointments: true,
            consultations: true,
            surgeries: true,
          },
        },
      },
    });

    if (!doctor) {
      throw new NotFoundError('Doctor not found');
    }

    return doctor;
  }

  async update(id: string, hospitalId: string, data: Partial<CreateDoctorDto> & { specializationId?: string }) {
    const doctor = await prisma.doctor.findFirst({
      where: { id, user: { hospitalId } },
    });

    if (!doctor) {
      throw new NotFoundError('Doctor not found');
    }

    // Validate specializationId if provided
    const departmentId = data.departmentId || doctor.departmentId;
    if (data.specializationId) {
      const specialization = await prisma.specialization.findFirst({
        where: {
          id: data.specializationId,
          departmentId: departmentId,
          isActive: true,
        },
      });

      if (!specialization) {
        throw new AppError('Invalid specialization for the selected department', 400);
      }
    }

    const { email, password, firstName, lastName, phone, schedules, ...doctorData } = data;

    // Convert empty specializationId to undefined to avoid FK constraint error
    if (doctorData.specializationId === '') {
      doctorData.specializationId = undefined;
    }

    const result = await prisma.$transaction(async (tx) => {
      // Update user if needed
      if (firstName || lastName || phone) {
        await tx.user.update({
          where: { id: doctor.userId },
          data: {
            firstName,
            lastName,
            phone,
          },
        });
      }

      // Update doctor
      const updatedDoctor = await tx.doctor.update({
        where: { id },
        data: doctorData,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
          department: true,
          specializationRef: true,
          schedules: {
            orderBy: { dayOfWeek: 'asc' },
          },
        },
      });

      return updatedDoctor;
    });

    // Handle schedules if provided (update or create)
    if (schedules && Array.isArray(schedules) && schedules.length > 0) {
      // Delete existing schedules and create new ones
      await prisma.$transaction(async (tx) => {
        await tx.doctorSchedule.deleteMany({
          where: { doctorId: id },
        });

        await tx.doctorSchedule.createMany({
          data: schedules
            .filter((s: any) => s.isActive) // Only create active schedules
            .map((s: any) => ({
              doctorId: id,
              dayOfWeek: s.dayOfWeek,
              startTime: s.startTime,
              endTime: s.endTime,
              breakStart: s.breakStart || null,
              breakEnd: s.breakEnd || null,
              isActive: s.isActive !== false,
            })),
        });
      });

      // Regenerate future slots based on new schedule
      slotService.regenerateSlots(id, hospitalId).catch((err) => {
        console.error('Failed to regenerate slots after doctor update:', err);
      });

      // Fetch updated schedules
      const updatedSchedules = await prisma.doctorSchedule.findMany({
        where: { doctorId: id },
        orderBy: { dayOfWeek: 'asc' },
      });

      return { ...result, schedules: updatedSchedules };
    }

    return result;
  }

  async updateSchedule(doctorId: string, hospitalId: string, schedules: {
    dayOfWeek: DayOfWeek;
    startTime: string;
    endTime: string;
    breakStart?: string;
    breakEnd?: string;
    isActive: boolean;
  }[]) {
    const doctor = await prisma.doctor.findFirst({
      where: { id: doctorId, user: { hospitalId } },
    });

    if (!doctor) {
      throw new NotFoundError('Doctor not found');
    }

    // Delete existing schedules and create new ones
    await prisma.$transaction(async (tx) => {
      await tx.doctorSchedule.deleteMany({
        where: { doctorId },
      });

      await tx.doctorSchedule.createMany({
        data: schedules.map(s => ({
          doctorId,
          ...s,
        })),
      });
    });

    const updatedSchedules = await prisma.doctorSchedule.findMany({
      where: { doctorId },
      orderBy: { dayOfWeek: 'asc' },
    });

    // Regenerate future slots based on new schedule
    slotService.regenerateSlots(doctorId, hospitalId).catch((err) => {
      console.error('Failed to regenerate slots after schedule update:', err);
    });

    return updatedSchedules;
  }

  async getSchedule(doctorId: string, hospitalId: string) {
    const doctor = await prisma.doctor.findFirst({
      where: { id: doctorId, user: { hospitalId } },
      include: {
        schedules: {
          orderBy: { dayOfWeek: 'asc' },
        },
      },
    });

    if (!doctor) {
      throw new NotFoundError('Doctor not found');
    }

    return doctor.schedules;
  }

  async toggleAvailability(id: string, hospitalId: string, isAvailable: boolean) {
    const doctor = await prisma.doctor.findFirst({
      where: { id, user: { hospitalId } },
    });

    if (!doctor) {
      throw new NotFoundError('Doctor not found');
    }

    const updated = await prisma.doctor.update({
      where: { id },
      data: { isAvailable },
    });

    return updated;
  }

  async getDashboardStats(doctorId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    const [
      todayAppointments,
      monthlyAppointments,
      totalPatients,
      pendingConsultations,
      recentConsultations,
    ] = await Promise.all([
      prisma.appointment.count({
        where: {
          doctorId,
          appointmentDate: { gte: today, lt: tomorrow },
        },
      }),
      prisma.appointment.count({
        where: {
          doctorId,
          appointmentDate: { gte: thisMonth, lt: nextMonth },
          status: 'COMPLETED',
        },
      }),
      prisma.appointment.groupBy({
        by: ['patientId'],
        where: { doctorId },
        _count: true,
      }),
      prisma.appointment.count({
        where: {
          doctorId,
          appointmentDate: { gte: today, lt: tomorrow },
          status: { in: ['SCHEDULED', 'CONFIRMED', 'CHECKED_IN'] },
        },
      }),
      prisma.consultation.findMany({
        where: { doctorId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          patient: {
            select: { firstName: true, lastName: true, mrn: true },
          },
        },
      }),
    ]);

    return {
      todayAppointments,
      monthlyAppointments,
      totalPatients: totalPatients.length,
      pendingConsultations,
      recentConsultations,
    };
  }
}

export const doctorService = new DoctorService();
