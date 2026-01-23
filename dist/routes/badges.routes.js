"use strict";
/**
 * Badge Routes - Achievement and Badge Management
 *
 * 7 endpoints for badge system
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.badgesRoutes = badgesRoutes;
const badges_service_1 = require("../services/badges.service");
const auth_middleware_1 = require("../middleware/auth.middleware");
async function badgesRoutes(fastify) {
    /**
     * GET /api/badges
     * Get all active badges
     * Query params: category, rarity
     */
    fastify.get('/', async (request, reply) => {
        try {
            const { category, rarity } = request.query;
            const badges = await (0, badges_service_1.getAllBadges)(category, rarity);
            return reply.send({
                success: true,
                data: badges,
            });
        }
        catch (error) {
            fastify.log.error('Get all badges error:', error);
            return reply.status(500).send({
                success: false,
                error: 'FETCH_BADGES_FAILED',
                message: error.message || 'Failed to fetch badges',
            });
        }
    });
    /**
     * GET /api/badges/:slug
     * Get badge details by slug
     */
    fastify.get('/:slug', async (request, reply) => {
        try {
            const { slug } = request.params;
            const badge = await (0, badges_service_1.getBadgeBySlug)(slug);
            if (!badge) {
                return reply.status(404).send({
                    success: false,
                    error: 'BADGE_NOT_FOUND',
                    message: `Badge '${slug}' not found`,
                });
            }
            return reply.send({
                success: true,
                data: badge,
            });
        }
        catch (error) {
            fastify.log.error('Get badge error:', error);
            return reply.status(500).send({
                success: false,
                error: 'FETCH_BADGE_FAILED',
                message: error.message || 'Failed to fetch badge',
            });
        }
    });
    /**
     * GET /api/badges/user/me
     * Get current user's badges
     * Requires authentication
     */
    fastify.get('/user/me', { preHandler: auth_middleware_1.requireAuth }, async (request, reply) => {
        try {
            const userId = request.user.userId;
            const badges = await (0, badges_service_1.getUserBadges)(userId);
            return reply.send({
                success: true,
                data: badges,
            });
        }
        catch (error) {
            fastify.log.error('Get user badges error:', error);
            return reply.status(500).send({
                success: false,
                error: 'FETCH_USER_BADGES_FAILED',
                message: error.message || 'Failed to fetch user badges',
            });
        }
    });
    /**
     * POST /api/badges/unlock
     * Unlock badge for user (admin only)
     * Body: { userId, badgeSlug, metadata }
     */
    fastify.post('/unlock', { preHandler: auth_middleware_1.requireAdmin }, async (request, reply) => {
        try {
            const { userId, badgeSlug, metadata } = request.body;
            if (!userId || !badgeSlug) {
                return reply.status(400).send({
                    success: false,
                    error: 'INVALID_REQUEST',
                    message: 'userId and badgeSlug are required',
                });
            }
            const result = await (0, badges_service_1.unlockBadge)(userId, badgeSlug, metadata);
            if (result.alreadyUnlocked) {
                return reply.status(200).send({
                    success: true,
                    message: 'Badge already unlocked',
                    alreadyUnlocked: true,
                    badge: result.badge,
                });
            }
            return reply.send({
                success: true,
                message: `Badge '${badgeSlug}' unlocked successfully`,
                badge: result.badge,
            });
        }
        catch (error) {
            fastify.log.error('Unlock badge error:', error);
            return reply.status(500).send({
                success: false,
                error: 'UNLOCK_BADGE_FAILED',
                message: error.message || 'Failed to unlock badge',
            });
        }
    });
    /**
     * POST /api/badges/claim
     * Claim badge rewards (mark as claimed)
     * Body: { badgeId }
     * Requires authentication
     */
    fastify.post('/claim', { preHandler: auth_middleware_1.requireAuth }, async (request, reply) => {
        try {
            const userId = request.user.userId;
            const { badgeId } = request.body;
            if (!badgeId) {
                return reply.status(400).send({
                    success: false,
                    error: 'INVALID_REQUEST',
                    message: 'badgeId is required',
                });
            }
            const result = await (0, badges_service_1.claimBadge)(userId, badgeId);
            return reply.send({
                success: true,
                message: 'Badge rewards claimed successfully',
            });
        }
        catch (error) {
            fastify.log.error('Claim badge error:', error);
            return reply.status(500).send({
                success: false,
                error: 'CLAIM_BADGE_FAILED',
                message: error.message || 'Failed to claim badge',
            });
        }
    });
    /**
     * POST /api/badges/toggle-display
     * Display or hide badge on profile
     * Body: { badgeId, isDisplayed }
     * Requires authentication
     */
    fastify.post('/toggle-display', { preHandler: auth_middleware_1.requireAuth }, async (request, reply) => {
        try {
            const userId = request.user.userId;
            const { badgeId, isDisplayed } = request.body;
            if (!badgeId || typeof isDisplayed !== 'boolean') {
                return reply.status(400).send({
                    success: false,
                    error: 'INVALID_REQUEST',
                    message: 'badgeId and isDisplayed (boolean) are required',
                });
            }
            const result = await (0, badges_service_1.toggleBadgeDisplay)(userId, badgeId, isDisplayed);
            return reply.send({
                success: true,
                message: isDisplayed
                    ? 'Badge is now displayed on your profile'
                    : 'Badge is now hidden from your profile',
            });
        }
        catch (error) {
            fastify.log.error('Toggle badge display error:', error);
            return reply.status(500).send({
                success: false,
                error: 'TOGGLE_BADGE_FAILED',
                message: error.message || 'Failed to toggle badge display',
            });
        }
    });
    /**
     * GET /api/badges/stats
     * Get badge system statistics
     */
    fastify.get('/stats', async (request, reply) => {
        try {
            const stats = await (0, badges_service_1.getBadgeStats)();
            return reply.send({
                success: true,
                data: stats,
            });
        }
        catch (error) {
            fastify.log.error('Get badge stats error:', error);
            return reply.status(500).send({
                success: false,
                error: 'FETCH_STATS_FAILED',
                message: error.message || 'Failed to fetch badge statistics',
            });
        }
    });
    /**
     * GET /api/badges/leaderboard
     * Get top badge collectors
     * Query params: limit (default: 100)
     */
    fastify.get('/leaderboard', async (request, reply) => {
        try {
            const limit = Math.min(Number(request.query.limit) || 100, 500);
            const leaderboard = await (0, badges_service_1.getBadgeLeaderboard)(limit);
            return reply.send({
                success: true,
                data: leaderboard,
            });
        }
        catch (error) {
            fastify.log.error('Get badge leaderboard error:', error);
            return reply.status(500).send({
                success: false,
                error: 'FETCH_LEADERBOARD_FAILED',
                message: error.message || 'Failed to fetch badge leaderboard',
            });
        }
    });
}
