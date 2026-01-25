/**
 * Forum Routes
 *
 * API endpoints for Match Detail Forum tab:
 * - Comments (with likes, replies)
 * - Live Chat
 * - Polls
 */

import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { commentsService, chatService, pollService } from '../services/forum/forumService';
import { requireAuth } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';
// PR-10: Schema validation
import { validate } from '../middleware/validation.middleware';
import {
  forumMatchIdParamSchema,
  forumCommentIdParamSchema,
  messageIdParamSchema,
  forumCommentSchema,
  chatMessageSchema,
  pollVoteSchema,
} from '../schemas/forum.schema';

export default async function forumRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
) {
  // ============================================
  // COMMENTS ENDPOINTS
  // ============================================

  /**
   * GET /api/forum/:matchId/comments
   * Get comments for a match
   */
  fastify.get('/:matchId/comments', async (request, reply) => {
    try {
      const { matchId } = request.params as { matchId: string };
      const { limit, offset } = request.query as { limit?: string; offset?: string };
      const userId = (request as any).user?.id;

      const result = await commentsService.getComments(
        matchId,
        userId,
        parseInt(limit || '50'),
        parseInt(offset || '0')
      );

      reply.send({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('[Forum] Error getting comments:', error);
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
  // PR-10: Validate params and body
  fastify.post('/:matchId/comments', { preHandler: [requireAuth, validate({ params: forumMatchIdParamSchema, body: forumCommentSchema }) as any] }, async (request, reply) => {
    try {
      const { matchId } = request.params as { matchId: string };
      const { content, parentId } = request.body as { content: string; parentId?: number };
      const userId = (request as any).user?.id;

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

      const comment = await commentsService.createComment(matchId, userId, content.trim(), parentId);

      reply.send({
        success: true,
        data: comment,
      });
    } catch (error: any) {
      logger.error('[Forum] Error creating comment:', error);
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
  // PR-10: Validate params
  fastify.delete('/comments/:commentId', { preHandler: [requireAuth, validate({ params: forumCommentIdParamSchema }) as any] }, async (request, reply) => {
    try {
      const { commentId } = request.params as { commentId: string };
      const userId = (request as any).user?.id;

      const deleted = await commentsService.deleteComment(parseInt(commentId), userId);

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
    } catch (error: any) {
      logger.error('[Forum] Error deleting comment:', error);
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
  // PR-10: Validate params
  fastify.post('/comments/:commentId/like', { preHandler: [requireAuth, validate({ params: forumCommentIdParamSchema }) as any] }, async (request, reply) => {
    try {
      const { commentId } = request.params as { commentId: string };
      const userId = (request as any).user?.id;

      const result = await commentsService.toggleLike(parseInt(commentId), userId);

      reply.send({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('[Forum] Error toggling like:', error);
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
      const { matchId } = request.params as { matchId: string };
      const { limit, before } = request.query as { limit?: string; before?: string };

      const messages = await chatService.getMessages(
        matchId,
        parseInt(limit || '100'),
        before ? parseInt(before) : undefined
      );

      reply.send({
        success: true,
        data: {
          messages,
          hasMore: messages.length === parseInt(limit || '100'),
        },
      });
    } catch (error: any) {
      logger.error('[Forum] Error getting chat messages:', error);
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
  // PR-10: Validate params and body
  fastify.post('/:matchId/chat', { preHandler: [requireAuth, validate({ params: forumMatchIdParamSchema, body: chatMessageSchema }) as any] }, async (request, reply) => {
    try {
      const { matchId } = request.params as { matchId: string };
      const { message } = request.body as { message: string };
      const user = (request as any).user;
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

      const chatMessage = await chatService.sendMessage(matchId, userId, username, message.trim());

      reply.send({
        success: true,
        data: chatMessage,
      });
    } catch (error: any) {
      logger.error('[Forum] Error sending chat message:', error);
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
  // PR-10: Validate params
  fastify.delete('/chat/:messageId', { preHandler: [requireAuth, validate({ params: messageIdParamSchema }) as any] }, async (request, reply) => {
    try {
      const { messageId } = request.params as { messageId: string };
      const userId = (request as any).user?.id;

      const deleted = await chatService.deleteMessage(parseInt(messageId), userId);

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
    } catch (error: any) {
      logger.error('[Forum] Error deleting chat message:', error);
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
      const { matchId } = request.params as { matchId: string };
      const userId = (request as any).user?.id;

      const poll = await pollService.getOrCreatePoll(matchId, userId);

      reply.send({
        success: true,
        data: poll,
      });
    } catch (error: any) {
      logger.error('[Forum] Error getting poll:', error);
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
  // PR-10: Validate params and body
  fastify.post('/:matchId/poll/vote', { preHandler: [requireAuth, validate({ params: forumMatchIdParamSchema, body: pollVoteSchema }) as any] }, async (request, reply) => {
    try {
      const { matchId } = request.params as { matchId: string };
      const { vote } = request.body as { vote: 'home' | 'draw' | 'away' };
      const userId = (request as any).user?.id;

      if (!['home', 'draw', 'away'].includes(vote)) {
        reply.status(400).send({
          success: false,
          message: 'Invalid vote. Must be home, draw, or away',
        });
        return;
      }

      // Get poll first
      const poll = await pollService.getOrCreatePoll(matchId, userId);

      if (!poll.is_active) {
        reply.status(400).send({
          success: false,
          message: 'Poll is closed',
        });
        return;
      }

      const result = await pollService.vote(poll.id, userId, vote);

      reply.send({
        success: true,
        data: result.poll,
      });
    } catch (error: any) {
      logger.error('[Forum] Error voting on poll:', error);
      reply.status(500).send({
        success: false,
        message: error.message || 'Failed to vote',
      });
    }
  });
}
