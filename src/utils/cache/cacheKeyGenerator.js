"use strict";
/**
 * Cache Key Generator Utilities
 *
 * Provides collision-resistant, deterministic cache key generation.
 * Used across the application for consistent cache key creation.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePredictionsCacheKey = generatePredictionsCacheKey;
exports.generateCacheKey = generateCacheKey;
exports.parseCacheKey = parseCacheKey;
var crypto = __importStar(require("crypto"));
/**
 * Generate deterministic cache key from query params
 *
 * Features:
 * - Order-independent: Sorts keys before hashing
 * - Excludes volatile params: Skips null/undefined values
 * - Collision-resistant: MD5 hash of normalized params
 * - Future-proof: New params automatically included
 *
 * @param queryParams - Object containing query parameters
 * @returns Cache key in format: "prefix:hash"
 *
 * @example
 * generatePredictionsCacheKey({ userId: '123', limit: 50 })
 * // → "matched:a1b2c3d4e5f6"
 *
 * generatePredictionsCacheKey({ limit: 50, userId: '123' })
 * // → "matched:a1b2c3d4e5f6" (same key, different order)
 */
function generatePredictionsCacheKey(queryParams) {
    // Sort keys to ensure deterministic hash
    var sortedKeys = Object.keys(queryParams).sort();
    var normalized = {};
    for (var _i = 0, sortedKeys_1 = sortedKeys; _i < sortedKeys_1.length; _i++) {
        var key = sortedKeys_1[_i];
        var value = queryParams[key];
        // Skip undefined/null values (volatile params)
        if (value !== undefined && value !== null) {
            normalized[key] = value;
        }
    }
    var paramsString = JSON.stringify(normalized);
    var hash = crypto.createHash('md5').update(paramsString).digest('hex').substring(0, 12);
    return "matched:".concat(hash);
}
/**
 * Generate cache key for generic resources
 *
 * @param prefix - Cache key prefix (e.g., 'match', 'team')
 * @param params - Parameters to hash
 * @returns Cache key in format: "prefix:hash"
 */
function generateCacheKey(prefix, params) {
    var sortedKeys = Object.keys(params).sort();
    var normalized = {};
    for (var _i = 0, sortedKeys_2 = sortedKeys; _i < sortedKeys_2.length; _i++) {
        var key = sortedKeys_2[_i];
        var value = params[key];
        if (value !== undefined && value !== null) {
            normalized[key] = value;
        }
    }
    var paramsString = JSON.stringify(normalized);
    var hash = crypto.createHash('md5').update(paramsString).digest('hex').substring(0, 12);
    return "".concat(prefix, ":").concat(hash);
}
/**
 * Extract params from cache key (for debugging)
 *
 * Note: This is a one-way hash, so params cannot be recovered.
 * This function is for logging/debugging purposes only.
 *
 * @param cacheKey - Cache key in format "prefix:hash"
 * @returns Object with prefix and hash
 */
function parseCacheKey(cacheKey) {
    var parts = cacheKey.split(':');
    return {
        prefix: parts[0],
        hash: parts[1] || '',
    };
}
