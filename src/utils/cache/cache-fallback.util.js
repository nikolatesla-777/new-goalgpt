"use strict";
/**
 * Cache Fallback Utility
 *
 * Implements stale-while-revalidate pattern for API failure scenarios
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
exports.getWithCacheFallback = getWithCacheFallback;
exports.staleWhileRevalidate = staleWhileRevalidate;
var cache_service_1 = require("./cache.service");
var types_1 = require("./types");
var logger_1 = require("../logger");
/**
 * Get data with cache fallback
 * Returns stale data if available when API fails
 */
function getWithCacheFallback(cacheKey_1, fetchFn_1) {
    return __awaiter(this, arguments, void 0, function (cacheKey, fetchFn, options) {
        var _a, ttl, _b, staleTtl, freshData, error_1, staleData;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _a = options.ttl, ttl = _a === void 0 ? types_1.CacheTTL.FiveMinutes : _a, _b = options.staleTtl, staleTtl = _b === void 0 ? types_1.CacheTTL.Day : _b;
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 4, , 6]);
                    return [4 /*yield*/, fetchFn()];
                case 2:
                    freshData = _c.sent();
                    // Cache fresh data
                    return [4 /*yield*/, cache_service_1.cacheService.set(cacheKey, freshData, ttl)];
                case 3:
                    // Cache fresh data
                    _c.sent();
                    return [2 /*return*/, freshData];
                case 4:
                    error_1 = _c.sent();
                    logger_1.logger.warn("API fetch failed, attempting cache fallback: ".concat(cacheKey), error_1);
                    return [4 /*yield*/, cache_service_1.cacheService.get(cacheKey)];
                case 5:
                    staleData = _c.sent();
                    if (staleData) {
                        logger_1.logger.info("Serving stale data from cache: ".concat(cacheKey));
                        return [2 /*return*/, staleData];
                    }
                    // No cache available, throw error
                    throw new Error("API fetch failed and no cache available: ".concat(error_1.message));
                case 6: return [2 /*return*/];
            }
        });
    });
}
/**
 * Stale-while-revalidate pattern
 * Returns cached data immediately, refreshes in background
 */
function staleWhileRevalidate(cacheKey_1, fetchFn_1) {
    return __awaiter(this, arguments, void 0, function (cacheKey, fetchFn, options) {
        var _a, ttl, cached, freshData;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = options.ttl, ttl = _a === void 0 ? types_1.CacheTTL.FiveMinutes : _a;
                    return [4 /*yield*/, cache_service_1.cacheService.get(cacheKey)];
                case 1:
                    cached = _b.sent();
                    if (cached) {
                        // Refresh in background (fire and forget)
                        fetchFn()
                            .then(function (freshData) {
                            cache_service_1.cacheService.set(cacheKey, freshData, ttl);
                            logger_1.logger.debug("Background refresh completed: ".concat(cacheKey));
                        })
                            .catch(function (error) {
                            logger_1.logger.warn("Background refresh failed: ".concat(cacheKey), error);
                        });
                        return [2 /*return*/, cached];
                    }
                    return [4 /*yield*/, fetchFn()];
                case 2:
                    freshData = _b.sent();
                    return [4 /*yield*/, cache_service_1.cacheService.set(cacheKey, freshData, ttl)];
                case 3:
                    _b.sent();
                    return [2 /*return*/, freshData];
            }
        });
    });
}
