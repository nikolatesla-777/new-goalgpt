/**
 * TheSports API Client Interface
 *
 * Standard interface for TheSports API interactions.
 * Implemented by TheSportsAPIManager singleton.
 */

import { CircuitState } from '../utils/circuitBreaker';

export interface ITheSportsAPI {
  /**
   * Execute GET request with rate limiting and circuit breaker
   */
  get<T>(
    endpoint: string,
    params?: Record<string, any>,
    options?: { skipRateLimit?: boolean }
  ): Promise<T>;

  /**
   * Execute POST request with rate limiting and circuit breaker
   */
  post<T>(
    endpoint: string,
    data?: any,
    params?: Record<string, any>
  ): Promise<T>;

  /**
   * Get current health status of the API client
   */
  getHealth(): {
    initialized: boolean;
    circuitState: CircuitState;
    rateLimiter: { tokens: number; queueLength: number };
    metrics: { requests: number; errors: number; lastRequest: number | null };
  };

  /**
   * Check if API is available (circuit breaker not open)
   */
  isAvailable(): boolean;

  /**
   * Reset circuit breaker state
   */
  resetCircuit(): void;
}
