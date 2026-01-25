/**
 * Forum Schemas
 *
 * PR-10: Schema Validation
 *
 * Zod schemas for forum.routes.ts endpoints.
 * Validates match forum (comments, chat, polls) API requests.
 */

import { z } from 'zod';
import { stringIdSchema } from './common';

// ============================================================
// PARAM SCHEMAS
// ============================================================

/**
 * Match ID param
 */
export const forumMatchIdParamSchema = z.object({
  matchId: z.string().min(1, 'Match ID is required'),
});

/**
 * Comment ID param
 */
export const forumCommentIdParamSchema = z.object({
  commentId: z.string().regex(/^\d+$/, 'Comment ID must be numeric'),
});

/**
 * Message ID param
 */
export const messageIdParamSchema = z.object({
  messageId: z.string().regex(/^\d+$/, 'Message ID must be numeric'),
});

// ============================================================
// BODY SCHEMAS
// ============================================================

/**
 * POST /api/forum/:matchId/comments
 * Create a forum comment
 */
export const forumCommentSchema = z.object({
  content: z.string()
    .min(1, 'Content is required')
    .max(1000, 'Content too long (max 1000 characters)')
    .transform((val) => val.trim()),
  parentId: z.number().int().positive().optional(),
});

/**
 * POST /api/forum/:matchId/chat
 * Send a chat message
 */
export const chatMessageSchema = z.object({
  message: z.string()
    .min(1, 'Message is required')
    .max(500, 'Message too long (max 500 characters)')
    .transform((val) => val.trim()),
});

/**
 * POST /api/forum/:matchId/poll/vote
 * Vote on a poll
 */
export const pollVoteSchema = z.object({
  vote: z.enum(['home', 'draw', 'away']),
});

// ============================================================
// TYPE EXPORTS
// ============================================================

export type ForumMatchIdParam = z.infer<typeof forumMatchIdParamSchema>;
export type ForumCommentIdParam = z.infer<typeof forumCommentIdParamSchema>;
export type MessageIdParam = z.infer<typeof messageIdParamSchema>;
export type ForumCommentInput = z.infer<typeof forumCommentSchema>;
export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
export type PollVoteInput = z.infer<typeof pollVoteSchema>;
