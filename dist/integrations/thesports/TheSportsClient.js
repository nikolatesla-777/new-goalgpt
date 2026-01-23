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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TheSportsClientClass = exports.theSportsClient = exports.TheSportsClient = exports.CircuitState = void 0;
const cockatiel_1 = require("cockatiel");
const config_1 = require("../../config");
const logger_1 = require("../../utils/logger");
const obsLogger_1 = require("../../utils/obsLogger");
// Re-export circuit state for external use
var CircuitState;
(function (CircuitState) {
    CircuitState["CLOSED"] = "CLOSED";
    CircuitState["OPEN"] = "OPEN";
    CircuitState["HALF_OPEN"] = "HALF_OPEN";
    CircuitState["ISOLATED"] = "ISOLATED";
})(CircuitState || (exports.CircuitState = CircuitState = {}));
const DEFAULT_CONFIG = {
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
const RATE_LIMIT_CONFIG = {
    tokensPerSecond: 1, // 1 request per second
    maxTokens: 5, // Burst capacity
};
class TokenBucketRateLimiter {
    constructor(rateLimitConfig = RATE_LIMIT_CONFIG) {
        this.waitQueue = [];
        this.isProcessingQueue = false;
        this.config = rateLimitConfig;
        this.tokens = rateLimitConfig.maxTokens;
        this.lastRefill = Date.now();
    }
    async acquire(context = 'default') {
        return new Promise((resolve) => {
            this.waitQueue.push(() => {
                this.refillTokens();
                if (this.tokens >= 1) {
                    this.tokens -= 1;
                    resolve();
                }
                else {
                    const waitTime = this.calculateWaitTime();
                    logger_1.logger.debug(`[TheSportsClient] Rate limit wait: ${waitTime}ms for ${context}`);
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
function generateRequestId() {
    return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}
// ============================================================================
// THESPORTS CLIENT
// ============================================================================
class TheSportsClient {
    constructor(clientConfig) {
        // Metrics
        this.requestCount = 0;
        this.errorCount = 0;
        this.lastRequestTime = null;
        this.circuitOpenCount = 0;
        this.config = {
            ...DEFAULT_CONFIG,
            baseUrl: config_1.config.thesports?.baseUrl || DEFAULT_CONFIG.baseUrl,
            user: config_1.config.thesports?.user || DEFAULT_CONFIG.user,
            secret: config_1.config.thesports?.secret || DEFAULT_CONFIG.secret,
            ...clientConfig,
        };
        this.rateLimiter = new TokenBucketRateLimiter();
        // Create circuit breaker with cockatiel
        // Opens after 5 consecutive failures, stays open for 30 seconds
        this.circuitBreakerPolicy = (0, cockatiel_1.circuitBreaker)(cockatiel_1.handleAll, {
            halfOpenAfter: this.config.circuitBreakerCooldownMs,
            breaker: new cockatiel_1.ConsecutiveBreaker(this.config.circuitBreakerThreshold),
        });
        // Log circuit breaker state changes
        this.circuitBreakerPolicy.onStateChange((state) => {
            const stateMap = {
                [cockatiel_1.CircuitState.Closed]: CircuitState.CLOSED,
                [cockatiel_1.CircuitState.Open]: CircuitState.OPEN,
                [cockatiel_1.CircuitState.HalfOpen]: CircuitState.HALF_OPEN,
                [cockatiel_1.CircuitState.Isolated]: CircuitState.ISOLATED,
            };
            const mappedState = stateMap[state];
            logger_1.logger.info(`[TheSportsClient] Circuit breaker state: ${mappedState}`);
            (0, obsLogger_1.logEvent)('info', 'thesports.circuit.state_change', { state: mappedState });
            if (state === cockatiel_1.CircuitState.Open) {
                this.circuitOpenCount++;
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
        this.retryPolicy.onRetry((event) => {
            logger_1.logger.warn(`[TheSportsClient] Retry attempt ${event.attempt} after ${event.delay}ms`, { error: event.reason?.message });
            (0, obsLogger_1.logEvent)('warn', 'thesports.http.retry', {
                attempt: event.attempt,
                delay: event.delay,
                error: event.reason?.message,
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
    static getInstance(clientConfig) {
        if (!TheSportsClient.instance) {
            TheSportsClient.instance = new TheSportsClient(clientConfig);
        }
        return TheSportsClient.instance;
    }
    /**
     * Reset singleton (for testing)
     */
    static resetInstance() {
        TheSportsClient.instance = null;
    }
    /**
     * Execute GET request with all protections
     */
    async get(endpoint, params = {}, options = {}) {
        const requestId = generateRequestId();
        const ctx = {
            requestId,
            endpoint,
            startTime: Date.now(),
            attempt: 0,
        };
        // Rate limiting
        if (!options.skipRateLimit) {
            await this.rateLimiter.acquire(endpoint);
        }
        this.requestCount++;
        this.lastRequestTime = Date.now();
        // Build URL with auth params
        const url = this.buildUrl(endpoint, params);
        const timeout = options.timeoutMs || this.config.timeoutMs;
        logger_1.logger.debug(`[TheSportsClient] → GET ${endpoint}`, { requestId, params });
        try {
            const result = await this.policy.execute(async () => {
                ctx.attempt++;
                return this.fetchWithTimeout(url, timeout, ctx);
            });
            const duration = Date.now() - ctx.startTime;
            logger_1.logger.debug(`[TheSportsClient] ← ${endpoint} (${duration}ms)`, { requestId });
            (0, obsLogger_1.logEvent)('info', 'thesports.http.success', {
                endpoint,
                requestId,
                duration_ms: duration,
                attempts: ctx.attempt,
            });
            return result;
        }
        catch (error) {
            this.errorCount++;
            const duration = Date.now() - ctx.startTime;
            logger_1.logger.error(`[TheSportsClient] ✗ ${endpoint} failed after ${ctx.attempt} attempts`, {
                requestId,
                error: error instanceof Error ? error.message : String(error),
                duration,
            });
            (0, obsLogger_1.logEvent)('error', 'thesports.http.fail', {
                endpoint,
                requestId,
                duration_ms: duration,
                attempts: ctx.attempt,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
    /**
     * Execute POST request with all protections
     */
    async post(endpoint, body, params = {}, options = {}) {
        const requestId = generateRequestId();
        const ctx = {
            requestId,
            endpoint,
            startTime: Date.now(),
            attempt: 0,
        };
        if (!options.skipRateLimit) {
            await this.rateLimiter.acquire(endpoint);
        }
        this.requestCount++;
        this.lastRequestTime = Date.now();
        const url = this.buildUrl(endpoint, params);
        const timeout = options.timeoutMs || this.config.timeoutMs;
        logger_1.logger.debug(`[TheSportsClient] → POST ${endpoint}`, { requestId, params });
        try {
            const result = await this.policy.execute(async () => {
                ctx.attempt++;
                return this.fetchWithTimeout(url, timeout, ctx, {
                    method: 'POST',
                    body: body ? JSON.stringify(body) : undefined,
                    headers: { 'Content-Type': 'application/json' },
                });
            });
            const duration = Date.now() - ctx.startTime;
            logger_1.logger.debug(`[TheSportsClient] ← ${endpoint} (${duration}ms)`, { requestId });
            return result;
        }
        catch (error) {
            this.errorCount++;
            throw error;
        }
    }
    /**
     * Fetch with AbortController timeout
     */
    async fetchWithTimeout(url, timeoutMs, ctx, init) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, {
                ...init,
                signal: controller.signal,
                headers: {
                    Accept: 'application/json',
                    'User-Agent': 'GoalGPT/3.0-Cockatiel',
                    'X-Request-ID': ctx.requestId,
                    ...init?.headers,
                },
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                const errorBody = await response.text().catch(() => 'Unable to read error body');
                const error = new Error(`HTTP ${response.status}: ${response.statusText} - ${errorBody}`);
                error.status = response.status;
                error.requestId = ctx.requestId;
                throw error;
            }
            const data = (await response.json());
            // Check for TheSports API-level errors
            if (data.err || (data.code && data.code !== 200 && data.code !== 0)) {
                const error = new Error(`TheSports API Error: ${data.err || data.msg || 'Unknown error'} (code: ${data.code})`);
                error.code = data.code;
                error.requestId = ctx.requestId;
                throw error;
            }
            return data;
        }
        catch (error) {
            clearTimeout(timeoutId);
            // Handle abort (timeout)
            if (error instanceof Error && error.name === 'AbortError') {
                const timeoutError = new Error(`Request timeout after ${timeoutMs}ms`);
                timeoutError.code = 'TIMEOUT';
                timeoutError.requestId = ctx.requestId;
                throw timeoutError;
            }
            throw error;
        }
    }
    /**
     * Build URL with query parameters and authentication
     */
    buildUrl(endpoint, params) {
        const url = new URL(`${this.config.baseUrl}${endpoint}`);
        // Add auth params
        url.searchParams.set('user', this.config.user);
        url.searchParams.set('secret', this.config.secret);
        // Add custom params
        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== null) {
                url.searchParams.set(key, String(value));
            }
        }
        return url.toString();
    }
    // ============================================================================
    // HEALTH & METRICS
    // ============================================================================
    /**
     * Get current circuit breaker state
     */
    getCircuitState() {
        const state = this.circuitBreakerPolicy.state;
        const stateMap = {
            [cockatiel_1.CircuitState.Closed]: CircuitState.CLOSED,
            [cockatiel_1.CircuitState.Open]: CircuitState.OPEN,
            [cockatiel_1.CircuitState.HalfOpen]: CircuitState.HALF_OPEN,
            [cockatiel_1.CircuitState.Isolated]: CircuitState.ISOLATED,
        };
        return stateMap[state];
    }
    /**
     * Check if API is available (circuit not open)
     */
    isAvailable() {
        return this.circuitBreakerPolicy.state !== cockatiel_1.CircuitState.Open;
    }
    /**
     * Get health status
     */
    getHealth() {
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
    }
    /**
     * Reset metrics (for testing)
     */
    resetMetrics() {
        this.requestCount = 0;
        this.errorCount = 0;
        this.lastRequestTime = null;
        this.circuitOpenCount = 0;
    }
}
exports.TheSportsClient = TheSportsClient;
exports.TheSportsClientClass = TheSportsClient;
TheSportsClient.instance = null;
// ============================================================================
// EXPORTS
// ============================================================================
// Default singleton export
exports.theSportsClient = TheSportsClient.getInstance();
