"use strict";
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
exports.singleFlight = void 0;
var logger_1 = require("../logger");
var SingleFlight = /** @class */ (function () {
    function SingleFlight() {
        this.inFlight = new Map();
        this.stats = {
            deduplicated: 0,
            executed: 0,
        };
    }
    /**
     * Execute function with single-flight protection
     *
     * @param key - Unique key for this request (e.g., cache key)
     * @param fn - Function to execute (only once per key)
     * @param timeoutMs - Max wait time for in-flight request (default: 10s)
     * @returns Result from function or in-flight request
     */
    SingleFlight.prototype.do = function (key_1, fn_1) {
        return __awaiter(this, arguments, void 0, function (key, fn, timeoutMs) {
            var existing, waitTime, promise, result, error_1;
            if (timeoutMs === void 0) { timeoutMs = 10000; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        existing = this.inFlight.get(key);
                        if (existing) {
                            waitTime = Date.now() - existing.startedAt;
                            // If in-flight request is too old, execute new request
                            if (waitTime > timeoutMs) {
                                logger_1.logger.warn("[SingleFlight] In-flight request timeout for ".concat(key, " (").concat(waitTime, "ms), executing new request"));
                                this.inFlight.delete(key);
                            }
                            else {
                                // Wait for existing request
                                this.stats.deduplicated++;
                                logger_1.logger.debug("[SingleFlight] Waiting for in-flight request: ".concat(key, " (").concat(waitTime, "ms ago)"));
                                return [2 /*return*/, existing.promise];
                            }
                        }
                        // Execute new request
                        this.stats.executed++;
                        promise = fn();
                        this.inFlight.set(key, {
                            promise: promise,
                            startedAt: Date.now(),
                        });
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, promise];
                    case 2:
                        result = _a.sent();
                        this.inFlight.delete(key);
                        return [2 /*return*/, result];
                    case 3:
                        error_1 = _a.sent();
                        // Remove from in-flight even on error
                        this.inFlight.delete(key);
                        throw error_1;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get statistics for monitoring
     */
    SingleFlight.prototype.getStats = function () {
        var total = this.stats.deduplicated + this.stats.executed;
        var savings = total > 0 ? Math.round((this.stats.deduplicated / total) * 100) : 0;
        return {
            deduplicated: this.stats.deduplicated,
            executed: this.stats.executed,
            savings: savings,
        };
    };
    /**
     * Clear all in-flight requests (for testing)
     */
    SingleFlight.prototype.clear = function () {
        this.inFlight.clear();
        this.stats.deduplicated = 0;
        this.stats.executed = 0;
    };
    return SingleFlight;
}());
// Singleton export
exports.singleFlight = new SingleFlight();
