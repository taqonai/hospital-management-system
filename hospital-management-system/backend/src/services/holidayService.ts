import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';

/**
 * Hospital Holiday Service
 * Manages hospital-wide holidays for slot blocking
 */
class HolidayService {
  /**
   * Create a hospital holiday
   */
  async create(hospitalId: string, data: {
    name: string;
    date: Date;
    isRecurring?: boolean;
    description?: string;
    createdBy: string;
  }) {
    // Check if holiday already exists for this date
    const existing = await prisma.hospitalHoliday.findUnique({
      where: {
        hospitalId_date: {
          hospitalId,
          date: data.date,
        },
      },
    });

    if (existing) {
      throw new AppError('A holiday already exists for this date', 400);
    }

    return prisma.hospitalHoliday.create({
      data: {
        hospitalId,
        name: data.name,
        date: data.date,
        isRecurring: data.isRecurring || false,
        description: data.description,
        createdBy: data.createdBy,
      },
    });
  }

  /**
   * Get all holidays for a hospital
   */
  async getAll(hospitalId: string, params?: {
    year?: number;
    upcoming?: boolean;
  }) {
    const where: any = { hospitalId, isActive: true };

    if (params?.year) {
      const startOfYear = new Date(params.year, 0, 1);
      const endOfYear = new Date(params.year, 11, 31);
      where.date = { gte: startOfYear, lte: endOfYear };
    }

    if (params?.upcoming) {
      where.date = { gte: new Date() };
    }

    return prisma.hospitalHoliday.findMany({
      where,
      orderBy: { date: 'asc' },
    });
  }

  /**
   * Check if a specific date is a holiday
   */
  async isHoliday(hospitalId: string, date: Date): Promise<boolean> {
    // Normalize date to start of day
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);

    // Check exact date match
    const exactMatch = await prisma.hospitalHoliday.findFirst({
      where: {
        hospitalId,
        date: normalizedDate,
        isActive: true,
      },
    });

    if (exactMatch) return true;

    // Check recurring holidays (same month and day, any year)
    const recurringHolidays = await prisma.hospitalHoliday.findMany({
      where: {
        hospitalId,
        isRecurring: true,
        isActive: true,
      },
    });

    for (const holiday of recurringHolidays) {
      const holidayDate = new Date(holiday.date);
      if (
        holidayDate.getMonth() === normalizedDate.getMonth() &&
        holidayDate.getDate() === normalizedDate.getDate()
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get holiday name for a date (if it's a holiday)
   */
  async getHolidayName(hospitalId: string, date: Date): Promise<string | null> {
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);

    // Check exact date match
    const exactMatch = await prisma.hospitalHoliday.findFirst({
      where: {
        hospitalId,
        date: normalizedDate,
        isActive: true,
      },
    });

    if (exactMatch) return exactMatch.name;

    // Check recurring holidays
    const recurringHolidays = await prisma.hospitalHoliday.findMany({
      where: {
        hospitalId,
        isRecurring: true,
        isActive: true,
      },
    });

    for (const holiday of recurringHolidays) {
      const holidayDate = new Date(holiday.date);
      if (
        holidayDate.getMonth() === normalizedDate.getMonth() &&
        holidayDate.getDate() === normalizedDate.getDate()
      ) {
        return holiday.name;
      }
    }

    return null;
  }

  /**
   * Update a holiday
   */
  async update(id: string, hospitalId: string, data: {
    name?: string;
    date?: Date;
    isRecurring?: boolean;
    description?: string;
  }) {
    const holiday = await prisma.hospitalHoliday.findFirst({
      where: { id, hospitalId },
    });

    if (!holiday) {
      throw new AppError('Holiday not found', 404);
    }

    // If changing date, check for conflicts
    if (data.date) {
      const existing = await prisma.hospitalHoliday.findFirst({
        where: {
          hospitalId,
          date: data.date,
          id: { not: id },
        },
      });

      if (existing) {
        throw new AppError('A holiday already exists for this date', 400);
      }
    }

    return prisma.hospitalHoliday.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete (deactivate) a holiday
   */
  async delete(id: string, hospitalId: string) {
    const holiday = await prisma.hospitalHoliday.findFirst({
      where: { id, hospitalId },
    });

    if (!holiday) {
      throw new AppError('Holiday not found', 404);
    }

    return prisma.hospitalHoliday.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Get holidays in a date range (for calendar view)
   */
  async getHolidaysInRange(hospitalId: string, startDate: Date, endDate: Date) {
    const holidays = await prisma.hospitalHoliday.findMany({
      where: {
        hospitalId,
        isActive: true,
        OR: [
          // Exact dates in range
          { date: { gte: startDate, lte: endDate }, isRecurring: false },
          // All recurring holidays (we'll filter by month/day)
          { isRecurring: true },
        ],
      },
    });

    const result: Array<{ date: Date; name: string; isRecurring: boolean }> = [];

    for (const holiday of holidays) {
      if (!holiday.isRecurring) {
        result.push({
          date: holiday.date,
          name: holiday.name,
          isRecurring: false,
        });
      } else {
        // For recurring holidays, find all occurrences in the date range
        const holidayMonth = holiday.date.getMonth();
        const holidayDay = holiday.date.getDate();

        const current = new Date(startDate);
        while (current <= endDate) {
          if (current.getMonth() === holidayMonth && current.getDate() === holidayDay) {
            result.push({
              date: new Date(current),
              name: holiday.name,
              isRecurring: true,
            });
          }
          current.setDate(current.getDate() + 1);
        }
      }
    }

    return result.sort((a, b) => a.date.getTime() - b.date.getTime());
  }
}

export const holidayService = new HolidayService();
