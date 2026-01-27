"use strict";
/**
 * TheSportsAPIManager - Singleton Pattern
 *
 * CRITICAL: This is the ONLY way to access TheSports API throughout the application.
 * All workers, services, and controllers MUST use this singleton to ensure:
 *
 * 1. Global rate limiting (1 req/sec across ALL components)
 * 2. Shared circuit breaker state
 * 3. Single Axios connection pool
 * 4. Consistent error handling and logging
 *
 * Usage:
 *   import { theSportsAPI } from '../core/TheSportsAPIManager';
 *   const data = await theSportsAPI.get('/match/detail', { uuid: matchId });
 *
 * @author GoalGPT Team
 * @version 2.0.0 - Singleton Architecture
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TheSportsAPIManager = exports.theSportsAPI = void 0;
var axios_1 = __importDefault(require("axios"));
var logger_1 = require("../utils/logger");
var obsLogger_1 = require("../utils/obsLogger");
var config_1 = require("../config");
var providerResilience_1 = require("../utils/providerResilience");
var circuitBreaker_1 = require("../utils/circuitBreaker");
var error_handler_1 = require("../utils/thesports/error-handler");
var GLOBAL_RATE_CONFIG = {
    tokensPerSecond: 1, // 1 request per second (API limit)
    maxTokens: 5, // Burst capacity for 5 rapid requests
};
var GlobalRateLimiter = /** @class */ (function () {
    function GlobalRateLimiter(config) {
        if (config === void 0) { config = GLOBAL_RATE_CONFIG; }
        this.waitQueue = [];
        this.isProcessingQueue = false;
        this.config = config;
        this.tokens = config.maxTokens;
        this.lastRefill = Date.now();
    }
    /**
     * Acquire a token - waits if none available
     * Uses FIFO queue to ensure fair ordering
     */
    GlobalRateLimiter.prototype.acquire = function () {
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
                                // Calculate wait time and schedule
                                var waitTime = _this.calculateWaitTime();
                                logger_1.logger.debug("[RateLimit] Waiting ".concat(waitTime, "ms for ").concat(context));
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
    GlobalRateLimiter.prototype.processQueue = function () {
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
                // Process next after minimum interval
                setTimeout(process, 1000 / _this.config.tokensPerSecond);
            }
        };
        process();
    };
    GlobalRateLimiter.prototype.refillTokens = function () {
        var now = Date.now();
        var timeElapsed = (now - this.lastRefill) / 1000;
        var tokensToAdd = timeElapsed * this.config.tokensPerSecond;
        this.tokens = Math.min(this.tokens + tokensToAdd, this.config.maxTokens);
        this.lastRefill = now;
    };
    GlobalRateLimiter.prototype.calculateWaitTime = function () {
        var tokensNeeded = 1 - this.tokens;
        return Math.ceil((tokensNeeded / this.config.tokensPerSecond) * 1000);
    };
    GlobalRateLimiter.prototype.getStats = function () {
        return {
            tokens: Math.floor(this.tokens),
            queueLength: this.waitQueue.length,
        };
    };
    return GlobalRateLimiter;
}());
// ============================================================================
// SINGLETON MANAGER
// ============================================================================
var TheSportsAPIManager = /** @class */ (function () {
    /**
     * Private constructor - use getInstance() instead
     */
    function TheSportsAPIManager() {
        var _a, _b, _c;
        this.isInitialized = false;
        // Metrics
        this.requestCount = 0;
        this.errorCount = 0;
        this.lastRequestTime = null;
        this.config = {
            baseUrl: ((_a = config_1.config.thesports) === null || _a === void 0 ? void 0 : _a.baseUrl) || 'https://api.thesports.com/v1/football',
            user: ((_b = config_1.config.thesports) === null || _b === void 0 ? void 0 : _b.user) || '',
            secret: ((_c = config_1.config.thesports) === null || _c === void 0 ? void 0 : _c.secret) || '',
            timeout: 30000,
        };
        this.axiosInstance = this.createAxiosInstance();
        this.circuitBreaker = new circuitBreaker_1.CircuitBreaker('thesports-api-singleton');
        this.rateLimiter = new GlobalRateLimiter();
        this.setupInterceptors();
        this.isInitialized = true;
        logger_1.logger.info('[TheSportsAPI] Singleton initialized successfully');
        (0, obsLogger_1.logEvent)('info', 'thesports.singleton.initialized', {
            baseUrl: this.config.baseUrl,
            user: this.config.user ? 'configured' : 'missing',
        });
    }
    /**
     * Get the singleton instance
     * Thread-safe lazy initialization
     */
    TheSportsAPIManager.getInstance = function () {
        if (!TheSportsAPIManager.instance) {
            TheSportsAPIManager.instance = new TheSportsAPIManager();
        }
        return TheSportsAPIManager.instance;
    };
    /**
     * Async initialization with validation
     * Use this at application startup
     */
    TheSportsAPIManager.initialize = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                if (TheSportsAPIManager.initializationPromise) {
                    return [2 /*return*/, TheSportsAPIManager.initializationPromise];
                }
                TheSportsAPIManager.initializationPromise = (function () { return __awaiter(_this, void 0, void 0, function () {
                    var instance;
                    return __generator(this, function (_a) {
                        instance = TheSportsAPIManager.getInstance();
                        // Validate configuration
                        if (!instance.config.user || !instance.config.secret) {
                            logger_1.logger.warn('[TheSportsAPI] API credentials not configured - requests will fail');
                        }
                        // Test connectivity (optional health check)
                        try {
                            // We don't actually call the API here to avoid wasting quota
                            logger_1.logger.info('[TheSportsAPI] Ready for requests');
                        }
                        catch (error) {
                            logger_1.logger.error('[TheSportsAPI] Initialization validation failed:', error);
                        }
                        return [2 /*return*/, instance];
                    });
                }); })();
                return [2 /*return*/, TheSportsAPIManager.initializationPromise];
            });
        });
    };
    /**
     * Shutdown and cleanup
     */
    TheSportsAPIManager.shutdown = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (TheSportsAPIManager.instance) {
                    logger_1.logger.info('[TheSportsAPI] Shutting down singleton...');
                    (0, obsLogger_1.logEvent)('info', 'thesports.singleton.shutdown', {
                        totalRequests: TheSportsAPIManager.instance.requestCount,
                        totalErrors: TheSportsAPIManager.instance.errorCount,
                    });
                    TheSportsAPIManager.instance = null;
                    TheSportsAPIManager.initializationPromise = null;
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Create Axios instance with optimal settings
     */
    TheSportsAPIManager.prototype.createAxiosInstance = function () {
        return axios_1.default.create({
            baseURL: this.config.baseUrl,
            timeout: this.config.timeout,
            headers: {
                Accept: 'application/json',
                'User-Agent': 'GoalGPT/2.0-Singleton',
            },
            // Connection pooling
            maxRedirects: 3,
            validateStatus: function (status) { return status >= 200 && status < 500; },
        });
    };
    /**
     * Setup request/response interceptors
     */
    TheSportsAPIManager.prototype.setupInterceptors = function () {
        var _this = this;
        // Request interceptor - add timing
        this.axiosInstance.interceptors.request.use(function (cfg) {
            var _a;
            cfg.metadata = { startTime: Date.now() };
            logger_1.logger.debug("[TheSportsAPI] \u2192 ".concat((_a = cfg.method) === null || _a === void 0 ? void 0 : _a.toUpperCase(), " ").concat(cfg.url));
            return cfg;
        }, function (error) {
            logger_1.logger.error('[TheSportsAPI] Request setup error:', error.message);
            return Promise.reject(error);
        });
        // Response interceptor - log timing and handle errors
        this.axiosInstance.interceptors.response.use(function (response) {
            var _a;
            var startTime = (_a = response.config.metadata) === null || _a === void 0 ? void 0 : _a.startTime;
            var duration = startTime ? Date.now() - startTime : 0;
            logger_1.logger.debug("[TheSportsAPI] \u2190 ".concat(response.status, " (").concat(duration, "ms)"));
            return response;
        }, function (error) {
            var formattedError = (0, error_handler_1.formatTheSportsError)(error);
            (0, error_handler_1.logTheSportsError)(formattedError, 'Singleton');
            _this.errorCount++;
            return Promise.reject(error);
        });
    };
    /**
     * Build query parameters with authentication
     */
    TheSportsAPIManager.prototype.buildQueryParams = function (params) {
        if (params === void 0) { params = {}; }
        return new URLSearchParams(__assign({ user: this.config.user, secret: this.config.secret }, params));
    };
    /**
     * Execute GET request with all protections
     * This is the primary method for API calls
     */
    TheSportsAPIManager.prototype.get = function (endpoint_1) {
        return __awaiter(this, arguments, void 0, function (endpoint, params, options) {
            var _this = this;
            if (params === void 0) { params = {}; }
            if (options === void 0) { options = {}; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!!options.skipRateLimit) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.rateLimiter.acquire(endpoint)];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        this.requestCount++;
                        this.lastRequestTime = Date.now();
                        // Circuit breaker + Retry
                        return [2 /*return*/, this.circuitBreaker.execute(function () { return __awaiter(_this, void 0, void 0, function () {
                                var _this = this;
                                return __generator(this, function (_a) {
                                    return [2 /*return*/, (0, providerResilience_1.withRetry)(function () { return __awaiter(_this, void 0, void 0, function () {
                                            var queryParams, url, response;
                                            return __generator(this, function (_a) {
                                                switch (_a.label) {
                                                    case 0:
                                                        queryParams = this.buildQueryParams(params);
                                                        url = "".concat(endpoint, "?").concat(queryParams.toString());
                                                        return [4 /*yield*/, this.axiosInstance.get(url)];
                                                    case 1:
                                                        response = _a.sent();
                                                        // Check for API-level errors
                                                        if (response.status >= 400) {
                                                            throw new Error("API Error: ".concat(response.status, " - ").concat(JSON.stringify(response.data)));
                                                        }
                                                        return [2 /*return*/, response.data];
                                                }
                                            });
                                        }); }, endpoint)];
                                });
                            }); })];
                }
            });
        });
    };
    /**
     * Execute POST request with all protections
     */
    TheSportsAPIManager.prototype.post = function (endpoint_1, data_1) {
        return __awaiter(this, arguments, void 0, function (endpoint, data, params) {
            var _this = this;
            if (params === void 0) { params = {}; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.rateLimiter.acquire(endpoint)];
                    case 1:
                        _a.sent();
                        this.requestCount++;
                        this.lastRequestTime = Date.now();
                        return [2 /*return*/, this.circuitBreaker.execute(function () { return __awaiter(_this, void 0, void 0, function () {
                                var _this = this;
                                return __generator(this, function (_a) {
                                    return [2 /*return*/, (0, providerResilience_1.withRetry)(function () { return __awaiter(_this, void 0, void 0, function () {
                                            var queryParams, url, response;
                                            return __generator(this, function (_a) {
                                                switch (_a.label) {
                                                    case 0:
                                                        queryParams = this.buildQueryParams(params);
                                                        url = "".concat(endpoint, "?").concat(queryParams.toString());
                                                        return [4 /*yield*/, this.axiosInstance.post(url, data)];
                                                    case 1:
                                                        response = _a.sent();
                                                        return [2 /*return*/, response.data];
                                                }
                                            });
                                        }); }, endpoint)];
                                });
                            }); })];
                }
            });
        });
    };
    // ============================================================================
    // HEALTH & METRICS
    // ============================================================================
    /**
     * Get current health status
     */
    TheSportsAPIManager.prototype.getHealth = function () {
        return {
            initialized: this.isInitialized,
            circuitState: this.circuitBreaker.getState(),
            rateLimiter: this.rateLimiter.getStats(),
            metrics: {
                requests: this.requestCount,
                errors: this.errorCount,
                lastRequest: this.lastRequestTime,
            },
        };
    };
    /**
     * Reset circuit breaker (for recovery)
     */
    TheSportsAPIManager.prototype.resetCircuit = function () {
        this.circuitBreaker.reset();
        logger_1.logger.info('[TheSportsAPI] Circuit breaker reset');
    };
    /**
     * Check if API is available
     */
    TheSportsAPIManager.prototype.isAvailable = function () {
        return this.circuitBreaker.getState() !== circuitBreaker_1.CircuitState.OPEN;
    };
    // ============================================================================
    // COMPATIBILITY METHODS (for TheSportsClient interface compatibility)
    // ============================================================================
    /**
     * Get circuit breaker state (TheSportsClient compatibility method)
     * @deprecated Use getHealth().circuitState instead
     */
    TheSportsAPIManager.prototype.getCircuitBreakerState = function () {
        return this.circuitBreaker.getState();
    };
    /**
     * Reset circuit breaker (TheSportsClient compatibility method)
     * @deprecated Use resetCircuit() instead
     */
    TheSportsAPIManager.prototype.resetCircuitBreaker = function () {
        this.resetCircuit();
    };
    TheSportsAPIManager.instance = null;
    TheSportsAPIManager.initializationPromise = null;
    return TheSportsAPIManager;
}());
exports.TheSportsAPIManager = TheSportsAPIManager;
// ============================================================================
// EXPORTS
// ============================================================================
// Default singleton export - use this in most cases
exports.theSportsAPI = TheSportsAPIManager.getInstance();
