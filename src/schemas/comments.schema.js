"use strict";
/**
 * Comments Schemas
 *
 * PR-10: Schema Validation
 *
 * Zod schemas for comments.routes.ts endpoints.
 * Validates match forum/discussion API requests.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRepliesQuerySchema = exports.getCommentsQuerySchema = exports.togglePinSchema = exports.replyCommentSchema = exports.createCommentSchema = exports.commentIdParamSchema = exports.matchIdParamSchema = void 0;
var zod_1 = require("zod");
var common_1 = require("./common");
// ============================================================
// PARAM SCHEMAS
// ============================================================
/**
 * Match ID param for comment creation
 */
exports.matchIdParamSchema = zod_1.z.object({
    matchId: zod_1.z.string().regex(/^\d+$/, 'Match ID must be numeric'),
});
/**
 * Comment ID param for all comment actions
 */
exports.commentIdParamSchema = zod_1.z.object({
    commentId: common_1.stringIdSchema,
});
// ============================================================
// BODY SCHEMAS
// ============================================================
/**
 * POST /api/comments/match/:matchId
 * Create a comment on a match
 */
exports.createCommentSchema = zod_1.z.object({
    content: zod_1.z.string()
        .min(3, 'Comment must be at least 3 characters')
        .max(1000, 'Comment must be less than 1000 characters'),
});
/**
 * POST /api/comments/:commentId/reply
 * Reply to a comment
 */
exports.replyCommentSchema = zod_1.z.object({
    content: zod_1.z.string()
        .min(3, 'Reply must be at least 3 characters')
        .max(1000, 'Reply must be less than 1000 characters'),
});
/**
 * POST /api/comments/:commentId/pin
 * Toggle pin status
 */
exports.togglePinSchema = zod_1.z.object({
    isPinned: zod_1.z.boolean(),
});
// ============================================================
// QUERY SCHEMAS
// ============================================================
/**
 * GET /api/comments/match/:matchId
 * Query params for listing comments
 */
exports.getCommentsQuerySchema = zod_1.z.object({
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(50),
    offset: zod_1.z.coerce.number().int().min(0).default(0),
});
/**
 * GET /api/comments/:commentId/replies
 * Query params for listing replies
 */
exports.getRepliesQuerySchema = zod_1.z.object({
    limit: zod_1.z.coerce.number().int().min(1).max(50).default(20),
});
