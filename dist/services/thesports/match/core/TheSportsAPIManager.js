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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TheSportsAPIManager = exports.theSportsAPI = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");
const obsLogger_1 = require("../utils/obsLogger");
const config_1 = require("../config");
const providerResilience_1 = require("../utils/providerResilience");
const circuitBreaker_1 = require("../utils/circuitBreaker");
const error_handler_1 = require("../utils/thesports/error-handler");
const GLOBAL_RATE_CONFIG = {
    tokensPerSecond: 1, // 1 request per second (API limit)
    maxTokens: 5, // Burst capacity for 5 rapid requests
};
class GlobalRateLimiter {
    constructor(config = GLOBAL_RATE_CONFIG) {
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
    async acquire(context = 'default') {
        return new Promise((resolve) => {
            this.waitQueue.push(() => {
                this.refillTokens();
                if (this.tokens >= 1) {
                    this.tokens -= 1;
                    resolve();
                }
                else {
                    // Calculate wait time and schedule
                    const waitTime = this.calculateWaitTime();
                    logger_1.logger.debug(`[RateLimit] Waiting ${waitTime}ms for ${context}`);
                    setTimeout(() => {
                        this.refillTokens();
                        this.tokens -= 1;
                        resolve();
                    }, waitTime);
                }
            });
            this.processQueue();
        });
    }
    processQueue() {
        if (this.isProcessingQueue)
            return;
        this.isProcessingQueue = true;
        const process = () => {
            if (this.waitQueue.length === 0) {
                this.isProcessingQueue = false;
                return;
            }
            const next = this.waitQueue.shift();
            if (next) {
                next();
                // Process next after minimum interval
                setTimeout(process, 1000 / this.config.tokensPerSecond);
            }
        };
        process();
    }
    refillTokens() {
        const now = Date.now();
        const timeElapsed = (now - this.lastRefill) / 1000;
        const tokensToAdd = timeElapsed * this.config.tokensPerSecond;
        this.tokens = Math.min(this.tokens + tokensToAdd, this.config.maxTokens);
        this.lastRefill = now;
    }
    calculateWaitTime() {
        const tokensNeeded = 1 - this.tokens;
        return Math.ceil((tokensNeeded / this.config.tokensPerSecond) * 1000);
    }
    getStats() {
        return {
            tokens: Math.floor(this.tokens),
            queueLength: this.waitQueue.length,
        };
    }
}
// ============================================================================
// SINGLETON MANAGER
// ============================================================================
class TheSportsAPIManager {
    /**
     * Private constructor - use getInstance() instead
     */
    constructor() {
        this.isInitialized = false;
        // Metrics
        this.requestCount = 0;
        this.errorCount = 0;
        this.lastRequestTime = null;
        this.config = {
            baseUrl: config_1.config.thesports?.baseUrl || 'https://api.thesports.com/v1/football',
            user: config_1.config.thesports?.user || '',
            secret: config_1.config.thesports?.secret || '',
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
    static getInstance() {
        if (!TheSportsAPIManager.instance) {
            TheSportsAPIManager.instance = new TheSportsAPIManager();
        }
        return TheSportsAPIManager.instance;
    }
    /**
     * Async initialization with validation
     * Use this at application startup
     */
    static async initialize() {
        if (TheSportsAPIManager.initializationPromise) {
            return TheSportsAPIManager.initializationPromise;
        }
        TheSportsAPIManager.initializationPromise = (async () => {
            const instance = TheSportsAPIManager.getInstance();
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
            return instance;
        })();
        return TheSportsAPIManager.initializationPromise;
    }
    /**
     * Shutdown and cleanup
     */
    static async shutdown() {
        if (TheSportsAPIManager.instance) {
            logger_1.logger.info('[TheSportsAPI] Shutting down singleton...');
            (0, obsLogger_1.logEvent)('info', 'thesports.singleton.shutdown', {
                totalRequests: TheSportsAPIManager.instance.requestCount,
                totalErrors: TheSportsAPIManager.instance.errorCount,
            });
            TheSportsAPIManager.instance = null;
            TheSportsAPIManager.initializationPromise = null;
        }
    }
    /**
     * Create Axios instance with optimal settings
     */
    createAxiosInstance() {
        return axios_1.default.create({
            baseURL: this.config.baseUrl,
            timeout: this.config.timeout,
            headers: {
                Accept: 'application/json',
                'User-Agent': 'GoalGPT/2.0-Singleton',
            },
            // Connection pooling
            maxRedirects: 3,
            validateStatus: (status) => status >= 200 && status < 500,
        });
    }
    /**
     * Setup request/response interceptors
     */
    setupInterceptors() {
        // Request interceptor - add timing
        this.axiosInstance.interceptors.request.use((cfg) => {
            cfg.metadata = { startTime: Date.now() };
            logger_1.logger.debug(`[TheSportsAPI] → ${cfg.method?.toUpperCase()} ${cfg.url}`);
            return cfg;
        }, (error) => {
            logger_1.logger.error('[TheSportsAPI] Request setup error:', error.message);
            return Promise.reject(error);
        });
        // Response interceptor - log timing and handle errors
        this.axiosInstance.interceptors.response.use((response) => {
            const startTime = response.config.metadata?.startTime;
            const duration = startTime ? Date.now() - startTime : 0;
            logger_1.logger.debug(`[TheSportsAPI] ← ${response.status} (${duration}ms)`);
            return response;
        }, (error) => {
            const formattedError = (0, error_handler_1.formatTheSportsError)(error);
            (0, error_handler_1.logTheSportsError)(formattedError, 'Singleton');
            this.errorCount++;
            return Promise.reject(error);
        });
    }
    /**
     * Build query parameters with authentication
     */
    buildQueryParams(params = {}) {
        return new URLSearchParams({
            user: this.config.user,
            secret: this.config.secret,
            ...params,
        });
    }
    /**
     * Execute GET request with all protections
     * This is the primary method for API calls
     */
    async get(endpoint, params = {}, options = {}) {
        // Global rate limiting (unless explicitly skipped for high-priority requests)
        if (!options.skipRateLimit) {
            await this.rateLimiter.acquire(endpoint);
        }
        this.requestCount++;
        this.lastRequestTime = Date.now();
        // Circuit breaker + Retry
        return this.circuitBreaker.execute(async () => {
            return (0, providerResilience_1.withRetry)(async () => {
                const queryParams = this.buildQueryParams(params);
                const url = `${endpoint}?${queryParams.toString()}`;
                const response = await this.axiosInstance.get(url);
                // Check for API-level errors
                if (response.status >= 400) {
                    throw new Error(`API Error: ${response.status} - ${JSON.stringify(response.data)}`);
                }
                return response.data;
            }, endpoint);
        });
    }
    /**
     * Execute POST request with all protections
     */
    async post(endpoint, data, params = {}) {
        await this.rateLimiter.acquire(endpoint);
        this.requestCount++;
        this.lastRequestTime = Date.now();
        return this.circuitBreaker.execute(async () => {
            return (0, providerResilience_1.withRetry)(async () => {
                const queryParams = this.buildQueryParams(params);
                const url = `${endpoint}?${queryParams.toString()}`;
                const response = await this.axiosInstance.post(url, data);
                return response.data;
            }, endpoint);
        });
    }
    // ============================================================================
    // HEALTH & METRICS
    // ============================================================================
    /**
     * Get current health status
     */
    getHealth() {
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
    }
    /**
     * Reset circuit breaker (for recovery)
     */
    resetCircuit() {
        this.circuitBreaker.reset();
        logger_1.logger.info('[TheSportsAPI] Circuit breaker reset');
    }
    /**
     * Check if API is available
     */
    isAvailable() {
        return this.circuitBreaker.getState() !== circuitBreaker_1.CircuitState.OPEN;
    }
    // ============================================================================
    // COMPATIBILITY METHODS (for TheSportsClient interface compatibility)
    // ============================================================================
    /**
     * Get circuit breaker state (TheSportsClient compatibility method)
     * @deprecated Use getHealth().circuitState instead
     */
    getCircuitBreakerState() {
        return this.circuitBreaker.getState();
    }
    /**
     * Reset circuit breaker (TheSportsClient compatibility method)
     * @deprecated Use resetCircuit() instead
     */
    resetCircuitBreaker() {
        this.resetCircuit();
    }
}
exports.TheSportsAPIManager = TheSportsAPIManager;
TheSportsAPIManager.instance = null;
TheSportsAPIManager.initializationPromise = null;
// ============================================================================
// EXPORTS
// ============================================================================
// Default singleton export - use this in most cases
exports.theSportsAPI = TheSportsAPIManager.getInstance();
