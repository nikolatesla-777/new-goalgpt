"use strict";
/**
 * Dashboard Controller
 * Handles dashboard API requests
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardStatsHandler = getDashboardStatsHandler;
exports.getRevenueChartHandler = getRevenueChartHandler;
exports.getTrendHandler = getTrendHandler;
exports.getDetailsHandler = getDetailsHandler;
const dashboard_service_1 = require("../services/dashboard.service");
const logger_1 = require("../utils/logger");
async function getDashboardStatsHandler(request, reply) {
    try {
        const period = request.query.period || 'month';
        const stats = await (0, dashboard_service_1.getDashboardStats)(period);
        return reply.send({
            success: true,
            data: stats,
            period,
        });
    }
    catch (error) {
        logger_1.logger.error('Dashboard stats error:', error);
        return reply.status(500).send({
            success: false,
            error: 'Failed to fetch dashboard stats',
            message: error.message,
        });
    }
}
async function getRevenueChartHandler(request, reply) {
    try {
        const period = request.query.period || 'month';
        const chartData = await (0, dashboard_service_1.getRevenueChart)(period);
        return reply.send({
            success: true,
            data: chartData,
            period,
        });
    }
    catch (error) {
        logger_1.logger.error('Revenue chart error:', error);
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
async function getTrendHandler(request, reply) {
    try {
        const { type } = request.params;
        const period = request.query.period || 'month';
        let trendData;
        switch (type) {
            case 'revenue':
                trendData = await (0, dashboard_service_1.getRevenueTrend)(period);
                break;
            case 'subscribers':
                trendData = await (0, dashboard_service_1.getSubscribersTrend)(period);
                break;
            case 'sales':
                trendData = await (0, dashboard_service_1.getSalesTrend)(period);
                break;
            case 'billing-errors':
                trendData = await (0, dashboard_service_1.getBillingErrorsTrend)(period);
                break;
            case 'signups':
                trendData = await (0, dashboard_service_1.getSignupsTrend)(period);
                break;
            case 'trials':
                trendData = await (0, dashboard_service_1.getTrialsTrend)(period);
                break;
            case 'cancellations':
                trendData = await (0, dashboard_service_1.getCancellationsTrend)(period);
                break;
            case 'churn':
                trendData = await (0, dashboard_service_1.getChurnTrend)(period);
                break;
            case 'first-purchase':
                trendData = await (0, dashboard_service_1.getFirstPurchaseTrend)(period);
                break;
            case 'conversion':
                trendData = await (0, dashboard_service_1.getConversionTrend)(period);
                break;
            case 'total-members':
                trendData = await (0, dashboard_service_1.getTotalMembersTrend)(period);
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
    }
    catch (error) {
        logger_1.logger.error('Trend data error:', error);
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
async function getDetailsHandler(request, reply) {
    try {
        const { type } = request.params;
        const period = request.query.period || 'month';
        const limit = parseInt(request.query.limit || '100');
        let detailsData;
        switch (type) {
            case 'revenue':
                detailsData = await (0, dashboard_service_1.getRevenueDetails)(period, limit);
                break;
            case 'subscribers':
                detailsData = await (0, dashboard_service_1.getActiveSubscribersDetails)(period, limit);
                break;
            case 'sales':
                detailsData = await (0, dashboard_service_1.getRevenueDetails)(period, limit); // Same as revenue for now
                break;
            case 'billing-errors':
                detailsData = await (0, dashboard_service_1.getBillingErrorsDetails)(period, limit);
                break;
            case 'signups':
                detailsData = await (0, dashboard_service_1.getSignupsDetails)(period, limit);
                break;
            case 'trials':
                detailsData = await (0, dashboard_service_1.getTrialsDetails)(period, limit);
                break;
            case 'cancellations':
                detailsData = await (0, dashboard_service_1.getCancellationsDetails)(period, limit);
                break;
            case 'churn':
                detailsData = await (0, dashboard_service_1.getChurnDetails)(period, limit);
                break;
            case 'first-purchase':
                detailsData = await (0, dashboard_service_1.getFirstPurchaseDetails)(period, limit);
                break;
            case 'conversion':
                detailsData = await (0, dashboard_service_1.getConversionDetails)(period, limit);
                break;
            case 'total-members':
                detailsData = await (0, dashboard_service_1.getTotalMembersDetails)(period, limit);
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
    }
    catch (error) {
        logger_1.logger.error('Details data error:', error);
        return reply.status(500).send({
            success: false,
            error: 'Failed to fetch details data',
            message: error.message,
        });
    }
}
