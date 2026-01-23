"use strict";
/**
 * Circuit Breaker Pattern Implementation
 *
 * Prevents cascading failures by stopping requests when service is down.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircuitBreaker = exports.DEFAULT_CIRCUIT_BREAKER_CONFIG = exports.CircuitState = void 0;
const logger_1 = require("../../../utils/logger");
var CircuitState;
(function (CircuitState) {
    CircuitState["CLOSED"] = "CLOSED";
    CircuitState["OPEN"] = "OPEN";
    CircuitState["HALF_OPEN"] = "HALF_OPEN";
})(CircuitState || (exports.CircuitState = CircuitState = {}));
exports.DEFAULT_CIRCUIT_BREAKER_CONFIG = {
    failureThreshold: 5,
    timeout: 60000, // 60 seconds
    halfOpenMaxAttempts: 3,
};
class CircuitBreaker {
    constructor(config = exports.DEFAULT_CIRCUIT_BREAKER_CONFIG) {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.lastFailureTime = null;
        this.halfOpenAttempts = 0;
        this.config = config;
    }
    /**
     * Execute function with circuit breaker protection
     */
    async execute(fn) {
        this.updateState();
        if (this.state === CircuitState.OPEN) {
            throw new Error('Circuit breaker is OPEN - service unavailable');
        }
        try {
            const result = await fn();
            this.onSuccess();
            return result;
        }
        catch (error) {
            this.onFailure();
            throw error;
        }
    }
    /**
     * Update circuit breaker state based on current conditions
     */
    updateState() {
        if (this.state === CircuitState.OPEN) {
            const timeSinceLastFailure = Date.now() - (this.lastFailureTime || 0);
            if (timeSinceLastFailure >= this.config.timeout) {
                this.state = CircuitState.HALF_OPEN;
                this.halfOpenAttempts = 0;
                logger_1.logger.info('Circuit breaker: Moving to HALF_OPEN state');
            }
        }
    }
    /**
     * Handle successful request
     */
    onSuccess() {
        if (this.state === CircuitState.HALF_OPEN) {
            this.state = CircuitState.CLOSED;
            this.failureCount = 0;
            this.halfOpenAttempts = 0;
            logger_1.logger.info('Circuit breaker: Service recovered, moving to CLOSED state');
        }
        else if (this.state === CircuitState.CLOSED) {
            this.failureCount = 0;
        }
    }
    /**
     * Handle failed request
     */
    onFailure() {
        this.lastFailureTime = Date.now();
        if (this.state === CircuitState.HALF_OPEN) {
            this.halfOpenAttempts++;
            if (this.halfOpenAttempts >= this.config.halfOpenMaxAttempts) {
                this.state = CircuitState.OPEN;
                logger_1.logger.warn('Circuit breaker: Moving to OPEN state after half-open failures');
            }
        }
        else if (this.state === CircuitState.CLOSED) {
            this.failureCount++;
            if (this.failureCount >= this.config.failureThreshold) {
                this.state = CircuitState.OPEN;
                logger_1.logger.warn('Circuit breaker: Moving to OPEN state after threshold failures');
            }
        }
    }
    /**
     * Get current state
     */
    getState() {
        return this.state;
    }
    /**
     * Reset circuit breaker
     */
    reset() {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.lastFailureTime = null;
        this.halfOpenAttempts = 0;
    }
}
exports.CircuitBreaker = CircuitBreaker;
