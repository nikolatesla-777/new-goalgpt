"use strict";
/**
 * Match Schemas
 *
 * PR-10: Schema Validation
 *
 * Zod schemas for match.routes.ts endpoints.
 * Validates match-related API requests.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldBeLiveQuerySchema = exports.unifiedQuerySchema = exports.diaryQuerySchema = exports.matchIdParamSchema = void 0;
var zod_1 = require("zod");
// ============================================================
// PARAM SCHEMAS
// ============================================================
/**
 * Match ID param (can be external_id string or numeric id)
 */
exports.matchIdParamSchema = zod_1.z.object({
    match_id: zod_1.z.string().min(1, 'Match ID is required'),
});
// ============================================================
// QUERY SCHEMAS
// ============================================================
/**
 * GET /api/matches/diary
 * Query params for diary endpoint
 */
exports.diaryQuerySchema = zod_1.z.object({
    date: zod_1.z.string().regex(/^\d{4}-?\d{2}-?\d{2}$/, 'Date must be YYYY-MM-DD or YYYYMMDD').optional(),
});
/**
 * GET /api/matches/unified
 * Query params for unified endpoint
 */
exports.unifiedQuerySchema = zod_1.z.object({
    date: zod_1.z.string().regex(/^\d{4}-?\d{2}-?\d{2}$/, 'Date must be YYYY-MM-DD or YYYYMMDD').optional(),
    include_live: zod_1.z.coerce.boolean().optional(),
    status: zod_1.z.string().optional(), // comma-separated status IDs
});
/**
 * GET /api/matches/should-be-live
 * Query params for should-be-live endpoint
 */
exports.shouldBeLiveQuerySchema = zod_1.z.object({
    maxMinutesAgo: zod_1.z.coerce.number().int().min(1).max(1440).default(120),
    limit: zod_1.z.coerce.number().int().min(1).max(500).default(200),
});
