/**
 * Health Routes
 *
 * Fastify route definitions for health and readiness endpoints
 *
 * SECURITY:
 * - /health, /ready - PUBLIC (load balancer needs these)
 * - /sync/force, /cache/clear - ADMIN ONLY (destructive operations)
 * - /health/detailed, /sync/status, /cache/stats, /perf/dashboard - INTERNAL ONLY (monitoring)
 */

import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { getHealth, getReady, getHealthDetailed, getSyncStatus, forceSyncLiveMatches, getCacheStats, clearCache, getPerformanceDashboard } from '../controllers/health.controller';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware';
import { requireInternal } from '../middleware/internal.middleware';

export async function healthRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
) {
  /**
   * GET /health
   * Simple health check - returns 200 if server process is up
   */
  fastify.get('/health', getHealth);

  /**
   * GET /ready
   * Readiness check - returns 200 only if critical dependencies are OK
   */
  fastify.get('/ready', getReady);

  /**
   * GET /health/detailed
   * Detailed health check with memory and worker stats
   * SECURITY: Internal only - exposes sensitive operational data
   */
  fastify.get('/health/detailed', { preHandler: requireInternal }, getHealthDetailed);

  /**
   * GET /sync/status
   * Check sync gap between API and database
   * SECURITY: Internal only - exposes operational metrics
   */
  fastify.get('/sync/status', { preHandler: requireInternal }, getSyncStatus);

  /**
   * POST /sync/force
   * Force sync live matches from API to database
   * SECURITY: Admin only - destructive operation
   */
  fastify.post('/sync/force', { preHandler: [requireAuth, requireAdmin] }, forceSyncLiveMatches);

  /**
   * GET /cache/stats
   * Memory cache statistics and performance metrics
   * Phase 5: Added for cache monitoring
   * SECURITY: Internal only - exposes performance data
   */
  fastify.get('/cache/stats', { preHandler: requireInternal }, getCacheStats);

  /**
   * POST /cache/clear
   * Clear all memory caches (emergency only)
   * SECURITY: Admin only - destructive operation
   */
  fastify.post('/cache/clear', { preHandler: [requireAuth, requireAdmin] }, clearCache);

  /**
   * GET /perf/dashboard
   * Phase 9: Comprehensive performance monitoring dashboard
   * Returns cache stats, job status, database stats, and data freshness
   * SECURITY: Internal only - exposes comprehensive operational data
   */
  fastify.get('/perf/dashboard', { preHandler: requireInternal }, getPerformanceDashboard);
}






