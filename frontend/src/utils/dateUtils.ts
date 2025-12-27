/**
 * Date Utilities for Turkish Timezone (UTC+3)
 * 
 * All date operations should use Turkish timezone to ensure consistency
 */

/**
 * Get today's date in Turkish timezone (YYYY-MM-DD format)
 * CRITICAL: Turkish time is UTC+3, so we need to adjust for correct date
 */
export function getTodayInTurkey(): string {
  const now = new Date();
  
  // Get UTC time
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  
  // Add Turkish timezone offset (UTC+3 = 3 hours = 10800000 ms)
  const turkeyTime = new Date(utcTime + (3 * 3600000));
  
  // Format as YYYY-MM-DD
  const year = turkeyTime.getUTCFullYear();
  const month = String(turkeyTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(turkeyTime.getUTCDate()).padStart(2, '0');
  
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
  const date = new Date(timestamp * 1000);
  const utcTime = date.getTime() + (date.getTimezoneOffset() * 60000);
  const turkeyTime = new Date(utcTime + (3 * 3600000));
  
  const year = turkeyTime.getUTCFullYear();
  const month = String(turkeyTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(turkeyTime.getUTCDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

