"use strict";
/**
 * Metrics Routes
 *
 * Performance and monitoring metrics API endpoints
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = metricsRoutes;
const metrics_controller_1 = require("../controllers/metrics.controller");
async function metricsRoutes(fastify, options) {
    /**
     * GET /api/metrics/latency
     * Get event latency statistics
     * Query params: eventType (optional) - filter by event type
     */
    fastify.get('/latency', metrics_controller_1.getLatencyMetrics);
    /**
     * GET /api/metrics/websocket
     * Get WebSocket connection health metrics
     */
    fastify.get('/websocket', metrics_controller_1.getWebSocketMetrics);
}
