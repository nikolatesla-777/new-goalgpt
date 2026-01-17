/**
 * Metrics Controller
 * 
 * Handles performance and monitoring metrics API requests
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../utils/logger';
import { EventLatencyMonitor } from '../services/thesports/websocket/eventLatencyMonitor';
import { getActiveConnections, getWebSocketHealth } from '../routes/websocket.routes';

// Store references to monitoring services (set from server.ts)
let latencyMonitor: EventLatencyMonitor | null = null;

/**
 * Set latency monitor instance (called from server.ts)
 */
export function setLatencyMonitor(monitor: EventLatencyMonitor): void {
  latencyMonitor = monitor;
}

/**
 * GET /api/metrics/latency
 * Get event latency statistics
 */
export async function getLatencyMetrics(
  request: FastifyRequest<{ Querystring: { eventType?: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    if (!latencyMonitor) {
      return reply.code(503).send({
        error: 'Latency monitor not initialized',
      });
    }

    const { eventType } = request.query;
    const stats = latencyMonitor.getStats(eventType);

    reply.send({
      success: true,
      data: {
        stats,
        measurementsCount: latencyMonitor.getMeasurementsCount(),
        timestamp: Date.now(),
      },
    });
  } catch (error: any) {
    logger.error('[Metrics] Error getting latency metrics:', error);
    reply.code(500).send({
      error: 'Failed to get latency metrics',
      message: error.message,
    });
  }
}

/**
 * GET /api/metrics/websocket
 * Get WebSocket connection health metrics
 */
export async function getWebSocketMetrics(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const health = getWebSocketHealth();
    
    reply.send({
      success: true,
      data: health,
    });
  } catch (error: any) {
    logger.error('[Metrics] Error getting WebSocket metrics:', error);
    reply.code(500).send({
      error: 'Failed to get WebSocket metrics',
      message: error.message,
    });
  }
}


