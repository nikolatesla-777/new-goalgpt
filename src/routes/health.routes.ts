/**
 * Health Routes
 * 
 * Fastify route definitions for health and readiness endpoints
 */

import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { getHealth, getReady, getHealthDetailed, getSyncStatus, forceSyncLiveMatches } from '../controllers/health.controller';

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
}






