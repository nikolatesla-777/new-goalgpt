"use strict";
/**
 * TheSportsClientAdapter - Adapter for backward compatibility
 *
 * This adapter provides the same interface as the legacy TheSportsAPIManager
 * but uses the new hardened TheSportsClient internally.
 *
 * Use this to migrate existing code without breaking changes.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.theSportsAPIAdapter = exports.TheSportsClientAdapter = void 0;
const TheSportsClient_1 = require("./TheSportsClient");
const circuitBreaker_1 = require("../../utils/circuitBreaker");
/**
 * Map new circuit states to legacy circuit states for backward compatibility
 */
function mapCircuitState(state) {
    switch (state) {
        case TheSportsClient_1.CircuitState.CLOSED:
            return circuitBreaker_1.CircuitState.CLOSED;
        case TheSportsClient_1.CircuitState.OPEN:
            return circuitBreaker_1.CircuitState.OPEN;
        case TheSportsClient_1.CircuitState.HALF_OPEN:
            return circuitBreaker_1.CircuitState.HALF_OPEN;
        case TheSportsClient_1.CircuitState.ISOLATED:
            return circuitBreaker_1.CircuitState.OPEN; // Map isolated to open for legacy compatibility
        default:
            return circuitBreaker_1.CircuitState.CLOSED;
    }
}
/**
 * Adapter class that implements ITheSportsAPI interface using the new TheSportsClient
 */
class TheSportsClientAdapter {
    constructor(client) {
        this.client = client || TheSportsClient_1.theSportsClient;
    }
    async get(endpoint, params = {}, options = {}) {
        return this.client.get(endpoint, params, options);
    }
    async post(endpoint, data, params = {}) {
        return this.client.post(endpoint, data, params);
    }
    getHealth() {
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
    isAvailable() {
        return this.client.isAvailable();
    }
    resetCircuit() {
        // The new client doesn't expose direct circuit reset
        // This is intentional - circuit breakers should recover automatically
        console.warn('[TheSportsClientAdapter] resetCircuit() called - circuit breaker will recover automatically');
    }
    /**
     * Get the underlying new client for advanced usage
     */
    getClient() {
        return this.client;
    }
}
exports.TheSportsClientAdapter = TheSportsClientAdapter;
// Export singleton adapter instance
exports.theSportsAPIAdapter = new TheSportsClientAdapter();
