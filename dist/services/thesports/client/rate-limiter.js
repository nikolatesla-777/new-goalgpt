"use strict";
/**
 * Rate Limiter - Token Bucket Algorithm
 *
 * Limits API requests per endpoint using token bucket algorithm.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimiter = exports.DEFAULT_RATE_LIMIT_CONFIG = void 0;
const logger_1 = require("../../../utils/logger");
exports.DEFAULT_RATE_LIMIT_CONFIG = {
    tokensPerSecond: 1, // 1 request per second (more conservative to avoid rate limits)
    maxTokens: 5, // Reduced burst capacity
};
class RateLimiter {
    constructor(defaultConfig = exports.DEFAULT_RATE_LIMIT_CONFIG) {
        this.config = defaultConfig;
        this.tokens = defaultConfig.maxTokens;
        this.lastRefill = Date.now();
        this.endpointLimits = new Map();
    }
    /**
     * Set custom rate limit for specific endpoint
     */
    setEndpointLimit(endpoint, config) {
        this.endpointLimits.set(endpoint, config);
    }
    /**
     * Check if request is allowed and consume token
     */
    async acquire(endpoint = 'default') {
        const config = this.endpointLimits.get(endpoint) || this.config;
        this.refillTokens(config);
        if (this.tokens < 1) {
            const waitTime = this.calculateWaitTime(config);
            logger_1.logger.warn(`Rate limit exceeded for ${endpoint}, waiting ${waitTime}ms`);
            await this.sleep(waitTime);
            this.refillTokens(config);
        }
        this.tokens -= 1;
    }
    /**
     * Refill tokens based on time elapsed
     */
    refillTokens(config) {
        const now = Date.now();
        const timeElapsed = (now - this.lastRefill) / 1000; // seconds
        const tokensToAdd = timeElapsed * config.tokensPerSecond;
        this.tokens = Math.min(this.tokens + tokensToAdd, config.maxTokens);
        this.lastRefill = now;
    }
    /**
     * Calculate wait time until next token is available
     */
    calculateWaitTime(config) {
        const tokensNeeded = 1 - this.tokens;
        return Math.ceil((tokensNeeded / config.tokensPerSecond) * 1000);
    }
    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    /**
     * Get current token count
     */
    getTokens() {
        return Math.floor(this.tokens);
    }
}
exports.RateLimiter = RateLimiter;
