/**
 * Metrics Routes
 * 
 * Performance and monitoring metrics API endpoints
 */

import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import {
  getLatencyMetrics,
  getWebSocketMetrics,
} from '../controllers/metrics.controller';

export default async function metricsRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
) {
  /**
   * GET /api/metrics/latency
   * Get event latency statistics
   * Query params: eventType (optional) - filter by event type
   */
  fastify.get('/latency', getLatencyMetrics);

  /**
   * GET /api/metrics/websocket
   * Get WebSocket connection health metrics
   */
  fastify.get('/websocket', getWebSocketMetrics);
}


