"use strict";
/**
 * Dashboard Routes
 * Admin dashboard API endpoints
 *
 * SECURITY: All endpoints require admin authentication
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardRoutes = dashboardRoutes;
const dashboard_controller_1 = require("../controllers/dashboard.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
// Middleware chain for admin-only access
const adminOnly = { preHandler: [auth_middleware_1.requireAuth, auth_middleware_1.requireAdmin] };
async function dashboardRoutes(fastify) {
    // Dashboard stats endpoint (main summary)
    fastify.get('/api/admin/dashboard/stats', adminOnly, dashboard_controller_1.getDashboardStatsHandler);
    // Revenue chart endpoint (legacy)
    fastify.get('/api/admin/dashboard/revenue-chart', adminOnly, dashboard_controller_1.getRevenueChartHandler);
    // Drill-down trend endpoints
    // GET /api/admin/dashboard/:type/trend?period=month
    // Types: revenue, subscribers, sales, billing-errors, signups, trials, cancellations, churn
    fastify.get('/api/admin/dashboard/:type/trend', adminOnly, dashboard_controller_1.getTrendHandler);
    // Drill-down details endpoints
    // GET /api/admin/dashboard/:type/details?period=month&limit=100
    // Types: revenue, subscribers, sales, billing-errors, signups, trials, cancellations, churn
    fastify.get('/api/admin/dashboard/:type/details', adminOnly, dashboard_controller_1.getDetailsHandler);
}
