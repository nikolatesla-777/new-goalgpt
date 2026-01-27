"use strict";
/**
 * Forum Schemas
 *
 * PR-10: Schema Validation
 *
 * Zod schemas for forum.routes.ts endpoints.
 * Validates match forum (comments, chat, polls) API requests.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.pollVoteSchema = exports.chatMessageSchema = exports.forumCommentSchema = exports.messageIdParamSchema = exports.forumCommentIdParamSchema = exports.forumMatchIdParamSchema = void 0;
var zod_1 = require("zod");
// ============================================================
// PARAM SCHEMAS
// ============================================================
/**
 * Match ID param
 */
exports.forumMatchIdParamSchema = zod_1.z.object({
    matchId: zod_1.z.string().min(1, 'Match ID is required'),
});
/**
 * Comment ID param
 */
exports.forumCommentIdParamSchema = zod_1.z.object({
    commentId: zod_1.z.string().regex(/^\d+$/, 'Comment ID must be numeric'),
});
/**
 * Message ID param
 */
exports.messageIdParamSchema = zod_1.z.object({
    messageId: zod_1.z.string().regex(/^\d+$/, 'Message ID must be numeric'),
});
// ============================================================
// BODY SCHEMAS
// ============================================================
/**
 * POST /api/forum/:matchId/comments
 * Create a forum comment
 */
exports.forumCommentSchema = zod_1.z.object({
    content: zod_1.z.string()
        .min(1, 'Content is required')
        .max(1000, 'Content too long (max 1000 characters)')
        .transform(function (val) { return val.trim(); }),
    parentId: zod_1.z.number().int().positive().optional(),
});
/**
 * POST /api/forum/:matchId/chat
 * Send a chat message
 */
exports.chatMessageSchema = zod_1.z.object({
    message: zod_1.z.string()
        .min(1, 'Message is required')
        .max(500, 'Message too long (max 500 characters)')
        .transform(function (val) { return val.trim(); }),
});
/**
 * POST /api/forum/:matchId/poll/vote
 * Vote on a poll
 */
exports.pollVoteSchema = zod_1.z.object({
    vote: zod_1.z.enum(['home', 'draw', 'away']),
});
