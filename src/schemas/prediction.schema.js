"use strict";
/**
 * Prediction Schemas
 *
 * PR-10: Schema Validation
 *
 * Zod schemas for prediction.routes.ts endpoints.
 * Includes both public ingest endpoints and admin mutation endpoints.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.externalIdParamSchema = exports.predictionIdParamSchema = exports.matchByExternalIdSchema = exports.matchUnmatchedSchema = exports.manualCouponSchema = exports.manualPredictionSchema = exports.updateAccessSchema = exports.bulkDisplaySchema = exports.updateDisplaySchema = exports.updateResultsSchema = exports.ingestPredictionSchema = void 0;
var zod_1 = require("zod");
var common_1 = require("./common");
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
exports.ingestPredictionSchema = zod_1.z.object({
    // Core fields
    id: zod_1.z.string().optional(),
    date: zod_1.z.string().optional(),
    prediction: zod_1.z.string().optional(), // May be Base64 encoded
    bot_name: zod_1.z.string().optional(),
    // Match info
    league: zod_1.z.string().optional(),
    home_team: zod_1.z.string().optional(),
    away_team: zod_1.z.string().optional(),
    score: zod_1.z.string().optional(),
    minute: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).optional(),
    // Prediction details
    prediction_type: zod_1.z.string().optional(),
    prediction_value: zod_1.z.string().optional(),
    odds: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).optional(),
    confidence: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).optional(),
    // Additional metadata
    match_id: zod_1.z.string().optional(),
    match_time: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).optional(),
    status: zod_1.z.string().optional(),
});
// ============================================================
// UPDATE RESULTS (ADMIN)
// ============================================================
/**
 * POST /api/predictions/update-results
 * Batch update prediction results
 */
exports.updateResultsSchema = zod_1.z.object({
    predictions: zod_1.z.array(zod_1.z.object({
        id: common_1.stringIdSchema,
        result: zod_1.z.enum(['WIN', 'LOSE', 'VOID', 'PENDING']),
    })).min(1, 'At least one prediction required'),
});
// ============================================================
// DISPLAY MANAGEMENT (ADMIN)
// ============================================================
/**
 * PUT /api/predictions/:id/display
 * Update single prediction display text
 */
exports.updateDisplaySchema = zod_1.z.object({
    display_prediction: common_1.nonEmptyStringSchema,
});
/**
 * PUT /api/predictions/bulk-display
 * Bulk update prediction display texts
 */
exports.bulkDisplaySchema = zod_1.z.object({
    updates: zod_1.z.array(zod_1.z.object({
        id: common_1.stringIdSchema,
        display_prediction: common_1.nonEmptyStringSchema,
    })).min(1, 'At least one update required'),
});
// ============================================================
// ACCESS TYPE (ADMIN)
// ============================================================
/**
 * PUT /api/predictions/:id/access
 * Update prediction access type (VIP/FREE)
 */
exports.updateAccessSchema = zod_1.z.object({
    access_type: common_1.accessTypeSchema,
});
// ============================================================
// MANUAL PREDICTION (ADMIN)
// ============================================================
/**
 * POST /api/predictions/manual
 * Create manual prediction
 */
exports.manualPredictionSchema = zod_1.z.object({
    match_id: common_1.stringIdSchema,
    home_team: common_1.nonEmptyStringSchema,
    away_team: common_1.nonEmptyStringSchema,
    league: common_1.nonEmptyStringSchema,
    score: common_1.scoreSchema,
    minute: common_1.minuteSchema,
    prediction: common_1.nonEmptyStringSchema,
    access_type: common_1.accessTypeSchema,
    bot_name: common_1.botNameSchema.optional(),
    match_time: zod_1.z.number().optional(),
});
/**
 * POST /api/predictions/manual-coupon
 * Create coupon with multiple predictions
 */
exports.manualCouponSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(200),
    description: zod_1.z.string().max(500).optional(),
    access_type: common_1.accessTypeSchema,
    items: zod_1.z.array(zod_1.z.object({
        match_id: common_1.stringIdSchema,
        home_team: common_1.nonEmptyStringSchema,
        away_team: common_1.nonEmptyStringSchema,
        league: common_1.nonEmptyStringSchema,
        score: zod_1.z.string(), // May be "vs" for pre-match
        minute: zod_1.z.number().int().min(0).optional(),
        prediction: common_1.nonEmptyStringSchema,
        match_time: zod_1.z.number().optional(),
    })).min(1, 'At least one item required').max(20, 'Maximum 20 items allowed'),
});
// ============================================================
// MATCH LINKING (ADMIN)
// ============================================================
/**
 * POST /api/predictions/match-unmatched
 * Link unmatched predictions to matches
 */
exports.matchUnmatchedSchema = zod_1.z.object({
    prediction_ids: zod_1.z.array(common_1.stringIdSchema).min(1, 'At least one prediction ID required'),
    match_id: common_1.stringIdSchema.optional(),
});
/**
 * POST /api/predictions/match/:externalId
 * Link prediction to specific match
 */
exports.matchByExternalIdSchema = zod_1.z.object({
    prediction_id: common_1.stringIdSchema,
});
// ============================================================
// PARAMS SCHEMAS
// ============================================================
/**
 * Prediction ID param
 */
exports.predictionIdParamSchema = zod_1.z.object({
    id: common_1.stringIdSchema,
});
/**
 * External ID param
 */
exports.externalIdParamSchema = zod_1.z.object({
    externalId: common_1.stringIdSchema,
});
