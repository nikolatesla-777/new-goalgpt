"use strict";
/**
 * Match Comments Routes - Match Forum/Discussion API Endpoints
 *
 * 12 endpoints for match comments system
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.commentsRoutes = commentsRoutes;
const comments_service_1 = require("../services/comments.service");
const auth_middleware_1 = require("../middleware/auth.middleware");
async function commentsRoutes(fastify) {
    /**
     * POST /api/comments/match/:matchId
     * Create a comment on a match
     * Requires authentication
     * Body: { content }
     */
    fastify.post('/match/:matchId', { preHandler: auth_middleware_1.requireAuth }, async (request, reply) => {
        try {
            const userId = request.user.userId;
            const matchId = parseInt(request.params.matchId);
            const { content } = request.body;
            if (!content) {
                return reply.status(400).send({
                    success: false,
                    error: 'INVALID_REQUEST',
                    message: 'content is required',
                });
            }
            const comment = await (0, comments_service_1.createComment)(userId, matchId, content);
            return reply.send({
                success: true,
                message: 'Comment created successfully',
                data: comment,
            });
        }
        catch (error) {
            fastify.log.error('Create comment error:', error);
            if (error.message === 'Comment must be at least 3 characters' ||
                error.message === 'Comment must be less than 1000 characters') {
                return reply.status(400).send({
                    success: false,
                    error: 'INVALID_CONTENT',
                    message: error.message,
                });
            }
            return reply.status(500).send({
                success: false,
                error: 'CREATE_COMMENT_FAILED',
                message: error.message || 'Failed to create comment',
            });
        }
    });
    /**
     * POST /api/comments/:commentId/reply
     * Reply to a comment
     * Requires authentication
     * Body: { content }
     */
    fastify.post('/:commentId/reply', { preHandler: auth_middleware_1.requireAuth }, async (request, reply) => {
        try {
            const userId = request.user.userId;
            const { commentId } = request.params;
            const { content } = request.body;
            if (!content) {
                return reply.status(400).send({
                    success: false,
                    error: 'INVALID_REQUEST',
                    message: 'content is required',
                });
            }
            const replyComment = await (0, comments_service_1.replyToComment)(userId, commentId, content);
            return reply.send({
                success: true,
                message: 'Reply created successfully',
                data: replyComment,
            });
        }
        catch (error) {
            fastify.log.error('Reply comment error:', error);
            if (error.message === 'Parent comment not found' ||
                error.message === 'Cannot reply to hidden or deleted comment') {
                return reply.status(404).send({
                    success: false,
                    error: 'PARENT_NOT_FOUND',
                    message: error.message,
                });
            }
            if (error.message === 'Reply must be at least 3 characters' ||
                error.message === 'Reply must be less than 1000 characters') {
                return reply.status(400).send({
                    success: false,
                    error: 'INVALID_CONTENT',
                    message: error.message,
                });
            }
            return reply.status(500).send({
                success: false,
                error: 'REPLY_FAILED',
                message: error.message || 'Failed to create reply',
            });
        }
    });
    /**
     * POST /api/comments/:commentId/like
     * Like a comment
     * Requires authentication
     */
    fastify.post('/:commentId/like', { preHandler: auth_middleware_1.requireAuth }, async (request, reply) => {
        try {
            const userId = request.user.userId;
            const { commentId } = request.params;
            const liked = await (0, comments_service_1.likeComment)(userId, commentId);
            if (!liked) {
                return reply.send({
                    success: true,
                    message: 'Already liked',
                    alreadyLiked: true,
                });
            }
            return reply.send({
                success: true,
                message: 'Comment liked successfully',
            });
        }
        catch (error) {
            fastify.log.error('Like comment error:', error);
            if (error.message === 'Comment not found') {
                return reply.status(404).send({
                    success: false,
                    error: 'NOT_FOUND',
                    message: 'Yorum bulunamadı',
                });
            }
            if (error.message === 'Cannot like your own comment') {
                return reply.status(400).send({
                    success: false,
                    error: 'SELF_LIKE',
                    message: 'Kendi yorumunu beğenemezsin',
                });
            }
            return reply.status(500).send({
                success: false,
                error: 'LIKE_FAILED',
                message: error.message || 'Failed to like comment',
            });
        }
    });
    /**
     * DELETE /api/comments/:commentId/like
     * Unlike a comment
     * Requires authentication
     */
    fastify.delete('/:commentId/like', { preHandler: auth_middleware_1.requireAuth }, async (request, reply) => {
        try {
            const userId = request.user.userId;
            const { commentId } = request.params;
            const unliked = await (0, comments_service_1.unlikeComment)(userId, commentId);
            if (!unliked) {
                return reply.send({
                    success: true,
                    message: 'Like not found',
                    notLiked: true,
                });
            }
            return reply.send({
                success: true,
                message: 'Comment unliked successfully',
            });
        }
        catch (error) {
            fastify.log.error('Unlike comment error:', error);
            return reply.status(500).send({
                success: false,
                error: 'UNLIKE_FAILED',
                message: error.message || 'Failed to unlike comment',
            });
        }
    });
    /**
     * POST /api/comments/:commentId/report
     * Report a comment (auto-hide at 3 reports)
     * Requires authentication
     */
    fastify.post('/:commentId/report', { preHandler: auth_middleware_1.requireAuth }, async (request, reply) => {
        try {
            const userId = request.user.userId;
            const { commentId } = request.params;
            const result = await (0, comments_service_1.reportComment)(userId, commentId);
            return reply.send({
                success: true,
                message: result.autoHidden
                    ? 'Yorum raporlandı ve gizlendi (3+ rapor)'
                    : 'Yorum raporlandı',
                data: {
                    reported: result.reported,
                    autoHidden: result.autoHidden,
                },
            });
        }
        catch (error) {
            fastify.log.error('Report comment error:', error);
            if (error.message === 'Comment not found') {
                return reply.status(404).send({
                    success: false,
                    error: 'NOT_FOUND',
                    message: 'Yorum bulunamadı',
                });
            }
            return reply.status(500).send({
                success: false,
                error: 'REPORT_FAILED',
                message: error.message || 'Failed to report comment',
            });
        }
    });
    /**
     * GET /api/comments/match/:matchId
     * Get match comments (top-level, paginated)
     * Query params: limit (default: 50), offset (default: 0)
     * Public endpoint (optionally authenticated for like status)
     */
    fastify.get('/match/:matchId', async (request, reply) => {
        try {
            const matchId = parseInt(request.params.matchId);
            const limit = Math.min(Number(request.query.limit) || 50, 100);
            const offset = Number(request.query.offset) || 0;
            // Get current user ID if authenticated
            const userId = request.user?.userId || null;
            const comments = await (0, comments_service_1.getMatchComments)(matchId, userId, limit, offset);
            return reply.send({
                success: true,
                data: comments,
                pagination: {
                    limit,
                    offset,
                    count: comments.length,
                },
            });
        }
        catch (error) {
            fastify.log.error('Get match comments error:', error);
            return reply.status(500).send({
                success: false,
                error: 'GET_COMMENTS_FAILED',
                message: error.message || 'Failed to get match comments',
            });
        }
    });
    /**
     * GET /api/comments/:commentId/replies
     * Get replies to a comment
     * Query params: limit (default: 20)
     * Public endpoint (optionally authenticated for like status)
     */
    fastify.get('/:commentId/replies', async (request, reply) => {
        try {
            const { commentId } = request.params;
            const limit = Math.min(Number(request.query.limit) || 20, 50);
            // Get current user ID if authenticated
            const userId = request.user?.userId || null;
            const replies = await (0, comments_service_1.getCommentReplies)(commentId, userId, limit);
            return reply.send({
                success: true,
                data: replies,
            });
        }
        catch (error) {
            fastify.log.error('Get comment replies error:', error);
            return reply.status(500).send({
                success: false,
                error: 'GET_REPLIES_FAILED',
                message: error.message || 'Failed to get comment replies',
            });
        }
    });
    /**
     * GET /api/comments/match/:matchId/stats
     * Get match comment statistics
     * Public endpoint
     */
    fastify.get('/match/:matchId/stats', async (request, reply) => {
        try {
            const matchId = parseInt(request.params.matchId);
            const stats = await (0, comments_service_1.getMatchCommentStats)(matchId);
            return reply.send({
                success: true,
                data: stats,
            });
        }
        catch (error) {
            fastify.log.error('Get comment stats error:', error);
            return reply.status(500).send({
                success: false,
                error: 'GET_STATS_FAILED',
                message: error.message || 'Failed to get comment statistics',
            });
        }
    });
    /**
     * POST /api/comments/:commentId/hide
     * Hide comment (admin moderation)
     * Admin only
     */
    fastify.post('/:commentId/hide', { preHandler: auth_middleware_1.requireAdmin }, async (request, reply) => {
        try {
            const { commentId } = request.params;
            await (0, comments_service_1.hideComment)(commentId);
            return reply.send({
                success: true,
                message: 'Comment hidden successfully',
            });
        }
        catch (error) {
            fastify.log.error('Hide comment error:', error);
            if (error.message === 'Comment not found') {
                return reply.status(404).send({
                    success: false,
                    error: 'NOT_FOUND',
                    message: 'Yorum bulunamadı',
                });
            }
            return reply.status(500).send({
                success: false,
                error: 'HIDE_FAILED',
                message: error.message || 'Failed to hide comment',
            });
        }
    });
    /**
     * POST /api/comments/:commentId/restore
     * Restore comment (admin moderation)
     * Admin only
     */
    fastify.post('/:commentId/restore', { preHandler: auth_middleware_1.requireAdmin }, async (request, reply) => {
        try {
            const { commentId } = request.params;
            await (0, comments_service_1.restoreComment)(commentId);
            return reply.send({
                success: true,
                message: 'Comment restored successfully',
            });
        }
        catch (error) {
            fastify.log.error('Restore comment error:', error);
            if (error.message === 'Comment not found') {
                return reply.status(404).send({
                    success: false,
                    error: 'NOT_FOUND',
                    message: 'Yorum bulunamadı',
                });
            }
            return reply.status(500).send({
                success: false,
                error: 'RESTORE_FAILED',
                message: error.message || 'Failed to restore comment',
            });
        }
    });
    /**
     * DELETE /api/comments/:commentId
     * Delete comment (admin moderation - soft delete)
     * Admin only
     */
    fastify.delete('/:commentId', { preHandler: auth_middleware_1.requireAdmin }, async (request, reply) => {
        try {
            const { commentId } = request.params;
            await (0, comments_service_1.deleteComment)(commentId);
            return reply.send({
                success: true,
                message: 'Comment deleted successfully',
            });
        }
        catch (error) {
            fastify.log.error('Delete comment error:', error);
            if (error.message === 'Comment not found') {
                return reply.status(404).send({
                    success: false,
                    error: 'NOT_FOUND',
                    message: 'Yorum bulunamadı',
                });
            }
            return reply.status(500).send({
                success: false,
                error: 'DELETE_FAILED',
                message: error.message || 'Failed to delete comment',
            });
        }
    });
    /**
     * POST /api/comments/:commentId/pin
     * Pin/unpin comment (admin)
     * Body: { isPinned }
     * Admin only
     */
    fastify.post('/:commentId/pin', { preHandler: auth_middleware_1.requireAdmin }, async (request, reply) => {
        try {
            const { commentId } = request.params;
            const { isPinned } = request.body;
            if (typeof isPinned !== 'boolean') {
                return reply.status(400).send({
                    success: false,
                    error: 'INVALID_REQUEST',
                    message: 'isPinned (boolean) is required',
                });
            }
            await (0, comments_service_1.togglePinComment)(commentId, isPinned);
            return reply.send({
                success: true,
                message: isPinned
                    ? 'Comment pinned successfully'
                    : 'Comment unpinned successfully',
            });
        }
        catch (error) {
            fastify.log.error('Toggle pin comment error:', error);
            if (error.message === 'Comment not found') {
                return reply.status(404).send({
                    success: false,
                    error: 'NOT_FOUND',
                    message: 'Yorum bulunamadı',
                });
            }
            return reply.status(500).send({
                success: false,
                error: 'PIN_FAILED',
                message: error.message || 'Failed to pin/unpin comment',
            });
        }
    });
}
