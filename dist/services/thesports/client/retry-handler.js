"use strict";
/**
 * Retry Handler with Exponential Backoff
 *
 * Handles retry logic for TheSports API requests with exponential backoff strategy.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_RETRY_CONFIG = void 0;
exports.isRetryableError = isRetryableError;
exports.withRetry = withRetry;
const logger_1 = require("../../../utils/logger");
exports.DEFAULT_RETRY_CONFIG = {
    maxAttempts: 3,
    initialDelay: 1000, // 1 second
    maxDelay: 10000, // 10 seconds
    backoffMultiplier: 2,
};
/**
 * Check if error is retryable
 */
function isRetryableError(error) {
    // Retry on network errors or 5xx server errors
    if (!error.response) {
        return true; // Network error
    }
    const status = error.response.status;
    return status >= 500 && status < 600; // Server errors
}
/**
 * Calculate delay for retry attempt
 */
function calculateDelay(attempt, config) {
    const delay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    return Math.min(delay, config.maxDelay);
}
/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/**
 * Execute function with retry logic
 */
async function withRetry(fn, config = exports.DEFAULT_RETRY_CONFIG) {
    let lastError;
    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            // Check if error is retryable
            if (!isRetryableError(error)) {
                throw error;
            }
            // Don't retry on last attempt
            if (attempt === config.maxAttempts) {
                break;
            }
            // Calculate delay and wait
            const delay = calculateDelay(attempt, config);
            logger_1.logger.warn(`Retry attempt ${attempt}/${config.maxAttempts} after ${delay}ms`, { error: error.message });
            await sleep(delay);
        }
    }
    throw lastError;
}
