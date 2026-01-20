/**
 * Timestamp Utilities
 * 
 * Handles conversion between TheSports API timestamps (Unix) and JavaScript Date objects
 */

/**
 * Convert Unix timestamp to JavaScript Date
 */
export function convertUnixToJSDate(unixTimestamp: number): Date {
  return new Date(unixTimestamp * 1000);
}

/**
 * Convert JavaScript Date to Unix timestamp
 */
export function convertJSToUnixDate(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

/**
 * TSI (Turkey Standard Time) offset: UTC+3 = 3 hours in milliseconds
 */
const TSI_OFFSET_MS = 3 * 60 * 60 * 1000;

/**
 * Format date to TheSports API format (YYYY-MM-DD)
 * CRITICAL: Uses TSI (Turkey Standard Time, UTC+3) regardless of server timezone
 */
export function formatTheSportsDate(date: Date): string {
  // Convert to TSI timezone
  const tsiMs = date.getTime() + TSI_OFFSET_MS;
  const tsiDate = new Date(tsiMs);

  const year = tsiDate.getUTCFullYear();
  const month = String(tsiDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(tsiDate.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get today's date in TSI timezone as YYYYMMDD
 */
export function getTodayTSI(): string {
  const tsiMs = Date.now() + TSI_OFFSET_MS;
  const tsiDate = new Date(tsiMs);

  const year = tsiDate.getUTCFullYear();
  const month = String(tsiDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(tsiDate.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Parse TheSports timestamp to JavaScript Date
 */
export function parseTheSportsTimestamp(timestamp: number): Date {
  return convertUnixToJSDate(timestamp);
}

/**
 * Get current Unix timestamp
 */
export function getCurrentUnixTimestamp(): number {
  return convertJSToUnixDate(new Date());
}

/**
 * Get date N days ago
 */
export function getDateDaysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

/**
 * Get date N days from now
 */
export function getDateDaysFromNow(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

/**
 * Check if date is today (in TSI timezone)
 * CRITICAL: Uses TSI (Turkey Standard Time, UTC+3) regardless of server timezone
 */
export function isToday(date: Date): boolean {
  const nowTsiMs = Date.now() + TSI_OFFSET_MS;
  const todayTsi = new Date(nowTsiMs);

  const dateTsiMs = date.getTime() + TSI_OFFSET_MS;
  const dateTsi = new Date(dateTsiMs);

  return (
    dateTsi.getUTCDate() === todayTsi.getUTCDate() &&
    dateTsi.getUTCMonth() === todayTsi.getUTCMonth() &&
    dateTsi.getUTCFullYear() === todayTsi.getUTCFullYear()
  );
}

