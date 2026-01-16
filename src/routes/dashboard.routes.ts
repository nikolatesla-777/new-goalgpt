/**
 * Dashboard Routes
 * Admin dashboard API endpoints
 *
 * SECURITY: All endpoints require admin authentication
 */

import { FastifyInstance } from 'fastify';
import {
    getDashboardStatsHandler,
    getRevenueChartHandler,
    getTrendHandler,
    getDetailsHandler
} from '../controllers/dashboard.controller';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware';

// Middleware chain for admin-only access
const adminOnly = { preHandler: [requireAuth, requireAdmin] };

export async function dashboardRoutes(fastify: FastifyInstance) {
    // Dashboard stats endpoint (main summary)
    fastify.get('/api/admin/dashboard/stats', adminOnly, getDashboardStatsHandler);

    // Revenue chart endpoint (legacy)
    fastify.get('/api/admin/dashboard/revenue-chart', adminOnly, getRevenueChartHandler);

    // Drill-down trend endpoints
    // GET /api/admin/dashboard/:type/trend?period=month
    // Types: revenue, subscribers, sales, billing-errors, signups, trials, cancellations, churn
    fastify.get('/api/admin/dashboard/:type/trend', adminOnly, getTrendHandler);

    // Drill-down details endpoints
    // GET /api/admin/dashboard/:type/details?period=month&limit=100
    // Types: revenue, subscribers, sales, billing-errors, signups, trials, cancellations, churn
    fastify.get('/api/admin/dashboard/:type/details', adminOnly, getDetailsHandler);
}
