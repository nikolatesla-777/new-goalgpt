/**
 * Date Utilities - Istanbul Timezone (Europe/Istanbul, UTC+3)
 *
 * CRITICAL: All date operations in the system MUST use Istanbul timezone
 * to ensure consistency across backend, frontend, and external APIs.
 */

/**
 * Get current date in Istanbul timezone (YYYY-MM-DD format)
 */
export function getTodayInIstanbul(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
}

/**
 * Get yesterday's date in Istanbul timezone (YYYY-MM-DD format)
 */
export function getYesterdayInIstanbul(): string {
  const today = new Date();
  const yesterday = new Date(today.getTime() - (24 * 60 * 60 * 1000));
  return yesterday.toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
}

/**
 * Format Unix timestamp to HH:MM in Istanbul timezone
 */
export function formatTimestampToIstanbul(timestamp: number): string {
  if (!timestamp || timestamp <= 0) return 'Tarih yok';

  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Format Unix timestamp to full date in Istanbul timezone (DD/MM/YYYY)
 */
export function formatDateToIstanbul(timestamp: number): string {
  if (!timestamp || timestamp <= 0) return 'Tarih yok';

  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

/**
 * Format Unix timestamp to long Turkish date format in Istanbul timezone
 * Example: "28 Ocak 2026"
 */
export function formatDateToLongTurkish(timestamp: number): string {
  if (!timestamp || timestamp <= 0) return 'Tarih yok';

  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Format Unix timestamp to full date and time in Istanbul timezone
 */
export function formatDateTimeToIstanbul(timestamp: number): string {
  if (!timestamp || timestamp <= 0) return 'Tarih yok';

  const date = new Date(timestamp * 1000);
  return date.toLocaleString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * Get date N days ago in Istanbul timezone (YYYY-MM-DD format)
 */
export function getDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
}

/**
 * Get date N days from now in Istanbul timezone (YYYY-MM-DD format)
 */
export function getDateDaysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
}

/**
 * Check if Unix timestamp falls within a specific date in Istanbul timezone
 */
export function isTimestampInDateIstanbul(timestamp: number, dateStr: string): boolean {
  if (!timestamp || timestamp <= 0) return false;

  const date = new Date(timestamp * 1000);
  const istanbulDate = date.toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });

  return istanbulDate === dateStr;
}

/**
 * Check if Unix timestamp is in the future relative to Istanbul time
 */
export function isTimestampInFutureIstanbul(timestamp: number): boolean {
  if (!timestamp || timestamp <= 0) return false;

  const now = Math.floor(Date.now() / 1000);
  return timestamp > now;
}

/**
 * Parse date string (YYYY-MM-DD) to start of day Unix timestamp in Istanbul timezone
 */
export function parseDateToTimestamp(dateStr: string): number {
  const [year, month, day] = dateStr.split('-').map(Number);

  // Create date at midnight in Istanbul timezone
  // Note: Month is 0-indexed in Date constructor
  const dateInIstanbul = new Date(
    new Date(year, month - 1, day).toLocaleString('en-US', { timeZone: 'Europe/Istanbul' })
  );

  return Math.floor(dateInIstanbul.getTime() / 1000);
}

/**
 * Get current Unix timestamp
 */
export function getCurrentTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * DEPRECATED: Use getTodayInIstanbul() instead
 * @deprecated
 */
export const getTSIDate = getTodayInIstanbul;

/**
 * DEPRECATED: Use formatTimestampToIstanbul() instead
 * @deprecated
 */
export const formatTSIDate = (timestamp: number): string => {
  return formatDateToIstanbul(timestamp);
};
