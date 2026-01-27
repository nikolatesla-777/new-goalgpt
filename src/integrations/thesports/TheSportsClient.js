"use strict";
/**
 * TheSportsClient - Hardened HTTP Client for TheSports API
 *
 * PR-5: TheSports Client Hardening
 *
 * Features:
 * - AbortController timeouts (10s default)
 * - Retry with exponential backoff (cockatiel)
 * - Circuit breaker (5 failures → 30s cooldown)
 * - Request ID tracing for debugging
 * - Global rate limiting (1 req/sec)
 *
 * @author GoalGPT Team
 * @version 3.0.0 - Cockatiel-based resilience
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.TheSportsClientClass = exports.theSportsClient = exports.TheSportsClient = exports.CircuitState = void 0;
var cockatiel_1 = require("cockatiel");
var config_1 = require("../../config");
var logger_1 = require("../../utils/logger");
var obsLogger_1 = require("../../utils/obsLogger");
// Re-export circuit state for external use
var CircuitState;
(function (CircuitState) {
    CircuitState["CLOSED"] = "CLOSED";
    CircuitState["OPEN"] = "OPEN";
    CircuitState["HALF_OPEN"] = "HALF_OPEN";
    CircuitState["ISOLATED"] = "ISOLATED";
})(CircuitState || (exports.CircuitState = CircuitState = {}));
var DEFAULT_CONFIG = {
    baseUrl: 'https://api.thesports.com/v1/football',
    user: '',
    secret: '',
    timeoutMs: 10000, // 10 seconds
    maxRetries: 3,
    initialRetryDelayMs: 500,
    maxRetryDelayMs: 10000,
    circuitBreakerThreshold: 5,
    circuitBreakerCooldownMs: 30000, // 30 seconds
};
var RATE_LIMIT_CONFIG = {
    tokensPerSecond: 1, // 1 request per second
    maxTokens: 5, // Burst capacity
};
var TokenBucketRateLimiter = /** @class */ (function () {
    function TokenBucketRateLimiter(rateLimitConfig) {
        if (rateLimitConfig === void 0) { rateLimitConfig = RATE_LIMIT_CONFIG; }
        this.waitQueue = [];
        this.isProcessingQueue = false;
        this.config = rateLimitConfig;
        this.tokens = rateLimitConfig.maxTokens;
        this.lastRefill = Date.now();
    }
    TokenBucketRateLimiter.prototype.acquire = function () {
        return __awaiter(this, arguments, void 0, function (context) {
            var _this = this;
            if (context === void 0) { context = 'default'; }
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve) {
                        _this.waitQueue.push(function () {
                            _this.refillTokens();
                            if (_this.tokens >= 1) {
                                _this.tokens -= 1;
                                resolve();
                            }
                            else {
                                var waitTime = _this.calculateWaitTime();
                                logger_1.logger.debug("[TheSportsClient] Rate limit wait: ".concat(waitTime, "ms for ").concat(context));
                                setTimeout(function () {
                                    _this.refillTokens();
                                    _this.tokens -= 1;
                                    resolve();
                                }, waitTime);
                            }
                        });
                        _this.processQueue();
                    })];
            });
        });
    };
    TokenBucketRateLimiter.prototype.processQueue = function () {
        var _this = this;
        if (this.isProcessingQueue)
            return;
        this.isProcessingQueue = true;
        var process = function () {
            if (_this.waitQueue.length === 0) {
                _this.isProcessingQueue = false;
                return;
            }
            var next = _this.waitQueue.shift();
            if (next) {
                next();
                setTimeout(process, 1000 / _this.config.tokensPerSecond);
            }
        };
        process();
    };
    TokenBucketRateLimiter.prototype.refillTokens = function () {
        var now = Date.now();
        var timeElapsed = (now - this.lastRefill) / 1000;
        var tokensToAdd = timeElapsed * this.config.tokensPerSecond;
        this.tokens = Math.min(this.tokens + tokensToAdd, this.config.maxTokens);
        this.lastRefill = now;
    };
    TokenBucketRateLimiter.prototype.calculateWaitTime = function () {
        var tokensNeeded = 1 - this.tokens;
        return Math.ceil((tokensNeeded / this.config.tokensPerSecond) * 1000);
    };
    TokenBucketRateLimiter.prototype.getStats = function () {
        return {
            tokens: Math.floor(this.tokens),
            queueLength: this.waitQueue.length,
        };
    };
    return TokenBucketRateLimiter;
}());
function generateRequestId() {
    return "req_".concat(Date.now().toString(36), "_").concat(Math.random().toString(36).substring(2, 8));
}
// ============================================================================
// THESPORTS CLIENT
// ============================================================================
var TheSportsClient = /** @class */ (function () {
    function TheSportsClient(clientConfig) {
        var _this = this;
        var _a, _b, _c;
        // Metrics
        this.requestCount = 0;
        this.errorCount = 0;
        this.lastRequestTime = null;
        this.circuitOpenCount = 0;
        this.config = __assign(__assign(__assign({}, DEFAULT_CONFIG), { baseUrl: ((_a = config_1.config.thesports) === null || _a === void 0 ? void 0 : _a.baseUrl) || DEFAULT_CONFIG.baseUrl, user: ((_b = config_1.config.thesports) === null || _b === void 0 ? void 0 : _b.user) || DEFAULT_CONFIG.user, secret: ((_c = config_1.config.thesports) === null || _c === void 0 ? void 0 : _c.secret) || DEFAULT_CONFIG.secret }), clientConfig);
        this.rateLimiter = new TokenBucketRateLimiter();
        // Create circuit breaker with cockatiel
        // Opens after 5 consecutive failures, stays open for 30 seconds
        this.circuitBreakerPolicy = (0, cockatiel_1.circuitBreaker)(cockatiel_1.handleAll, {
            halfOpenAfter: this.config.circuitBreakerCooldownMs,
            breaker: new cockatiel_1.ConsecutiveBreaker(this.config.circuitBreakerThreshold),
        });
        // Log circuit breaker state changes
        this.circuitBreakerPolicy.onStateChange(function (state) {
            var _a;
            var stateMap = (_a = {},
                _a[cockatiel_1.CircuitState.Closed] = CircuitState.CLOSED,
                _a[cockatiel_1.CircuitState.Open] = CircuitState.OPEN,
                _a[cockatiel_1.CircuitState.HalfOpen] = CircuitState.HALF_OPEN,
                _a[cockatiel_1.CircuitState.Isolated] = CircuitState.ISOLATED,
                _a);
            var mappedState = stateMap[state];
            logger_1.logger.info("[TheSportsClient] Circuit breaker state: ".concat(mappedState));
            (0, obsLogger_1.logEvent)('info', 'thesports.circuit.state_change', { state: mappedState });
            if (state === cockatiel_1.CircuitState.Open) {
                _this.circuitOpenCount++;
            }
        });
        // Create retry policy with exponential backoff
        this.retryPolicy = (0, cockatiel_1.retry)(cockatiel_1.handleAll, {
            maxAttempts: this.config.maxRetries,
            backoff: new cockatiel_1.ExponentialBackoff({
                initialDelay: this.config.initialRetryDelayMs,
                maxDelay: this.config.maxRetryDelayMs,
            }),
        });
        // Log retry events
        this.retryPolicy.onRetry(function (event) {
            var _a, _b;
            logger_1.logger.warn("[TheSportsClient] Retry attempt ".concat(event.attempt, " after ").concat(event.delay, "ms"), { error: (_a = event.reason) === null || _a === void 0 ? void 0 : _a.message });
            (0, obsLogger_1.logEvent)('warn', 'thesports.http.retry', {
                attempt: event.attempt,
                delay: event.delay,
                error: (_b = event.reason) === null || _b === void 0 ? void 0 : _b.message,
            });
        });
        // Wrap circuit breaker around retry policy
        this.policy = (0, cockatiel_1.wrap)(this.circuitBreakerPolicy, this.retryPolicy);
        logger_1.logger.info('[TheSportsClient] Initialized with cockatiel resilience', {
            baseUrl: this.config.baseUrl,
            timeoutMs: this.config.timeoutMs,
            maxRetries: this.config.maxRetries,
            circuitBreakerThreshold: this.config.circuitBreakerThreshold,
            circuitBreakerCooldownMs: this.config.circuitBreakerCooldownMs,
        });
    }
    /**
     * Get singleton instance
     */
    TheSportsClient.getInstance = function (clientConfig) {
        if (!TheSportsClient.instance) {
            TheSportsClient.instance = new TheSportsClient(clientConfig);
        }
        return TheSportsClient.instance;
    };
    /**
     * Reset singleton (for testing)
     */
    TheSportsClient.resetInstance = function () {
        TheSportsClient.instance = null;
    };
    /**
     * Execute GET request with all protections
     */
    TheSportsClient.prototype.get = function (endpoint_1) {
        return __awaiter(this, arguments, void 0, function (endpoint, params, options) {
            var requestId, ctx, url, timeout, result, duration, error_1, duration;
            var _this = this;
            if (params === void 0) { params = {}; }
            if (options === void 0) { options = {}; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        requestId = generateRequestId();
                        ctx = {
                            requestId: requestId,
                            endpoint: endpoint,
                            startTime: Date.now(),
                            attempt: 0,
                        };
                        if (!!options.skipRateLimit) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.rateLimiter.acquire(endpoint)];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        this.requestCount++;
                        this.lastRequestTime = Date.now();
                        url = this.buildUrl(endpoint, params);
                        timeout = options.timeoutMs || this.config.timeoutMs;
                        logger_1.logger.debug("[TheSportsClient] \u2192 GET ".concat(endpoint), { requestId: requestId, params: params });
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, this.policy.execute(function () { return __awaiter(_this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    ctx.attempt++;
                                    return [2 /*return*/, this.fetchWithTimeout(url, timeout, ctx)];
                                });
                            }); })];
                    case 4:
                        result = _a.sent();
                        duration = Date.now() - ctx.startTime;
                        logger_1.logger.debug("[TheSportsClient] \u2190 ".concat(endpoint, " (").concat(duration, "ms)"), { requestId: requestId });
                        (0, obsLogger_1.logEvent)('info', 'thesports.http.success', {
                            endpoint: endpoint,
                            requestId: requestId,
                            duration_ms: duration,
                            attempts: ctx.attempt,
                        });
                        return [2 /*return*/, result];
                    case 5:
                        error_1 = _a.sent();
                        this.errorCount++;
                        duration = Date.now() - ctx.startTime;
                        logger_1.logger.error("[TheSportsClient] \u2717 ".concat(endpoint, " failed after ").concat(ctx.attempt, " attempts"), {
                            requestId: requestId,
                            error: error_1 instanceof Error ? error_1.message : String(error_1),
                            duration: duration,
                        });
                        (0, obsLogger_1.logEvent)('error', 'thesports.http.fail', {
                            endpoint: endpoint,
                            requestId: requestId,
                            duration_ms: duration,
                            attempts: ctx.attempt,
                            error: error_1 instanceof Error ? error_1.message : String(error_1),
                        });
                        throw error_1;
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Execute POST request with all protections
     */
    TheSportsClient.prototype.post = function (endpoint_1, body_1) {
        return __awaiter(this, arguments, void 0, function (endpoint, body, params, options) {
            var requestId, ctx, url, timeout, result, duration, error_2;
            var _this = this;
            if (params === void 0) { params = {}; }
            if (options === void 0) { options = {}; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        requestId = generateRequestId();
                        ctx = {
                            requestId: requestId,
                            endpoint: endpoint,
                            startTime: Date.now(),
                            attempt: 0,
                        };
                        if (!!options.skipRateLimit) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.rateLimiter.acquire(endpoint)];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        this.requestCount++;
                        this.lastRequestTime = Date.now();
                        url = this.buildUrl(endpoint, params);
                        timeout = options.timeoutMs || this.config.timeoutMs;
                        logger_1.logger.debug("[TheSportsClient] \u2192 POST ".concat(endpoint), { requestId: requestId, params: params });
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, this.policy.execute(function () { return __awaiter(_this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    ctx.attempt++;
                                    return [2 /*return*/, this.fetchWithTimeout(url, timeout, ctx, {
                                            method: 'POST',
                                            body: body ? JSON.stringify(body) : undefined,
                                            headers: { 'Content-Type': 'application/json' },
                                        })];
                                });
                            }); })];
                    case 4:
                        result = _a.sent();
                        duration = Date.now() - ctx.startTime;
                        logger_1.logger.debug("[TheSportsClient] \u2190 ".concat(endpoint, " (").concat(duration, "ms)"), { requestId: requestId });
                        return [2 /*return*/, result];
                    case 5:
                        error_2 = _a.sent();
                        this.errorCount++;
                        throw error_2;
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Fetch with AbortController timeout
     */
    TheSportsClient.prototype.fetchWithTimeout = function (url, timeoutMs, ctx, init) {
        return __awaiter(this, void 0, void 0, function () {
            var controller, timeoutId, response, errorBody, error, data, error, error_3, timeoutError;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        controller = new AbortController();
                        timeoutId = setTimeout(function () { return controller.abort(); }, timeoutMs);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 6, , 7]);
                        return [4 /*yield*/, fetch(url, __assign(__assign({}, init), { signal: controller.signal, headers: __assign({ Accept: 'application/json', 'User-Agent': 'GoalGPT/3.0-Cockatiel', 'X-Request-ID': ctx.requestId }, init === null || init === void 0 ? void 0 : init.headers) }))];
                    case 2:
                        response = _a.sent();
                        clearTimeout(timeoutId);
                        if (!!response.ok) return [3 /*break*/, 4];
                        return [4 /*yield*/, response.text().catch(function () { return 'Unable to read error body'; })];
                    case 3:
                        errorBody = _a.sent();
                        error = new Error("HTTP ".concat(response.status, ": ").concat(response.statusText, " - ").concat(errorBody));
                        error.status = response.status;
                        error.requestId = ctx.requestId;
                        throw error;
                    case 4: return [4 /*yield*/, response.json()];
                    case 5:
                        data = (_a.sent());
                        // Check for TheSports API-level errors
                        if (data.err || (data.code && data.code !== 200 && data.code !== 0)) {
                            error = new Error("TheSports API Error: ".concat(data.err || data.msg || 'Unknown error', " (code: ").concat(data.code, ")"));
                            error.code = data.code;
                            error.requestId = ctx.requestId;
                            throw error;
                        }
                        return [2 /*return*/, data];
                    case 6:
                        error_3 = _a.sent();
                        clearTimeout(timeoutId);
                        // Handle abort (timeout)
                        if (error_3 instanceof Error && error_3.name === 'AbortError') {
                            timeoutError = new Error("Request timeout after ".concat(timeoutMs, "ms"));
                            timeoutError.code = 'TIMEOUT';
                            timeoutError.requestId = ctx.requestId;
                            throw timeoutError;
                        }
                        throw error_3;
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Build URL with query parameters and authentication
     */
    TheSportsClient.prototype.buildUrl = function (endpoint, params) {
        var url = new URL("".concat(this.config.baseUrl).concat(endpoint));
        // Add auth params
        url.searchParams.set('user', this.config.user);
        url.searchParams.set('secret', this.config.secret);
        // Add custom params
        for (var _i = 0, _a = Object.entries(params); _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], value = _b[1];
            if (value !== undefined && value !== null) {
                url.searchParams.set(key, String(value));
            }
        }
        return url.toString();
    };
    // ============================================================================
    // HEALTH & METRICS
    // ============================================================================
    /**
     * Get current circuit breaker state
     */
    TheSportsClient.prototype.getCircuitState = function () {
        var _a;
        var state = this.circuitBreakerPolicy.state;
        var stateMap = (_a = {},
            _a[cockatiel_1.CircuitState.Closed] = CircuitState.CLOSED,
            _a[cockatiel_1.CircuitState.Open] = CircuitState.OPEN,
            _a[cockatiel_1.CircuitState.HalfOpen] = CircuitState.HALF_OPEN,
            _a[cockatiel_1.CircuitState.Isolated] = CircuitState.ISOLATED,
            _a);
        return stateMap[state];
    };
    /**
     * Check if API is available (circuit not open)
     */
    TheSportsClient.prototype.isAvailable = function () {
        return this.circuitBreakerPolicy.state !== cockatiel_1.CircuitState.Open;
    };
    /**
     * Get health status
     */
    TheSportsClient.prototype.getHealth = function () {
        return {
            initialized: true,
            circuitState: this.getCircuitState(),
            rateLimiter: this.rateLimiter.getStats(),
            metrics: {
                requests: this.requestCount,
                errors: this.errorCount,
                lastRequest: this.lastRequestTime,
                circuitOpenCount: this.circuitOpenCount,
            },
            config: {
                timeoutMs: this.config.timeoutMs,
                maxRetries: this.config.maxRetries,
                circuitBreakerThreshold: this.config.circuitBreakerThreshold,
                circuitBreakerCooldownMs: this.config.circuitBreakerCooldownMs,
            },
        };
    };
    /**
     * Reset metrics (for testing)
     */
    TheSportsClient.prototype.resetMetrics = function () {
        this.requestCount = 0;
        this.errorCount = 0;
        this.lastRequestTime = null;
        this.circuitOpenCount = 0;
    };
    TheSportsClient.instance = null;
    return TheSportsClient;
}());
exports.TheSportsClient = TheSportsClient;
exports.TheSportsClientClass = TheSportsClient;
// ============================================================================
// EXPORTS
// ============================================================================
// Default singleton export
exports.theSportsClient = TheSportsClient.getInstance();
