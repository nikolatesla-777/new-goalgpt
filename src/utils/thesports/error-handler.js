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
var logger_1 = require("../logger");
/**
 * Check if error is retryable
 */
function isRetryableError(error) {
    if (!error.response) {
        return true; // Network error
    }
    var status = error.response.status;
    return status >= 500 && status < 600; // Server errors
}
/**
 * Format TheSports API error
 */
function formatTheSportsError(error) {
    var _a, _b, _c, _d, _e, _f;
    var errorData = (_a = error.response) === null || _a === void 0 ? void 0 : _a.data;
    // Check for IP authorization error
    if (((_b = error.response) === null || _b === void 0 ? void 0 : _b.status) === 401 || ((_c = error.response) === null || _c === void 0 ? void 0 : _c.status) === 403) {
        var message = (errorData === null || errorData === void 0 ? void 0 : errorData.err) || 'IP is not authorized to access TheSports API';
        logger_1.logger.error("TheSports API Auth Error: ".concat(message));
        return {
            message: message,
            code: 'UNAUTHORIZED',
            statusCode: error.response.status,
            isRetryable: false,
        };
    }
    // Check for rate limit error (HTTP 429 or response body code 429)
    if (((_d = error.response) === null || _d === void 0 ? void 0 : _d.status) === 429 || (errorData === null || errorData === void 0 ? void 0 : errorData.code) === 429) {
        var retryAfter = ((_e = error.response) === null || _e === void 0 ? void 0 : _e.headers['retry-after']) || ((_f = error.response) === null || _f === void 0 ? void 0 : _f.headers['x-ratelimit-reset']);
        return {
            message: (errorData === null || errorData === void 0 ? void 0 : errorData.msg) || (errorData === null || errorData === void 0 ? void 0 : errorData.err) || 'Çok fazla istek gönderildi. Lütfen birkaç dakika bekleyip tekrar deneyin.',
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
            message: (errorData === null || errorData === void 0 ? void 0 : errorData.err) || 'Internal server error',
            code: 'SERVER_ERROR',
            statusCode: error.response.status,
            isRetryable: true,
        };
    }
    // Other errors
    return {
        message: (errorData === null || errorData === void 0 ? void 0 : errorData.err) || error.message || 'Unknown error',
        code: 'UNKNOWN_ERROR',
        statusCode: error.response.status,
        isRetryable: false,
    };
}
/**
 * Log TheSports API error
 */
function logTheSportsError(error, context) {
    var contextMsg = context ? "[".concat(context, "] ") : '';
    logger_1.logger.error("".concat(contextMsg, "TheSports API Error:"), {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        isRetryable: error.isRetryable,
    });
}
