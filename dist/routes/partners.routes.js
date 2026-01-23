"use strict";
/**
 * Partner Routes - Partner/Bayi Program API Endpoints
 *
 * 11 endpoints for partner management
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.partnersRoutes = partnersRoutes;
const partners_service_1 = require("../services/partners.service");
const auth_middleware_1 = require("../middleware/auth.middleware");
async function partnersRoutes(fastify) {
    /**
     * POST /api/partners/apply
     * Apply for partnership program
     * Requires authentication
     * Body: { businessName, taxId?, phone, email, address?, notes? }
     */
    fastify.post('/apply', { preHandler: auth_middleware_1.requireAuth }, async (request, reply) => {
        try {
            const userId = request.user.userId;
            const { businessName, taxId, phone, email, address, notes } = request.body;
            if (!businessName || !phone || !email) {
                return reply.status(400).send({
                    success: false,
                    error: 'INVALID_REQUEST',
                    message: 'businessName, phone, and email are required',
                });
            }
            const partner = await (0, partners_service_1.applyForPartnership)({
                userId,
                businessName,
                taxId,
                phone,
                email,
                address,
                notes,
            });
            return reply.send({
                success: true,
                message: 'Partnership application submitted successfully',
                data: partner,
            });
        }
        catch (error) {
            fastify.log.error('Apply for partnership error:', error);
            if (error.message === 'User already has a partner account') {
                return reply.status(400).send({
                    success: false,
                    error: 'ALREADY_PARTNER',
                    message: 'Zaten bir partner hesabın var',
                });
            }
            return reply.status(500).send({
                success: false,
                error: 'APPLY_FAILED',
                message: error.message || 'Failed to apply for partnership',
            });
        }
    });
    /**
     * GET /api/partners/me
     * Get user's partner profile
     * Requires authentication
     */
    fastify.get('/me', { preHandler: auth_middleware_1.requireAuth }, async (request, reply) => {
        try {
            const userId = request.user.userId;
            const partner = await (0, partners_service_1.getPartnerByUserId)(userId);
            if (!partner) {
                return reply.status(404).send({
                    success: false,
                    error: 'NOT_A_PARTNER',
                    message: 'Partner hesabı bulunamadı',
                });
            }
            return reply.send({
                success: true,
                data: partner,
            });
        }
        catch (error) {
            fastify.log.error('Get partner profile error:', error);
            return reply.status(500).send({
                success: false,
                error: 'GET_PARTNER_FAILED',
                message: error.message || 'Failed to get partner profile',
            });
        }
    });
    /**
     * GET /api/partners/me/stats
     * Get partner statistics
     * Requires authentication (partner only)
     */
    fastify.get('/me/stats', { preHandler: auth_middleware_1.requireAuth }, async (request, reply) => {
        try {
            const userId = request.user.userId;
            const partner = await (0, partners_service_1.getPartnerByUserId)(userId);
            if (!partner) {
                return reply.status(404).send({
                    success: false,
                    error: 'NOT_A_PARTNER',
                    message: 'Partner hesabı bulunamadı',
                });
            }
            const stats = await (0, partners_service_1.getPartnerStats)(partner.id);
            return reply.send({
                success: true,
                data: stats,
            });
        }
        catch (error) {
            fastify.log.error('Get partner stats error:', error);
            return reply.status(500).send({
                success: false,
                error: 'GET_STATS_FAILED',
                message: error.message || 'Failed to get partner statistics',
            });
        }
    });
    /**
     * GET /api/partners/me/analytics
     * Get partner analytics (daily breakdown)
     * Query params: startDate, endDate
     * Requires authentication (partner only)
     */
    fastify.get('/me/analytics', { preHandler: auth_middleware_1.requireAuth }, async (request, reply) => {
        try {
            const userId = request.user.userId;
            const partner = await (0, partners_service_1.getPartnerByUserId)(userId);
            if (!partner) {
                return reply.status(404).send({
                    success: false,
                    error: 'NOT_A_PARTNER',
                    message: 'Partner hesabı bulunamadı',
                });
            }
            // Default to last 30 days
            const endDate = request.query.endDate
                ? new Date(request.query.endDate)
                : new Date();
            const startDate = request.query.startDate
                ? new Date(request.query.startDate)
                : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const analytics = await (0, partners_service_1.getPartnerAnalytics)(partner.id, startDate, endDate);
            return reply.send({
                success: true,
                data: analytics,
            });
        }
        catch (error) {
            fastify.log.error('Get partner analytics error:', error);
            return reply.status(500).send({
                success: false,
                error: 'GET_ANALYTICS_FAILED',
                message: error.message || 'Failed to get partner analytics',
            });
        }
    });
    /**
     * GET /api/partners
     * Get all partners (admin only)
     * Query params: status, limit, offset
     */
    fastify.get('/', { preHandler: auth_middleware_1.requireAdmin }, async (request, reply) => {
        try {
            const { status, limit, offset } = request.query;
            const partners = await (0, partners_service_1.getAllPartners)(status, Math.min(Number(limit) || 50, 100), Number(offset) || 0);
            return reply.send({
                success: true,
                data: partners,
            });
        }
        catch (error) {
            fastify.log.error('Get partners error:', error);
            return reply.status(500).send({
                success: false,
                error: 'GET_PARTNERS_FAILED',
                message: error.message || 'Failed to get partners',
            });
        }
    });
    /**
     * GET /api/partners/pending
     * Get pending partner applications (admin only)
     */
    fastify.get('/pending', { preHandler: auth_middleware_1.requireAdmin }, async (request, reply) => {
        try {
            const applications = await (0, partners_service_1.getPendingApplications)(50);
            return reply.send({
                success: true,
                data: applications,
            });
        }
        catch (error) {
            fastify.log.error('Get pending applications error:', error);
            return reply.status(500).send({
                success: false,
                error: 'GET_PENDING_FAILED',
                message: error.message || 'Failed to get pending applications',
            });
        }
    });
    /**
     * POST /api/partners/:id/approve
     * Approve partner application (admin only)
     * Body: { notes? }
     */
    fastify.post('/:id/approve', { preHandler: auth_middleware_1.requireAdmin }, async (request, reply) => {
        try {
            const { id } = request.params;
            const adminId = request.user.userId;
            const { notes } = request.body;
            const partner = await (0, partners_service_1.approvePartner)(id, adminId, notes);
            return reply.send({
                success: true,
                message: 'Partner approved successfully',
                data: partner,
            });
        }
        catch (error) {
            fastify.log.error('Approve partner error:', error);
            if (error.message === 'Partner not found or already processed') {
                return reply.status(404).send({
                    success: false,
                    error: 'NOT_FOUND',
                    message: 'Partner bulunamadı veya zaten işlendi',
                });
            }
            return reply.status(500).send({
                success: false,
                error: 'APPROVE_FAILED',
                message: error.message || 'Failed to approve partner',
            });
        }
    });
    /**
     * POST /api/partners/:id/reject
     * Reject partner application (admin only)
     * Body: { reason }
     */
    fastify.post('/:id/reject', { preHandler: auth_middleware_1.requireAdmin }, async (request, reply) => {
        try {
            const { id } = request.params;
            const adminId = request.user.userId;
            const { reason } = request.body;
            if (!reason) {
                return reply.status(400).send({
                    success: false,
                    error: 'INVALID_REQUEST',
                    message: 'reason is required',
                });
            }
            await (0, partners_service_1.rejectPartner)(id, adminId, reason);
            return reply.send({
                success: true,
                message: 'Partner rejected successfully',
            });
        }
        catch (error) {
            fastify.log.error('Reject partner error:', error);
            if (error.message === 'Partner not found or already processed') {
                return reply.status(404).send({
                    success: false,
                    error: 'NOT_FOUND',
                    message: 'Partner bulunamadı veya zaten işlendi',
                });
            }
            return reply.status(500).send({
                success: false,
                error: 'REJECT_FAILED',
                message: error.message || 'Failed to reject partner',
            });
        }
    });
    /**
     * POST /api/partners/:id/suspend
     * Suspend partner account (admin only)
     * Body: { reason }
     */
    fastify.post('/:id/suspend', { preHandler: auth_middleware_1.requireAdmin }, async (request, reply) => {
        try {
            const { id } = request.params;
            const { reason } = request.body;
            if (!reason) {
                return reply.status(400).send({
                    success: false,
                    error: 'INVALID_REQUEST',
                    message: 'reason is required',
                });
            }
            await (0, partners_service_1.suspendPartner)(id, reason);
            return reply.send({
                success: true,
                message: 'Partner suspended successfully',
            });
        }
        catch (error) {
            fastify.log.error('Suspend partner error:', error);
            if (error.message === 'Partner not found or not approved') {
                return reply.status(404).send({
                    success: false,
                    error: 'NOT_FOUND',
                    message: 'Partner bulunamadı veya onaylı değil',
                });
            }
            return reply.status(500).send({
                success: false,
                error: 'SUSPEND_FAILED',
                message: error.message || 'Failed to suspend partner',
            });
        }
    });
    /**
     * POST /api/partners/:id/reactivate
     * Reactivate suspended partner (admin only)
     */
    fastify.post('/:id/reactivate', { preHandler: auth_middleware_1.requireAdmin }, async (request, reply) => {
        try {
            const { id } = request.params;
            await (0, partners_service_1.reactivatePartner)(id);
            return reply.send({
                success: true,
                message: 'Partner reactivated successfully',
            });
        }
        catch (error) {
            fastify.log.error('Reactivate partner error:', error);
            if (error.message === 'Partner not found or not suspended') {
                return reply.status(404).send({
                    success: false,
                    error: 'NOT_FOUND',
                    message: 'Partner bulunamadı veya suspend değil',
                });
            }
            return reply.status(500).send({
                success: false,
                error: 'REACTIVATE_FAILED',
                message: error.message || 'Failed to reactivate partner',
            });
        }
    });
    /**
     * PATCH /api/partners/:id/commission
     * Update partner commission rate (admin only)
     * Body: { commissionRate }
     */
    fastify.patch('/:id/commission', { preHandler: auth_middleware_1.requireAdmin }, async (request, reply) => {
        try {
            const { id } = request.params;
            const { commissionRate } = request.body;
            if (typeof commissionRate !== 'number' || commissionRate < 0 || commissionRate > 100) {
                return reply.status(400).send({
                    success: false,
                    error: 'INVALID_REQUEST',
                    message: 'commissionRate must be a number between 0 and 100',
                });
            }
            await (0, partners_service_1.updateCommissionRate)(id, commissionRate);
            return reply.send({
                success: true,
                message: 'Commission rate updated successfully',
            });
        }
        catch (error) {
            fastify.log.error('Update commission rate error:', error);
            if (error.message === 'Partner not found') {
                return reply.status(404).send({
                    success: false,
                    error: 'NOT_FOUND',
                    message: 'Partner bulunamadı',
                });
            }
            return reply.status(500).send({
                success: false,
                error: 'UPDATE_FAILED',
                message: error.message || 'Failed to update commission rate',
            });
        }
    });
}
