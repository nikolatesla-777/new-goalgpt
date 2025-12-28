/**
 * Dashboard Controller
 * Handles dashboard API requests
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { getDashboardStats, getRevenueChart, PeriodFilter } from '../services/dashboard.service';
import { logger } from '../utils/logger';

interface DashboardQuerystring {
    period?: PeriodFilter;
}

export async function getDashboardStatsHandler(
    request: FastifyRequest<{ Querystring: DashboardQuerystring }>,
    reply: FastifyReply
) {
    try {
        const period = request.query.period || 'month';
        const stats = await getDashboardStats(period);

        return reply.send({
            success: true,
            data: stats,
            period,
        });
    } catch (error: any) {
        logger.error('Dashboard stats error:', error);
        return reply.status(500).send({
            success: false,
            error: 'Failed to fetch dashboard stats',
            message: error.message,
        });
    }
}

export async function getRevenueChartHandler(
    request: FastifyRequest<{ Querystring: DashboardQuerystring }>,
    reply: FastifyReply
) {
    try {
        const period = request.query.period || 'month';
        const chartData = await getRevenueChart(period);

        return reply.send({
            success: true,
            data: chartData,
            period,
        });
    } catch (error: any) {
        logger.error('Revenue chart error:', error);
        return reply.status(500).send({
            success: false,
            error: 'Failed to fetch revenue chart',
            message: error.message,
        });
    }
}
