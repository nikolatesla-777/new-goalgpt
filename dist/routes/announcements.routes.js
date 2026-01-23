"use strict";
/**
 * Announcements Routes - Admin Popup Management API
 *
 * Admin Endpoints:
 * - POST   /api/announcements              - Create announcement
 * - GET    /api/announcements              - List all announcements
 * - GET    /api/announcements/:id          - Get announcement by ID
 * - PUT    /api/announcements/:id          - Update announcement
 * - DELETE /api/announcements/:id          - Delete announcement
 * - POST   /api/announcements/:id/activate - Activate announcement
 * - GET    /api/announcements/stats        - Get statistics
 *
 * Mobile Endpoints:
 * - GET    /api/announcements/active       - Get active announcements for user
 * - POST   /api/announcements/:id/dismiss  - Dismiss announcement
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.announcementsRoutes = announcementsRoutes;
const auth_middleware_1 = require("../middleware/auth.middleware");
const announcements_service_1 = require("../services/announcements.service");
// ============================================================================
// ROUTES
// ============================================================================
async function announcementsRoutes(fastify) {
    // ==========================================================================
    // ADMIN ROUTES
    // ==========================================================================
    /**
     * POST /api/announcements
     * Create a new announcement
     */
    fastify.post('/', { preHandler: auth_middleware_1.requireAdmin }, async (request, reply) => {
        try {
            const adminUserId = request.user?.userId;
            const announcement = await (0, announcements_service_1.createAnnouncement)(request.body, adminUserId);
            return reply.status(201).send({
                success: true,
                message: 'Duyuru oluşturuldu',
                data: announcement,
            });
        }
        catch (error) {
            fastify.log.error('Create announcement error:', error);
            return reply.status(500).send({
                success: false,
                error: 'CREATE_ANNOUNCEMENT_FAILED',
                message: error.message || 'Duyuru oluşturulamadı',
            });
        }
    });
    /**
     * GET /api/announcements
     * List all announcements (admin)
     */
    fastify.get('/', { preHandler: auth_middleware_1.requireAdmin }, async (request, reply) => {
        try {
            const limit = Math.min(Number(request.query.limit) || 50, 100);
            const offset = Number(request.query.offset) || 0;
            const announcements = await (0, announcements_service_1.getAllAnnouncements)(limit, offset);
            return reply.send({
                success: true,
                data: announcements,
                pagination: { limit, offset, count: announcements.length },
            });
        }
        catch (error) {
            fastify.log.error('List announcements error:', error);
            return reply.status(500).send({
                success: false,
                error: 'LIST_ANNOUNCEMENTS_FAILED',
                message: error.message || 'Duyurular listelenemedi',
            });
        }
    });
    /**
     * GET /api/announcements/stats
     * Get announcement statistics (admin)
     */
    fastify.get('/stats', { preHandler: auth_middleware_1.requireAdmin }, async (request, reply) => {
        try {
            const stats = await (0, announcements_service_1.getAnnouncementStats)();
            return reply.send({
                success: true,
                data: stats,
            });
        }
        catch (error) {
            fastify.log.error('Get announcement stats error:', error);
            return reply.status(500).send({
                success: false,
                error: 'GET_STATS_FAILED',
                message: error.message || 'İstatistikler alınamadı',
            });
        }
    });
    /**
     * GET /api/announcements/active
     * Get active announcements for mobile user
     */
    fastify.get('/active', { preHandler: auth_middleware_1.requireAuth }, async (request, reply) => {
        try {
            const userId = request.user.userId;
            // Check if user is VIP (you can enhance this logic)
            // For now, we'll assume non-VIP - you can integrate with subscription check
            const isVip = false; // TODO: Get from user subscription status
            const announcements = await (0, announcements_service_1.getActiveAnnouncementsForUser)(userId, isVip);
            return reply.send({
                success: true,
                data: announcements,
            });
        }
        catch (error) {
            fastify.log.error('Get active announcements error:', error);
            return reply.status(500).send({
                success: false,
                error: 'GET_ACTIVE_ANNOUNCEMENTS_FAILED',
                message: error.message || 'Duyurular alınamadı',
            });
        }
    });
    /**
     * GET /api/announcements/:id
     * Get announcement by ID (admin)
     */
    fastify.get('/:id', { preHandler: auth_middleware_1.requireAdmin }, async (request, reply) => {
        try {
            const { id } = request.params;
            const announcement = await (0, announcements_service_1.getAnnouncementById)(id);
            if (!announcement) {
                return reply.status(404).send({
                    success: false,
                    error: 'ANNOUNCEMENT_NOT_FOUND',
                    message: 'Duyuru bulunamadı',
                });
            }
            return reply.send({
                success: true,
                data: announcement,
            });
        }
        catch (error) {
            fastify.log.error('Get announcement error:', error);
            return reply.status(500).send({
                success: false,
                error: 'GET_ANNOUNCEMENT_FAILED',
                message: error.message || 'Duyuru alınamadı',
            });
        }
    });
    /**
     * PUT /api/announcements/:id
     * Update an announcement (admin)
     */
    fastify.put('/:id', { preHandler: auth_middleware_1.requireAdmin }, async (request, reply) => {
        try {
            const { id } = request.params;
            const announcement = await (0, announcements_service_1.updateAnnouncement)(id, request.body);
            if (!announcement) {
                return reply.status(404).send({
                    success: false,
                    error: 'ANNOUNCEMENT_NOT_FOUND',
                    message: 'Duyuru bulunamadı',
                });
            }
            return reply.send({
                success: true,
                message: 'Duyuru güncellendi',
                data: announcement,
            });
        }
        catch (error) {
            fastify.log.error('Update announcement error:', error);
            return reply.status(500).send({
                success: false,
                error: 'UPDATE_ANNOUNCEMENT_FAILED',
                message: error.message || 'Duyuru güncellenemedi',
            });
        }
    });
    /**
     * DELETE /api/announcements/:id
     * Delete an announcement (admin)
     */
    fastify.delete('/:id', { preHandler: auth_middleware_1.requireAdmin }, async (request, reply) => {
        try {
            const { id } = request.params;
            const deleted = await (0, announcements_service_1.deleteAnnouncement)(id);
            if (!deleted) {
                return reply.status(404).send({
                    success: false,
                    error: 'ANNOUNCEMENT_NOT_FOUND',
                    message: 'Duyuru bulunamadı',
                });
            }
            return reply.send({
                success: true,
                message: 'Duyuru silindi',
            });
        }
        catch (error) {
            fastify.log.error('Delete announcement error:', error);
            return reply.status(500).send({
                success: false,
                error: 'DELETE_ANNOUNCEMENT_FAILED',
                message: error.message || 'Duyuru silinemedi',
            });
        }
    });
    /**
     * POST /api/announcements/:id/activate
     * Activate an announcement (admin)
     */
    fastify.post('/:id/activate', { preHandler: auth_middleware_1.requireAdmin }, async (request, reply) => {
        try {
            const { id } = request.params;
            const announcement = await (0, announcements_service_1.updateAnnouncement)(id, { status: 'active' });
            if (!announcement) {
                return reply.status(404).send({
                    success: false,
                    error: 'ANNOUNCEMENT_NOT_FOUND',
                    message: 'Duyuru bulunamadı',
                });
            }
            return reply.send({
                success: true,
                message: 'Duyuru aktifleştirildi',
                data: announcement,
            });
        }
        catch (error) {
            fastify.log.error('Activate announcement error:', error);
            return reply.status(500).send({
                success: false,
                error: 'ACTIVATE_ANNOUNCEMENT_FAILED',
                message: error.message || 'Duyuru aktifleştirilemedi',
            });
        }
    });
    /**
     * POST /api/announcements/:id/dismiss
     * Dismiss an announcement for the current user
     */
    fastify.post('/:id/dismiss', { preHandler: auth_middleware_1.requireAuth }, async (request, reply) => {
        try {
            const userId = request.user.userId;
            const { id } = request.params;
            const dismissed = await (0, announcements_service_1.dismissAnnouncement)(userId, id);
            return reply.send({
                success: true,
                message: 'Duyuru kapatıldı',
                dismissed,
            });
        }
        catch (error) {
            fastify.log.error('Dismiss announcement error:', error);
            return reply.status(500).send({
                success: false,
                error: 'DISMISS_ANNOUNCEMENT_FAILED',
                message: error.message || 'Duyuru kapatılamadı',
            });
        }
    });
}
