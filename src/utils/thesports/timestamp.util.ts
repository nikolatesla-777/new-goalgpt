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
 * Format date to TheSports API format (YYYY-MM-DD)
 */
export function formatTheSportsDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
 * Check if date is today
 */
export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

/**
 * TSI (Turkish Time, UTC+3) Timezone Utilities
 * CRITICAL: All date operations should use TSI to ensure consistency
 */
const TSI_OFFSET_MS = 3 * 60 * 60 * 1000; // 3 hours in milliseconds

/**
 * Get current date in TSI (UTC+3) timezone as YYYY-MM-DD string
 */
export function getTSIDate(): string {
  const tsiMs = Date.now() + TSI_OFFSET_MS;
  const tsiDate = new Date(tsiMs);

  const year = tsiDate.getUTCFullYear();
  const month = String(tsiDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(tsiDate.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Convert any date to TSI (UTC+3) timezone and format as YYYY-MM-DD
 */
export function toTSIDate(date: Date): string {
  const tsiMs = date.getTime() + TSI_OFFSET_MS;
  const tsiDate = new Date(tsiMs);

  const year = tsiDate.getUTCFullYear();
  const month = String(tsiDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(tsiDate.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Format date using TSI (UTC+3) timezone - YYYY-MM-DD
 * Use this instead of formatTheSportsDate for consistent TSI dates
 */
export function formatTSIDate(date: Date): string {
  return toTSIDate(date);
}

/**
 * Get TSI date string in YYYYMMDD format (TheSports API format)
 */
export function getTSIDateString(): string {
  return getTSIDate().replace(/-/g, '');
}

