"use strict";
/**
 * Provider Resilience Utilities
 *
 * Phase 4-2: HTTP timeout, retry, and circuit breaker utilities
 * with structured observability logging.
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PHASE4_2_RETRY_CONFIG = void 0;
exports.isRetryableError = isRetryableError;
exports.withRetry = withRetry;
var axios_1 = require("axios");
var obsLogger_1 = require("./obsLogger");
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
    var _a;
    // Network errors (no response)
    if (error instanceof axios_1.AxiosError && !error.response) {
        return true;
    }
    // Timeout errors
    if (error instanceof axios_1.AxiosError && (error.code === 'ECONNABORTED' || ((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('timeout')))) {
        return true;
    }
    // 5xx server errors
    if (error instanceof axios_1.AxiosError && error.response) {
        var status_1 = error.response.status;
        return status_1 >= 500 && status_1 < 600;
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
    return new Promise(function (resolve) { return setTimeout(resolve, ms); });
}
/**
 * Execute function with retry logic and structured logging
 */
function withRetry(fn_1, endpoint_1) {
    return __awaiter(this, arguments, void 0, function (fn, endpoint, config) {
        var lastError, startTime, attempt, result, error_1, duration_1, delay, duration_2, duration;
        if (config === void 0) { config = exports.PHASE4_2_RETRY_CONFIG; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    lastError = null;
                    startTime = Date.now();
                    attempt = 1;
                    _a.label = 1;
                case 1:
                    if (!(attempt <= config.maxAttempts + 1)) return [3 /*break*/, 7];
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 6]);
                    return [4 /*yield*/, fn()];
                case 3:
                    result = _a.sent();
                    return [2 /*return*/, result];
                case 4:
                    error_1 = _a.sent();
                    lastError = error_1;
                    // Check if error is retryable
                    if (!isRetryableError(lastError)) {
                        duration_1 = Date.now() - startTime;
                        (0, obsLogger_1.logEvent)('error', 'provider.http.fail', {
                            provider: 'thesports',
                            endpoint: endpoint,
                            attempt: attempt,
                            error_code: lastError instanceof axios_1.AxiosError && lastError.response
                                ? lastError.response.status
                                : lastError.message || 'unknown',
                            duration_ms: duration_1,
                        });
                        throw error_1;
                    }
                    // Don't retry on last attempt
                    if (attempt > config.maxAttempts) {
                        return [3 /*break*/, 7];
                    }
                    delay = calculateDelay(attempt, config);
                    duration_2 = Date.now() - startTime;
                    (0, obsLogger_1.logEvent)('warn', 'provider.http.retry', {
                        provider: 'thesports',
                        endpoint: endpoint,
                        attempt: attempt,
                        error_code: lastError instanceof axios_1.AxiosError && lastError.response
                            ? lastError.response.status
                            : lastError.message || 'unknown',
                        duration_ms: duration_2,
                    });
                    return [4 /*yield*/, sleep(delay)];
                case 5:
                    _a.sent();
                    return [3 /*break*/, 6];
                case 6:
                    attempt++;
                    return [3 /*break*/, 1];
                case 7:
                    // All retries exhausted - log final failure
                    if (lastError === null) {
                        throw new Error('Retry exhausted but no error captured');
                    }
                    duration = Date.now() - startTime;
                    (0, obsLogger_1.logEvent)('error', 'provider.http.fail', {
                        provider: 'thesports',
                        endpoint: endpoint,
                        attempt: config.maxAttempts + 1,
                        error_code: lastError instanceof axios_1.AxiosError && lastError.response
                            ? lastError.response.status
                            : lastError.message || 'unknown',
                        duration_ms: duration,
                    });
                    throw lastError;
            }
        });
    });
}
