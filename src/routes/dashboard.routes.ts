/**
 * Dashboard Routes
 * Admin dashboard API endpoints
 */

import { FastifyInstance } from 'fastify';
import { getDashboardStatsHandler, getRevenueChartHandler } from '../controllers/dashboard.controller';

export async function dashboardRoutes(fastify: FastifyInstance) {
    // Dashboard stats endpoint
    fastify.get('/api/admin/dashboard/stats', getDashboardStatsHandler);

    // Revenue chart endpoint
    fastify.get('/api/admin/dashboard/revenue-chart', getRevenueChartHandler);
}
