/**
 * Health Routes
 * 
 * Fastify route definitions for health and readiness endpoints
 */

import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { getHealth, getReady, getHealthDetailed, getSyncStatus, forceSyncLiveMatches, getCacheStats, clearCache, getPerformanceDashboard } from '../controllers/health.controller';

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
   */
  fastify.get('/health/detailed', getHealthDetailed);

  /**
   * GET /sync/status
   * Check sync gap between API and database
   */
  fastify.get('/sync/status', getSyncStatus);

  /**
   * POST /sync/force
   * Force sync live matches from API to database
   */
  fastify.post('/sync/force', forceSyncLiveMatches);

  /**
   * GET /cache/stats
   * Memory cache statistics and performance metrics
   * Phase 5: Added for cache monitoring
   */
  fastify.get('/cache/stats', getCacheStats);

  /**
   * POST /cache/clear
   * Clear all memory caches (emergency only)
   */
  fastify.post('/cache/clear', clearCache);

  /**
   * GET /perf/dashboard
   * Phase 9: Comprehensive performance monitoring dashboard
   * Returns cache stats, job status, database stats, and data freshness
   */
  fastify.get('/perf/dashboard', getPerformanceDashboard);
}






