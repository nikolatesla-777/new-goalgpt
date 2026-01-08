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

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { logger } from '../utils/logger';
import { logEvent } from '../utils/obsLogger';
import { config } from '../config';
import { withRetry, isRetryableError } from '../utils/providerResilience';
import { CircuitBreaker, CircuitState } from '../utils/circuitBreaker';
import { formatTheSportsError, logTheSportsError } from '../utils/thesports/error-handler';
import { ITheSportsAPI } from '../types/api-client.interface';

// ============================================================================
// RATE LIMITER - Global Token Bucket
// ============================================================================

interface RateLimitConfig {
  tokensPerSecond: number;
  maxTokens: number;
}

const GLOBAL_RATE_CONFIG: RateLimitConfig = {
  tokensPerSecond: 1,  // 1 request per second (API limit)
  maxTokens: 5,        // Burst capacity for 5 rapid requests
};

class GlobalRateLimiter {
  private tokens: number;
  private lastRefill: number;
  private config: RateLimitConfig;
  private waitQueue: Array<() => void> = [];
  private isProcessingQueue = false;

  constructor(config: RateLimitConfig = GLOBAL_RATE_CONFIG) {
    this.config = config;
    this.tokens = config.maxTokens;
    this.lastRefill = Date.now();
  }

  /**
   * Acquire a token - waits if none available
   * Uses FIFO queue to ensure fair ordering
   */
  async acquire(context: string = 'default'): Promise<void> {
    return new Promise<void>((resolve) => {
      this.waitQueue.push(() => {
        this.refillTokens();

        if (this.tokens >= 1) {
          this.tokens -= 1;
          resolve();
        } else {
          // Calculate wait time and schedule
          const waitTime = this.calculateWaitTime();
          logger.debug(`[RateLimit] Waiting ${waitTime}ms for ${context}`);
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

  private processQueue(): void {
    if (this.isProcessingQueue) return;
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

  private refillTokens(): void {
    const now = Date.now();
    const timeElapsed = (now - this.lastRefill) / 1000;
    const tokensToAdd = timeElapsed * this.config.tokensPerSecond;
    this.tokens = Math.min(this.tokens + tokensToAdd, this.config.maxTokens);
    this.lastRefill = now;
  }

  private calculateWaitTime(): number {
    const tokensNeeded = 1 - this.tokens;
    return Math.ceil((tokensNeeded / this.config.tokensPerSecond) * 1000);
  }

  getStats(): { tokens: number; queueLength: number } {
    return {
      tokens: Math.floor(this.tokens),
      queueLength: this.waitQueue.length,
    };
  }
}

// ============================================================================
// CLIENT CONFIGURATION
// ============================================================================

interface TheSportsClientConfig {
  baseUrl: string;
  user: string;
  secret: string;
  timeout: number;
}

// ============================================================================
// SINGLETON MANAGER
// ============================================================================

class TheSportsAPIManager implements ITheSportsAPI {
  private static instance: TheSportsAPIManager | null = null;
  private static initializationPromise: Promise<TheSportsAPIManager> | null = null;

  private axiosInstance: AxiosInstance;
  private circuitBreaker: CircuitBreaker;
  private rateLimiter: GlobalRateLimiter;
  private config: TheSportsClientConfig;
  private isInitialized = false;

  // Metrics
  private requestCount = 0;
  private errorCount = 0;
  private lastRequestTime: number | null = null;

  /**
   * Private constructor - use getInstance() instead
   */
  private constructor() {
    this.config = {
      baseUrl: config.thesports?.baseUrl || 'https://api.thesports.com/v1/football',
      user: config.thesports?.user || '',
      secret: config.thesports?.secret || '',
      timeout: 30000,
    };

    this.axiosInstance = this.createAxiosInstance();
    this.circuitBreaker = new CircuitBreaker('thesports-api-singleton');
    this.rateLimiter = new GlobalRateLimiter();
    this.setupInterceptors();
    this.isInitialized = true;

    logger.info('[TheSportsAPI] Singleton initialized successfully');
    logEvent('info', 'thesports.singleton.initialized', {
      baseUrl: this.config.baseUrl,
      user: this.config.user ? 'configured' : 'missing',
    });
  }

  /**
   * Get the singleton instance
   * Thread-safe lazy initialization
   */
  static getInstance(): TheSportsAPIManager {
    if (!TheSportsAPIManager.instance) {
      TheSportsAPIManager.instance = new TheSportsAPIManager();
    }
    return TheSportsAPIManager.instance;
  }

  /**
   * Async initialization with validation
   * Use this at application startup
   */
  static async initialize(): Promise<TheSportsAPIManager> {
    if (TheSportsAPIManager.initializationPromise) {
      return TheSportsAPIManager.initializationPromise;
    }

    TheSportsAPIManager.initializationPromise = (async () => {
      const instance = TheSportsAPIManager.getInstance();

      // Validate configuration
      if (!instance.config.user || !instance.config.secret) {
        logger.warn('[TheSportsAPI] API credentials not configured - requests will fail');
      }

      // Test connectivity (optional health check)
      try {
        // We don't actually call the API here to avoid wasting quota
        logger.info('[TheSportsAPI] Ready for requests');
      } catch (error) {
        logger.error('[TheSportsAPI] Initialization validation failed:', error);
      }

      return instance;
    })();

    return TheSportsAPIManager.initializationPromise;
  }

  /**
   * Shutdown and cleanup
   */
  static async shutdown(): Promise<void> {
    if (TheSportsAPIManager.instance) {
      logger.info('[TheSportsAPI] Shutting down singleton...');
      logEvent('info', 'thesports.singleton.shutdown', {
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
  private createAxiosInstance(): AxiosInstance {
    return axios.create({
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
  private setupInterceptors(): void {
    // Request interceptor - add timing
    this.axiosInstance.interceptors.request.use(
      (cfg) => {
        (cfg as any).metadata = { startTime: Date.now() };
        logger.debug(`[TheSportsAPI] → ${cfg.method?.toUpperCase()} ${cfg.url}`);
        return cfg;
      },
      (error) => {
        logger.error('[TheSportsAPI] Request setup error:', error.message);
        return Promise.reject(error);
      }
    );

    // Response interceptor - log timing and handle errors
    this.axiosInstance.interceptors.response.use(
      (response) => {
        const startTime = (response.config as any).metadata?.startTime;
        const duration = startTime ? Date.now() - startTime : 0;
        logger.debug(`[TheSportsAPI] ← ${response.status} (${duration}ms)`);
        return response;
      },
      (error) => {
        const formattedError = formatTheSportsError(error);
        logTheSportsError(formattedError, 'Singleton');
        this.errorCount++;
        return Promise.reject(error);
      }
    );
  }

  /**
   * Build query parameters with authentication
   */
  private buildQueryParams(params: Record<string, any> = {}): URLSearchParams {
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
  async get<T>(
    endpoint: string,
    params: Record<string, any> = {},
    options: { skipRateLimit?: boolean } = {}
  ): Promise<T> {
    // Global rate limiting (unless explicitly skipped for high-priority requests)
    if (!options.skipRateLimit) {
      await this.rateLimiter.acquire(endpoint);
    }

    this.requestCount++;
    this.lastRequestTime = Date.now();

    // Circuit breaker + Retry
    return this.circuitBreaker.execute(async () => {
      return withRetry(
        async () => {
          const queryParams = this.buildQueryParams(params);
          const url = `${endpoint}?${queryParams.toString()}`;
          const response: AxiosResponse<T> = await this.axiosInstance.get(url);

          // Check for API-level errors
          if (response.status >= 400) {
            throw new Error(`API Error: ${response.status} - ${JSON.stringify(response.data)}`);
          }

          return response.data;
        },
        endpoint
      );
    });
  }

  /**
   * Execute POST request with all protections
   */
  async post<T>(
    endpoint: string,
    data?: any,
    params: Record<string, any> = {}
  ): Promise<T> {
    await this.rateLimiter.acquire(endpoint);
    this.requestCount++;
    this.lastRequestTime = Date.now();

    return this.circuitBreaker.execute(async () => {
      return withRetry(
        async () => {
          const queryParams = this.buildQueryParams(params);
          const url = `${endpoint}?${queryParams.toString()}`;
          const response: AxiosResponse<T> = await this.axiosInstance.post(url, data);
          return response.data;
        },
        endpoint
      );
    });
  }

  // ============================================================================
  // HEALTH & METRICS
  // ============================================================================

  /**
   * Get current health status
   */
  getHealth(): {
    initialized: boolean;
    circuitState: CircuitState;
    rateLimiter: { tokens: number; queueLength: number };
    metrics: { requests: number; errors: number; lastRequest: number | null };
  } {
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
  resetCircuit(): void {
    this.circuitBreaker.reset();
    logger.info('[TheSportsAPI] Circuit breaker reset');
  }

  /**
   * Check if API is available
   */
  isAvailable(): boolean {
    return this.circuitBreaker.getState() !== CircuitState.OPEN;
  }

  // ============================================================================
  // COMPATIBILITY METHODS (for TheSportsClient interface compatibility)
  // ============================================================================

  /**
   * Get circuit breaker state (TheSportsClient compatibility method)
   * @deprecated Use getHealth().circuitState instead
   */
  getCircuitBreakerState(): CircuitState {
    return this.circuitBreaker.getState();
  }

  /**
   * Reset circuit breaker (TheSportsClient compatibility method)
   * @deprecated Use resetCircuit() instead
   */
  resetCircuitBreaker(): void {
    this.resetCircuit();
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

// Default singleton export - use this in most cases
export const theSportsAPI = TheSportsAPIManager.getInstance();

// Manager class export - for advanced usage (testing, initialization)
export { TheSportsAPIManager };

// Re-export types
export type { TheSportsClientConfig, RateLimitConfig };
