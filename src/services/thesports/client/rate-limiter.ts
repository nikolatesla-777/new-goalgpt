/**
 * Rate Limiter - Token Bucket Algorithm
 * 
 * Limits API requests per endpoint using token bucket algorithm.
 */

import { logger } from '../../../utils/logger';

export interface RateLimitConfig {
  tokensPerSecond: number;
  maxTokens: number;
}

export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  tokensPerSecond: 1, // 1 request per second (more conservative to avoid rate limits)
  maxTokens: 5, // Reduced burst capacity
};

export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private config: RateLimitConfig;
  private endpointLimits: Map<string, RateLimitConfig>;

  constructor(defaultConfig: RateLimitConfig = DEFAULT_RATE_LIMIT_CONFIG) {
    this.config = defaultConfig;
    this.tokens = defaultConfig.maxTokens;
    this.lastRefill = Date.now();
    this.endpointLimits = new Map();
  }

  /**
   * Set custom rate limit for specific endpoint
   */
  setEndpointLimit(endpoint: string, config: RateLimitConfig): void {
    this.endpointLimits.set(endpoint, config);
  }

  /**
   * Check if request is allowed and consume token
   */
  async acquire(endpoint: string = 'default'): Promise<void> {
    const config = this.endpointLimits.get(endpoint) || this.config;
    this.refillTokens(config);

    if (this.tokens < 1) {
      const waitTime = this.calculateWaitTime(config);
      logger.warn(`Rate limit exceeded for ${endpoint}, waiting ${waitTime}ms`);
      await this.sleep(waitTime);
      this.refillTokens(config);
    }

    this.tokens -= 1;
  }

  /**
   * Refill tokens based on time elapsed
   */
  private refillTokens(config: RateLimitConfig): void {
    const now = Date.now();
    const timeElapsed = (now - this.lastRefill) / 1000; // seconds
    const tokensToAdd = timeElapsed * config.tokensPerSecond;

    this.tokens = Math.min(this.tokens + tokensToAdd, config.maxTokens);
    this.lastRefill = now;
  }

  /**
   * Calculate wait time until next token is available
   */
  private calculateWaitTime(config: RateLimitConfig): number {
    const tokensNeeded = 1 - this.tokens;
    return Math.ceil((tokensNeeded / config.tokensPerSecond) * 1000);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get current token count
   */
  getTokens(): number {
    return Math.floor(this.tokens);
  }
}

