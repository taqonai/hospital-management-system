import prisma from '../config/database';
import { NotFoundError, AppError, ValidationError } from '../middleware/errorHandler';
import { DayOfWeek } from '@prisma/client';
import { holidayService } from './holidayService';
import {
  getCurrentTimeMinutesUAE,
  getTodayDateUAE,
  getTodayInUAE,
  isTodayInUAE,
  isDateInPastUAE,
} from '../utils/timezone';

// Map JavaScript Date.getDay() (0=Sunday, 6=Saturday) to DayOfWeek enum
const dayIndexToEnum: Record<number, DayOfWeek> = {
  0: DayOfWeek.SUNDAY,
  1: DayOfWeek.MONDAY,
  2: DayOfWeek.TUESDAY,
  3: DayOfWeek.WEDNESDAY,
  4: DayOfWeek.THURSDAY,
  5: DayOfWeek.FRIDAY,
  6: DayOfWeek.SATURDAY,
};

// Validation helpers
const TIME_REGEX = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Booking constraints
const MAX_ADVANCE_BOOKING_DAYS = 30; // Maximum days in advance a slot can be booked
const MIN_BOOKING_BUFFER_MINUTES = 15; // Minimum minutes before appointment start

export class SlotService {
  /**
   * Parse time string "HH:MM" to minutes since midnight
   */
  private parseTime(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Format minutes since midnight to "HH:MM" string
   */
  private formatTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  /**
   * Generate time slots for a given schedule
   */
  private generateTimeSlots(
    startTime: string,
    endTime: string,
    slotDuration: number,
    breakStart?: string | null,
    breakEnd?: string | null
  ): Array<{ startTime: string; endTime: string }> {
    const slots: Array<{ startTime: string; endTime: string }> = [];
    const start = this.parseTime(startTime);
    const end = this.parseTime(endTime);
    const breakStartMinutes = breakStart ? this.parseTime(breakStart) : null;
    const breakEndMinutes = breakEnd ? this.parseTime(breakEnd) : null;

    let currentTime = start;

    while (currentTime + slotDuration <= end) {
      const slotEnd = currentTime + slotDuration;

      // Skip slots that overlap with break time
      if (breakStartMinutes !== null && breakEndMinutes !== null) {
        // Check if slot starts or ends during break
        const slotStartsDuringBreak = currentTime >= breakStartMinutes && currentTime < breakEndMinutes;
        const slotEndsDuringBreak = slotEnd > breakStartMinutes && slotEnd <= breakEndMinutes;
        const slotSpansBreak = currentTime < breakStartMinutes && slotEnd > breakEndMinutes;

        if (slotStartsDuringBreak || slotEndsDuringBreak || slotSpansBreak) {
          // Skip to break end
          currentTime = breakEndMinutes;
          continue;
        }
      }

      slots.push({
        startTime: this.formatTime(currentTime),
        endTime: this.formatTime(slotEnd),
      });

      currentTime = slotEnd;
    }

    return slots;
  }

  /**
   * Generate slots for a doctor for the next N days
   * Automatically blocks slots that fall within active absences
   */
  async generateSlotsForDoctor(
    doctorId: string,
    hospitalId: string,
    daysAhead: number = 30
  ): Promise<number> {
    // Get doctor with schedules
    const doctor = await prisma.doctor.findFirst({
      where: { id: doctorId, user: { hospitalId } },
      include: {
        schedules: {
          where: { isActive: true },
        },
      },
    });

    if (!doctor) {
      throw new NotFoundError('Doctor not found');
    }

    if (!doctor.schedules || doctor.schedules.length === 0) {
      return 0; // No schedules defined
    }

    // Use UAE timezone for "today"
    const today = getTodayDateUAE();

    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + daysAhead);

    // Fetch active absences for this doctor in the date range
    const absences = await prisma.doctorAbsence.findMany({
      where: {
        doctorId,
        status: 'ACTIVE',
        startDate: { lte: endDate },
        endDate: { gte: today },
      },
    });

    // Helper to check if a slot should be blocked due to absence
    const isSlotInAbsence = (slotDate: Date, startTime: string, endTime: string): boolean => {
      const slotDateStr = slotDate.toISOString().split('T')[0];

      for (const absence of absences) {
        const absenceStart = new Date(absence.startDate);
        const absenceEnd = new Date(absence.endDate);

        // Check if slot date is within absence range
        if (slotDate >= absenceStart && slotDate <= absenceEnd) {
          if (absence.isFullDay) {
            return true; // Full day absence blocks all slots
          }

          // Partial day - check time overlap
          if (absence.startTime && absence.endTime) {
            const slotStartMinutes = this.parseTime(startTime);
            const slotEndMinutes = this.parseTime(endTime);
            const absenceStartMinutes = this.parseTime(absence.startTime);
            const absenceEndMinutes = this.parseTime(absence.endTime);

            // Check for overlap
            if (slotStartMinutes < absenceEndMinutes && slotEndMinutes > absenceStartMinutes) {
              return true;
            }
          }
        }
      }
      return false;
    };

    const slotsToCreate: Array<{
      doctorId: string;
      hospitalId: string;
      slotDate: Date;
      startTime: string;
      endTime: string;
      isBlocked: boolean;
    }> = [];

    // Fetch hospital holidays in the date range
    const holidays = await holidayService.getHolidaysInRange(hospitalId, today, endDate);
    const holidayDates = new Set(holidays.map(h => h.date.toISOString().split('T')[0]));

    // Generate slots for each day
    for (let i = 0; i < daysAhead; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);

      // Skip hospital holidays
      const dateStr = date.toISOString().split('T')[0];
      if (holidayDates.has(dateStr)) {
        continue;
      }

      const dayOfWeek = dayIndexToEnum[date.getDay()];
      const schedule = doctor.schedules.find((s) => s.dayOfWeek === dayOfWeek);

      if (!schedule) continue;

      // Generate time slots for this day
      const timeSlots = this.generateTimeSlots(
        schedule.startTime,
        schedule.endTime,
        doctor.slotDuration,
        schedule.breakStart,
        schedule.breakEnd
      );

      for (const slot of timeSlots) {
        const shouldBlock = isSlotInAbsence(date, slot.startTime, slot.endTime);
        slotsToCreate.push({
          doctorId,
          hospitalId,
          slotDate: date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          isBlocked: shouldBlock,
        });
      }
    }

    if (slotsToCreate.length === 0) {
      return 0;
    }

    // Use upsert to avoid duplicates
    let createdCount = 0;
    for (const slot of slotsToCreate) {
      try {
        await prisma.doctorSlot.upsert({
          where: {
            doctorId_slotDate_startTime: {
              doctorId: slot.doctorId,
              slotDate: slot.slotDate,
              startTime: slot.startTime,
            },
          },
          create: slot,
          update: { isBlocked: slot.isBlocked }, // Update blocked status if absence was added
        });
        createdCount++;
      } catch (error) {
        // Ignore duplicate key errors
      }
    }

    return createdCount;
  }

  /**
   * Get all future available slots for a doctor
   */
  async getAvailableSlotsForDoctor(doctorId: string, hospitalId: string) {
    // Use UAE timezone for "today"
    const today = getTodayDateUAE();

    const slots = await prisma.doctorSlot.findMany({
      where: {
        doctorId,
        hospitalId,
        slotDate: { gte: today },
        isAvailable: true,
        isBlocked: false,
      },
      orderBy: [{ slotDate: 'asc' }, { startTime: 'asc' }],
    });

    return slots;
  }

  /**
   * Validate date string format
   */
  private validateDateFormat(date: string): void {
    if (!DATE_REGEX.test(date)) {
      throw new ValidationError('Invalid date format. Use YYYY-MM-DD');
    }
    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) {
      throw new ValidationError('Invalid date');
    }
  }

  /**
   * Get current time in minutes since midnight (UAE timezone)
   */
  private getCurrentTimeMinutes(): number {
    return getCurrentTimeMinutesUAE();
  }

  /**
   * Check if a date is today (UAE timezone)
   */
  private isToday(date: Date): boolean {
    return isTodayInUAE(date);
  }

  /**
   * Get available slots for a specific date
   * Returns slots with availability status and reason if unavailable
   */
  async getAvailableSlotsByDate(
    doctorId: string,
    date: string,
    hospitalId: string
  ) {
    // Validate date format
    this.validateDateFormat(date);

    const slotDate = new Date(date);
    slotDate.setHours(0, 0, 0, 0);

    // Check if the date is not in the past (UAE timezone)
    const today = getTodayDateUAE();
    const todayStr = getTodayInUAE();
    const slotDateStr = slotDate.toISOString().split('T')[0];

    if (slotDateStr < todayStr) {
      return { slots: [], unavailableReason: 'past_date', message: 'Cannot book appointments in the past' };
    }

    // Check max advance booking limit
    const maxAdvanceDate = new Date(today);
    maxAdvanceDate.setDate(maxAdvanceDate.getDate() + MAX_ADVANCE_BOOKING_DAYS);
    if (slotDate > maxAdvanceDate) {
      return {
        slots: [],
        unavailableReason: 'too_far_ahead',
        message: `Cannot book more than ${MAX_ADVANCE_BOOKING_DAYS} days in advance`
      };
    }

    // Check for doctor absence on this date
    const absence = await prisma.doctorAbsence.findFirst({
      where: {
        doctorId,
        status: 'ACTIVE',
        startDate: { lte: slotDate },
        endDate: { gte: slotDate },
      },
    });

    // If full day absence, return empty with reason
    if (absence?.isFullDay) {
      return {
        slots: [],
        unavailableReason: 'doctor_leave',
        message: 'Doctor is on leave on this date',
        absenceType: absence.absenceType,
      };
    }

    // Get doctor to check maxPatientsPerDay
    const doctor = await prisma.doctor.findFirst({
      where: { id: doctorId, user: { hospitalId } },
      include: {
        schedules: { where: { isActive: true } },
      },
    });

    if (!doctor) {
      throw new NotFoundError('Doctor not found');
    }

    let slots = await prisma.doctorSlot.findMany({
      where: {
        doctorId,
        hospitalId,
        slotDate,
      },
      orderBy: { startTime: 'asc' },
    });

    // If no slots exist for this date, try to generate them on-demand
    if (slots.length === 0) {
      if (doctor.schedules.length > 0) {
        const dayOfWeek = dayIndexToEnum[slotDate.getDay()];
        const schedule = doctor.schedules.find((s) => s.dayOfWeek === dayOfWeek);

        if (schedule) {
          const timeSlots = this.generateTimeSlots(
            schedule.startTime,
            schedule.endTime,
            doctor.slotDuration,
            schedule.breakStart,
            schedule.breakEnd
          );

          // Create slots for this date
          for (const slot of timeSlots) {
            try {
              await prisma.doctorSlot.create({
                data: {
                  doctorId,
                  hospitalId,
                  slotDate,
                  startTime: slot.startTime,
                  endTime: slot.endTime,
                },
              });
            } catch (error) {
              // Ignore duplicate key errors
            }
          }

          // Fetch newly created slots
          slots = await prisma.doctorSlot.findMany({
            where: {
              doctorId,
              hospitalId,
              slotDate,
            },
            orderBy: { startTime: 'asc' },
          });
        }
      }
    }

    // For today's date (UAE timezone), filter out past time slots
    const requestedDateStr = slotDate.toISOString().split('T')[0];
    if (requestedDateStr === todayStr) {
      const currentMinutes = this.getCurrentTimeMinutes();
      // Add 15 minute buffer - don't show slots that start in less than 15 mins
      const bufferMinutes = currentMinutes + 15;

      slots = slots.filter(slot => {
        const slotStartMinutes = this.parseTime(slot.startTime);
        return slotStartMinutes >= bufferMinutes;
      });
    }

    // For partial-day absence, mark affected time slots as unavailable
    if (absence && !absence.isFullDay && absence.startTime && absence.endTime) {
      const absenceStartMinutes = this.parseTime(absence.startTime);
      const absenceEndMinutes = this.parseTime(absence.endTime);

      slots = slots.map(slot => {
        const slotStartMinutes = this.parseTime(slot.startTime);
        const slotEndMinutes = this.parseTime(slot.endTime);
        // Check if slot overlaps with absence
        if (slotStartMinutes < absenceEndMinutes && slotEndMinutes > absenceStartMinutes) {
          return {
            ...slot,
            isAvailable: false,
            isBlocked: true,
            _unavailableReason: 'doctor_leave',
          };
        }
        return slot;
      });
    }

    // Check max patients per day - count booked slots
    const bookedCount = slots.filter(s => !s.isAvailable).length;
    const maxPatients = doctor.maxPatientsPerDay || 30;
    const remainingCapacity = Math.max(0, maxPatients - bookedCount);

    // If max reached, mark remaining slots as unavailable in response
    if (bookedCount >= maxPatients) {
      slots = slots.map(slot => ({
        ...slot,
        isAvailable: false,
        _unavailableReason: slot.isAvailable ? 'max_patients_reached' : (slot as any)._unavailableReason,
      }));
    }

    return {
      slots,
      maxPatientsPerDay: maxPatients,
      bookedCount,
      remainingCapacity,
      maxAdvanceBookingDays: MAX_ADVANCE_BOOKING_DAYS,
    };
  }

  /**
   * Book a slot by linking it to an appointment
   */
  async bookSlot(slotId: string, appointmentId: string): Promise<void> {
    const slot = await prisma.doctorSlot.findUnique({
      where: { id: slotId },
    });

    if (!slot) {
      throw new NotFoundError('Slot not found');
    }

    if (!slot.isAvailable) {
      throw new AppError('Slot is not available', 400);
    }

    if (slot.isBlocked) {
      throw new AppError('Slot is blocked', 400);
    }

    await prisma.doctorSlot.update({
      where: { id: slotId },
      data: {
        isAvailable: false,
        appointmentId,
      },
    });
  }

  /**
   * Find and book a slot by doctor, date, and time
   * Uses transaction with locking to prevent race conditions
   */
  async bookSlotByDateTime(
    doctorId: string,
    hospitalId: string,
    slotDate: Date,
    startTime: string,
    appointmentId: string
  ): Promise<void> {
    // Validate time format
    if (!TIME_REGEX.test(startTime)) {
      throw new ValidationError('Invalid time format. Use HH:MM');
    }

    // Normalize the date to midnight
    const normalizedDate = new Date(slotDate);
    normalizedDate.setHours(0, 0, 0, 0);

    // Check if the date is not in the past (UAE timezone)
    const today = getTodayDateUAE();
    const todayStr = getTodayInUAE();
    const normalizedDateStr = normalizedDate.toISOString().split('T')[0];

    if (normalizedDateStr < todayStr) {
      throw new AppError('Cannot book appointments in the past', 400);
    }

    // Check max advance booking limit
    const maxAdvanceDate = new Date(today);
    maxAdvanceDate.setDate(maxAdvanceDate.getDate() + MAX_ADVANCE_BOOKING_DAYS);
    if (normalizedDate > maxAdvanceDate) {
      throw new AppError(`Cannot book appointments more than ${MAX_ADVANCE_BOOKING_DAYS} days in advance`, 400);
    }

    // For today (UAE timezone), check if the time slot has already passed
    if (normalizedDateStr === todayStr) {
      const slotStartMinutes = this.parseTime(startTime);
      const currentMinutes = this.getCurrentTimeMinutes();
      // Add buffer time
      if (slotStartMinutes < currentMinutes + MIN_BOOKING_BUFFER_MINUTES) {
        throw new AppError('This time slot has already passed or is too soon', 400);
      }
    }

    // Check for active doctor absence on this date
    const absence = await prisma.doctorAbsence.findFirst({
      where: {
        doctorId,
        status: 'ACTIVE',
        startDate: { lte: normalizedDate },
        endDate: { gte: normalizedDate },
      },
    });

    if (absence) {
      // Check if the absence applies to this time slot
      if (absence.isFullDay) {
        throw new AppError('Doctor is on leave on this date', 400);
      }
      // For partial day absence, check time overlap
      if (absence.startTime && absence.endTime) {
        const slotStartMinutes = this.parseTime(startTime);
        const absenceStartMinutes = this.parseTime(absence.startTime);
        const absenceEndMinutes = this.parseTime(absence.endTime);
        if (slotStartMinutes >= absenceStartMinutes && slotStartMinutes < absenceEndMinutes) {
          throw new AppError('Doctor is unavailable during this time', 400);
        }
      }
    }

    // Get doctor to check maxPatientsPerDay
    const doctor = await prisma.doctor.findFirst({
      where: { id: doctorId },
    });

    if (!doctor) {
      throw new NotFoundError('Doctor not found');
    }

    // Use transaction with locking to prevent race conditions
    await prisma.$transaction(async (tx) => {
      // Check max patients per day (within transaction)
      const bookedSlotsToday = await tx.doctorSlot.count({
        where: {
          doctorId,
          slotDate: normalizedDate,
          isAvailable: false,
        },
      });

      const maxPatients = doctor.maxPatientsPerDay || 30;
      if (bookedSlotsToday >= maxPatients) {
        throw new AppError(`Maximum appointments (${maxPatients}) reached for this day`, 400);
      }

      // Find and lock the slot (SELECT FOR UPDATE equivalent)
      const slot = await tx.doctorSlot.findUnique({
        where: {
          doctorId_slotDate_startTime: {
            doctorId,
            slotDate: normalizedDate,
            startTime,
          },
        },
      });

      if (!slot) {
        // Create the slot if it doesn't exist (for backward compatibility)
        // Calculate end time
        const [hours, mins] = startTime.split(':').map(Number);
        const startMinutes = hours * 60 + mins;
        const endMinutes = startMinutes + doctor.slotDuration;
        const endTime = this.formatTime(endMinutes);

        await tx.doctorSlot.create({
          data: {
            doctorId,
            hospitalId,
            slotDate: normalizedDate,
            startTime,
            endTime,
            isAvailable: false,
            appointmentId,
          },
        });
        return;
      }

      // Re-check availability within transaction (prevents race condition)
      if (!slot.isAvailable) {
        throw new AppError('This time slot is already booked', 400);
      }

      if (slot.isBlocked) {
        throw new AppError('This time slot is blocked by the doctor', 400);
      }

      // Book the slot
      await tx.doctorSlot.update({
        where: { id: slot.id },
        data: {
          isAvailable: false,
          appointmentId,
        },
      });
    }, {
      isolationLevel: 'Serializable', // Highest isolation to prevent race conditions
      timeout: 10000, // 10 second timeout
    });
  }

  /**
   * Release a slot when appointment is cancelled
   */
  async releaseSlot(appointmentId: string): Promise<void> {
    const slot = await prisma.doctorSlot.findFirst({
      where: { appointmentId },
    });

    if (slot) {
      await prisma.doctorSlot.update({
        where: { id: slot.id },
        data: {
          isAvailable: true,
          appointmentId: null,
        },
      });
    }
  }

  /**
   * Block or unblock a slot
   */
  async toggleBlockSlot(
    slotId: string,
    hospitalId: string,
    isBlocked: boolean
  ): Promise<any> {
    const slot = await prisma.doctorSlot.findFirst({
      where: { id: slotId, hospitalId },
    });

    if (!slot) {
      throw new NotFoundError('Slot not found');
    }

    if (!slot.isAvailable && !isBlocked) {
      throw new AppError('Cannot unblock a booked slot', 400);
    }

    const updated = await prisma.doctorSlot.update({
      where: { id: slotId },
      data: { isBlocked },
    });

    return updated;
  }

  /**
   * Regenerate future slots when schedule changes
   */
  async regenerateSlots(
    doctorId: string,
    hospitalId: string,
    fromDate?: Date
  ): Promise<number> {
    // Use UAE timezone for default start date
    const startDate = fromDate || getTodayDateUAE();

    // Delete future unbooked slots
    await prisma.doctorSlot.deleteMany({
      where: {
        doctorId,
        hospitalId,
        slotDate: { gte: startDate },
        isAvailable: true,
        appointmentId: null,
      },
    });

    // Generate new slots
    const daysAhead = 30;
    return this.generateSlotsForDoctor(doctorId, hospitalId, daysAhead);
  }

  /**
   * Get slots grouped by date for calendar view
   */
  async getSlotsByDateRange(
    doctorId: string,
    hospitalId: string,
    startDate: string,
    endDate: string
  ) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const slots = await prisma.doctorSlot.findMany({
      where: {
        doctorId,
        hospitalId,
        slotDate: {
          gte: start,
          lte: end,
        },
      },
      orderBy: [{ slotDate: 'asc' }, { startTime: 'asc' }],
      include: {
        appointment: {
          select: {
            id: true,
            status: true,
            patient: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                mrn: true,
              },
            },
          },
        },
      },
    });

    // Group slots by date
    const slotsByDate: Record<string, typeof slots> = {};
    for (const slot of slots) {
      const dateKey = slot.slotDate.toISOString().split('T')[0];
      if (!slotsByDate[dateKey]) {
        slotsByDate[dateKey] = [];
      }
      slotsByDate[dateKey].push(slot);
    }

    return slotsByDate;
  }

  /**
   * Block all slots for a doctor within a date range
   * Used when creating a doctor absence
   */
  async blockSlotsForDateRange(
    doctorId: string,
    hospitalId: string,
    startDate: Date,
    endDate: Date,
    isFullDay: boolean = true,
    startTime?: string,
    endTime?: string
  ): Promise<number> {
    // Normalize dates to midnight
    const normalizedStart = new Date(startDate);
    normalizedStart.setHours(0, 0, 0, 0);
    const normalizedEnd = new Date(endDate);
    normalizedEnd.setHours(23, 59, 59, 999);

    // Build the where clause
    const where: any = {
      doctorId,
      hospitalId,
      slotDate: {
        gte: normalizedStart,
        lte: normalizedEnd,
      },
      isAvailable: true, // Only block available slots (not already booked)
    };

    // For partial day blocking, filter by time
    if (!isFullDay && startTime && endTime) {
      const startMinutes = this.parseTime(startTime);
      const endMinutes = this.parseTime(endTime);

      // Get all slots in date range, then filter by time in application layer
      const slots = await prisma.doctorSlot.findMany({
        where: {
          ...where,
          isAvailable: true,
        },
        select: { id: true, startTime: true, endTime: true },
      });

      // Filter slots that overlap with the absence time range
      const slotIdsToBlock = slots
        .filter((slot) => {
          const slotStart = this.parseTime(slot.startTime);
          const slotEnd = this.parseTime(slot.endTime);
          // Slot overlaps if it starts during absence or ends during absence
          return slotStart >= startMinutes && slotEnd <= endMinutes;
        })
        .map((slot) => slot.id);

      if (slotIdsToBlock.length === 0) {
        return 0;
      }

      const result = await prisma.doctorSlot.updateMany({
        where: { id: { in: slotIdsToBlock } },
        data: { isBlocked: true },
      });

      return result.count;
    }

    // Full day blocking - block all available slots in date range
    const result = await prisma.doctorSlot.updateMany({
      where,
      data: { isBlocked: true },
    });

    return result.count;
  }

  /**
   * Unblock all slots for a doctor within a date range
   * Used when cancelling a doctor absence
   */
  async unblockSlotsForDateRange(
    doctorId: string,
    hospitalId: string,
    startDate: Date,
    endDate: Date,
    isFullDay: boolean = true,
    startTime?: string,
    endTime?: string
  ): Promise<number> {
    // Normalize dates
    const normalizedStart = new Date(startDate);
    normalizedStart.setHours(0, 0, 0, 0);
    const normalizedEnd = new Date(endDate);
    normalizedEnd.setHours(23, 59, 59, 999);

    // Build the where clause
    const where: any = {
      doctorId,
      hospitalId,
      slotDate: {
        gte: normalizedStart,
        lte: normalizedEnd,
      },
      isBlocked: true,
    };

    // For partial day unblocking, filter by time
    if (!isFullDay && startTime && endTime) {
      const startMinutes = this.parseTime(startTime);
      const endMinutes = this.parseTime(endTime);

      const slots = await prisma.doctorSlot.findMany({
        where: {
          ...where,
          isBlocked: true,
        },
        select: { id: true, startTime: true, endTime: true },
      });

      const slotIdsToUnblock = slots
        .filter((slot) => {
          const slotStart = this.parseTime(slot.startTime);
          const slotEnd = this.parseTime(slot.endTime);
          return slotStart >= startMinutes && slotEnd <= endMinutes;
        })
        .map((slot) => slot.id);

      if (slotIdsToUnblock.length === 0) {
        return 0;
      }

      const result = await prisma.doctorSlot.updateMany({
        where: { id: { in: slotIdsToUnblock } },
        data: { isBlocked: false },
      });

      return result.count;
    }

    // Full day unblocking
    const result = await prisma.doctorSlot.updateMany({
      where,
      data: { isBlocked: false },
    });

    return result.count;
  }

  /**
   * Count existing appointments in a date range for a doctor
   * Used to warn when creating an absence
   */
  async countAppointmentsInDateRange(
    doctorId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const normalizedStart = new Date(startDate);
    normalizedStart.setHours(0, 0, 0, 0);
    const normalizedEnd = new Date(endDate);
    normalizedEnd.setHours(23, 59, 59, 999);

    const count = await prisma.appointment.count({
      where: {
        doctorId,
        appointmentDate: {
          gte: normalizedStart,
          lte: normalizedEnd,
        },
        status: {
          notIn: ['CANCELLED', 'NO_SHOW'],
        },
      },
    });

    return count;
  }
}

export const slotService = new SlotService();
