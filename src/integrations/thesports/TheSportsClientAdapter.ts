/**
 * TheSportsClientAdapter - Adapter for backward compatibility
 *
 * This adapter provides the same interface as the legacy TheSportsAPIManager
 * but uses the new hardened TheSportsClient internally.
 *
 * Use this to migrate existing code without breaking changes.
 */

import { theSportsClient, CircuitState, TheSportsClient } from './TheSportsClient';
import { ITheSportsAPI } from '../../types/api-client.interface';
import { CircuitState as LegacyCircuitState } from '../../utils/circuitBreaker';

/**
 * Map new circuit states to legacy circuit states for backward compatibility
 */
function mapCircuitState(state: CircuitState): LegacyCircuitState {
  switch (state) {
    case CircuitState.CLOSED:
      return LegacyCircuitState.CLOSED;
    case CircuitState.OPEN:
      return LegacyCircuitState.OPEN;
    case CircuitState.HALF_OPEN:
      return LegacyCircuitState.HALF_OPEN;
    case CircuitState.ISOLATED:
      return LegacyCircuitState.OPEN; // Map isolated to open for legacy compatibility
    default:
      return LegacyCircuitState.CLOSED;
  }
}

/**
 * Adapter class that implements ITheSportsAPI interface using the new TheSportsClient
 */
export class TheSportsClientAdapter implements ITheSportsAPI {
  private client: TheSportsClient;

  constructor(client?: TheSportsClient) {
    this.client = client || theSportsClient;
  }

  async get<T>(
    endpoint: string,
    params: Record<string, unknown> = {},
    options: { skipRateLimit?: boolean } = {}
  ): Promise<T> {
    return this.client.get<T>(endpoint, params, options);
  }

  async post<T>(
    endpoint: string,
    data?: unknown,
    params: Record<string, unknown> = {}
  ): Promise<T> {
    return this.client.post<T>(endpoint, data, params);
  }

  getHealth(): {
    initialized: boolean;
    circuitState: LegacyCircuitState;
    rateLimiter: { tokens: number; queueLength: number };
    metrics: { requests: number; errors: number; lastRequest: number | null };
  } {
    const health = this.client.getHealth();
    return {
      initialized: health.initialized,
      circuitState: mapCircuitState(health.circuitState),
      rateLimiter: health.rateLimiter,
      metrics: {
        requests: health.metrics.requests,
        errors: health.metrics.errors,
        lastRequest: health.metrics.lastRequest,
      },
    };
  }

  isAvailable(): boolean {
    return this.client.isAvailable();
  }

  resetCircuit(): void {
    // The new client doesn't expose direct circuit reset
    // This is intentional - circuit breakers should recover automatically
    console.warn('[TheSportsClientAdapter] resetCircuit() called - circuit breaker will recover automatically');
  }

  /**
   * Get the underlying new client for advanced usage
   */
  getClient(): TheSportsClient {
    return this.client;
  }
}

// Export singleton adapter instance
export const theSportsAPIAdapter = new TheSportsClientAdapter();
