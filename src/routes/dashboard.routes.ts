/**
 * Dashboard Routes
 * Admin dashboard API endpoints
 *
 * SECURITY: All endpoints require admin authentication
 */

import { FastifyInstance, RouteShorthandOptions } from 'fastify';
import {
    getDashboardStatsHandler,
    getRevenueChartHandler,
    getTrendHandler,
    getDetailsHandler
} from '../controllers/dashboard.controller';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware';

// Middleware chain for admin-only access
const adminOnly: RouteShorthandOptions = { preHandler: [requireAuth, requireAdmin] };

export async function dashboardRoutes(fastify: FastifyInstance) {
    // Dashboard stats endpoint (main summary)
    fastify.get<{ Querystring: any }>('/api/admin/dashboard/stats', { preHandler: [requireAuth, requireAdmin] }, getDashboardStatsHandler);

    // Revenue chart endpoint (legacy)
    fastify.get<{ Querystring: any }>('/api/admin/dashboard/revenue-chart', { preHandler: [requireAuth, requireAdmin] }, getRevenueChartHandler);

    // Drill-down trend endpoints
    // GET /api/admin/dashboard/:type/trend?period=month
    // Types: revenue, subscribers, sales, billing-errors, signups, trials, cancellations, churn
    fastify.get<{ Params: any; Querystring: any }>('/api/admin/dashboard/:type/trend', { preHandler: [requireAuth, requireAdmin] }, getTrendHandler);

    // Drill-down details endpoints
    // GET /api/admin/dashboard/:type/details?period=month&limit=100
    // Types: revenue, subscribers, sales, billing-errors, signups, trials, cancellations, churn
    fastify.get<{ Params: any; Querystring: any }>('/api/admin/dashboard/:type/details', { preHandler: [requireAuth, requireAdmin] }, getDetailsHandler);
}
