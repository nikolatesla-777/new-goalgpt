"use strict";
/**
 * Referral Routes - Referral Program API Endpoints
 *
 * 8 endpoints for referral system
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.referralsRoutes = referralsRoutes;
const referrals_service_1 = require("../services/referrals.service");
const auth_middleware_1 = require("../middleware/auth.middleware");
async function referralsRoutes(fastify) {
    /**
     * GET /api/referrals/me/code
     * Get user's referral code (create if doesn't exist)
     * Requires authentication
     */
    fastify.get('/me/code', { preHandler: auth_middleware_1.requireAuth }, async (request, reply) => {
        try {
            const userId = request.user.userId;
            const referralCode = await (0, referrals_service_1.getUserReferralCode)(userId);
            return reply.send({
                success: true,
                data: {
                    referralCode,
                    shareUrl: `https://goalgpt.app/signup?ref=${referralCode}`,
                    shareMessage: `GoalGPT'ye katıl ve ${referralCode} kodumu kullan! 🎉`,
                },
            });
        }
        catch (error) {
            fastify.log.error('Get referral code error:', error);
            return reply.status(500).send({
                success: false,
                error: 'GET_REFERRAL_CODE_FAILED',
                message: error.message || 'Failed to get referral code',
            });
        }
    });
    /**
     * POST /api/referrals/apply
     * Apply referral code during signup (Tier 1)
     * Requires authentication (for new user)
     * Body: { referralCode: string }
     */
    fastify.post('/apply', { preHandler: auth_middleware_1.requireAuth }, async (request, reply) => {
        try {
            const userId = request.user.userId;
            const { referralCode } = request.body;
            if (!referralCode) {
                return reply.status(400).send({
                    success: false,
                    error: 'INVALID_REQUEST',
                    message: 'referralCode is required',
                });
            }
            const result = await (0, referrals_service_1.applyReferralCode)(userId, referralCode.toUpperCase());
            return reply.send({
                success: true,
                message: 'Referral code applied successfully',
                data: result.referral,
            });
        }
        catch (error) {
            fastify.log.error('Apply referral code error:', error);
            // Handle specific errors
            if (error.message === 'Invalid referral code') {
                return reply.status(400).send({
                    success: false,
                    error: 'INVALID_REFERRAL_CODE',
                    message: 'Geçersiz referral kodu',
                });
            }
            if (error.message === 'Cannot refer yourself') {
                return reply.status(400).send({
                    success: false,
                    error: 'SELF_REFERRAL',
                    message: 'Kendi kodunu kullanamazsın',
                });
            }
            if (error.message === 'User already has a referral') {
                return reply.status(400).send({
                    success: false,
                    error: 'ALREADY_REFERRED',
                    message: 'Zaten bir referral kodun var',
                });
            }
            return reply.status(500).send({
                success: false,
                error: 'APPLY_REFERRAL_FAILED',
                message: error.message || 'Failed to apply referral code',
            });
        }
    });
    /**
     * GET /api/referrals/me/stats
     * Get user's referral statistics
     * Requires authentication
     */
    fastify.get('/me/stats', { preHandler: auth_middleware_1.requireAuth }, async (request, reply) => {
        try {
            const userId = request.user.userId;
            const stats = await (0, referrals_service_1.getReferralStats)(userId);
            return reply.send({
                success: true,
                data: stats,
            });
        }
        catch (error) {
            fastify.log.error('Get referral stats error:', error);
            return reply.status(500).send({
                success: false,
                error: 'GET_STATS_FAILED',
                message: error.message || 'Failed to get referral statistics',
            });
        }
    });
    /**
     * GET /api/referrals/me/referrals
     * Get user's referral list
     * Query params: limit (default: 50), offset (default: 0)
     * Requires authentication
     */
    fastify.get('/me/referrals', { preHandler: auth_middleware_1.requireAuth }, async (request, reply) => {
        try {
            const userId = request.user.userId;
            const limit = Math.min(Number(request.query.limit) || 50, 100);
            const offset = Number(request.query.offset) || 0;
            const referrals = await (0, referrals_service_1.getUserReferrals)(userId, limit, offset);
            return reply.send({
                success: true,
                data: referrals,
                pagination: {
                    limit,
                    offset,
                    total: referrals.length,
                },
            });
        }
        catch (error) {
            fastify.log.error('Get referrals error:', error);
            return reply.status(500).send({
                success: false,
                error: 'GET_REFERRALS_FAILED',
                message: error.message || 'Failed to get referrals',
            });
        }
    });
    /**
     * GET /api/referrals/leaderboard
     * Get referral leaderboard (top referrers)
     * Query params: limit (default: 100, max: 500)
     */
    fastify.get('/leaderboard', async (request, reply) => {
        try {
            const limit = Math.min(Number(request.query.limit) || 100, 500);
            const leaderboard = await (0, referrals_service_1.getReferralLeaderboard)(limit);
            return reply.send({
                success: true,
                data: leaderboard,
            });
        }
        catch (error) {
            fastify.log.error('Get referral leaderboard error:', error);
            return reply.status(500).send({
                success: false,
                error: 'GET_LEADERBOARD_FAILED',
                message: error.message || 'Failed to get referral leaderboard',
            });
        }
    });
    /**
     * POST /api/referrals/validate
     * Validate referral code
     * Body: { code: string }
     * Public endpoint (no auth required)
     */
    fastify.post('/validate', async (request, reply) => {
        try {
            const { code } = request.body;
            if (!code) {
                return reply.status(400).send({
                    success: false,
                    error: 'INVALID_REQUEST',
                    message: 'code is required',
                });
            }
            const result = await (0, referrals_service_1.validateReferralCode)(code.toUpperCase());
            return reply.send({
                success: true,
                data: {
                    valid: result.valid,
                    message: result.valid ? 'Geçerli referral kodu' : 'Geçersiz referral kodu',
                },
            });
        }
        catch (error) {
            fastify.log.error('Validate referral code error:', error);
            return reply.status(500).send({
                success: false,
                error: 'VALIDATE_CODE_FAILED',
                message: error.message || 'Failed to validate referral code',
            });
        }
    });
    /**
     * POST /api/referrals/tier2/:userId
     * Process Tier 2 reward (first login)
     * Admin only - manual trigger
     */
    fastify.post('/tier2/:userId', { preHandler: auth_middleware_1.requireAdmin }, async (request, reply) => {
        try {
            const { userId } = request.params;
            const success = await (0, referrals_service_1.processReferralTier2)(userId);
            if (!success) {
                return reply.status(404).send({
                    success: false,
                    error: 'NO_REFERRAL_FOUND',
                    message: 'No active Tier 1 referral found for this user',
                });
            }
            return reply.send({
                success: true,
                message: 'Tier 2 reward processed successfully',
            });
        }
        catch (error) {
            fastify.log.error('Process Tier 2 error:', error);
            return reply.status(500).send({
                success: false,
                error: 'PROCESS_TIER2_FAILED',
                message: error.message || 'Failed to process Tier 2 reward',
            });
        }
    });
    /**
     * POST /api/referrals/tier3/:userId
     * Process Tier 3 reward (subscription purchase)
     * Admin only - manual trigger
     */
    fastify.post('/tier3/:userId', { preHandler: auth_middleware_1.requireAdmin }, async (request, reply) => {
        try {
            const { userId } = request.params;
            const success = await (0, referrals_service_1.processReferralTier3)(userId);
            if (!success) {
                return reply.status(404).send({
                    success: false,
                    error: 'NO_REFERRAL_FOUND',
                    message: 'No active Tier 2 referral found for this user',
                });
            }
            return reply.send({
                success: true,
                message: 'Tier 3 reward processed successfully',
            });
        }
        catch (error) {
            fastify.log.error('Process Tier 3 error:', error);
            return reply.status(500).send({
                success: false,
                error: 'PROCESS_TIER3_FAILED',
                message: error.message || 'Failed to process Tier 3 reward',
            });
        }
    });
}
