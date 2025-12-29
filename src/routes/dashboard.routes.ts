/**
 * Dashboard Routes
 * Admin dashboard API endpoints
 */

import { FastifyInstance } from 'fastify';
import {
    getDashboardStatsHandler,
    getRevenueChartHandler,
    getTrendHandler,
    getDetailsHandler
} from '../controllers/dashboard.controller';
import {
    getMemberDetailHandler,
    getMemberActivityHandler
} from '../controllers/member.controller';

export async function dashboardRoutes(fastify: FastifyInstance) {
    // Dashboard stats endpoint (main summary)
    fastify.get('/api/admin/dashboard/stats', getDashboardStatsHandler);

    // Revenue chart endpoint (legacy)
    fastify.get('/api/admin/dashboard/revenue-chart', getRevenueChartHandler);

    // Drill-down trend endpoints
    // GET /api/admin/dashboard/:type/trend?period=month
    // Types: revenue, subscribers, sales, billing-errors, signups, trials, cancellations, churn
    fastify.get('/api/admin/dashboard/:type/trend', getTrendHandler);

    // Drill-down details endpoints
    // GET /api/admin/dashboard/:type/details?period=month&limit=100
    // Types: revenue, subscribers, sales, billing-errors, signups, trials, cancellations, churn
    fastify.get('/api/admin/dashboard/:type/details', getDetailsHandler);

    // Member detail endpoints
    fastify.get('/api/admin/member/:id', getMemberDetailHandler);
    fastify.get('/api/admin/member/:id/activity', getMemberActivityHandler);
}
