"use strict";
/**
 * Circuit Breaker for Provider Resilience
 *
 * Phase 4-2: Circuit breaker with window-based failure tracking
 * - Window: 60 seconds
 * - Fail threshold: 5 consecutive failures
 * - Open state duration: 120 seconds
 * - Half-open: allow 1 test request
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircuitBreaker = exports.CircuitOpenError = exports.PHASE4_2_CIRCUIT_CONFIG = exports.CircuitState = void 0;
var obsLogger_1 = require("./obsLogger");
var CircuitState;
(function (CircuitState) {
    CircuitState["CLOSED"] = "CLOSED";
    CircuitState["OPEN"] = "OPEN";
    CircuitState["HALF_OPEN"] = "HALF_OPEN";
})(CircuitState || (exports.CircuitState = CircuitState = {}));
exports.PHASE4_2_CIRCUIT_CONFIG = {
    failureThreshold: 5,
    windowMs: 60000, // 60 seconds
    openDurationMs: 120000, // 120 seconds
    halfOpenMaxAttempts: 1, // Allow 1 test request
};
/**
 * CircuitOpenError - Typed error for circuit breaker OPEN state
 * Phase 4-2: Replaces string matching with instanceof check
 */
var CircuitOpenError = /** @class */ (function (_super) {
    __extends(CircuitOpenError, _super);
    function CircuitOpenError(provider) {
        var _this = _super.call(this, "Circuit breaker is OPEN - ".concat(provider, " service unavailable")) || this;
        _this.name = 'CircuitOpenError';
        _this.code = 'CIRCUIT_OPEN';
        _this.provider = provider;
        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(_this, CircuitOpenError);
        }
        return _this;
    }
    return CircuitOpenError;
}(Error));
exports.CircuitOpenError = CircuitOpenError;
var CircuitBreaker = /** @class */ (function () {
    function CircuitBreaker(name, config) {
        if (name === void 0) { name = 'provider'; }
        if (config === void 0) { config = exports.PHASE4_2_CIRCUIT_CONFIG; }
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.failureWindow = []; // Timestamps of failures in current window
        this.lastFailureTime = null;
        this.openTime = null; // When circuit was opened
        this.halfOpenAttempts = 0;
        this.config = config;
        this.name = name;
    }
    /**
     * Execute function with circuit breaker protection
     * Returns result or throws error (never throws uncaught exceptions upward)
     */
    CircuitBreaker.prototype.execute = function (fn) {
        return __awaiter(this, void 0, void 0, function () {
            var result, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.updateState();
                        this.cleanupFailureWindow();
                        // If OPEN, skip provider call and return/log
                        if (this.state === CircuitState.OPEN) {
                            // Log that circuit is open and request is skipped
                            (0, obsLogger_1.logEvent)('warn', 'provider.circuit.opened', {
                                provider: this.name,
                                state: 'OPEN',
                                skipped: true,
                            });
                            // Phase 4-2: Throw typed error instead of string-based error
                            throw new CircuitOpenError(this.name);
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, fn()];
                    case 2:
                        result = _a.sent();
                        this.onSuccess();
                        return [2 /*return*/, result];
                    case 3:
                        error_1 = _a.sent();
                        this.onFailure();
                        throw error_1;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Update circuit breaker state based on current conditions
     */
    CircuitBreaker.prototype.updateState = function () {
        var now = Date.now();
        // If OPEN, check if we should move to HALF_OPEN
        if (this.state === CircuitState.OPEN && this.openTime !== null) {
            var timeSinceOpen = now - this.openTime;
            if (timeSinceOpen >= this.config.openDurationMs) {
                this.state = CircuitState.HALF_OPEN;
                this.halfOpenAttempts = 0;
                (0, obsLogger_1.logEvent)('info', 'provider.circuit.half_open', {
                    provider: this.name,
                    state: 'HALF_OPEN',
                });
            }
        }
    };
    /**
     * Clean up failure window (remove failures older than window)
     */
    CircuitBreaker.prototype.cleanupFailureWindow = function () {
        var _this = this;
        var now = Date.now();
        this.failureWindow = this.failureWindow.filter(function (timestamp) { return now - timestamp < _this.config.windowMs; });
    };
    /**
     * Handle successful request
     */
    CircuitBreaker.prototype.onSuccess = function () {
        if (this.state === CircuitState.HALF_OPEN) {
            // Success in half-open → close circuit
            this.state = CircuitState.CLOSED;
            this.failureCount = 0;
            this.failureWindow = [];
            this.halfOpenAttempts = 0;
            this.openTime = null;
            (0, obsLogger_1.logEvent)('info', 'provider.circuit.closed', {
                provider: this.name,
                state: 'CLOSED',
            });
        }
        else if (this.state === CircuitState.CLOSED) {
            // Success in closed → reset failure count
            this.failureCount = 0;
            this.failureWindow = [];
        }
    };
    /**
     * Handle failed request
     */
    CircuitBreaker.prototype.onFailure = function () {
        var now = Date.now();
        this.lastFailureTime = now;
        this.failureWindow.push(now);
        if (this.state === CircuitState.HALF_OPEN) {
            // Failure in half-open → open circuit
            this.halfOpenAttempts++;
            if (this.halfOpenAttempts >= this.config.halfOpenMaxAttempts) {
                this.state = CircuitState.OPEN;
                this.openTime = now;
                (0, obsLogger_1.logEvent)('warn', 'provider.circuit.opened', {
                    provider: this.name,
                    state: 'OPEN',
                    reason: 'half_open_failure',
                });
            }
        }
        else if (this.state === CircuitState.CLOSED) {
            // Failure in closed → check threshold
            this.failureCount++;
            // Check if we have 5 consecutive failures in the window
            if (this.failureWindow.length >= this.config.failureThreshold) {
                this.state = CircuitState.OPEN;
                this.openTime = now;
                (0, obsLogger_1.logEvent)('warn', 'provider.circuit.opened', {
                    provider: this.name,
                    state: 'OPEN',
                    reason: 'threshold_exceeded',
                    failure_count: this.failureWindow.length,
                });
            }
        }
    };
    /**
     * Get current state
     */
    CircuitBreaker.prototype.getState = function () {
        return this.state;
    };
    /**
     * Reset circuit breaker (for testing/manual recovery)
     */
    CircuitBreaker.prototype.reset = function () {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.failureWindow = [];
        this.lastFailureTime = null;
        this.openTime = null;
        this.halfOpenAttempts = 0;
    };
    return CircuitBreaker;
}());
exports.CircuitBreaker = CircuitBreaker;
