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

