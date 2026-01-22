import prisma from '../config/database';
import bcrypt from 'bcryptjs';
import { CreateDoctorDto, SearchParams } from '../types';
import { NotFoundError, ConflictError, AppError, ValidationError } from '../middleware/errorHandler';
import { DayOfWeek, AbsenceStatus, AbsenceType } from '@prisma/client';
import { slotService } from './slotService';
import { notificationService } from './notificationService';
import { sendEmail } from './emailService';
import logger from '../utils/logger';

export interface CreateAbsenceDto {
  startDate: string;
  endDate: string;
  absenceType: AbsenceType;
  reason?: string;
  notes?: string;
  isFullDay?: boolean;
  startTime?: string;
  endTime?: string;
}

export interface UpdateAbsenceDto {
  absenceType?: AbsenceType;
  reason?: string;
  notes?: string;
}

// Human-readable labels for absence types
const ABSENCE_TYPE_LABELS: Record<string, string> = {
  ANNUAL_LEAVE: 'Annual Leave',
  SICK_LEAVE: 'Sick Leave',
  CONFERENCE: 'Conference',
  TRAINING: 'Training',
  PERSONAL: 'Personal',
  EMERGENCY: 'Emergency',
  OTHER: 'Other',
};

// Helper function to validate schedule times
const validateScheduleTimes = (schedules: {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  breakStart?: string | null;
  breakEnd?: string | null;
  isActive?: boolean;
}[]): string[] => {
  const validationErrors: string[] = [];
  const dayNames: Record<string, string> = {
    MONDAY: 'Monday', TUESDAY: 'Tuesday', WEDNESDAY: 'Wednesday',
    THURSDAY: 'Thursday', FRIDAY: 'Friday', SATURDAY: 'Saturday', SUNDAY: 'Sunday',
  };

  // Convert time string (HH:mm) to minutes for comparison
  const toMinutes = (time: string | null | undefined): number => {
    if (!time) return -1;
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  for (const schedule of schedules) {
    // Default isActive to true if not specified
    const isActive = schedule.isActive !== false;
    if (!isActive) continue;

    const dayName = dayNames[schedule.dayOfWeek] || schedule.dayOfWeek;
    const startMinutes = toMinutes(schedule.startTime);
    const endMinutes = toMinutes(schedule.endTime);
    const breakStartMinutes = toMinutes(schedule.breakStart);
    const breakEndMinutes = toMinutes(schedule.breakEnd);

    // Start Time must be < End Time
    if (startMinutes >= endMinutes) {
      validationErrors.push(`${dayName}: End time must be after start time`);
    }

    // Break time validations
    const hasBreakStart = schedule.breakStart && schedule.breakStart !== '';
    const hasBreakEnd = schedule.breakEnd && schedule.breakEnd !== '';

    if (hasBreakStart || hasBreakEnd) {
      // Both break times required if one is filled
      if (hasBreakStart && !hasBreakEnd) {
        validationErrors.push(`${dayName}: Break end time is required when break start is set`);
      }
      if (hasBreakEnd && !hasBreakStart) {
        validationErrors.push(`${dayName}: Break start time is required when break end is set`);
      }

      if (hasBreakStart && hasBreakEnd) {
        // Break Start must be < Break End
        if (breakStartMinutes >= breakEndMinutes) {
          validationErrors.push(`${dayName}: Break end must be after break start`);
        }

        // Break Start must be > Start Time
        if (breakStartMinutes <= startMinutes) {
          validationErrors.push(`${dayName}: Break must start after work begins`);
        }

        // Break End must be < End Time
        if (breakEndMinutes >= endMinutes) {
          validationErrors.push(`${dayName}: Break must end before work ends`);
        }

        // Break duration check (max 2 hours = 120 minutes)
        const breakDuration = breakEndMinutes - breakStartMinutes;
        if (breakDuration > 120) {
          validationErrors.push(`${dayName}: Break duration cannot exceed 2 hours`);
        }
      }
    }
  }

  return validationErrors;
};

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
      // Validate schedules before creating
      const scheduleValidationErrors = validateScheduleTimes(data.schedules);
      if (scheduleValidationErrors.length > 0) {
        throw new ValidationError('Schedule validation failed: ' + scheduleValidationErrors.join('; '));
      }

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

  async findByUserId(userId: string, hospitalId: string) {
    const doctor = await prisma.doctor.findFirst({
      where: {
        userId,
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
      include: { user: { select: { firstName: true, lastName: true } } },
    });

    if (!doctor) {
      throw new NotFoundError('Doctor not found');
    }

    // Validate schedules using helper function
    const validationErrors = validateScheduleTimes(schedules);
    if (validationErrors.length > 0) {
      throw new ValidationError('Schedule validation failed: ' + validationErrors.join('; '));
    }

    // Build a map of new schedule hours by day
    const dayToHours = new Map<string, { start: string; end: string; active: boolean }>();
    const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    for (const s of schedules) {
      dayToHours.set(s.dayOfWeek, { start: s.startTime, end: s.endTime, active: s.isActive });
    }

    // Find future appointments that may be affected
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const futureAppointments = await prisma.appointment.findMany({
      where: {
        doctorId,
        hospitalId,
        appointmentDate: { gte: today },
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, oderId: true } },
      },
    });

    // Check which appointments fall outside new schedule
    const affectedAppointments: typeof futureAppointments = [];
    for (const appt of futureAppointments) {
      const dayOfWeek = dayNames[appt.appointmentDate.getDay()];
      const hours = dayToHours.get(dayOfWeek);

      if (!hours || !hours.active) {
        // Doctor no longer works on this day
        affectedAppointments.push(appt);
      } else if (appt.startTime < hours.start || appt.endTime > hours.end) {
        // Appointment time outside new working hours
        affectedAppointments.push(appt);
      }
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

    // Notify affected patients about schedule change
    if (affectedAppointments.length > 0) {
      const doctorName = `Dr. ${doctor.user.firstName} ${doctor.user.lastName}`;

      for (const appt of affectedAppointments) {
        try {
          if (appt.patient.oderId) {
            await notificationService.sendNotification(
              appt.patient.oderId,
              'APPOINTMENT',
              {
                title: 'Schedule Change - Action Required',
                message: `${doctorName}'s schedule has changed. Your appointment on ${appt.appointmentDate.toISOString().split('T')[0]} at ${appt.startTime} may need to be rescheduled. Please contact us or rebook online.`,
                priority: 'high',
                metadata: {
                  appointmentId: appt.id,
                  type: 'SCHEDULE_CHANGE',
                  requiresReschedule: true,
                },
              },
              ['sms', 'in_app']
            );
          }
        } catch (error) {
          console.error(`Failed to notify patient ${appt.patientId} of schedule change:`, error);
        }
      }

      console.log(`[SCHEDULE] ${affectedAppointments.length} appointments affected by schedule change for doctor ${doctorId}`);
    }

    return {
      schedules: updatedSchedules,
      affectedAppointments: affectedAppointments.length,
    };
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
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!doctor) {
      throw new NotFoundError('Doctor not found');
    }

    // If deactivating doctor (resignation/leave), handle existing appointments
    let cancelledAppointments: string[] = [];
    let notifiedPatients = 0;

    if (!isAvailable) {
      // Find all future appointments
      const futureAppointments = await prisma.appointment.findMany({
        where: {
          doctorId: id,
          appointmentDate: { gte: new Date() },
          status: { in: ['SCHEDULED', 'CONFIRMED'] },
        },
        include: {
          patient: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      if (futureAppointments.length > 0) {
        // Cancel all future appointments
        await prisma.appointment.updateMany({
          where: {
            doctorId: id,
            appointmentDate: { gte: new Date() },
            status: { in: ['SCHEDULED', 'CONFIRMED'] },
          },
          data: {
            status: 'CANCELLED',
            notes: 'Cancelled due to doctor unavailability',
          },
        });

        cancelledAppointments = futureAppointments.map(a => a.id);

        // Release all slots (isAvailable: false means it's booked)
        await prisma.doctorSlot.updateMany({
          where: {
            doctorId: id,
            slotDate: { gte: new Date() },
            isAvailable: false,
          },
          data: {
            isAvailable: true,
            appointmentId: null,
          },
        });

        // Notify all affected patients
        for (const appointment of futureAppointments) {
          try {
            await notificationService.sendNotification(
              appointment.patient.id,
              'APPOINTMENT',
              {
                title: 'Appointment Cancelled - Doctor Unavailable',
                message: `Your appointment with Dr. ${doctor.user.firstName} ${doctor.user.lastName} on ${appointment.appointmentDate.toDateString()} at ${appointment.startTime} has been cancelled. The doctor is no longer available. Please reschedule with another doctor.`,
                priority: 'high',
                metadata: {
                  appointmentId: appointment.id,
                  doctorId: id,
                  reason: 'DOCTOR_UNAVAILABLE',
                },
              },
              ['in_app', 'sms']
            );
            notifiedPatients++;
          } catch (error) {
            console.error(`Failed to notify patient ${appointment.patient.id}:`, error);
          }
        }
      }
    }

    const updated = await prisma.doctor.update({
      where: { id },
      data: { isAvailable },
    });

    return {
      ...updated,
      cancelledAppointments: cancelledAppointments.length,
      notifiedPatients,
      affectedAppointmentIds: cancelledAppointments,
    };
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

  // ==================== ABSENCE MANAGEMENT ====================

  async createAbsence(
    doctorId: string,
    hospitalId: string,
    userId: string,
    data: CreateAbsenceDto
  ) {
    // Validate doctor exists
    const doctor = await prisma.doctor.findFirst({
      where: { id: doctorId, user: { hospitalId } },
    });

    if (!doctor) {
      throw new NotFoundError('Doctor not found');
    }

    // Parse and validate dates
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new ValidationError('Invalid date format');
    }

    if (endDate < startDate) {
      throw new ValidationError('End date must be on or after start date');
    }

    // Check for past dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (startDate < today) {
      throw new ValidationError('Cannot create absence in the past');
    }

    // Check for overlapping active absences
    const overlapping = await prisma.doctorAbsence.findFirst({
      where: {
        doctorId,
        status: AbsenceStatus.ACTIVE,
        OR: [
          {
            startDate: { lte: endDate },
            endDate: { gte: startDate },
          },
        ],
      },
    });

    if (overlapping) {
      throw new AppError('An absence already exists for this date range', 400);
    }

    // Find affected appointments with patient details
    const affectedAppointments = await prisma.appointment.findMany({
      where: {
        doctorId,
        appointmentDate: {
          gte: startDate,
          lte: endDate,
        },
        status: {
          notIn: ['CANCELLED', 'NO_SHOW', 'COMPLETED'],
        },
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            oderId: true, // This links to User for portal notifications
          },
        },
        doctor: {
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
          },
        },
      },
    });

    // Create the absence record
    const absence = await prisma.doctorAbsence.create({
      data: {
        doctorId,
        hospitalId,
        startDate,
        endDate,
        absenceType: data.absenceType || 'OTHER',
        reason: data.reason,
        notes: data.notes,
        isFullDay: data.isFullDay !== false,
        startTime: data.isFullDay === false ? data.startTime : null,
        endTime: data.isFullDay === false ? data.endTime : null,
        createdBy: userId,
      },
    });

    // Block slots for the date range
    const blockedSlots = await slotService.blockSlotsForDateRange(
      doctorId,
      hospitalId,
      startDate,
      endDate,
      data.isFullDay !== false,
      data.startTime,
      data.endTime
    );

    // Handle affected appointments - AUTO-CANCEL ALL appointments when doctor is absent
    const notifiedPatients: string[] = [];
    const cancelledAppointments: string[] = [];
    const isEmergency = data.absenceType === 'EMERGENCY';
    const absenceTypeLabel = ABSENCE_TYPE_LABELS[data.absenceType] || data.absenceType || 'Doctor Leave';

    if (affectedAppointments.length > 0) {
      const doctorName = affectedAppointments[0]?.doctor?.user
        ? `Dr. ${affectedAppointments[0].doctor.user.firstName} ${affectedAppointments[0].doctor.user.lastName}`
        : 'Your doctor';

      for (const appointment of affectedAppointments) {
        // Auto-cancel ALL appointments when doctor adds any absence
        try {
          const cancellationReason = isEmergency
            ? 'Auto-cancelled due to doctor emergency leave'
            : `Auto-cancelled due to doctor unavailability (${absenceTypeLabel})`;

          await prisma.appointment.update({
            where: { id: appointment.id },
            data: {
              status: 'CANCELLED',
              notes: `${appointment.notes || ''}\n${cancellationReason}`.trim(),
            },
          });

          // Release the slot
          await slotService.releaseSlot(appointment.id);
          cancelledAppointments.push(appointment.id);
        } catch (error) {
          console.error('Failed to cancel appointment:', appointment.id, error);
        }

        // Create notification for patient
        if (appointment.patient?.oderId) {
          try {
            const notificationTitle = isEmergency
              ? 'Appointment Cancelled - Doctor Emergency'
              : `Appointment Cancelled - Doctor ${absenceTypeLabel}`;

            const notificationMessage = `Your appointment with ${doctorName} on ${new Date(appointment.appointmentDate).toLocaleDateString()} at ${appointment.startTime} has been cancelled due to ${isEmergency ? 'an emergency' : `doctor ${absenceTypeLabel.toLowerCase()}`}. Please rebook at your earliest convenience.`;

            await prisma.notification.create({
              data: {
                userId: appointment.patient.oderId,
                type: 'APPOINTMENT',
                title: notificationTitle,
                message: notificationMessage,
                data: JSON.stringify({
                  appointmentId: appointment.id,
                  absenceId: absence.id,
                  doctorId,
                  originalDate: appointment.appointmentDate,
                  wasCancelled: true,
                  priority: isEmergency ? 'HIGH' : 'NORMAL',
                }),
              },
            });
            notifiedPatients.push(appointment.patient.id);
          } catch (error) {
            console.error('Failed to create notification for patient:', appointment.patient.id, error);
          }
        }

        // Send email notification to patient if they have an email address
        if (appointment.patient?.email) {
          try {
            const patientName = `${appointment.patient.firstName} ${appointment.patient.lastName}`;
            const appointmentDate = new Date(appointment.appointmentDate).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            });

            const emailSubject = isEmergency
              ? `URGENT: Your Appointment Has Been Cancelled - ${appointmentDate}`
              : `Your Appointment Has Been Cancelled - ${appointmentDate}`;

            const emailHtml = `
                <h2>Appointment Cancellation Notice</h2>
                <p>Dear ${patientName},</p>
                <p>We regret to inform you that your appointment has been <strong>cancelled</strong> due to ${isEmergency ? 'an emergency situation' : `doctor ${absenceTypeLabel.toLowerCase()}`}.</p>
                <div class="info-box">
                  <table>
                    <tr><td class="info-label">Doctor:</td><td class="info-value">${doctorName}</td></tr>
                    <tr><td class="info-label">Original Date:</td><td class="info-value">${appointmentDate}</td></tr>
                    <tr><td class="info-label">Original Time:</td><td class="info-value">${appointment.startTime}</td></tr>
                    <tr><td class="info-label">Reason:</td><td class="info-value">Doctor ${absenceTypeLabel}</td></tr>
                  </table>
                </div>
                <div class="warning">
                  <strong>Action Required:</strong> Please rebook your appointment at your earliest convenience through the patient portal or by contacting our reception.
                </div>
                <p>We sincerely apologize for any inconvenience this may cause.</p>
                ${isEmergency ? '<p>If you have any urgent medical concerns, please contact us immediately or visit our emergency department.</p>' : ''}
              `;

            const emailResult = await sendEmail({
              to: appointment.patient.email,
              subject: emailSubject,
              html: emailHtml,
            });

            if (emailResult.success) {
              logger.info(`[ABSENCE] Email sent to ${appointment.patient.email} for ${isEmergency ? 'cancelled' : 'affected'} appointment ${appointment.id}`);
            } else {
              logger.warn(`[ABSENCE] Failed to send email to ${appointment.patient.email}: ${emailResult.error}`);
            }
          } catch (emailError) {
            logger.error(`[ABSENCE] Error sending email to patient ${appointment.patient.id}:`, emailError);
          }
        }
      }
    }

    logger.info(`[ABSENCE] Created ${isEmergency ? 'EMERGENCY' : 'regular'} absence for doctor ${doctorId}. Affected: ${affectedAppointments.length}, Cancelled: ${cancelledAppointments.length}, Notified: ${notifiedPatients.length}`);

    return {
      ...absence,
      blockedSlots,
      affectedAppointments: affectedAppointments.length,
      cancelledAppointments: cancelledAppointments.length,
      notifiedPatients: notifiedPatients.length,
      affectedAppointmentDetails: affectedAppointments.map((apt) => ({
        id: apt.id,
        date: apt.appointmentDate,
        time: apt.startTime,
        patientName: apt.patient ? `${apt.patient.firstName} ${apt.patient.lastName}` : 'Unknown',
        patientPhone: apt.patient?.phone,
        wasCancelled: cancelledAppointments.includes(apt.id),
      })),
    };
  }

  async getAbsences(
    doctorId: string,
    hospitalId: string,
    params?: { upcoming?: boolean; status?: AbsenceStatus }
  ) {
    // Validate doctor exists
    const doctor = await prisma.doctor.findFirst({
      where: { id: doctorId, user: { hospitalId } },
    });

    if (!doctor) {
      throw new NotFoundError('Doctor not found');
    }

    const where: any = {
      doctorId,
      hospitalId,
    };

    // Filter by status if provided
    if (params?.status) {
      where.status = params.status;
    }

    // Filter for upcoming absences if requested
    if (params?.upcoming) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      where.endDate = { gte: today };
    }

    const absences = await prisma.doctorAbsence.findMany({
      where,
      orderBy: { startDate: 'asc' },
    });

    return absences;
  }

  async getAbsenceById(absenceId: string, hospitalId: string) {
    const absence = await prisma.doctorAbsence.findFirst({
      where: {
        id: absenceId,
        hospitalId,
      },
    });

    if (!absence) {
      throw new NotFoundError('Absence not found');
    }

    return absence;
  }

  async updateAbsence(
    absenceId: string,
    hospitalId: string,
    data: UpdateAbsenceDto
  ) {
    const absence = await prisma.doctorAbsence.findFirst({
      where: {
        id: absenceId,
        hospitalId,
        status: AbsenceStatus.ACTIVE,
      },
    });

    if (!absence) {
      throw new NotFoundError('Active absence not found');
    }

    // Only allow updating absenceType, reason and notes, not dates
    const updated = await prisma.doctorAbsence.update({
      where: { id: absenceId },
      data: {
        absenceType: data.absenceType ?? absence.absenceType,
        reason: data.reason ?? absence.reason,
        notes: data.notes ?? absence.notes,
      },
    });

    return updated;
  }

  async cancelAbsence(absenceId: string, hospitalId: string) {
    const absence = await prisma.doctorAbsence.findFirst({
      where: {
        id: absenceId,
        hospitalId,
        status: AbsenceStatus.ACTIVE,
      },
    });

    if (!absence) {
      throw new NotFoundError('Active absence not found');
    }

    // Update status to CANCELLED
    const updated = await prisma.doctorAbsence.update({
      where: { id: absenceId },
      data: { status: AbsenceStatus.CANCELLED },
    });

    // Unblock the slots
    const unblockedSlots = await slotService.unblockSlotsForDateRange(
      absence.doctorId,
      hospitalId,
      absence.startDate,
      absence.endDate,
      absence.isFullDay,
      absence.startTime || undefined,
      absence.endTime || undefined
    );

    return {
      ...updated,
      unblockedSlots,
    };
  }

  async getUpcomingAbsenceSummary(doctorId: string, hospitalId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [upcomingAbsences, activeAbsences, allFutureAbsences] = await Promise.all([
      // True upcoming: absences that start in the future (not yet active)
      prisma.doctorAbsence.count({
        where: {
          doctorId,
          hospitalId,
          status: AbsenceStatus.ACTIVE,
          startDate: { gt: today }, // Start date is in the future
        },
      }),
      // Currently active: today is within the absence range
      prisma.doctorAbsence.count({
        where: {
          doctorId,
          hospitalId,
          status: AbsenceStatus.ACTIVE,
          startDate: { lte: today },
          endDate: { gte: today },
        },
      }),
      // All future absences (for calculating blocked days)
      prisma.doctorAbsence.findMany({
        where: {
          doctorId,
          hospitalId,
          status: AbsenceStatus.ACTIVE,
          endDate: { gte: today },
        },
        select: {
          startDate: true,
          endDate: true,
        },
      }),
    ]);

    // Calculate total days blocked from today onwards
    let totalDays = 0;
    for (const absence of allFutureAbsences) {
      const start = new Date(Math.max(absence.startDate.getTime(), today.getTime()));
      const end = absence.endDate;
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      totalDays += diffDays;
    }

    return {
      upcomingAbsences, // Only future absences, not currently active ones
      activeAbsences, // Currently active absences
      totalDaysBlocked: totalDays,
    };
  }
}

export const doctorService = new DoctorService();
