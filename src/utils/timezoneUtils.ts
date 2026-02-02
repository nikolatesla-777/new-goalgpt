/**
 * Timezone Utilities
 * Centralized timezone handling for Istanbul (Europe/Istanbul, UTC+3)
 */

import moment from 'moment-timezone';

const ISTANBUL_TZ = 'Europe/Istanbul';

/**
 * Get today's date in Istanbul timezone (YYYY-MM-DD)
 */
export function getTodayInIstanbul(): string {
  return moment().tz(ISTANBUL_TZ).format('YYYY-MM-DD');
}

/**
 * Get date in Istanbul timezone (YYYY-MM-DD)
 * @param date - Optional date string, defaults to today
 */
export function getDateInIstanbul(date?: string): string {
  if (!date) return getTodayInIstanbul();
  return moment(date).tz(ISTANBUL_TZ).format('YYYY-MM-DD');
}

/**
 * Convert Unix timestamp to Istanbul date (YYYY-MM-DD)
 * @param unixTimestamp - Unix timestamp in seconds
 */
export function unixToIstanbulDate(unixTimestamp: number): string {
  return moment.unix(unixTimestamp).tz(ISTANBUL_TZ).format('YYYY-MM-DD');
}

/**
 * Normalize date/time string to Unix timestamp in Istanbul timezone
 * @param dateStr - Date string (YYYY-MM-DD)
 * @param timeStr - Optional time string (HH:mm)
 */
export function normalizeToUnixTimestamp(dateStr: string, timeStr?: string): number {
  const datetime = timeStr ? `${dateStr} ${timeStr}` : dateStr;
  return moment.tz(datetime, ISTANBUL_TZ).unix();
}
