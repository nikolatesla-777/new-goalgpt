/**
 * Match Schemas
 *
 * PR-10: Schema Validation
 *
 * Zod schemas for match.routes.ts endpoints.
 * Validates match-related API requests.
 */

import { z } from 'zod';

// ============================================================
// PARAM SCHEMAS
// ============================================================

/**
 * Match ID param (can be external_id string or numeric id)
 */
export const matchIdParamSchema = z.object({
  match_id: z.string().min(1, 'Match ID is required'),
});

// ============================================================
// QUERY SCHEMAS
// ============================================================

/**
 * GET /api/matches/diary
 * Query params for diary endpoint
 */
export const diaryQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-?\d{2}-?\d{2}$/, 'Date must be YYYY-MM-DD or YYYYMMDD').optional(),
});

/**
 * GET /api/matches/unified
 * Query params for unified endpoint
 */
export const unifiedQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-?\d{2}-?\d{2}$/, 'Date must be YYYY-MM-DD or YYYYMMDD').optional(),
  include_live: z.coerce.boolean().optional(),
  status: z.string().optional(), // comma-separated status IDs
});

/**
 * GET /api/matches/should-be-live
 * Query params for should-be-live endpoint
 */
export const shouldBeLiveQuerySchema = z.object({
  maxMinutesAgo: z.coerce.number().int().min(1).max(1440).default(120),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

// ============================================================
// TYPE EXPORTS
// ============================================================

export type MatchIdParam = z.infer<typeof matchIdParamSchema>;
export type DiaryQuery = z.infer<typeof diaryQuerySchema>;
export type UnifiedQuery = z.infer<typeof unifiedQuerySchema>;
export type ShouldBeLiveQuery = z.infer<typeof shouldBeLiveQuerySchema>;
