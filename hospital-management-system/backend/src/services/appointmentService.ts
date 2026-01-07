import prisma from '../config/database';
import { CreateAppointmentDto, SearchParams } from '../types';
import { NotFoundError, ConflictError, AppError } from '../middleware/errorHandler';
import { AppointmentStatus } from '@prisma/client';
import { notificationService } from './notificationService';

export class AppointmentService {
  async create(hospitalId: string, data: CreateAppointmentDto) {
    // Verify patient exists
    const patient = await prisma.patient.findFirst({
      where: { id: data.patientId, hospitalId },
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    // Verify doctor exists and belongs to hospital
    const doctor = await prisma.doctor.findFirst({
      where: { id: data.doctorId },
      include: { user: true },
    });

    if (!doctor || doctor.user.hospitalId !== hospitalId) {
      throw new NotFoundError('Doctor not found');
    }

    // Check for conflicting appointments
    const existingAppointment = await prisma.appointment.findFirst({
      where: {
        doctorId: data.doctorId,
        appointmentDate: new Date(data.appointmentDate),
        startTime: data.startTime,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      },
    });

    if (existingAppointment) {
      throw new ConflictError('This time slot is already booked');
    }

    // Get token number for the day
    const todayAppointments = await prisma.appointment.count({
      where: {
        doctorId: data.doctorId,
        appointmentDate: new Date(data.appointmentDate),
        status: { notIn: ['CANCELLED'] },
      },
    });

    const appointment = await prisma.appointment.create({
      data: {
        hospitalId,
        patientId: data.patientId,
        doctorId: data.doctorId,
        appointmentDate: new Date(data.appointmentDate),
        startTime: data.startTime,
        endTime: data.endTime,
        type: data.type,
        reason: data.reason,
        notes: data.notes,
        isFollowUp: data.isFollowUp || false,
        parentAppointmentId: data.parentAppointmentId,
        tokenNumber: todayAppointments + 1,
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            mrn: true,
          },
        },
        doctor: {
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
            department: true,
          },
        },
      },
    });

    // Send appointment confirmation notification
    try {
      await notificationService.sendAppointmentNotification(
        {
          appointmentId: appointment.id,
          patientName: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
          doctorName: `${appointment.doctor.user.firstName} ${appointment.doctor.user.lastName}`,
          departmentName: appointment.doctor.department?.name,
          appointmentDate: appointment.appointmentDate,
          appointmentTime: appointment.startTime,
          title: 'Appointment Scheduled',
          message: '',
          type: 'SCHEDULED',
        },
        'SCHEDULED'
      );
    } catch (error) {
      console.error('Failed to send appointment notification:', error);
      // Don't fail the appointment creation if notification fails
    }

    return appointment;
  }

  async findAll(hospitalId: string, params: SearchParams & {
    doctorId?: string;
    patientId?: string;
    status?: AppointmentStatus;
    date?: Date;
    startDate?: Date;
    endDate?: Date;
  }) {
    const {
      page = 1,
      limit = 10,
      sortBy = 'appointmentDate',
      sortOrder = 'desc',
      doctorId,
      patientId,
      status,
      date,
      startDate,
      endDate,
    } = params;

    const skip = (page - 1) * limit;

    const where: any = { hospitalId };

    if (doctorId) where.doctorId = doctorId;
    if (patientId) where.patientId = patientId;
    if (status) where.status = status;

    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      where.appointmentDate = {
        gte: startOfDay,
        lte: endOfDay,
      };
    } else if (startDate && endDate) {
      where.appointmentDate = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              mrn: true,
            },
          },
          doctor: {
            include: {
              user: {
                select: { firstName: true, lastName: true },
              },
              department: {
                select: { id: true, name: true },
              },
            },
          },
        },
      }),
      prisma.appointment.count({ where }),
    ]);

    return { appointments, total };
  }

  async findById(id: string, hospitalId: string) {
    const appointment = await prisma.appointment.findFirst({
      where: { id, hospitalId },
      include: {
        patient: {
          include: {
            allergies: true,
            vitals: {
              orderBy: { recordedAt: 'desc' },
              take: 1,
            },
          },
        },
        doctor: {
          include: {
            user: {
              select: { firstName: true, lastName: true, phone: true, email: true },
            },
            department: true,
          },
        },
        consultation: {
          include: {
            prescriptions: {
              include: { medications: true },
            },
          },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }

    return appointment;
  }

  async update(id: string, hospitalId: string, data: Partial<CreateAppointmentDto>) {
    const appointment = await prisma.appointment.findFirst({
      where: { id, hospitalId },
    });

    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }

    // Store old date/time for reschedule notification
    const oldDate = appointment.appointmentDate;
    const oldTime = appointment.startTime;
    const isRescheduling = data.appointmentDate || data.startTime;

    // If rescheduling, check for conflicts
    if (isRescheduling) {
      const conflictCheck = await prisma.appointment.findFirst({
        where: {
          id: { not: id },
          doctorId: data.doctorId || appointment.doctorId,
          appointmentDate: data.appointmentDate ? new Date(data.appointmentDate) : appointment.appointmentDate,
          startTime: data.startTime || appointment.startTime,
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        },
      });

      if (conflictCheck) {
        throw new ConflictError('This time slot is already booked');
      }
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        ...data,
        appointmentDate: data.appointmentDate ? new Date(data.appointmentDate) : undefined,
      },
      include: {
        patient: {
          select: { id: true, firstName: true, lastName: true, phone: true, email: true },
        },
        doctor: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            department: true,
          },
        },
      },
    });

    // Send reschedule notification if date or time changed
    if (isRescheduling) {
      try {
        await notificationService.sendAppointmentNotification(
          {
            appointmentId: updated.id,
            patientName: `${updated.patient.firstName} ${updated.patient.lastName}`,
            doctorName: `${updated.doctor.user.firstName} ${updated.doctor.user.lastName}`,
            departmentName: updated.doctor.department?.name,
            appointmentDate: updated.appointmentDate,
            appointmentTime: updated.startTime,
            title: 'Appointment Rescheduled',
            message: `Your appointment has been rescheduled from ${oldDate.toLocaleDateString()} at ${oldTime} to ${updated.appointmentDate.toLocaleDateString()} at ${updated.startTime}.`,
            type: 'RESCHEDULED',
          },
          'RESCHEDULED'
        );
      } catch (error) {
        console.error('Failed to send reschedule notification:', error);
        // Don't fail the update if notification fails
      }
    }

    return updated;
  }

  async updateStatus(id: string, hospitalId: string, status: AppointmentStatus) {
    const appointment = await prisma.appointment.findFirst({
      where: { id, hospitalId },
      include: {
        patient: {
          select: { id: true, firstName: true, lastName: true, phone: true, email: true },
        },
        doctor: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            department: true,
          },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }

    const updateData: any = { status };

    if (status === 'CHECKED_IN') {
      updateData.checkedInAt = new Date();
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: updateData,
    });

    // Send confirmation notification when status changes to CONFIRMED
    if (status === 'CONFIRMED') {
      try {
        await notificationService.sendAppointmentNotification(
          {
            appointmentId: appointment.id,
            patientName: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
            doctorName: `${appointment.doctor.user.firstName} ${appointment.doctor.user.lastName}`,
            departmentName: appointment.doctor.department?.name,
            appointmentDate: appointment.appointmentDate,
            appointmentTime: appointment.startTime,
            title: 'Appointment Confirmed',
            message: '',
            type: 'CONFIRMED',
          },
          'CONFIRMED'
        );
      } catch (error) {
        console.error('Failed to send confirmation notification:', error);
        // Don't fail the status update if notification fails
      }
    }

    return updated;
  }

  async cancel(id: string, hospitalId: string, reason?: string) {
    const appointment = await prisma.appointment.findFirst({
      where: { id, hospitalId },
      include: {
        patient: {
          select: { id: true, firstName: true, lastName: true, phone: true, email: true },
        },
        doctor: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            department: true,
          },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }

    if (appointment.status === 'COMPLETED') {
      throw new AppError('Cannot cancel a completed appointment');
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        notes: reason ? `${appointment.notes || ''}\nCancellation reason: ${reason}`.trim() : appointment.notes,
      },
    });

    // Send cancellation notification
    try {
      await notificationService.sendAppointmentNotification(
        {
          appointmentId: appointment.id,
          patientName: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
          doctorName: `${appointment.doctor.user.firstName} ${appointment.doctor.user.lastName}`,
          departmentName: appointment.doctor.department?.name,
          appointmentDate: appointment.appointmentDate,
          appointmentTime: appointment.startTime,
          title: 'Appointment Cancelled',
          message: reason ? `Reason: ${reason}` : '',
          type: 'CANCELLED',
        },
        'CANCELLED'
      );
    } catch (error) {
      console.error('Failed to send cancellation notification:', error);
      // Don't fail the cancellation if notification fails
    }

    return updated;
  }

  async getAvailableSlots(
    hospitalId: string,
    doctorId: string,
    date: Date
  ) {
    const doctor = await prisma.doctor.findFirst({
      where: { id: doctorId },
      include: {
        user: true,
        schedules: true,
      },
    });

    if (!doctor || doctor.user.hospitalId !== hospitalId) {
      throw new NotFoundError('Doctor not found');
    }

    const dayOfWeek = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][date.getDay()];

    const schedule = doctor.schedules.find(s => s.dayOfWeek === dayOfWeek && s.isActive);

    if (!schedule) {
      return [];
    }

    // Get existing appointments for the day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const existingAppointments = await prisma.appointment.findMany({
      where: {
        doctorId,
        appointmentDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      },
      select: { startTime: true, endTime: true },
    });

    const bookedSlots = new Set(existingAppointments.map(a => a.startTime));

    // Generate available slots
    const slots: { startTime: string; endTime: string; isAvailable: boolean }[] = [];
    const slotDuration = doctor.slotDuration;

    const [startHour, startMin] = schedule.startTime.split(':').map(Number);
    const [endHour, endMin] = schedule.endTime.split(':').map(Number);
    const [breakStartHour, breakStartMin] = schedule.breakStart?.split(':').map(Number) || [0, 0];
    const [breakEndHour, breakEndMin] = schedule.breakEnd?.split(':').map(Number) || [0, 0];

    let currentTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;
    const breakStart = schedule.breakStart ? breakStartHour * 60 + breakStartMin : null;
    const breakEnd = schedule.breakEnd ? breakEndHour * 60 + breakEndMin : null;

    while (currentTime + slotDuration <= endTime) {
      // Skip break time
      if (breakStart && breakEnd && currentTime >= breakStart && currentTime < breakEnd) {
        currentTime = breakEnd;
        continue;
      }

      const slotStart = `${Math.floor(currentTime / 60).toString().padStart(2, '0')}:${(currentTime % 60).toString().padStart(2, '0')}`;
      const slotEndTime = currentTime + slotDuration;
      const slotEnd = `${Math.floor(slotEndTime / 60).toString().padStart(2, '0')}:${(slotEndTime % 60).toString().padStart(2, '0')}`;

      slots.push({
        startTime: slotStart,
        endTime: slotEnd,
        isAvailable: !bookedSlots.has(slotStart),
      });

      currentTime += slotDuration;
    }

    return slots;
  }

  async getTodayQueue(hospitalId: string, doctorId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const appointments = await prisma.appointment.findMany({
      where: {
        hospitalId,
        doctorId,
        appointmentDate: {
          gte: today,
          lt: tomorrow,
        },
        status: { notIn: ['CANCELLED', 'NO_SHOW', 'COMPLETED'] },
      },
      orderBy: [
        { status: 'asc' },
        { tokenNumber: 'asc' },
      ],
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            mrn: true,
            gender: true,
            dateOfBirth: true,
          },
        },
      },
    });

    return appointments;
  }

  async getDashboardStats(hospitalId: string, doctorId?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const where: any = { hospitalId };
    if (doctorId) where.doctorId = doctorId;

    const [
      todayTotal,
      todayCompleted,
      todayPending,
      todayNoShow,
      weeklyTotal,
    ] = await Promise.all([
      prisma.appointment.count({
        where: {
          ...where,
          appointmentDate: { gte: today, lt: tomorrow },
        },
      }),
      prisma.appointment.count({
        where: {
          ...where,
          appointmentDate: { gte: today, lt: tomorrow },
          status: 'COMPLETED',
        },
      }),
      prisma.appointment.count({
        where: {
          ...where,
          appointmentDate: { gte: today, lt: tomorrow },
          status: { in: ['SCHEDULED', 'CONFIRMED', 'CHECKED_IN'] },
        },
      }),
      prisma.appointment.count({
        where: {
          ...where,
          appointmentDate: { gte: today, lt: tomorrow },
          status: 'NO_SHOW',
        },
      }),
      prisma.appointment.count({
        where: {
          ...where,
          appointmentDate: {
            gte: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
            lt: tomorrow,
          },
        },
      }),
    ]);

    return {
      today: {
        total: todayTotal,
        completed: todayCompleted,
        pending: todayPending,
        noShow: todayNoShow,
      },
      weeklyTotal,
    };
  }
}

export const appointmentService = new AppointmentService();
