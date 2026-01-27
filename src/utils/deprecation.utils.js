"use strict";
/**
 * Deprecation Utilities
 *
 * PR-11: Controlled deprecation for duplicate/legacy routes
 * Provides deprecation headers and rate-limited logging
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.addDeprecationHeaders = addDeprecationHeaders;
exports.logDeprecation = logDeprecation;
exports.getClientIp = getClientIp;
exports.deprecateRoute = deprecateRoute;
exports.clearDeprecationLogCache = clearDeprecationLogCache;
exports.getDeprecationLogCacheSize = getDeprecationLogCacheSize;
var logger_1 = require("./logger");
/**
 * Rate-limited deprecation log cache
 * Key format: "route:clientIp"
 * Value: Last log timestamp
 */
var deprecationLogCache = new Map();
/**
 * Rate limit for deprecation logs (milliseconds)
 * Default: 60 seconds (same route + IP combo logs max once per minute)
 */
var LOG_RATE_LIMIT_MS = 60000;
/**
 * Add deprecation headers to response
 *
 * Headers added:
 * - Deprecation: true (standard RFC 8594)
 * - Sunset: <ISO date> (standard RFC 8594)
 * - Link: <canonical-url>; rel="alternate" (standard RFC 8288)
 * - X-Deprecation-Message: Custom message
 *
 * @param reply - Fastify reply object
 * @param config - Deprecation configuration
 */
function addDeprecationHeaders(reply, config) {
    // Standard RFC 8594 Deprecation header
    reply.header('Deprecation', 'true');
    // Standard RFC 8594 Sunset header (when endpoint will be removed)
    reply.header('Sunset', config.sunset);
    // Standard RFC 8288 Link header (points to replacement)
    reply.header('Link', "<".concat(config.canonical, ">; rel=\"alternate\""));
    // Custom message header (easier for clients to parse)
    var message = config.message
        || "This endpoint is deprecated. Use ".concat(config.canonical, " instead.");
    reply.header('X-Deprecation-Message', message);
    // Optional: Documentation link
    if (config.docs) {
        reply.header('X-Deprecation-Docs', config.docs);
    }
}
/**
 * Log deprecation access (rate-limited)
 *
 * Logs at INFO level (not WARNING) to avoid alert noise.
 * Rate-limited per route+IP combination to prevent log flooding.
 *
 * @param routePath - Route that was accessed
 * @param clientIp - Client IP address
 * @param canonical - Canonical replacement route
 */
function logDeprecation(routePath, clientIp, canonical) {
    var cacheKey = "".concat(routePath, ":").concat(clientIp);
    var lastLog = deprecationLogCache.get(cacheKey) || 0;
    var now = Date.now();
    // Check rate limit
    if (now - lastLog > LOG_RATE_LIMIT_MS) {
        logger_1.logger.info("[Deprecation] Legacy route accessed", {
            route: routePath,
            canonical: canonical,
            clientIp: clientIp,
            timestamp: new Date().toISOString(),
            rateLimit: 'once per 60s per IP'
        });
        deprecationLogCache.set(cacheKey, now);
    }
}
/**
 * Get client IP from Fastify request
 * Handles proxies (x-forwarded-for, x-real-ip)
 *
 * @param request - Fastify request object
 * @returns Client IP address
 */
function getClientIp(request) {
    var _a, _b;
    return ((_b = (_a = request.headers['x-forwarded-for']) === null || _a === void 0 ? void 0 : _a.split(',')[0]) === null || _b === void 0 ? void 0 : _b.trim())
        || request.headers['x-real-ip']
        || request.ip
        || 'unknown';
}
/**
 * Combined helper: Add headers + log deprecation
 *
 * Use this in legacy route handlers for one-line deprecation setup.
 *
 * @example
 * ```typescript
 * fastify.post('/api/v1/legacy/endpoint', async (request, reply) => {
 *   deprecateRoute(request, reply, {
 *     canonical: '/api/v2/new/endpoint',
 *     sunset: '2026-03-01T00:00:00Z',
 *     docs: 'https://docs.example.com/migration'
 *   });
 *
 *   // ... rest of handler
 * });
 * ```
 */
function deprecateRoute(request, reply, config) {
    var _a;
    // Add deprecation headers
    addDeprecationHeaders(reply, config);
    // Log deprecation access (rate-limited)
    var clientIp = getClientIp(request);
    var routePath = ((_a = request.routeOptions) === null || _a === void 0 ? void 0 : _a.url) || request.url;
    logDeprecation(routePath, clientIp, config.canonical);
}
/**
 * Clear deprecation log cache (for testing)
 */
function clearDeprecationLogCache() {
    deprecationLogCache.clear();
}
/**
 * Get deprecation log cache size (for monitoring)
 */
function getDeprecationLogCacheSize() {
    return deprecationLogCache.size;
}
