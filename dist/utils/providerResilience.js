"use strict";
/**
 * Provider Resilience Utilities
 *
 * Phase 4-2: HTTP timeout, retry, and circuit breaker utilities
 * with structured observability logging.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PHASE4_2_RETRY_CONFIG = void 0;
exports.isRetryableError = isRetryableError;
exports.withRetry = withRetry;
const axios_1 = require("axios");
const obsLogger_1 = require("./obsLogger");
exports.PHASE4_2_RETRY_CONFIG = {
    maxAttempts: 2, // max 2 retries (3 total attempts)
    initialDelay: 500, // 500ms initial delay
    backoffMultiplier: 2, // 500ms → 1000ms
};
/**
 * Check if error is retryable (network error, timeout, 5xx)
 * DO NOT retry on 4xx
 */
function isRetryableError(error) {
    // Network errors (no response)
    if (error instanceof axios_1.AxiosError && !error.response) {
        return true;
    }
    // Timeout errors
    if (error instanceof axios_1.AxiosError && (error.code === 'ECONNABORTED' || error.message?.includes('timeout'))) {
        return true;
    }
    // 5xx server errors
    if (error instanceof axios_1.AxiosError && error.response) {
        const status = error.response.status;
        return status >= 500 && status < 600;
    }
    // NOT retryable: 4xx client errors
    return false;
}
/**
 * Calculate delay for retry attempt (exponential backoff)
 */
function calculateDelay(attempt, config) {
    return config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1);
}
/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/**
 * Execute function with retry logic and structured logging
 */
async function withRetry(fn, endpoint, config = exports.PHASE4_2_RETRY_CONFIG) {
    let lastError = null;
    const startTime = Date.now();
    for (let attempt = 1; attempt <= config.maxAttempts + 1; attempt++) {
        try {
            const result = await fn();
            return result;
        }
        catch (error) {
            lastError = error;
            // Check if error is retryable
            if (!isRetryableError(lastError)) {
                // Not retryable - log and throw immediately
                const duration = Date.now() - startTime;
                (0, obsLogger_1.logEvent)('error', 'provider.http.fail', {
                    provider: 'thesports',
                    endpoint,
                    attempt,
                    error_code: lastError instanceof axios_1.AxiosError && lastError.response
                        ? lastError.response.status
                        : lastError.message || 'unknown',
                    duration_ms: duration,
                });
                throw error;
            }
            // Don't retry on last attempt
            if (attempt > config.maxAttempts) {
                break;
            }
            // Calculate delay and wait
            const delay = calculateDelay(attempt, config);
            const duration = Date.now() - startTime;
            (0, obsLogger_1.logEvent)('warn', 'provider.http.retry', {
                provider: 'thesports',
                endpoint,
                attempt,
                error_code: lastError instanceof axios_1.AxiosError && lastError.response
                    ? lastError.response.status
                    : lastError.message || 'unknown',
                duration_ms: duration,
            });
            await sleep(delay);
        }
    }
    // All retries exhausted - log final failure
    if (lastError === null) {
        throw new Error('Retry exhausted but no error captured');
    }
    const duration = Date.now() - startTime;
    (0, obsLogger_1.logEvent)('error', 'provider.http.fail', {
        provider: 'thesports',
        endpoint,
        attempt: config.maxAttempts + 1,
        error_code: lastError instanceof axios_1.AxiosError && lastError.response
            ? lastError.response.status
            : lastError.message || 'unknown',
        duration_ms: duration,
    });
    throw lastError;
}
