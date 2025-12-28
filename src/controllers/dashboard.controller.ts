/**
 * Dashboard Controller
 * Handles dashboard API requests
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import {
    getDashboardStats,
    getRevenueChart,
    getRevenueTrend,
    getSubscribersTrend,
    getSalesTrend,
    getBillingErrorsTrend,
    getSignupsTrend,
    getTrialsTrend,
    getCancellationsTrend,
    getChurnTrend,
    getRevenueDetails,
    getActiveSubscribersDetails,
    getSignupsDetails,
    getTrialsDetails,
    getCancellationsDetails,
    getChurnDetails,
    getBillingErrorsDetails,
    PeriodFilter
} from '../services/dashboard.service';
import { logger } from '../utils/logger';

interface DashboardQuerystring {
    period?: PeriodFilter;
    limit?: string;
}

interface DrilldownParams {
    type: string;
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

// ==========================================
// DRILL-DOWN TREND HANDLERS
// ==========================================

export async function getTrendHandler(
    request: FastifyRequest<{ Params: DrilldownParams; Querystring: DashboardQuerystring }>,
    reply: FastifyReply
) {
    try {
        const { type } = request.params;
        const period = request.query.period || 'month';

        let trendData;
        switch (type) {
            case 'revenue':
                trendData = await getRevenueTrend(period);
                break;
            case 'subscribers':
                trendData = await getSubscribersTrend(period);
                break;
            case 'sales':
                trendData = await getSalesTrend(period);
                break;
            case 'billing-errors':
                trendData = await getBillingErrorsTrend(period);
                break;
            case 'signups':
                trendData = await getSignupsTrend(period);
                break;
            case 'trials':
                trendData = await getTrialsTrend(period);
                break;
            case 'cancellations':
                trendData = await getCancellationsTrend(period);
                break;
            case 'churn':
                trendData = await getChurnTrend(period);
                break;
            default:
                return reply.status(400).send({
                    success: false,
                    error: `Unknown trend type: ${type}`,
                });
        }

        return reply.send({
            success: true,
            data: trendData,
            period,
            type,
        });
    } catch (error: any) {
        logger.error('Trend data error:', error);
        return reply.status(500).send({
            success: false,
            error: 'Failed to fetch trend data',
            message: error.message,
        });
    }
}

// ==========================================
// DRILL-DOWN DETAILS HANDLERS
// ==========================================

export async function getDetailsHandler(
    request: FastifyRequest<{ Params: DrilldownParams; Querystring: DashboardQuerystring }>,
    reply: FastifyReply
) {
    try {
        const { type } = request.params;
        const period = request.query.period || 'month';
        const limit = parseInt(request.query.limit || '100');

        let detailsData;
        switch (type) {
            case 'revenue':
                detailsData = await getRevenueDetails(period, limit);
                break;
            case 'subscribers':
                detailsData = await getActiveSubscribersDetails(period, limit);
                break;
            case 'sales':
                detailsData = await getRevenueDetails(period, limit); // Same as revenue for now
                break;
            case 'billing-errors':
                detailsData = await getBillingErrorsDetails(period, limit);
                break;
            case 'signups':
                detailsData = await getSignupsDetails(period, limit);
                break;
            case 'trials':
                detailsData = await getTrialsDetails(period, limit);
                break;
            case 'cancellations':
                detailsData = await getCancellationsDetails(period, limit);
                break;
            case 'churn':
                detailsData = await getChurnDetails(period, limit);
                break;
            default:
                return reply.status(400).send({
                    success: false,
                    error: `Unknown details type: ${type}`,
                });
        }

        return reply.send({
            success: true,
            data: detailsData,
            total: detailsData.length,
            period,
            type,
        });
    } catch (error: any) {
        logger.error('Details data error:', error);
        return reply.status(500).send({
            success: false,
            error: 'Failed to fetch details data',
            message: error.message,
        });
    }
}
