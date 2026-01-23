"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.xpRoutes = xpRoutes;
const auth_middleware_1 = require("../middleware/auth.middleware");
const xp_service_1 = require("../services/xp.service");
const logger_1 = require("../utils/logger");
async function xpRoutes(fastify) {
    /**
     * GET /api/xp/me
     * Get current user's XP profile
     * Protected: Requires authentication
     */
    fastify.get('/me', { preHandler: auth_middleware_1.requireAuth }, async (request, reply) => {
        try {
            const userId = request.user.userId;
            const xpData = await (0, xp_service_1.getUserXP)(userId);
            if (!xpData) {
                return reply.status(404).send({
                    success: false,
                    error: 'USER_XP_NOT_FOUND',
                    message: 'User XP record not found',
                });
            }
            return reply.send({
                success: true,
                data: xpData,
            });
        }
        catch (error) {
            logger_1.logger.error('Error fetching user XP:', error);
            return reply.status(500).send({
                success: false,
                error: 'INTERNAL_ERROR',
                message: error.message,
            });
        }
    });
    /**
     * POST /api/xp/grant
     * Grant XP to a user (admin only)
     * Protected: Requires authentication + admin role
     */
    fastify.post('/grant', { preHandler: [auth_middleware_1.requireAuth, auth_middleware_1.requireAdmin] }, async (request, reply) => {
        try {
            const { userId, amount, transactionType, description, referenceId, referenceType, metadata } = request.body;
            const result = await (0, xp_service_1.grantXP)({
                userId,
                amount,
                transactionType,
                description,
                referenceId,
                referenceType,
                metadata,
            });
            return reply.send({
                success: true,
                data: result,
            });
        }
        catch (error) {
            logger_1.logger.error('Error granting XP:', error);
            return reply.status(500).send({
                success: false,
                error: 'GRANT_XP_FAILED',
                message: error.message,
            });
        }
    });
    /**
     * GET /api/xp/transactions
     * Get current user's XP transaction history
     * Protected: Requires authentication
     */
    fastify.get('/transactions', { preHandler: auth_middleware_1.requireAuth }, async (request, reply) => {
        try {
            const userId = request.user.userId;
            const limit = parseInt(request.query.limit || '50', 10);
            const offset = parseInt(request.query.offset || '0', 10);
            const transactions = await (0, xp_service_1.getXPTransactions)(userId, limit, offset);
            return reply.send({
                success: true,
                data: transactions,
                pagination: {
                    limit,
                    offset,
                    count: transactions.length,
                },
            });
        }
        catch (error) {
            logger_1.logger.error('Error fetching XP transactions:', error);
            return reply.status(500).send({
                success: false,
                error: 'FETCH_TRANSACTIONS_FAILED',
                message: error.message,
            });
        }
    });
    /**
     * POST /api/xp/login-streak
     * Update daily login streak for current user
     * Protected: Requires authentication
     */
    fastify.post('/login-streak', { preHandler: auth_middleware_1.requireAuth }, async (request, reply) => {
        try {
            const userId = request.user.userId;
            const streakResult = await (0, xp_service_1.updateLoginStreak)(userId);
            return reply.send({
                success: true,
                data: streakResult,
                message: streakResult.xpGranted > 0
                    ? `Günlük giriş bonusu kazandın! ${streakResult.xpGranted} XP`
                    : 'Bugün zaten giriş yaptın',
            });
        }
        catch (error) {
            logger_1.logger.error('Error updating login streak:', error);
            return reply.status(500).send({
                success: false,
                error: 'UPDATE_STREAK_FAILED',
                message: error.message,
            });
        }
    });
    /**
     * GET /api/xp/leaderboard
     * Get global XP leaderboard
     * Public: No authentication required
     */
    fastify.get('/leaderboard', async (request, reply) => {
        try {
            const limit = parseInt(request.query.limit || '100', 10);
            const leaderboard = await (0, xp_service_1.getXPLeaderboard)(limit);
            return reply.send({
                success: true,
                data: leaderboard,
            });
        }
        catch (error) {
            logger_1.logger.error('Error fetching XP leaderboard:', error);
            return reply.status(500).send({
                success: false,
                error: 'FETCH_LEADERBOARD_FAILED',
                message: error.message,
            });
        }
    });
}
