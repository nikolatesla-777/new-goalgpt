/**
 * Health Routes
 * 
 * Fastify route definitions for health and readiness endpoints
 */

import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { getHealth, getReady } from '../controllers/health.controller';

export default async function healthRoutes(
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
}




