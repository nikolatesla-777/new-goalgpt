/**
 * Date Utilities for Turkish Timezone (UTC+3)
 * 
 * All date operations should use Turkish timezone to ensure consistency
 */

/**
 * Get today's date in Turkish timezone (YYYY-MM-DD format)
 * CRITICAL: Turkish time is UTC+3, so we need to adjust for correct date
 * Same logic as backend DailyMatchSyncWorker.getTodayTsiStrings()
 */
export function getTodayInTurkey(): string {
  // Date.now() returns UTC milliseconds
  // Add TSI offset (UTC+3 = 3 hours = 10800000 ms)
  const TSI_OFFSET_MS = 3 * 3600 * 1000;
  const tsiMs = Date.now() + TSI_OFFSET_MS;
  const tsiDate = new Date(tsiMs);
  
  // Format as YYYY-MM-DD using UTC methods
  const year = tsiDate.getUTCFullYear();
  const month = String(tsiDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(tsiDate.getUTCDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Format date to YYYY-MM-DD string (for date input fields)
 */
export function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get date string from timestamp (Turkish timezone)
 */
export function getDateStringFromTimestamp(timestamp: number): string {
  // Convert Unix timestamp to milliseconds
  const dateMs = timestamp * 1000;
  // Add TSI offset (UTC+3 = 3 hours = 10800000 ms)
  const TSI_OFFSET_MS = 3 * 3600 * 1000;
  const tsiMs = dateMs + TSI_OFFSET_MS;
  const tsiDate = new Date(tsiMs);

  const year = tsiDate.getUTCFullYear();
  const month = String(tsiDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(tsiDate.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

// TSI Offset constant (UTC+3 = 3 hours in milliseconds)
export const TSI_OFFSET_MS = 3 * 3600 * 1000;

/**
 * Get current time in TSI (Turkey Standard Time, UTC+3)
 * Returns a Date object adjusted to TSI
 */
export function getNowInTSI(): Date {
  const tsiMs = Date.now() + TSI_OFFSET_MS;
  return new Date(tsiMs);
}

/**
 * Format Unix timestamp to HH:MM in TSI timezone
 * CRITICAL: All match times must be displayed in TSI, not browser's local timezone
 */
export function formatTimestampToTSI(timestamp: number): string {
  if (!timestamp || timestamp <= 0) return 'Tarih yok';

  // Convert Unix timestamp (seconds) to TSI milliseconds
  const tsiMs = (timestamp * 1000) + TSI_OFFSET_MS;
  const tsiDate = new Date(tsiMs);

  // Use UTC methods since we already added the TSI offset
  const hours = tsiDate.getUTCHours().toString().padStart(2, '0');
  const minutes = tsiDate.getUTCMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Format Unix timestamp to DD/MM/YYYY in TSI timezone
 */
export function formatDateToTSI(timestamp: number): string {
  if (!timestamp || timestamp <= 0) return 'Tarih yok';

  const tsiMs = (timestamp * 1000) + TSI_OFFSET_MS;
  const tsiDate = new Date(tsiMs);

  const day = tsiDate.getUTCDate().toString().padStart(2, '0');
  const month = (tsiDate.getUTCMonth() + 1).toString().padStart(2, '0');
  const year = tsiDate.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Check if timestamp is in the future relative to TSI time
 */
export function isTimestampInFutureTSI(timestamp: number): boolean {
  if (!timestamp || timestamp <= 0) return false;
  const nowTsiMs = Date.now() + TSI_OFFSET_MS;
  const matchTsiMs = timestamp * 1000;
  return matchTsiMs > nowTsiMs;
}

/**
 * Get today's date in YYYYMMDD format (Turkey timezone)
 * Used for date navigation and comparison
 */
export function getTodayInTurkeyYYYYMMDD(): string {
  const tsiMs = Date.now() + TSI_OFFSET_MS;
  const tsiDate = new Date(tsiMs);

  const year = tsiDate.getUTCFullYear();
  const month = String(tsiDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(tsiDate.getUTCDate()).padStart(2, '0');

  return `${year}${month}${day}`;
}

/**
 * Navigate date by days in TSI timezone
 * @param currentDate - Current date in YYYYMMDD format
 * @param days - Number of days to add (negative for previous)
 * @returns New date in YYYYMMDD format
 */
export function navigateDateTSI(currentDate: string, days: number): string {
  // Parse YYYYMMDD format
  const year = parseInt(currentDate.slice(0, 4));
  const month = parseInt(currentDate.slice(4, 6)) - 1; // JS months are 0-indexed
  const day = parseInt(currentDate.slice(6, 8));

  // Create date in UTC (we're working with pure dates, not times)
  const date = new Date(Date.UTC(year, month, day));
  date.setUTCDate(date.getUTCDate() + days);

  const newYear = date.getUTCFullYear();
  const newMonth = String(date.getUTCMonth() + 1).padStart(2, '0');
  const newDay = String(date.getUTCDate()).padStart(2, '0');

  return `${newYear}${newMonth}${newDay}`;
}

