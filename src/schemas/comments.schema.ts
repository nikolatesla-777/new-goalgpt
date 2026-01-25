/**
 * Comments Schemas
 *
 * PR-10: Schema Validation
 *
 * Zod schemas for comments.routes.ts endpoints.
 * Validates match forum/discussion API requests.
 */

import { z } from 'zod';
import { stringIdSchema, idSchema, paginationSchema } from './common';

// ============================================================
// PARAM SCHEMAS
// ============================================================

/**
 * Match ID param for comment creation
 */
export const matchIdParamSchema = z.object({
  matchId: z.string().regex(/^\d+$/, 'Match ID must be numeric'),
});

/**
 * Comment ID param for all comment actions
 */
export const commentIdParamSchema = z.object({
  commentId: stringIdSchema,
});

// ============================================================
// BODY SCHEMAS
// ============================================================

/**
 * POST /api/comments/match/:matchId
 * Create a comment on a match
 */
export const createCommentSchema = z.object({
  content: z.string()
    .min(3, 'Comment must be at least 3 characters')
    .max(1000, 'Comment must be less than 1000 characters'),
});

/**
 * POST /api/comments/:commentId/reply
 * Reply to a comment
 */
export const replyCommentSchema = z.object({
  content: z.string()
    .min(3, 'Reply must be at least 3 characters')
    .max(1000, 'Reply must be less than 1000 characters'),
});

/**
 * POST /api/comments/:commentId/pin
 * Toggle pin status
 */
export const togglePinSchema = z.object({
  isPinned: z.boolean(),
});

// ============================================================
// QUERY SCHEMAS
// ============================================================

/**
 * GET /api/comments/match/:matchId
 * Query params for listing comments
 */
export const getCommentsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * GET /api/comments/:commentId/replies
 * Query params for listing replies
 */
export const getRepliesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// ============================================================
// TYPE EXPORTS
// ============================================================

export type MatchIdParam = z.infer<typeof matchIdParamSchema>;
export type CommentIdParam = z.infer<typeof commentIdParamSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type ReplyCommentInput = z.infer<typeof replyCommentSchema>;
export type TogglePinInput = z.infer<typeof togglePinSchema>;
