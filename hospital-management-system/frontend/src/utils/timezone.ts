/**
 * Timezone utilities for UAE GST (Gulf Standard Time, UTC+4)
 * All hospital operations run on UAE timezone
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
 * Get current time in UAE as HH:MM string
 */
export function getCurrentTimeUAE(): string {
  const uaeNow = getNowInUAE();
  const hours = uaeNow.getUTCHours().toString().padStart(2, '0');
  const minutes = uaeNow.getUTCMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
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
 * @param selectedDate - Selected date in YYYY-MM-DD format
 * @param bufferMinutes - Minimum minutes before appointment (default 15)
 */
export function isSlotPastInUAE(slotTime: string, selectedDate: string, bufferMinutes: number = 15): boolean {
  const todayUAE = getTodayInUAE();

  // If not today, slot is not past
  if (selectedDate !== todayUAE) {
    return false;
  }

  const currentMinutes = getCurrentTimeMinutesUAE();
  const slotMinutes = parseTimeToMinutes(slotTime);

  // Slot is past if it starts within buffer minutes or has already passed
  return slotMinutes < currentMinutes + bufferMinutes;
}

/**
 * Check if a date string (YYYY-MM-DD) is today in UAE timezone
 */
export function isDateTodayInUAE(dateStr: string): boolean {
  return dateStr === getTodayInUAE();
}

/**
 * Check if a date string (YYYY-MM-DD) is in the past in UAE timezone
 */
export function isDateInPastUAE(dateStr: string): boolean {
  return dateStr < getTodayInUAE();
}

// Export timezone info for reference
export const UAE_TIMEZONE = {
  name: 'Gulf Standard Time',
  abbreviation: 'GST',
  offsetHours: UAE_OFFSET_HOURS,
  offsetString: '+04:00',
  ianaTimezone: 'Asia/Dubai',
};
