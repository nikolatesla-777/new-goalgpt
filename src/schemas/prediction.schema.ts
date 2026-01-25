/**
 * Prediction Schemas
 *
 * PR-10: Schema Validation
 *
 * Zod schemas for prediction.routes.ts endpoints.
 * Includes both public ingest endpoints and admin mutation endpoints.
 */

import { z } from 'zod';
import {
  stringIdSchema,
  accessTypeSchema,
  scoreSchema,
  minuteSchema,
  botNameSchema,
  nonEmptyStringSchema,
} from './common';

// ============================================================
// INGEST (PUBLIC ENDPOINTS - External Bot Submissions)
// ============================================================

/**
 * POST /api/predictions/ingest
 * POST /api/v1/ingest/predictions
 *
 * External bot prediction submission
 * Note: Using non-strict mode to allow flexible external data
 */
export const ingestPredictionSchema = z.object({
  // Core fields
  id: z.string().optional(),
  date: z.string().optional(),
  prediction: z.string().optional(), // May be Base64 encoded
  bot_name: z.string().optional(),

  // Match info
  league: z.string().optional(),
  home_team: z.string().optional(),
  away_team: z.string().optional(),
  score: z.string().optional(),
  minute: z.union([z.string(), z.number()]).optional(),

  // Prediction details
  prediction_type: z.string().optional(),
  prediction_value: z.string().optional(),
  odds: z.union([z.string(), z.number()]).optional(),
  confidence: z.union([z.string(), z.number()]).optional(),

  // Additional metadata
  match_id: z.string().optional(),
  match_time: z.union([z.string(), z.number()]).optional(),
  status: z.string().optional(),
});

// ============================================================
// UPDATE RESULTS (ADMIN)
// ============================================================

/**
 * POST /api/predictions/update-results
 * Batch update prediction results
 */
export const updateResultsSchema = z.object({
  predictions: z.array(z.object({
    id: stringIdSchema,
    result: z.enum(['WIN', 'LOSE', 'VOID', 'PENDING']),
  })).min(1, 'At least one prediction required'),
});

// ============================================================
// DISPLAY MANAGEMENT (ADMIN)
// ============================================================

/**
 * PUT /api/predictions/:id/display
 * Update single prediction display text
 */
export const updateDisplaySchema = z.object({
  display_prediction: nonEmptyStringSchema,
});

/**
 * PUT /api/predictions/bulk-display
 * Bulk update prediction display texts
 */
export const bulkDisplaySchema = z.object({
  updates: z.array(z.object({
    id: stringIdSchema,
    display_prediction: nonEmptyStringSchema,
  })).min(1, 'At least one update required'),
});

// ============================================================
// ACCESS TYPE (ADMIN)
// ============================================================

/**
 * PUT /api/predictions/:id/access
 * Update prediction access type (VIP/FREE)
 */
export const updateAccessSchema = z.object({
  access_type: accessTypeSchema,
});

// ============================================================
// MANUAL PREDICTION (ADMIN)
// ============================================================

/**
 * POST /api/predictions/manual
 * Create manual prediction
 */
export const manualPredictionSchema = z.object({
  match_id: stringIdSchema,
  home_team: nonEmptyStringSchema,
  away_team: nonEmptyStringSchema,
  league: nonEmptyStringSchema,
  score: scoreSchema,
  minute: minuteSchema,
  prediction: nonEmptyStringSchema,
  access_type: accessTypeSchema,
  bot_name: botNameSchema.optional(),
  match_time: z.number().optional(),
});

/**
 * POST /api/predictions/manual-coupon
 * Create coupon with multiple predictions
 */
export const manualCouponSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  access_type: accessTypeSchema,
  items: z.array(z.object({
    match_id: stringIdSchema,
    home_team: nonEmptyStringSchema,
    away_team: nonEmptyStringSchema,
    league: nonEmptyStringSchema,
    score: z.string(), // May be "vs" for pre-match
    minute: z.number().int().min(0).optional(),
    prediction: nonEmptyStringSchema,
    match_time: z.number().optional(),
  })).min(1, 'At least one item required').max(20, 'Maximum 20 items allowed'),
});

// ============================================================
// MATCH LINKING (ADMIN)
// ============================================================

/**
 * POST /api/predictions/match-unmatched
 * Link unmatched predictions to matches
 */
export const matchUnmatchedSchema = z.object({
  prediction_ids: z.array(stringIdSchema).min(1, 'At least one prediction ID required'),
  match_id: stringIdSchema.optional(),
});

/**
 * POST /api/predictions/match/:externalId
 * Link prediction to specific match
 */
export const matchByExternalIdSchema = z.object({
  prediction_id: stringIdSchema,
});

// ============================================================
// PARAMS SCHEMAS
// ============================================================

/**
 * Prediction ID param
 */
export const predictionIdParamSchema = z.object({
  id: stringIdSchema,
});

/**
 * External ID param
 */
export const externalIdParamSchema = z.object({
  externalId: stringIdSchema,
});

// ============================================================
// TYPE EXPORTS
// ============================================================

export type IngestPredictionInput = z.infer<typeof ingestPredictionSchema>;
export type UpdateResultsInput = z.infer<typeof updateResultsSchema>;
export type UpdateDisplayInput = z.infer<typeof updateDisplaySchema>;
export type BulkDisplayInput = z.infer<typeof bulkDisplaySchema>;
export type UpdateAccessInput = z.infer<typeof updateAccessSchema>;
export type ManualPredictionInput = z.infer<typeof manualPredictionSchema>;
export type ManualCouponInput = z.infer<typeof manualCouponSchema>;
export type MatchUnmatchedInput = z.infer<typeof matchUnmatchedSchema>;
