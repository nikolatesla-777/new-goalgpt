"use strict";
/**
 * TheSports API Error Handler
 *
 * Handles TheSports-specific errors and formats them appropriately.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRetryableError = isRetryableError;
exports.formatTheSportsError = formatTheSportsError;
exports.logTheSportsError = logTheSportsError;
const logger_1 = require("../logger");
/**
 * Check if error is retryable
 */
function isRetryableError(error) {
    if (!error.response) {
        return true; // Network error
    }
    const status = error.response.status;
    return status >= 500 && status < 600; // Server errors
}
/**
 * Format TheSports API error
 */
function formatTheSportsError(error) {
    const errorData = error.response?.data;
    // Check for IP authorization error
    if (error.response?.status === 401 || error.response?.status === 403) {
        const message = errorData?.err || 'IP is not authorized to access TheSports API';
        logger_1.logger.error(`TheSports API Auth Error: ${message}`);
        return {
            message,
            code: 'UNAUTHORIZED',
            statusCode: error.response.status,
            isRetryable: false,
        };
    }
    // Check for rate limit error (HTTP 429 or response body code 429)
    if (error.response?.status === 429 || errorData?.code === 429) {
        const retryAfter = error.response?.headers['retry-after'] || error.response?.headers['x-ratelimit-reset'];
        return {
            message: errorData?.msg || errorData?.err || 'Çok fazla istek gönderildi. Lütfen birkaç dakika bekleyip tekrar deneyin.',
            code: 'RATE_LIMIT',
            statusCode: 429,
            isRetryable: true,
        };
    }
    // Network error
    if (!error.response) {
        return {
            message: error.message || 'Network error',
            code: 'NETWORK_ERROR',
            isRetryable: true,
        };
    }
    // Server error
    if (error.response.status >= 500) {
        return {
            message: errorData?.err || 'Internal server error',
            code: 'SERVER_ERROR',
            statusCode: error.response.status,
            isRetryable: true,
        };
    }
    // Other errors
    return {
        message: errorData?.err || error.message || 'Unknown error',
        code: 'UNKNOWN_ERROR',
        statusCode: error.response.status,
        isRetryable: false,
    };
}
/**
 * Log TheSports API error
 */
function logTheSportsError(error, context) {
    const contextMsg = context ? `[${context}] ` : '';
    logger_1.logger.error(`${contextMsg}TheSports API Error:`, {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        isRetryable: error.isRetryable,
    });
}
