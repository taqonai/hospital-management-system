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
 * Get today's date as a Date object normalized to midnight UAE time
 */
export function getTodayDateUAE(): Date {
  const uaeNow = getNowInUAE();
  const todayStr = uaeNow.toISOString().split('T')[0];
  const date = new Date(todayStr + 'T00:00:00Z');
  return date;
}

/**
 * Check if a given date is today in UAE timezone
 */
export function isTodayInUAE(date: Date): boolean {
  const inputDateStr = date.toISOString().split('T')[0];
  const todayStr = getTodayInUAE();
  return inputDateStr === todayStr;
}

/**
 * Check if a given date string (YYYY-MM-DD) is today in UAE timezone
 */
export function isDateTodayInUAE(dateStr: string): boolean {
  return dateStr === getTodayInUAE();
}

/**
 * Check if a given date is in the past (before today in UAE timezone)
 */
export function isDateInPastUAE(date: Date): boolean {
  const inputDateStr = date.toISOString().split('T')[0];
  const todayStr = getTodayInUAE();
  return inputDateStr < todayStr;
}

/**
 * Format current UAE time as HH:MM string
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
 * Check if a time slot has passed or is too soon (within buffer) for today
 * @param slotTime - Slot start time in HH:MM format
 * @param bufferMinutes - Minimum minutes before appointment (default 15)
 */
export function isSlotPastOrTooSoon(slotTime: string, bufferMinutes: number = 15): boolean {
  const currentMinutes = getCurrentTimeMinutesUAE();
  const slotMinutes = parseTimeToMinutes(slotTime);
  return slotMinutes < currentMinutes + bufferMinutes;
}

// Export timezone info for documentation
export const UAE_TIMEZONE = {
  name: 'Gulf Standard Time',
  abbreviation: 'GST',
  offsetHours: UAE_OFFSET_HOURS,
  offsetString: '+04:00',
  ianaTimezone: 'Asia/Dubai',
};
