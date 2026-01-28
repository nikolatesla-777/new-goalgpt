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

/**
 * Get yesterday's date in Turkish timezone (YYYY-MM-DD format)
 */
export function getYesterdayInTurkey(): string {
  const tsiMs = Date.now() + TSI_OFFSET_MS - (24 * 60 * 60 * 1000);
  const tsiDate = new Date(tsiMs);

  const year = tsiDate.getUTCFullYear();
  const month = String(tsiDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(tsiDate.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Get the start of the current month in Turkish timezone (YYYY-MM-DD format)
 */
export function getMonthStartInTurkey(): string {
  const tsiMs = Date.now() + TSI_OFFSET_MS;
  const tsiDate = new Date(tsiMs);

  const year = tsiDate.getUTCFullYear();
  const month = String(tsiDate.getUTCMonth() + 1).padStart(2, '0');

  return `${year}-${month}-01`;
}

/**
 * Check if an ISO timestamp falls within a specific TSI date
 * @param isoTimestamp - ISO 8601 timestamp string (e.g., "2026-01-21T10:30:00Z")
 * @param tsiDate - Date in YYYY-MM-DD format representing a day in TSI timezone
 * @returns true if the timestamp falls within the TSI day boundaries
 */
export function isDateInTSIRange(isoTimestamp: string, tsiDate: string): boolean {
  const TSI_OFFSET_SECONDS = 3 * 3600; // UTC+3

  const [year, month, day] = tsiDate.split('-').map(Number);

  // TSI midnight in UTC = TSI 00:00:00 - 3 hours = previous day 21:00:00 UTC
  const dayStartUTC = Date.UTC(year, month - 1, day, 0, 0, 0) / 1000 - TSI_OFFSET_SECONDS;
  // TSI end of day in UTC = TSI 23:59:59 - 3 hours = same day 20:59:59 UTC
  const dayEndUTC = Date.UTC(year, month - 1, day, 23, 59, 59) / 1000 - TSI_OFFSET_SECONDS;

  const timestamp = new Date(isoTimestamp).getTime() / 1000;

  return timestamp >= dayStartUTC && timestamp <= dayEndUTC;
}

/**
 * Check if an ISO timestamp is on or after a specific TSI date
 * Used for "today" filter where we want predictions from today onwards
 */
export function isDateOnOrAfterTSI(isoTimestamp: string, tsiDate: string): boolean {
  const TSI_OFFSET_SECONDS = 3 * 3600; // UTC+3

  const [year, month, day] = tsiDate.split('-').map(Number);

  // TSI midnight in UTC
  const dayStartUTC = Date.UTC(year, month - 1, day, 0, 0, 0) / 1000 - TSI_OFFSET_SECONDS;

  const timestamp = new Date(isoTimestamp).getTime() / 1000;

  return timestamp >= dayStartUTC;
}

/**
 * Format millisecond timestamp to full date and time in TSI timezone
 * Example: "28/01/2026 14:30:45"
 */
export function formatMillisecondsToTSI(timestampMs: number): string {
  if (!timestampMs || timestampMs <= 0) return 'Tarih yok';

  const tsiMs = timestampMs + TSI_OFFSET_MS;
  const tsiDate = new Date(tsiMs);

  const day = tsiDate.getUTCDate().toString().padStart(2, '0');
  const month = (tsiDate.getUTCMonth() + 1).toString().padStart(2, '0');
  const year = tsiDate.getUTCFullYear();
  const hours = tsiDate.getUTCHours().toString().padStart(2, '0');
  const minutes = tsiDate.getUTCMinutes().toString().padStart(2, '0');
  const seconds = tsiDate.getUTCSeconds().toString().padStart(2, '0');

  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

/**
 * Format date string (YYYY-MM-DD) to long Turkish format
 * Example: "28 Ocak 2026 Salı"
 */
export function formatDateStringToLongTurkish(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);

  const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
                      'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

  // Create date at noon UTC to avoid timezone issues
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const weekday = dayNames[date.getUTCDay()];
  const monthName = monthNames[month - 1];

  return `${day} ${monthName} ${year} ${weekday}`;
}

/**
 * Format Unix timestamp to long Turkish date format (without weekday)
 * Example: "28 Ocak 2026"
 */
export function formatUnixToLongTurkish(timestamp: number): string {
  if (!timestamp || timestamp <= 0) return 'Tarih yok';

  const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
                      'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

  // Convert to TSI timezone
  const tsiMs = (timestamp * 1000) + TSI_OFFSET_MS;
  const tsiDate = new Date(tsiMs);

  const day = tsiDate.getUTCDate();
  const month = tsiDate.getUTCMonth();
  const year = tsiDate.getUTCFullYear();

  return `${day} ${monthNames[month]} ${year}`;
}

