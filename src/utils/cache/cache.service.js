"use strict";
/**
 * Cache Service
 *
 * Simple in-memory cache implementation
 * TODO: Add Redis support in the future
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
exports.cacheService = void 0;
var types_1 = require("./types");
var logger_1 = require("../logger");
var CacheService = /** @class */ (function () {
    function CacheService() {
        this.cache = new Map();
        this.cleanupInterval = null;
        // Start active cleanup on instantiation (Phase 2 Fix)
        this.startCleanup();
    }
    /**
     * Start background cleanup task
     * Runs every 60 seconds to remove expired entries
     */
    CacheService.prototype.startCleanup = function () {
        var _this = this;
        this.cleanupInterval = setInterval(function () {
            _this.cleanup();
        }, 60000); // 60 seconds
        // Prevent Node.js from keeping process alive just for this
        if (this.cleanupInterval.unref) {
            this.cleanupInterval.unref();
        }
        logger_1.logger.info('[Cache] Active cleanup started (60s interval)');
    };
    /**
     * Clean up expired entries
     * Called automatically every 60 seconds
     */
    CacheService.prototype.cleanup = function () {
        var now = Date.now();
        var removed = 0;
        for (var _i = 0, _a = this.cache.entries(); _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], entry = _b[1];
            if (now > entry.expiry) {
                this.cache.delete(key);
                removed++;
            }
        }
        if (removed > 0) {
            logger_1.logger.debug("[Cache] Cleanup: removed ".concat(removed, " expired entries (").concat(this.cache.size, " remaining)"));
        }
    };
    /**
     * Get value from cache
     */
    CacheService.prototype.get = function (key) {
        return __awaiter(this, void 0, void 0, function () {
            var entry;
            return __generator(this, function (_a) {
                entry = this.cache.get(key);
                if (!entry) {
                    return [2 /*return*/, null];
                }
                // Check if expired
                if (Date.now() > entry.expiry) {
                    this.cache.delete(key);
                    return [2 /*return*/, null];
                }
                return [2 /*return*/, entry.value];
            });
        });
    };
    /**
     * Set value in cache
     */
    CacheService.prototype.set = function (key_1, value_1) {
        return __awaiter(this, arguments, void 0, function (key, value, ttl) {
            var expiry;
            if (ttl === void 0) { ttl = types_1.CacheTTL.Hour; }
            return __generator(this, function (_a) {
                expiry = Date.now() + ttl * 1000;
                this.cache.set(key, { value: value, expiry: expiry });
                logger_1.logger.debug("Cache set: ".concat(key, " (TTL: ").concat(ttl, "s)"));
                return [2 /*return*/];
            });
        });
    };
    /**
     * Delete value from cache
     */
    CacheService.prototype.del = function (key) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this.cache.delete(key);
                logger_1.logger.debug("Cache deleted: ".concat(key));
                return [2 /*return*/];
            });
        });
    };
    /**
     * Delete all keys matching a pattern (prefix)
     * For in-memory cache, we check if key starts with pattern
     */
    CacheService.prototype.deletePattern = function (pattern) {
        return __awaiter(this, void 0, void 0, function () {
            var deleted, prefix, _i, _a, key;
            return __generator(this, function (_b) {
                deleted = 0;
                prefix = pattern.replace(/\*$/, '');
                for (_i = 0, _a = this.cache.keys(); _i < _a.length; _i++) {
                    key = _a[_i];
                    if (key.startsWith(prefix)) {
                        this.cache.delete(key);
                        deleted++;
                    }
                }
                if (deleted > 0) {
                    logger_1.logger.debug("[Cache] deletePattern: removed ".concat(deleted, " keys matching \"").concat(pattern, "\""));
                }
                return [2 /*return*/, deleted];
            });
        });
    };
    /**
     * Clear all cache
     */
    CacheService.prototype.clear = function () {
        this.cache.clear();
        logger_1.logger.info('Cache cleared');
    };
    /**
     * Get cache size
     */
    CacheService.prototype.size = function () {
        return this.cache.size;
    };
    /**
     * Stop cleanup (for graceful shutdown)
     * Call this during application shutdown
     */
    CacheService.prototype.stop = function () {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
            logger_1.logger.info('[Cache] Active cleanup stopped');
        }
    };
    return CacheService;
}());
exports.cacheService = new CacheService();
