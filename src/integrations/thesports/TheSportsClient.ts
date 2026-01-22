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

import {
  circuitBreaker,
  CircuitBreakerPolicy,
  CircuitState as CockatielCircuitState,
  ConsecutiveBreaker,
  ExponentialBackoff,
  handleAll,
  retry,
  RetryPolicy,
  wrap,
} from 'cockatiel';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { logEvent } from '../../utils/obsLogger';

// Re-export circuit state for external use
export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
  ISOLATED = 'ISOLATED',
}

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface TheSportsClientConfig {
  baseUrl: string;
  user: string;
  secret: string;
  /** Request timeout in milliseconds (default: 10000) */
  timeoutMs: number;
  /** Maximum retry attempts (default: 3) */
  maxRetries: number;
  /** Initial retry delay in milliseconds (default: 500) */
  initialRetryDelayMs: number;
  /** Maximum retry delay in milliseconds (default: 10000) */
  maxRetryDelayMs: number;
  /** Number of consecutive failures before circuit opens (default: 5) */
  circuitBreakerThreshold: number;
  /** Circuit breaker cooldown in milliseconds (default: 30000) */
  circuitBreakerCooldownMs: number;
}

const DEFAULT_CONFIG: TheSportsClientConfig = {
  baseUrl: 'https://api.thesports.com/v1/football',
  user: '',
  secret: '',
  timeoutMs: 10_000, // 10 seconds
  maxRetries: 3,
  initialRetryDelayMs: 500,
  maxRetryDelayMs: 10_000,
  circuitBreakerThreshold: 5,
  circuitBreakerCooldownMs: 30_000, // 30 seconds
};

// ============================================================================
// RATE LIMITER
// ============================================================================

interface RateLimitConfig {
  tokensPerSecond: number;
  maxTokens: number;
}

const RATE_LIMIT_CONFIG: RateLimitConfig = {
  tokensPerSecond: 1, // 1 request per second
  maxTokens: 5, // Burst capacity
};

class TokenBucketRateLimiter {
  private tokens: number;
  private lastRefill: number;
  private config: RateLimitConfig;
  private waitQueue: Array<() => void> = [];
  private isProcessingQueue = false;

  constructor(rateLimitConfig: RateLimitConfig = RATE_LIMIT_CONFIG) {
    this.config = rateLimitConfig;
    this.tokens = rateLimitConfig.maxTokens;
    this.lastRefill = Date.now();
  }

  async acquire(context: string = 'default'): Promise<void> {
    return new Promise<void>((resolve) => {
      this.waitQueue.push(() => {
        this.refillTokens();

        if (this.tokens >= 1) {
          this.tokens -= 1;
          resolve();
        } else {
          const waitTime = this.calculateWaitTime();
          logger.debug(`[TheSportsClient] Rate limit wait: ${waitTime}ms for ${context}`);
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
// REQUEST CONTEXT
// ============================================================================

interface RequestContext {
  requestId: string;
  endpoint: string;
  startTime: number;
  attempt: number;
}

function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

// ============================================================================
// THESPORTS CLIENT
// ============================================================================

export class TheSportsClient {
  private static instance: TheSportsClient | null = null;

  private config: TheSportsClientConfig;
  private rateLimiter: TokenBucketRateLimiter;
  private circuitBreakerPolicy: CircuitBreakerPolicy;
  private retryPolicy: RetryPolicy;
  private policy: ReturnType<typeof wrap>;

  // Metrics
  private requestCount = 0;
  private errorCount = 0;
  private lastRequestTime: number | null = null;
  private circuitOpenCount = 0;

  private constructor(clientConfig?: Partial<TheSportsClientConfig>) {
    this.config = {
      ...DEFAULT_CONFIG,
      baseUrl: config.thesports?.baseUrl || DEFAULT_CONFIG.baseUrl,
      user: config.thesports?.user || DEFAULT_CONFIG.user,
      secret: config.thesports?.secret || DEFAULT_CONFIG.secret,
      ...clientConfig,
    };

    this.rateLimiter = new TokenBucketRateLimiter();

    // Create circuit breaker with cockatiel
    // Opens after 5 consecutive failures, stays open for 30 seconds
    this.circuitBreakerPolicy = circuitBreaker(handleAll, {
      halfOpenAfter: this.config.circuitBreakerCooldownMs,
      breaker: new ConsecutiveBreaker(this.config.circuitBreakerThreshold),
    });

    // Log circuit breaker state changes
    this.circuitBreakerPolicy.onStateChange((state: CockatielCircuitState) => {
      const stateMap: Record<CockatielCircuitState, CircuitState> = {
        [CockatielCircuitState.Closed]: CircuitState.CLOSED,
        [CockatielCircuitState.Open]: CircuitState.OPEN,
        [CockatielCircuitState.HalfOpen]: CircuitState.HALF_OPEN,
        [CockatielCircuitState.Isolated]: CircuitState.ISOLATED,
      };

      const mappedState = stateMap[state];
      logger.info(`[TheSportsClient] Circuit breaker state: ${mappedState}`);
      logEvent('info', 'thesports.circuit.state_change', { state: mappedState });

      if (state === CockatielCircuitState.Open) {
        this.circuitOpenCount++;
      }
    });

    // Create retry policy with exponential backoff
    this.retryPolicy = retry(handleAll, {
      maxAttempts: this.config.maxRetries,
      backoff: new ExponentialBackoff({
        initialDelay: this.config.initialRetryDelayMs,
        maxDelay: this.config.maxRetryDelayMs,
      }),
    });

    // Log retry events
    this.retryPolicy.onRetry((event: { delay: number; attempt: number; reason?: { message?: string } }) => {
      logger.warn(
        `[TheSportsClient] Retry attempt ${event.attempt} after ${event.delay}ms`,
        { error: event.reason?.message }
      );
      logEvent('warn', 'thesports.http.retry', {
        attempt: event.attempt,
        delay: event.delay,
        error: event.reason?.message,
      });
    });

    // Wrap circuit breaker around retry policy
    this.policy = wrap(this.circuitBreakerPolicy, this.retryPolicy);

    logger.info('[TheSportsClient] Initialized with cockatiel resilience', {
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
  static getInstance(clientConfig?: Partial<TheSportsClientConfig>): TheSportsClient {
    if (!TheSportsClient.instance) {
      TheSportsClient.instance = new TheSportsClient(clientConfig);
    }
    return TheSportsClient.instance;
  }

  /**
   * Reset singleton (for testing)
   */
  static resetInstance(): void {
    TheSportsClient.instance = null;
  }

  /**
   * Execute GET request with all protections
   */
  async get<T>(
    endpoint: string,
    params: Record<string, unknown> = {},
    options: { skipRateLimit?: boolean; timeoutMs?: number } = {}
  ): Promise<T> {
    const requestId = generateRequestId();
    const ctx: RequestContext = {
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

    logger.debug(`[TheSportsClient] → GET ${endpoint}`, { requestId, params });

    try {
      const result = await this.policy.execute(async () => {
        ctx.attempt++;
        return this.fetchWithTimeout<T>(url, timeout, ctx);
      });

      const duration = Date.now() - ctx.startTime;
      logger.debug(`[TheSportsClient] ← ${endpoint} (${duration}ms)`, { requestId });
      logEvent('info', 'thesports.http.success', {
        endpoint,
        requestId,
        duration_ms: duration,
        attempts: ctx.attempt,
      });

      return result as T;
    } catch (error) {
      this.errorCount++;
      const duration = Date.now() - ctx.startTime;

      logger.error(`[TheSportsClient] ✗ ${endpoint} failed after ${ctx.attempt} attempts`, {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        duration,
      });

      logEvent('error', 'thesports.http.fail', {
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
  async post<T>(
    endpoint: string,
    body?: unknown,
    params: Record<string, unknown> = {},
    options: { skipRateLimit?: boolean; timeoutMs?: number } = {}
  ): Promise<T> {
    const requestId = generateRequestId();
    const ctx: RequestContext = {
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

    logger.debug(`[TheSportsClient] → POST ${endpoint}`, { requestId, params });

    try {
      const result = await this.policy.execute(async () => {
        ctx.attempt++;
        return this.fetchWithTimeout<T>(url, timeout, ctx, {
          method: 'POST',
          body: body ? JSON.stringify(body) : undefined,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const duration = Date.now() - ctx.startTime;
      logger.debug(`[TheSportsClient] ← ${endpoint} (${duration}ms)`, { requestId });

      return result as T;
    } catch (error) {
      this.errorCount++;
      throw error;
    }
  }

  /**
   * Fetch with AbortController timeout
   */
  private async fetchWithTimeout<T>(
    url: string,
    timeoutMs: number,
    ctx: RequestContext,
    init?: RequestInit
  ): Promise<T> {
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
        const error = new Error(
          `HTTP ${response.status}: ${response.statusText} - ${errorBody}`
        );
        (error as any).status = response.status;
        (error as any).requestId = ctx.requestId;
        throw error;
      }

      const data = (await response.json()) as Record<string, unknown>;

      // Check for TheSports API-level errors
      if (data.err || (data.code && data.code !== 200 && data.code !== 0)) {
        const error = new Error(
          `TheSports API Error: ${data.err || data.msg || 'Unknown error'} (code: ${data.code})`
        );
        (error as any).code = data.code;
        (error as any).requestId = ctx.requestId;
        throw error;
      }

      return data as unknown as T;
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle abort (timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutError = new Error(`Request timeout after ${timeoutMs}ms`);
        (timeoutError as any).code = 'TIMEOUT';
        (timeoutError as any).requestId = ctx.requestId;
        throw timeoutError;
      }

      throw error;
    }
  }

  /**
   * Build URL with query parameters and authentication
   */
  private buildUrl(endpoint: string, params: Record<string, unknown>): string {
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
  getCircuitState(): CircuitState {
    const state = this.circuitBreakerPolicy.state;
    const stateMap: Record<CockatielCircuitState, CircuitState> = {
      [CockatielCircuitState.Closed]: CircuitState.CLOSED,
      [CockatielCircuitState.Open]: CircuitState.OPEN,
      [CockatielCircuitState.HalfOpen]: CircuitState.HALF_OPEN,
      [CockatielCircuitState.Isolated]: CircuitState.ISOLATED,
    };
    return stateMap[state];
  }

  /**
   * Check if API is available (circuit not open)
   */
  isAvailable(): boolean {
    return this.circuitBreakerPolicy.state !== CockatielCircuitState.Open;
  }

  /**
   * Get health status
   */
  getHealth(): {
    initialized: boolean;
    circuitState: CircuitState;
    rateLimiter: { tokens: number; queueLength: number };
    metrics: {
      requests: number;
      errors: number;
      lastRequest: number | null;
      circuitOpenCount: number;
    };
    config: {
      timeoutMs: number;
      maxRetries: number;
      circuitBreakerThreshold: number;
      circuitBreakerCooldownMs: number;
    };
  } {
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
  resetMetrics(): void {
    this.requestCount = 0;
    this.errorCount = 0;
    this.lastRequestTime = null;
    this.circuitOpenCount = 0;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

// Default singleton export
export const theSportsClient = TheSportsClient.getInstance();

// Class export for advanced usage
export { TheSportsClient as TheSportsClientClass };
