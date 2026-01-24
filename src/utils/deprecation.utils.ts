/**
 * Deprecation Utilities
 *
 * PR-11: Controlled deprecation for duplicate/legacy routes
 * Provides deprecation headers and rate-limited logging
 */

import { FastifyReply } from 'fastify';
import { logger } from './logger';

/**
 * Deprecation configuration for a route
 */
export interface DeprecationConfig {
  /** Canonical replacement endpoint */
  canonical: string;

  /** Sunset date (ISO 8601 format) */
  sunset: string;

  /** Documentation URL for migration guide */
  docs?: string;

  /** Custom deprecation message */
  message?: string;
}

/**
 * Rate-limited deprecation log cache
 * Key format: "route:clientIp"
 * Value: Last log timestamp
 */
const deprecationLogCache = new Map<string, number>();

/**
 * Rate limit for deprecation logs (milliseconds)
 * Default: 60 seconds (same route + IP combo logs max once per minute)
 */
const LOG_RATE_LIMIT_MS = 60000;

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
export function addDeprecationHeaders(
  reply: FastifyReply,
  config: DeprecationConfig
): void {
  // Standard RFC 8594 Deprecation header
  reply.header('Deprecation', 'true');

  // Standard RFC 8594 Sunset header (when endpoint will be removed)
  reply.header('Sunset', config.sunset);

  // Standard RFC 8288 Link header (points to replacement)
  reply.header('Link', `<${config.canonical}>; rel="alternate"`);

  // Custom message header (easier for clients to parse)
  const message = config.message
    || `This endpoint is deprecated. Use ${config.canonical} instead.`;
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
export function logDeprecation(
  routePath: string,
  clientIp: string,
  canonical: string
): void {
  const cacheKey = `${routePath}:${clientIp}`;
  const lastLog = deprecationLogCache.get(cacheKey) || 0;
  const now = Date.now();

  // Check rate limit
  if (now - lastLog > LOG_RATE_LIMIT_MS) {
    logger.info(`[Deprecation] Legacy route accessed`, {
      route: routePath,
      canonical,
      clientIp,
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
export function getClientIp(request: any): string {
  return (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || (request.headers['x-real-ip'] as string)
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
export function deprecateRoute(
  request: any,
  reply: FastifyReply,
  config: DeprecationConfig
): void {
  // Add deprecation headers
  addDeprecationHeaders(reply, config);

  // Log deprecation access (rate-limited)
  const clientIp = getClientIp(request);
  const routePath = request.routeOptions?.url || request.url;
  logDeprecation(routePath, clientIp, config.canonical);
}

/**
 * Clear deprecation log cache (for testing)
 */
export function clearDeprecationLogCache(): void {
  deprecationLogCache.clear();
}

/**
 * Get deprecation log cache size (for monitoring)
 */
export function getDeprecationLogCacheSize(): number {
  return deprecationLogCache.size;
}
