/**
 * Single Flight Pattern
 *
 * Prevents duplicate concurrent requests to the same resource.
 * When multiple requests for the same key arrive simultaneously,
 * only one DB query executes while others wait for the result.
 *
 * Benefits:
 * - Reduces DB load during cache misses
 * - Prevents pool exhaustion on cache expiration
 * - Thread-safe for concurrent requests
 */

import { logger } from '../logger';

interface InFlightRequest<T> {
  promise: Promise<T>;
  startedAt: number;
}

class SingleFlight {
  private inFlight: Map<string, InFlightRequest<any>> = new Map();
  private stats = {
    deduplicated: 0,
    executed: 0,
  };

  /**
   * Execute function with single-flight protection
   *
   * @param key - Unique key for this request (e.g., cache key)
   * @param fn - Function to execute (only once per key)
   * @param timeoutMs - Max wait time for in-flight request (default: 10s)
   * @returns Result from function or in-flight request
   */
  async do<T>(key: string, fn: () => Promise<T>, timeoutMs = 10000): Promise<T> {
    // Check if request is already in-flight
    const existing = this.inFlight.get(key);
    if (existing) {
      const waitTime = Date.now() - existing.startedAt;

      // If in-flight request is too old, execute new request
      if (waitTime > timeoutMs) {
        logger.warn(`[SingleFlight] In-flight request timeout for ${key} (${waitTime}ms), executing new request`);
        this.inFlight.delete(key);
      } else {
        // Wait for existing request
        this.stats.deduplicated++;
        logger.debug(`[SingleFlight] Waiting for in-flight request: ${key} (${waitTime}ms ago)`);
        return existing.promise;
      }
    }

    // Execute new request
    this.stats.executed++;
    const promise = fn();

    this.inFlight.set(key, {
      promise,
      startedAt: Date.now(),
    });

    try {
      const result = await promise;
      this.inFlight.delete(key);
      return result;
    } catch (error) {
      // Remove from in-flight even on error
      this.inFlight.delete(key);
      throw error;
    }
  }

  /**
   * Get statistics for monitoring
   */
  getStats(): { deduplicated: number; executed: number; savings: number } {
    const total = this.stats.deduplicated + this.stats.executed;
    const savings = total > 0 ? Math.round((this.stats.deduplicated / total) * 100) : 0;

    return {
      deduplicated: this.stats.deduplicated,
      executed: this.stats.executed,
      savings,
    };
  }

  /**
   * Clear all in-flight requests (for testing)
   */
  clear(): void {
    this.inFlight.clear();
    this.stats.deduplicated = 0;
    this.stats.executed = 0;
  }
}

// Singleton export
export const singleFlight = new SingleFlight();
