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

