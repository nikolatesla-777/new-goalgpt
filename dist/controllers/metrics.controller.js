"use strict";
/**
 * Metrics Controller
 *
 * Handles performance and monitoring metrics API requests
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.setLatencyMonitor = setLatencyMonitor;
exports.getLatencyMetrics = getLatencyMetrics;
exports.getWebSocketMetrics = getWebSocketMetrics;
const logger_1 = require("../utils/logger");
const websocket_routes_1 = require("../routes/websocket.routes");
// Store references to monitoring services (set from server.ts)
let latencyMonitor = null;
/**
 * Set latency monitor instance (called from server.ts)
 */
function setLatencyMonitor(monitor) {
    latencyMonitor = monitor;
}
/**
 * GET /api/metrics/latency
 * Get event latency statistics
 */
async function getLatencyMetrics(request, reply) {
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
    }
    catch (error) {
        logger_1.logger.error('[Metrics] Error getting latency metrics:', error);
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
async function getWebSocketMetrics(request, reply) {
    try {
        const health = (0, websocket_routes_1.getWebSocketHealth)();
        reply.send({
            success: true,
            data: health,
        });
    }
    catch (error) {
        logger_1.logger.error('[Metrics] Error getting WebSocket metrics:', error);
        reply.code(500).send({
            error: 'Failed to get WebSocket metrics',
            message: error.message,
        });
    }
}
