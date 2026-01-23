"use strict";
/**
 * Timestamp Utilities
 *
 * Handles conversion between TheSports API timestamps (Unix) and JavaScript Date objects
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertUnixToJSDate = convertUnixToJSDate;
exports.convertJSToUnixDate = convertJSToUnixDate;
exports.formatTheSportsDate = formatTheSportsDate;
exports.getTodayTSI = getTodayTSI;
exports.parseTheSportsTimestamp = parseTheSportsTimestamp;
exports.getCurrentUnixTimestamp = getCurrentUnixTimestamp;
exports.getDateDaysAgo = getDateDaysAgo;
exports.getDateDaysFromNow = getDateDaysFromNow;
exports.isToday = isToday;
exports.getTSIDate = getTSIDate;
exports.toTSIDate = toTSIDate;
exports.formatTSIDate = formatTSIDate;
exports.getTSIDateString = getTSIDateString;
/**
 * Convert Unix timestamp to JavaScript Date
 */
function convertUnixToJSDate(unixTimestamp) {
    return new Date(unixTimestamp * 1000);
}
/**
 * Convert JavaScript Date to Unix timestamp
 */
function convertJSToUnixDate(date) {
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
function formatTheSportsDate(date) {
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
function getTodayTSI() {
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
function parseTheSportsTimestamp(timestamp) {
    return convertUnixToJSDate(timestamp);
}
/**
 * Get current Unix timestamp
 */
function getCurrentUnixTimestamp() {
    return convertJSToUnixDate(new Date());
}
/**
 * Get date N days ago
 */
function getDateDaysAgo(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date;
}
/**
 * Get date N days from now
 */
function getDateDaysFromNow(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
}
/**
 * Check if date is today (in TSI timezone)
 * CRITICAL: Uses TSI (Turkey Standard Time, UTC+3) regardless of server timezone
 */
function isToday(date) {
    const nowTsiMs = Date.now() + TSI_OFFSET_MS;
    const todayTsi = new Date(nowTsiMs);
    const dateTsiMs = date.getTime() + TSI_OFFSET_MS;
    const dateTsi = new Date(dateTsiMs);
    return (dateTsi.getUTCDate() === todayTsi.getUTCDate() &&
        dateTsi.getUTCMonth() === todayTsi.getUTCMonth() &&
        dateTsi.getUTCFullYear() === todayTsi.getUTCFullYear());
}
/**
 * TSI (Turkish Time, UTC+3) Timezone Utilities
 * CRITICAL: All date operations should use TSI to ensure consistency
 */
/**
 * Get current date in TSI (UTC+3) timezone as YYYY-MM-DD string
 */
function getTSIDate() {
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
function toTSIDate(date) {
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
function formatTSIDate(date) {
    return toTSIDate(date);
}
/**
 * Get TSI date string in YYYYMMDD format (TheSports API format)
 */
function getTSIDateString() {
    return getTSIDate().replace(/-/g, '');
}
