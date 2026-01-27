"use strict";
/**
 * Redis Manager - Singleton
 *
 * Centralized Redis connection management for LiveMatchOrchestrator.
 * Provides distributed locking and caching capabilities.
 *
 * @module core/RedisManager
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisManager = void 0;
var ioredis_1 = __importDefault(require("ioredis"));
var logger_1 = require("../utils/logger");
var RedisManager = /** @class */ (function () {
    function RedisManager() {
    }
    /**
     * Get or create Redis singleton instance
     */
    RedisManager.getInstance = function () {
        if (!this.instance) {
            this.instance = this.createRedisClient();
        }
        return this.instance;
    };
    /**
     * Create Redis client with retry strategy
     */
    RedisManager.createRedisClient = function () {
        var _this = this;
        var redis = new ioredis_1.default({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379', 10),
            password: process.env.REDIS_PASSWORD,
            db: parseInt(process.env.REDIS_DB || '0', 10),
            // Retry strategy: exponential backoff
            retryStrategy: function (times) {
                if (times > _this.MAX_RECONNECT_ATTEMPTS) {
                    logger_1.logger.error('[Redis] Max reconnect attempts reached, giving up');
                    return null; // Stop retrying
                }
                var delay = Math.min(times * 50, 2000); // Max 2 seconds
                logger_1.logger.warn("[Redis] Reconnecting... attempt ".concat(times, ", delay ").concat(delay, "ms"));
                _this.reconnectAttempts = times;
                return delay;
            },
            // Connection timeout
            connectTimeout: 10000,
            // Command timeout
            commandTimeout: 5000,
            // Lazy connect (don't block server startup)
            lazyConnect: false,
            // Keep-alive
            keepAlive: 30000,
        });
        // Event handlers
        redis.on('connect', function () {
            logger_1.logger.info('[Redis] Connected successfully');
            _this.reconnectAttempts = 0;
        });
        redis.on('ready', function () {
            logger_1.logger.info('[Redis] Ready to accept commands');
        });
        redis.on('error', function (error) {
            logger_1.logger.error('[Redis] Connection error:', error);
        });
        redis.on('close', function () {
            logger_1.logger.warn('[Redis] Connection closed');
        });
        redis.on('reconnecting', function () {
            logger_1.logger.info('[Redis] Reconnecting to Redis...');
        });
        redis.on('end', function () {
            logger_1.logger.warn('[Redis] Connection ended');
        });
        return redis;
    };
    /**
     * Acquire distributed lock with timeout
     *
     * CRITICAL FIX: Graceful degradation when Redis unavailable.
     * If Redis is not connected, returns true to allow writes (single-node fallback).
     * This prevents complete system failure when Redis is down.
     *
     * @param key - Lock key (e.g., 'lock:match:123')
     * @param value - Lock value (e.g., job name)
     * @param ttl - Time to live in seconds (default: 5s)
     * @returns true if lock acquired OR Redis unavailable (graceful degradation)
     */
    RedisManager.acquireLock = function (key_1, value_1) {
        return __awaiter(this, arguments, void 0, function (key, value, ttl) {
            var redis, result, error_1;
            var _a;
            if (ttl === void 0) { ttl = 5; }
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        // GRACEFUL DEGRADATION: If Redis not connected, allow writes without lock
                        // This is a single-node fallback - no distributed coordination but at least writes proceed
                        if (!this.instance || this.instance.status !== 'ready') {
                            logger_1.logger.warn("[Redis] Not connected (status=".concat((_a = this.instance) === null || _a === void 0 ? void 0 : _a.status, "), bypassing lock for ").concat(key, " - GRACEFUL DEGRADATION"));
                            return [2 /*return*/, true]; // Allow write without lock
                        }
                        redis = this.getInstance();
                        return [4 /*yield*/, redis.set(key, value, 'EX', ttl, 'NX')];
                    case 1:
                        result = _b.sent();
                        return [2 /*return*/, result === 'OK'];
                    case 2:
                        error_1 = _b.sent();
                        // GRACEFUL DEGRADATION: On error, allow writes to proceed
                        // Better to have potential race conditions than complete system failure
                        logger_1.logger.error("[Redis] Failed to acquire lock for ".concat(key, ":"), error_1);
                        logger_1.logger.warn("[Redis] GRACEFUL DEGRADATION: Allowing write without lock for ".concat(key));
                        return [2 /*return*/, true]; // Allow write on error
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Release distributed lock
     *
     * @param key - Lock key
     * @returns true if lock released, false otherwise
     */
    RedisManager.releaseLock = function (key) {
        return __awaiter(this, void 0, void 0, function () {
            var redis, result, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        redis = this.getInstance();
                        return [4 /*yield*/, redis.del(key)];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result === 1];
                    case 2:
                        error_2 = _a.sent();
                        logger_1.logger.error("[Redis] Failed to release lock for ".concat(key, ":"), error_2);
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get value from Redis
     */
    RedisManager.get = function (key) {
        return __awaiter(this, void 0, void 0, function () {
            var redis, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        redis = this.getInstance();
                        return [4 /*yield*/, redis.get(key)];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2:
                        error_3 = _a.sent();
                        logger_1.logger.error("[Redis] Failed to get key ".concat(key, ":"), error_3);
                        return [2 /*return*/, null];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Set value in Redis with optional TTL
     */
    RedisManager.set = function (key, value, ttl) {
        return __awaiter(this, void 0, void 0, function () {
            var redis, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 5, , 6]);
                        redis = this.getInstance();
                        if (!ttl) return [3 /*break*/, 2];
                        return [4 /*yield*/, redis.setex(key, ttl, value)];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 2: return [4 /*yield*/, redis.set(key, value)];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4: return [2 /*return*/, true];
                    case 5:
                        error_4 = _a.sent();
                        logger_1.logger.error("[Redis] Failed to set key ".concat(key, ":"), error_4);
                        return [2 /*return*/, false];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Check if Redis is available (synchronous status check)
     * Returns true if Redis client is connected and ready
     * Use this for quick availability checks without async ping
     */
    RedisManager.isAvailable = function () {
        try {
            if (!this.instance) {
                return false;
            }
            // Check connection status
            return this.instance.status === 'ready' || this.instance.status === 'connecting';
        }
        catch (error) {
            return false;
        }
    };
    /**
     * Check if Redis is connected and healthy (async with PING)
     */
    RedisManager.healthCheck = function () {
        return __awaiter(this, void 0, void 0, function () {
            var redis, result, error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        redis = this.getInstance();
                        return [4 /*yield*/, redis.ping()];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result === 'PONG'];
                    case 2:
                        error_5 = _a.sent();
                        logger_1.logger.error('[Redis] Health check failed:', error_5);
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Close Redis connection (graceful shutdown)
     */
    RedisManager.close = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.instance) return [3 /*break*/, 2];
                        logger_1.logger.info('[Redis] Closing connection...');
                        return [4 /*yield*/, this.instance.quit()];
                    case 1:
                        _a.sent();
                        this.instance = null;
                        logger_1.logger.info('[Redis] Connection closed');
                        _a.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get Redis client stats
     */
    RedisManager.getStats = function () {
        if (!this.instance) {
            return { connected: false, reconnectAttempts: 0 };
        }
        return {
            connected: this.instance.status === 'ready',
            status: this.instance.status,
            reconnectAttempts: this.reconnectAttempts,
        };
    };
    RedisManager.instance = null;
    RedisManager.reconnectAttempts = 0;
    RedisManager.MAX_RECONNECT_ATTEMPTS = 10;
    return RedisManager;
}());
exports.RedisManager = RedisManager;
