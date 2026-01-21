import prisma from '../config/database';
import { NotFoundError, AppError } from '../middleware/errorHandler';
import { DayOfWeek } from '@prisma/client';

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

    const slotsToCreate: Array<{
      doctorId: string;
      hospitalId: string;
      slotDate: Date;
      startTime: string;
      endTime: string;
    }> = [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Generate slots for each day
    for (let i = 0; i < daysAhead; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);

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
        slotsToCreate.push({
          doctorId,
          hospitalId,
          slotDate: date,
          startTime: slot.startTime,
          endTime: slot.endTime,
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
          update: {}, // Don't update if exists
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);

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
   * Get available slots for a specific date
   */
  async getAvailableSlotsByDate(
    doctorId: string,
    date: string,
    hospitalId: string
  ) {
    const slotDate = new Date(date);
    slotDate.setHours(0, 0, 0, 0);

    // Check if the date is not in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (slotDate < today) {
      return [];
    }

    const slots = await prisma.doctorSlot.findMany({
      where: {
        doctorId,
        hospitalId,
        slotDate,
      },
      orderBy: { startTime: 'asc' },
    });

    // If no slots exist for this date, try to generate them
    if (slots.length === 0) {
      const doctor = await prisma.doctor.findFirst({
        where: { id: doctorId, user: { hospitalId } },
        include: {
          schedules: { where: { isActive: true } },
        },
      });

      if (doctor && doctor.schedules.length > 0) {
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
          return prisma.doctorSlot.findMany({
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

    return slots;
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
   */
  async bookSlotByDateTime(
    doctorId: string,
    hospitalId: string,
    slotDate: Date,
    startTime: string,
    appointmentId: string
  ): Promise<void> {
    // Normalize the date to midnight
    const normalizedDate = new Date(slotDate);
    normalizedDate.setHours(0, 0, 0, 0);

    const slot = await prisma.doctorSlot.findUnique({
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
      const doctor = await prisma.doctor.findFirst({
        where: { id: doctorId },
      });

      if (!doctor) {
        throw new NotFoundError('Doctor not found');
      }

      // Calculate end time
      const [hours, mins] = startTime.split(':').map(Number);
      const startMinutes = hours * 60 + mins;
      const endMinutes = startMinutes + doctor.slotDuration;
      const endTime = this.formatTime(endMinutes);

      await prisma.doctorSlot.create({
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

    if (!slot.isAvailable) {
      throw new AppError('Slot is not available', 400);
    }

    if (slot.isBlocked) {
      throw new AppError('Slot is blocked by the doctor', 400);
    }

    await prisma.doctorSlot.update({
      where: { id: slot.id },
      data: {
        isAvailable: false,
        appointmentId,
      },
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
    const startDate = fromDate || new Date();
    startDate.setHours(0, 0, 0, 0);

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
}

export const slotService = new SlotService();
