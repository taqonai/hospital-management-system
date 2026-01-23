/**
 * Timezone utilities for UAE GST (Gulf Standard Time, UTC+4)
 * Matches backend timezone handling for consistency
 */

// UAE GST offset in hours (UTC+4)
const UAE_OFFSET_HOURS = 4;
const UAE_OFFSET_MINUTES = UAE_OFFSET_HOURS * 60;

/**
 * Get current date/time in UAE timezone
 */
export function getNowInUAE(): Date {
  const now = new Date();
  // Convert UTC to UAE by adding 4 hours
  const uaeTime = new Date(now.getTime() + UAE_OFFSET_MINUTES * 60 * 1000);
  return uaeTime;
}

/**
 * Get current time in UAE as minutes since midnight
 */
export function getCurrentTimeMinutesUAE(): number {
  const uaeNow = getNowInUAE();
  return uaeNow.getUTCHours() * 60 + uaeNow.getUTCMinutes();
}

/**
 * Get today's date in UAE timezone (YYYY-MM-DD format)
 */
export function getTodayInUAE(): string {
  const uaeNow = getNowInUAE();
  return uaeNow.toISOString().split('T')[0];
}

/**
 * Get today's date as a Date object normalized to midnight UAE time
 */
export function getTodayDateUAE(): Date {
  const todayStr = getTodayInUAE();
  return new Date(todayStr + 'T00:00:00Z');
}

/**
 * Check if a given date string (YYYY-MM-DD) is today in UAE timezone
 */
export function isDateTodayInUAE(dateStr: string): boolean {
  return dateStr === getTodayInUAE();
}

/**
 * Check if a given date string is in the past (before today in UAE timezone)
 */
export function isDateInPastUAE(dateStr: string): boolean {
  return dateStr < getTodayInUAE();
}

/**
 * Parse time string "HH:MM" to minutes since midnight
 */
export function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Check if a time slot has passed or is too soon (within buffer) for today in UAE timezone
 * @param slotTime - Slot start time in HH:MM format
 * @param bufferMinutes - Minimum minutes before appointment (default 15)
 */
export function isSlotPastOrTooSoon(slotTime: string, bufferMinutes: number = 15): boolean {
  const currentMinutes = getCurrentTimeMinutesUAE();
  const slotMinutes = parseTimeToMinutes(slotTime);
  return slotMinutes < currentMinutes + bufferMinutes;
}

/**
 * Generate array of dates starting from today in UAE timezone
 * @param days - Number of days to generate (default 15 for today + 14 days)
 */
export function generateAvailableDatesUAE(days: number = 15): string[] {
  const dates: string[] = [];
  const todayUAE = getTodayDateUAE();

  for (let i = 0; i < days; i++) {
    const date = new Date(todayUAE);
    date.setUTCDate(todayUAE.getUTCDate() + i);
    dates.push(date.toISOString().split('T')[0]);
  }

  return dates;
}

/**
 * Format a date string for display (e.g., "Friday, January 24, 2026")
 */
export function formatDateForDisplay(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00Z');
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC', // Use UTC since we're working with UTC dates
  });
}

// Export timezone info for documentation
export const UAE_TIMEZONE = {
  name: 'Gulf Standard Time',
  abbreviation: 'GST',
  offsetHours: UAE_OFFSET_HOURS,
  offsetString: '+04:00',
  ianaTimezone: 'Asia/Dubai',
};
