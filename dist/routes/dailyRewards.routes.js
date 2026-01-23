"use strict";
/**
 * Daily Rewards Routes - Daily Gift Wheel API Endpoints
 *
 * 5 endpoints for daily rewards system
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.dailyRewardsRoutes = dailyRewardsRoutes;
const dailyRewards_service_1 = require("../services/dailyRewards.service");
const auth_middleware_1 = require("../middleware/auth.middleware");
async function dailyRewardsRoutes(fastify) {
    /**
     * GET /api/daily-rewards/status
     * Get daily reward status for current user
     * Requires authentication
     */
    fastify.get('/status', { preHandler: auth_middleware_1.requireAuth }, async (request, reply) => {
        try {
            const userId = request.user.userId;
            const status = await (0, dailyRewards_service_1.getDailyRewardStatus)(userId);
            return reply.send({
                success: true,
                data: status,
            });
        }
        catch (error) {
            fastify.log.error('Get daily reward status error:', error);
            return reply.status(500).send({
                success: false,
                error: 'GET_STATUS_FAILED',
                message: error.message || 'Failed to get daily reward status',
            });
        }
    });
    /**
     * POST /api/daily-rewards/claim
     * Claim today's daily reward
     * Requires authentication
     */
    fastify.post('/claim', { preHandler: auth_middleware_1.requireAuth }, async (request, reply) => {
        try {
            const userId = request.user.userId;
            const result = await (0, dailyRewards_service_1.claimDailyReward)(userId);
            return reply.send({
                success: true,
                message: result.message,
                data: result.reward,
            });
        }
        catch (error) {
            fastify.log.error('Claim daily reward error:', error);
            if (error.message === 'Daily reward already claimed today') {
                return reply.status(400).send({
                    success: false,
                    error: 'ALREADY_CLAIMED',
                    message: 'Bugün zaten ödül aldın',
                });
            }
            return reply.status(500).send({
                success: false,
                error: 'CLAIM_FAILED',
                message: error.message || 'Failed to claim daily reward',
            });
        }
    });
    /**
     * GET /api/daily-rewards/history
     * Get daily reward claim history
     * Query params: limit (default: 30)
     * Requires authentication
     */
    fastify.get('/history', { preHandler: auth_middleware_1.requireAuth }, async (request, reply) => {
        try {
            const userId = request.user.userId;
            const limit = Math.min(Number(request.query.limit) || 30, 100);
            const history = await (0, dailyRewards_service_1.getDailyRewardHistory)(userId, limit);
            return reply.send({
                success: true,
                data: history,
            });
        }
        catch (error) {
            fastify.log.error('Get daily reward history error:', error);
            return reply.status(500).send({
                success: false,
                error: 'GET_HISTORY_FAILED',
                message: error.message || 'Failed to get reward history',
            });
        }
    });
    /**
     * GET /api/daily-rewards/calendar
     * Get 7-day reward calendar
     * Public endpoint
     */
    fastify.get('/calendar', async (request, reply) => {
        try {
            const calendar = (0, dailyRewards_service_1.getDailyRewardCalendar)();
            return reply.send({
                success: true,
                data: calendar,
            });
        }
        catch (error) {
            fastify.log.error('Get reward calendar error:', error);
            return reply.status(500).send({
                success: false,
                error: 'GET_CALENDAR_FAILED',
                message: error.message || 'Failed to get reward calendar',
            });
        }
    });
    /**
     * GET /api/daily-rewards/stats
     * Get daily reward statistics (admin only)
     */
    fastify.get('/stats', { preHandler: auth_middleware_1.requireAdmin }, async (request, reply) => {
        try {
            const stats = await (0, dailyRewards_service_1.getDailyRewardStats)();
            return reply.send({
                success: true,
                data: stats,
            });
        }
        catch (error) {
            fastify.log.error('Get daily reward stats error:', error);
            return reply.status(500).send({
                success: false,
                error: 'GET_STATS_FAILED',
                message: error.message || 'Failed to get reward statistics',
            });
        }
    });
}
