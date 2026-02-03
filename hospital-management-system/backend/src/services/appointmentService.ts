import prisma from '../config/database';
import { CreateAppointmentDto, SearchParams } from '../types';
import { NotFoundError, ConflictError, AppError } from '../middleware/errorHandler';
import { AppointmentStatus } from '@prisma/client';
import { notificationService } from './notificationService';
import { slotService } from './slotService';
import { holidayService } from './holidayService';
import { billingService } from './billingService';

// Booking constraints
const MAX_ADVANCE_BOOKING_DAYS = 30;

export class AppointmentService {
  // Helper to parse time string to minutes
  private parseTime(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  // Helper method to validate slot availability
  private async validateSlotAvailability(
    doctorId: string,
    hospitalId: string,
    appointmentDate: Date,
    startTime: string,
    excludeAppointmentId?: string
  ): Promise<{ doctor: any; schedule: any }> {
    // Verify doctor exists and belongs to hospital
    const doctor = await prisma.doctor.findFirst({
      where: { id: doctorId },
      include: { user: true, schedules: true },
    });

    if (!doctor || doctor.user.hospitalId !== hospitalId) {
      throw new NotFoundError('Doctor not found');
    }

    // Check if doctor is available
    if (!doctor.isAvailable) {
      throw new AppError('Doctor is currently not available for appointments');
    }

    // Check if doctor's user account is active
    if (!doctor.user.isActive) {
      throw new AppError('Doctor is no longer active in the system');
    }

    // Normalize the date
    const normalizedDate = new Date(appointmentDate);
    const startOfDay = new Date(normalizedDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

    // Check if appointment date is in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (startOfDay < today) {
      throw new AppError('Cannot book appointments in the past');
    }

    // Check max advance booking limit
    const maxAdvanceDate = new Date(today);
    maxAdvanceDate.setDate(maxAdvanceDate.getDate() + MAX_ADVANCE_BOOKING_DAYS);
    if (startOfDay > maxAdvanceDate) {
      throw new AppError(`Cannot book appointments more than ${MAX_ADVANCE_BOOKING_DAYS} days in advance`);
    }

    // Check for hospital holidays
    const holidayName = await holidayService.getHolidayName(hospitalId, startOfDay);
    if (holidayName) {
      throw new AppError(`Cannot book appointments on ${holidayName} (hospital holiday)`);
    }

    // Check for doctor absence on this date
    const absence = await prisma.doctorAbsence.findFirst({
      where: {
        doctorId,
        status: 'ACTIVE',
        startDate: { lte: startOfDay },
        endDate: { gte: startOfDay },
      },
    });

    if (absence) {
      if (absence.isFullDay) {
        throw new AppError('Doctor is on leave on this date');
      }
      // Check partial day absence
      if (absence.startTime && absence.endTime) {
        const slotMinutes = this.parseTime(startTime);
        const absenceStartMinutes = this.parseTime(absence.startTime);
        const absenceEndMinutes = this.parseTime(absence.endTime);
        if (slotMinutes >= absenceStartMinutes && slotMinutes < absenceEndMinutes) {
          throw new AppError('Doctor is unavailable during this time');
        }
      }
    }

    // Get day of week
    const dayOfWeek = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][normalizedDate.getUTCDay()];

    // Check if doctor has schedule for this day
    const schedule = doctor.schedules.find((s: any) => s.dayOfWeek === dayOfWeek && s.isActive);
    if (!schedule) {
      throw new AppError(`Doctor is not available on ${dayOfWeek.toLowerCase()}s`);
    }

    // Validate time is within doctor's schedule
    const [slotHour, slotMin] = startTime.split(':').map(Number);
    const [schedStartHour, schedStartMin] = schedule.startTime.split(':').map(Number);
    const [schedEndHour, schedEndMin] = schedule.endTime.split(':').map(Number);

    const slotMinutes = slotHour * 60 + slotMin;
    const schedStartMinutes = schedStartHour * 60 + schedStartMin;
    const schedEndMinutes = schedEndHour * 60 + schedEndMin;

    if (slotMinutes < schedStartMinutes || slotMinutes + doctor.slotDuration > schedEndMinutes) {
      throw new AppError(`Selected time is outside doctor's working hours (${schedule.startTime} - ${schedule.endTime})`);
    }

    // Check if slot falls during break time
    if (schedule.breakStart && schedule.breakEnd) {
      const [breakStartHour, breakStartMin] = schedule.breakStart.split(':').map(Number);
      const [breakEndHour, breakEndMin] = schedule.breakEnd.split(':').map(Number);
      const breakStartMinutes = breakStartHour * 60 + breakStartMin;
      const breakEndMinutes = breakEndHour * 60 + breakEndMin;

      if (slotMinutes >= breakStartMinutes && slotMinutes < breakEndMinutes) {
        throw new AppError(`Selected time falls during doctor's break (${schedule.breakStart} - ${schedule.breakEnd})`);
      }
    }

    // Check for conflicting appointments
    const conflictWhere: any = {
      doctorId,
      appointmentDate: {
        gte: startOfDay,
        lt: endOfDay,
      },
      startTime,
      status: { notIn: ['CANCELLED', 'NO_SHOW'] },
    };

    // Exclude current appointment if updating
    if (excludeAppointmentId) {
      conflictWhere.id = { not: excludeAppointmentId };
    }

    const existingAppointment = await prisma.appointment.findFirst({
      where: conflictWhere,
    });

    if (existingAppointment) {
      throw new ConflictError('This time slot is already booked');
    }

    // Check max patients per day limit
    const todayAppointmentsCount = await prisma.appointment.count({
      where: {
        doctorId,
        appointmentDate: {
          gte: startOfDay,
          lt: endOfDay,
        },
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
      },
    });

    if (todayAppointmentsCount >= doctor.maxPatientsPerDay) {
      throw new AppError(`Doctor has reached maximum patients (${doctor.maxPatientsPerDay}) for this day`);
    }

    return { doctor, schedule };
  }

  async create(hospitalId: string, data: CreateAppointmentDto) {
    // Verify patient exists
    const patient = await prisma.patient.findFirst({
      where: { id: data.patientId, hospitalId },
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    // Normalize the date and create date range for consistent comparison
    const appointmentDate = new Date(data.appointmentDate);
    const startOfDay = new Date(appointmentDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

    // Check for patient duplicate booking at the same time
    const patientConflict = await prisma.appointment.findFirst({
      where: {
        patientId: data.patientId,
        appointmentDate: {
          gte: startOfDay,
          lt: endOfDay,
        },
        startTime: data.startTime,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      },
      include: {
        doctor: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    if (patientConflict) {
      const doctorName = `Dr. ${patientConflict.doctor.user.firstName} ${patientConflict.doctor.user.lastName}`;
      throw new ConflictError(
        `Patient already has an appointment at ${data.startTime} with ${doctorName}`
      );
    }

    // Validate slot availability (includes doctor verification, schedule check, conflict check)
    const { doctor } = await this.validateSlotAvailability(
      data.doctorId,
      hospitalId,
      new Date(data.appointmentDate),
      data.startTime
    );

    // Get token number for the day - use date range for consistent matching
    const todayAppointments = await prisma.appointment.count({
      where: {
        doctorId: data.doctorId,
        appointmentDate: {
          gte: startOfDay,
          lt: endOfDay,
        },
        status: { notIn: ['CANCELLED'] },
      },
    });

    const appointment = await prisma.appointment.create({
      data: {
        hospitalId,
        patientId: data.patientId,
        doctorId: data.doctorId,
        appointmentDate: startOfDay, // Use normalized date
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

    // Book the slot in DoctorSlot table
    try {
      await slotService.bookSlotByDateTime(
        data.doctorId,
        hospitalId,
        startOfDay,
        data.startTime,
        appointment.id
      );
    } catch (error) {
      console.error('Failed to book slot:', error);
      // Don't fail appointment creation if slot booking fails
      // The existing appointment conflict check provides backup validation
    }

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
      search,
      doctorId,
      patientId,
      status,
      date,
      startDate,
      endDate,
    } = params;

    const skip = (page - 1) * limit;

    const where: any = { hospitalId };

    if (search) {
      const terms = search.trim().split(/\s+/);
      if (terms.length === 1) {
        const term = terms[0];
        where.OR = [
          { patient: { firstName: { contains: term, mode: 'insensitive' } } },
          { patient: { lastName: { contains: term, mode: 'insensitive' } } },
          { patient: { mrn: { contains: term, mode: 'insensitive' } } },
          { doctor: { user: { firstName: { contains: term, mode: 'insensitive' } } } },
          { doctor: { user: { lastName: { contains: term, mode: 'insensitive' } } } },
          { doctor: { department: { name: { contains: term, mode: 'insensitive' } } } },
        ];
      } else {
        // Multi-word: every word must match at least one name field (patient or doctor)
        where.AND = terms.map(term => ({
          OR: [
            { patient: { firstName: { contains: term, mode: 'insensitive' } } },
            { patient: { lastName: { contains: term, mode: 'insensitive' } } },
            { patient: { mrn: { contains: term, mode: 'insensitive' } } },
            { doctor: { user: { firstName: { contains: term, mode: 'insensitive' } } } },
            { doctor: { user: { lastName: { contains: term, mode: 'insensitive' } } } },
            { doctor: { department: { name: { contains: term, mode: 'insensitive' } } } },
          ],
        }));
      }
    }

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

    // When viewing a specific date, sort by startTime descending (latest slot first)
    const effectiveOrderBy = date
      ? [{ startTime: 'desc' as const }, { appointmentDate: 'desc' as const }]
      : [{ [sortBy]: sortOrder }];

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        skip,
        take: limit,
        orderBy: effectiveOrderBy,
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

    // Prevent editing completed appointments
    if (appointment.status === 'COMPLETED') {
      throw new AppError('Cannot edit a completed appointment');
    }

    // Prevent editing cancelled appointments
    if (appointment.status === 'CANCELLED') {
      throw new AppError('Cannot edit a cancelled appointment');
    }

    // Store old date/time for reschedule notification
    const oldDate = appointment.appointmentDate;
    const oldTime = appointment.startTime;
    const isRescheduling = data.appointmentDate || data.startTime || data.doctorId;

    // If rescheduling (changing date, time, or doctor), validate the new slot
    if (isRescheduling) {
      const newDoctorId = data.doctorId || appointment.doctorId;
      const newDate = data.appointmentDate ? new Date(data.appointmentDate) : appointment.appointmentDate;
      const newTime = data.startTime || appointment.startTime;

      // Validate the new slot availability
      // This checks: doctor schedule, working hours, break time, conflicts, max patients
      await this.validateSlotAvailability(
        newDoctorId,
        hospitalId,
        newDate,
        newTime,
        id // Exclude current appointment from conflict check
      );

      // Calculate new end time based on doctor's slot duration
      if (data.startTime && !data.endTime) {
        const doctor = await prisma.doctor.findUnique({
          where: { id: newDoctorId },
          select: { slotDuration: true },
        });
        if (doctor) {
          const [hour, min] = data.startTime.split(':').map(Number);
          const endMinutes = hour * 60 + min + doctor.slotDuration;
          data.endTime = `${Math.floor(endMinutes / 60).toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`;
        }
      }
    }

    // Build clean update data — only include fields Prisma accepts
    const updateData: any = {};
    if (data.appointmentDate) updateData.appointmentDate = new Date(data.appointmentDate);
    if (data.startTime) updateData.startTime = data.startTime;
    if (data.endTime) updateData.endTime = data.endTime;
    if (data.type) updateData.type = data.type;
    if (data.reason !== undefined) updateData.reason = data.reason;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.status) updateData.status = data.status;
    // Handle relations via connect
    if (data.doctorId) updateData.doctor = { connect: { id: data.doctorId } };
    if (data.patientId) updateData.patient = { connect: { id: data.patientId } };

    const updated = await prisma.appointment.update({
      where: { id },
      data: updateData,
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

    // Handle slot changes when rescheduling
    if (isRescheduling) {
      try {
        // Release the old slot
        await slotService.releaseSlot(id);

        // Book the new slot
        const newDate = new Date(updated.appointmentDate);
        newDate.setHours(0, 0, 0, 0);
        await slotService.bookSlotByDateTime(
          updated.doctorId,
          hospitalId,
          newDate,
          updated.startTime,
          updated.id
        );
      } catch (error) {
        console.error('Failed to update slots during reschedule:', error);
        // Don't fail the update if slot management fails
      }

      // Send reschedule notification
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
        consultation: {
          select: { id: true, diagnosis: true, icdCodes: true },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }

    // Validation: Cannot complete consultation without diagnosis
    if (status === 'COMPLETED') {
      const consultation = appointment.consultation;
      const hasDiagnosis = consultation && (
        (Array.isArray(consultation.diagnosis) && consultation.diagnosis.length > 0) ||
        (Array.isArray(consultation.icdCodes) && consultation.icdCodes.length > 0)
      );

      if (!hasDiagnosis) {
        throw new AppError('Cannot complete consultation without a diagnosis. Please add at least one diagnosis before completing.');
      }
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

    // Auto-generate invoice on appointment completion
    if (status === 'COMPLETED') {
      try {
        await billingService.autoGenerateInvoice(id, hospitalId, appointment.doctorId || 'system');
      } catch (error) {
        console.error('[AUTO-BILLING] Failed to auto-generate invoice for appointment:', id, error);
        // Don't fail the status update if billing fails
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

    // Release the slot so it can be booked again
    try {
      await slotService.releaseSlot(id);
    } catch (error) {
      console.error('Failed to release slot:', error);
      // Don't fail cancellation if slot release fails
    }

    // Send cancellation notification to patient
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
    }

    // Notify doctor of cancellation (especially for last-minute cancellations)
    try {
      const hoursUntilAppointment = (appointment.appointmentDate.getTime() - Date.now()) / (1000 * 60 * 60);
      const isLastMinute = hoursUntilAppointment <= 24 && hoursUntilAppointment >= 0;

      await notificationService.sendNotification(
        appointment.doctor.userId,
        'APPOINTMENT',
        {
          title: isLastMinute ? 'Last-Minute Cancellation' : 'Appointment Cancelled',
          message: `${appointment.patient.firstName} ${appointment.patient.lastName} cancelled their ${appointment.startTime} appointment on ${appointment.appointmentDate.toISOString().split('T')[0]}${reason ? `. Reason: ${reason}` : ''}`,
          priority: isLastMinute ? 'high' : 'normal',
          metadata: {
            appointmentId: appointment.id,
            patientId: appointment.patientId,
            type: 'CANCELLATION',
            isLastMinute,
          },
        },
        ['in_app']
      );
    } catch (error) {
      console.error('Failed to notify doctor of cancellation:', error);
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
