"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthRoutes = healthRoutes;
const health_controller_1 = require("../controllers/health.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const internal_middleware_1 = require("../middleware/internal.middleware");
async function healthRoutes(fastify, options) {
    /**
     * GET /health
     * Simple health check - returns 200 if server process is up
     */
    fastify.get('/health', health_controller_1.getHealth);
    /**
     * GET /ready
     * Readiness check - returns 200 only if critical dependencies are OK
     */
    fastify.get('/ready', health_controller_1.getReady);
    /**
     * GET /health/detailed
     * Detailed health check with memory and worker stats
     * SECURITY: Internal only - exposes sensitive operational data
     */
    fastify.get('/health/detailed', { preHandler: internal_middleware_1.requireInternal }, health_controller_1.getHealthDetailed);
    /**
     * GET /sync/status
     * Check sync gap between API and database
     * SECURITY: Internal only - exposes operational metrics
     */
    fastify.get('/sync/status', { preHandler: internal_middleware_1.requireInternal }, health_controller_1.getSyncStatus);
    /**
     * POST /sync/force
     * Force sync live matches from API to database
     * SECURITY: Admin only - destructive operation
     */
    fastify.post('/sync/force', { preHandler: [auth_middleware_1.requireAuth, auth_middleware_1.requireAdmin] }, health_controller_1.forceSyncLiveMatches);
    /**
     * GET /cache/stats
     * Memory cache statistics and performance metrics
     * Phase 5: Added for cache monitoring
     * SECURITY: Internal only - exposes performance data
     */
    fastify.get('/cache/stats', { preHandler: internal_middleware_1.requireInternal }, health_controller_1.getCacheStats);
    /**
     * POST /cache/clear
     * Clear all memory caches (emergency only)
     * SECURITY: Admin only - destructive operation
     */
    fastify.post('/cache/clear', { preHandler: [auth_middleware_1.requireAuth, auth_middleware_1.requireAdmin] }, health_controller_1.clearCache);
    /**
     * GET /perf/dashboard
     * Phase 9: Comprehensive performance monitoring dashboard
     * Returns cache stats, job status, database stats, and data freshness
     * SECURITY: Internal only - exposes comprehensive operational data
     */
    fastify.get('/perf/dashboard', { preHandler: internal_middleware_1.requireInternal }, health_controller_1.getPerformanceDashboard);
}
