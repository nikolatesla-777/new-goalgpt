/**
 * Circuit Breaker for Provider Resilience
 * 
 * Phase 4-2: Circuit breaker with window-based failure tracking
 * - Window: 60 seconds
 * - Fail threshold: 5 consecutive failures
 * - Open state duration: 120 seconds
 * - Half-open: allow 1 test request
 */

import { logEvent } from './obsLogger';

export enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Service is down, reject requests
  HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

export interface CircuitBreakerConfig {
  failureThreshold: number; // Open circuit after N consecutive failures
  windowMs: number; // Failure tracking window (60s)
  openDurationMs: number; // How long to stay OPEN (120s)
  halfOpenMaxAttempts: number; // Max attempts in half-open (1)
}

export const PHASE4_2_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  windowMs: 60000, // 60 seconds
  openDurationMs: 120000, // 120 seconds
  halfOpenMaxAttempts: 1, // Allow 1 test request
};

/**
 * CircuitOpenError - Typed error for circuit breaker OPEN state
 * Phase 4-2: Replaces string matching with instanceof check
 */
export class CircuitOpenError extends Error {
  public readonly name = 'CircuitOpenError';
  public readonly code = 'CIRCUIT_OPEN';
  public readonly provider: string;

  constructor(provider: string) {
    super(`Circuit breaker is OPEN - ${provider} service unavailable`);
    this.provider = provider;
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CircuitOpenError);
    }
  }
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private failureWindow: number[] = []; // Timestamps of failures in current window
  private lastFailureTime: number | null = null;
  private openTime: number | null = null; // When circuit was opened
  private halfOpenAttempts = 0;
  private config: CircuitBreakerConfig;
  private name: string; // For logging (e.g., 'thesports-http', 'thesports-mqtt')

  constructor(name: string = 'provider', config: CircuitBreakerConfig = PHASE4_2_CIRCUIT_CONFIG) {
    this.config = config;
    this.name = name;
  }

  /**
   * Execute function with circuit breaker protection
   * Returns result or throws error (never throws uncaught exceptions upward)
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.updateState();
    this.cleanupFailureWindow();

    // If OPEN, skip provider call and return/log
    if (this.state === CircuitState.OPEN) {
      // Log that circuit is open and request is skipped
      logEvent('warn', 'provider.circuit.opened', {
        provider: this.name,
        state: 'OPEN',
        skipped: true,
      });
      
      // Phase 4-2: Throw typed error instead of string-based error
      throw new CircuitOpenError(this.name);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Update circuit breaker state based on current conditions
   */
  private updateState(): void {
    const now = Date.now();

    // If OPEN, check if we should move to HALF_OPEN
    if (this.state === CircuitState.OPEN && this.openTime !== null) {
      const timeSinceOpen = now - this.openTime;
      if (timeSinceOpen >= this.config.openDurationMs) {
        this.state = CircuitState.HALF_OPEN;
        this.halfOpenAttempts = 0;
        logEvent('info', 'provider.circuit.half_open', {
          provider: this.name,
          state: 'HALF_OPEN',
        });
      }
    }
  }

  /**
   * Clean up failure window (remove failures older than window)
   */
  private cleanupFailureWindow(): void {
    const now = Date.now();
    this.failureWindow = this.failureWindow.filter(
      (timestamp) => now - timestamp < this.config.windowMs
    );
  }

  /**
   * Handle successful request
   */
  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      // Success in half-open → close circuit
      this.state = CircuitState.CLOSED;
      this.failureCount = 0;
      this.failureWindow = [];
      this.halfOpenAttempts = 0;
      this.openTime = null;
      logEvent('info', 'provider.circuit.closed', {
        provider: this.name,
        state: 'CLOSED',
      });
    } else if (this.state === CircuitState.CLOSED) {
      // Success in closed → reset failure count
      this.failureCount = 0;
      this.failureWindow = [];
    }
  }

  /**
   * Handle failed request
   */
  private onFailure(): void {
    const now = Date.now();
    this.lastFailureTime = now;
    this.failureWindow.push(now);

    if (this.state === CircuitState.HALF_OPEN) {
      // Failure in half-open → open circuit
      this.halfOpenAttempts++;
      if (this.halfOpenAttempts >= this.config.halfOpenMaxAttempts) {
        this.state = CircuitState.OPEN;
        this.openTime = now;
        logEvent('warn', 'provider.circuit.opened', {
          provider: this.name,
          state: 'OPEN',
          reason: 'half_open_failure',
        });
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Failure in closed → check threshold
      this.failureCount++;
      
      // Check if we have 5 consecutive failures in the window
      if (this.failureWindow.length >= this.config.failureThreshold) {
        this.state = CircuitState.OPEN;
        this.openTime = now;
        logEvent('warn', 'provider.circuit.opened', {
          provider: this.name,
          state: 'OPEN',
          reason: 'threshold_exceeded',
          failure_count: this.failureWindow.length,
        });
      }
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Reset circuit breaker (for testing/manual recovery)
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.failureWindow = [];
    this.lastFailureTime = null;
    this.openTime = null;
    this.halfOpenAttempts = 0;
  }
}

