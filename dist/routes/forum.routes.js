"use strict";
/**
 * Forum Routes
 *
 * API endpoints for Match Detail Forum tab:
 * - Comments (with likes, replies)
 * - Live Chat
 * - Polls
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = forumRoutes;
const forumService_1 = require("../services/forum/forumService");
const auth_middleware_1 = require("../middleware/auth.middleware");
const logger_1 = require("../utils/logger");
async function forumRoutes(fastify, options) {
    // ============================================
    // COMMENTS ENDPOINTS
    // ============================================
    /**
     * GET /api/forum/:matchId/comments
     * Get comments for a match
     */
    fastify.get('/:matchId/comments', async (request, reply) => {
        try {
            const { matchId } = request.params;
            const { limit, offset } = request.query;
            const userId = request.user?.id;
            const result = await forumService_1.commentsService.getComments(matchId, userId, parseInt(limit || '50'), parseInt(offset || '0'));
            reply.send({
                success: true,
                data: result,
            });
        }
        catch (error) {
            logger_1.logger.error('[Forum] Error getting comments:', error);
            reply.status(500).send({
                success: false,
                message: error.message || 'Failed to get comments',
            });
        }
    });
    /**
     * POST /api/forum/:matchId/comments
     * Create a new comment (requires auth)
     */
    fastify.post('/:matchId/comments', { preHandler: [auth_middleware_1.requireAuth] }, async (request, reply) => {
        try {
            const { matchId } = request.params;
            const { content, parentId } = request.body;
            const userId = request.user?.id;
            if (!content || content.trim().length === 0) {
                reply.status(400).send({
                    success: false,
                    message: 'Content is required',
                });
                return;
            }
            if (content.length > 1000) {
                reply.status(400).send({
                    success: false,
                    message: 'Content too long (max 1000 characters)',
                });
                return;
            }
            const comment = await forumService_1.commentsService.createComment(matchId, userId, content.trim(), parentId);
            reply.send({
                success: true,
                data: comment,
            });
        }
        catch (error) {
            logger_1.logger.error('[Forum] Error creating comment:', error);
            reply.status(500).send({
                success: false,
                message: error.message || 'Failed to create comment',
            });
        }
    });
    /**
     * DELETE /api/forum/comments/:commentId
     * Delete a comment (requires auth, owner only)
     */
    fastify.delete('/comments/:commentId', { preHandler: [auth_middleware_1.requireAuth] }, async (request, reply) => {
        try {
            const { commentId } = request.params;
            const userId = request.user?.id;
            const deleted = await forumService_1.commentsService.deleteComment(parseInt(commentId), userId);
            if (!deleted) {
                reply.status(404).send({
                    success: false,
                    message: 'Comment not found or not authorized',
                });
                return;
            }
            reply.send({
                success: true,
                message: 'Comment deleted',
            });
        }
        catch (error) {
            logger_1.logger.error('[Forum] Error deleting comment:', error);
            reply.status(500).send({
                success: false,
                message: error.message || 'Failed to delete comment',
            });
        }
    });
    /**
     * POST /api/forum/comments/:commentId/like
     * Like/unlike a comment (requires auth)
     */
    fastify.post('/comments/:commentId/like', { preHandler: [auth_middleware_1.requireAuth] }, async (request, reply) => {
        try {
            const { commentId } = request.params;
            const userId = request.user?.id;
            const result = await forumService_1.commentsService.toggleLike(parseInt(commentId), userId);
            reply.send({
                success: true,
                data: result,
            });
        }
        catch (error) {
            logger_1.logger.error('[Forum] Error toggling like:', error);
            reply.status(500).send({
                success: false,
                message: error.message || 'Failed to toggle like',
            });
        }
    });
    // ============================================
    // CHAT ENDPOINTS
    // ============================================
    /**
     * GET /api/forum/:matchId/chat
     * Get chat messages for a match
     */
    fastify.get('/:matchId/chat', async (request, reply) => {
        try {
            const { matchId } = request.params;
            const { limit, before } = request.query;
            const messages = await forumService_1.chatService.getMessages(matchId, parseInt(limit || '100'), before ? parseInt(before) : undefined);
            reply.send({
                success: true,
                data: {
                    messages,
                    hasMore: messages.length === parseInt(limit || '100'),
                },
            });
        }
        catch (error) {
            logger_1.logger.error('[Forum] Error getting chat messages:', error);
            reply.status(500).send({
                success: false,
                message: error.message || 'Failed to get chat messages',
            });
        }
    });
    /**
     * POST /api/forum/:matchId/chat
     * Send a chat message (requires auth)
     */
    fastify.post('/:matchId/chat', { preHandler: [auth_middleware_1.requireAuth] }, async (request, reply) => {
        try {
            const { matchId } = request.params;
            const { message } = request.body;
            const user = request.user;
            const userId = user?.id;
            const username = user?.display_name || user?.email?.split('@')[0] || 'Anonim';
            if (!message || message.trim().length === 0) {
                reply.status(400).send({
                    success: false,
                    message: 'Message is required',
                });
                return;
            }
            if (message.length > 500) {
                reply.status(400).send({
                    success: false,
                    message: 'Message too long (max 500 characters)',
                });
                return;
            }
            const chatMessage = await forumService_1.chatService.sendMessage(matchId, userId, username, message.trim());
            reply.send({
                success: true,
                data: chatMessage,
            });
        }
        catch (error) {
            logger_1.logger.error('[Forum] Error sending chat message:', error);
            reply.status(500).send({
                success: false,
                message: error.message || 'Failed to send chat message',
            });
        }
    });
    /**
     * DELETE /api/forum/chat/:messageId
     * Delete a chat message (requires auth, owner only)
     */
    fastify.delete('/chat/:messageId', { preHandler: [auth_middleware_1.requireAuth] }, async (request, reply) => {
        try {
            const { messageId } = request.params;
            const userId = request.user?.id;
            const deleted = await forumService_1.chatService.deleteMessage(parseInt(messageId), userId);
            if (!deleted) {
                reply.status(404).send({
                    success: false,
                    message: 'Message not found or not authorized',
                });
                return;
            }
            reply.send({
                success: true,
                message: 'Message deleted',
            });
        }
        catch (error) {
            logger_1.logger.error('[Forum] Error deleting chat message:', error);
            reply.status(500).send({
                success: false,
                message: error.message || 'Failed to delete chat message',
            });
        }
    });
    // ============================================
    // POLL ENDPOINTS
    // ============================================
    /**
     * GET /api/forum/:matchId/poll
     * Get or create poll for a match
     */
    fastify.get('/:matchId/poll', async (request, reply) => {
        try {
            const { matchId } = request.params;
            const userId = request.user?.id;
            const poll = await forumService_1.pollService.getOrCreatePoll(matchId, userId);
            reply.send({
                success: true,
                data: poll,
            });
        }
        catch (error) {
            logger_1.logger.error('[Forum] Error getting poll:', error);
            reply.status(500).send({
                success: false,
                message: error.message || 'Failed to get poll',
            });
        }
    });
    /**
     * POST /api/forum/:matchId/poll/vote
     * Vote on a poll (requires auth)
     */
    fastify.post('/:matchId/poll/vote', { preHandler: [auth_middleware_1.requireAuth] }, async (request, reply) => {
        try {
            const { matchId } = request.params;
            const { vote } = request.body;
            const userId = request.user?.id;
            if (!['home', 'draw', 'away'].includes(vote)) {
                reply.status(400).send({
                    success: false,
                    message: 'Invalid vote. Must be home, draw, or away',
                });
                return;
            }
            // Get poll first
            const poll = await forumService_1.pollService.getOrCreatePoll(matchId, userId);
            if (!poll.is_active) {
                reply.status(400).send({
                    success: false,
                    message: 'Poll is closed',
                });
                return;
            }
            const result = await forumService_1.pollService.vote(poll.id, userId, vote);
            reply.send({
                success: true,
                data: result.poll,
            });
        }
        catch (error) {
            logger_1.logger.error('[Forum] Error voting on poll:', error);
            reply.status(500).send({
                success: false,
                message: error.message || 'Failed to vote',
            });
        }
    });
}
