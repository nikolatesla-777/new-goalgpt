"use strict";
/**
 * Common Schema Primitives
 *
 * PR-10: Schema Validation
 *
 * Reusable Zod schema primitives for consistent validation across endpoints.
 * Import these into domain-specific schema files.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.botNameSchema = exports.predictionResultSchema = exports.accessTypeSchema = exports.minuteSchema = exports.scoreSchema = exports.matchStatusIdSchema = exports.timestampSchema = exports.dateStringSchema = exports.pageBasedPaginationSchema = exports.paginationSchema = exports.deviceInfoSchema = exports.optionalStringIdSchema = exports.stringIdSchema = exports.idSchema = exports.optionalStringSchema = exports.nonEmptyStringSchema = exports.uuidSchema = exports.phoneSchema = exports.passwordSchema = exports.emailSchema = void 0;
var zod_1 = require("zod");
// ============================================================
// STRING PRIMITIVES
// ============================================================
/**
 * Email with normalization (lowercase + trim)
 */
exports.emailSchema = zod_1.z
    .string()
    .email('Invalid email format')
    .transform(function (val) { return val.toLowerCase().trim(); });
/**
 * Password with minimum length requirement
 */
exports.passwordSchema = zod_1.z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(128, 'Password too long');
/**
 * Phone number in E.164 format
 * Examples: +905551234567, +14155551234
 */
exports.phoneSchema = zod_1.z
    .string()
    .regex(/^\+[1-9]\d{1,14}$/, 'Phone must be in E.164 format (e.g., +905551234567)');
/**
 * UUID v4 format
 */
exports.uuidSchema = zod_1.z.string().uuid('Invalid UUID format');
/**
 * Non-empty string (trimmed)
 */
exports.nonEmptyStringSchema = zod_1.z
    .string()
    .min(1, 'This field is required')
    .transform(function (val) { return val.trim(); });
/**
 * Optional string that transforms empty to undefined
 */
exports.optionalStringSchema = zod_1.z
    .string()
    .optional()
    .transform(function (val) { return (val === '' ? undefined : val); });
// ============================================================
// ID PRIMITIVES
// ============================================================
/**
 * Positive integer ID (coerces string to number)
 */
exports.idSchema = zod_1.z.coerce
    .number()
    .int('ID must be an integer')
    .positive('ID must be positive');
/**
 * String ID (for external_id, match_id, etc.)
 */
exports.stringIdSchema = zod_1.z
    .string()
    .min(1, 'ID is required');
/**
 * Optional string ID
 */
exports.optionalStringIdSchema = zod_1.z.string().optional();
// ============================================================
// COMMON OBJECTS
// ============================================================
/**
 * Device info for auth requests (mobile apps)
 */
exports.deviceInfoSchema = zod_1.z.object({
    deviceId: zod_1.z.string().min(1).optional(),
    platform: zod_1.z.enum(['ios', 'android', 'web']).optional(),
    appVersion: zod_1.z.string().optional(),
    fcmToken: zod_1.z.string().optional(),
    deviceModel: zod_1.z.string().optional(),
    osVersion: zod_1.z.string().optional(),
});
/**
 * Pagination query parameters
 */
exports.paginationSchema = zod_1.z.object({
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(50),
    offset: zod_1.z.coerce.number().int().min(0).default(0),
});
/**
 * Extended pagination with page number
 */
exports.pageBasedPaginationSchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(50),
});
/**
 * Date string (ISO 8601 format)
 */
exports.dateStringSchema = zod_1.z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');
/**
 * Timestamp (Unix epoch in seconds)
 */
exports.timestampSchema = zod_1.z.coerce
    .number()
    .int()
    .positive('Timestamp must be positive');
// ============================================================
// MATCH-RELATED
// ============================================================
/**
 * Match status ID enum
 * From TheSports API documentation
 */
exports.matchStatusIdSchema = zod_1.z.coerce.number().int().min(0).max(15);
/**
 * Score format (e.g., "2-1", "0-0")
 */
exports.scoreSchema = zod_1.z
    .string()
    .regex(/^\d+-\d+$/, 'Score must be in format "X-Y" (e.g., "2-1")');
/**
 * Match minute (0-150 for overtime/extra time)
 */
exports.minuteSchema = zod_1.z.coerce
    .number()
    .int()
    .min(0, 'Minute cannot be negative')
    .max(150, 'Minute cannot exceed 150');
// ============================================================
// PREDICTION-RELATED
// ============================================================
/**
 * Prediction access type
 */
exports.accessTypeSchema = zod_1.z.enum(['VIP', 'FREE']);
/**
 * Prediction result
 */
exports.predictionResultSchema = zod_1.z.enum(['WIN', 'LOSE', 'PENDING', 'VOID']);
/**
 * Bot name (alphanumeric with underscores)
 */
exports.botNameSchema = zod_1.z
    .string()
    .regex(/^[a-zA-Z0-9_]+$/, 'Bot name must be alphanumeric with underscores');
