/**
 * Common Schema Primitives
 *
 * PR-10: Schema Validation
 *
 * Reusable Zod schema primitives for consistent validation across endpoints.
 * Import these into domain-specific schema files.
 */

import { z } from 'zod';

// ============================================================
// STRING PRIMITIVES
// ============================================================

/**
 * Email with normalization (lowercase + trim)
 */
export const emailSchema = z
  .string()
  .email('Invalid email format')
  .transform((val) => val.toLowerCase().trim());

/**
 * Password with minimum length requirement
 */
export const passwordSchema = z
  .string()
  .min(6, 'Password must be at least 6 characters')
  .max(128, 'Password too long');

/**
 * Phone number in E.164 format
 * Examples: +905551234567, +14155551234
 */
export const phoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{1,14}$/, 'Phone must be in E.164 format (e.g., +905551234567)');

/**
 * UUID v4 format
 */
export const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * Non-empty string (trimmed)
 */
export const nonEmptyStringSchema = z
  .string()
  .min(1, 'This field is required')
  .transform((val) => val.trim());

/**
 * Optional string that transforms empty to undefined
 */
export const optionalStringSchema = z
  .string()
  .optional()
  .transform((val) => (val === '' ? undefined : val));

// ============================================================
// ID PRIMITIVES
// ============================================================

/**
 * Positive integer ID (coerces string to number)
 */
export const idSchema = z.coerce
  .number()
  .int('ID must be an integer')
  .positive('ID must be positive');

/**
 * String ID (for external_id, match_id, etc.)
 */
export const stringIdSchema = z
  .string()
  .min(1, 'ID is required');

/**
 * Optional string ID
 */
export const optionalStringIdSchema = z.string().optional();

// ============================================================
// COMMON OBJECTS
// ============================================================

/**
 * Device info for auth requests (mobile apps)
 */
export const deviceInfoSchema = z.object({
  deviceId: z.string().min(1).optional(),
  platform: z.enum(['ios', 'android', 'web']).optional(),
  appVersion: z.string().optional(),
  fcmToken: z.string().optional(),
  deviceModel: z.string().optional(),
  osVersion: z.string().optional(),
});

/**
 * Pagination query parameters
 */
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * Extended pagination with page number
 */
export const pageBasedPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/**
 * Date string (ISO 8601 format)
 */
export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

/**
 * Timestamp (Unix epoch in seconds)
 */
export const timestampSchema = z.coerce
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
export const matchStatusIdSchema = z.coerce.number().int().min(0).max(15);

/**
 * Score format (e.g., "2-1", "0-0")
 */
export const scoreSchema = z
  .string()
  .regex(/^\d+-\d+$/, 'Score must be in format "X-Y" (e.g., "2-1")');

/**
 * Match minute (0-150 for overtime/extra time)
 */
export const minuteSchema = z.coerce
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
export const accessTypeSchema = z.enum(['VIP', 'FREE']);

/**
 * Prediction result
 */
export const predictionResultSchema = z.enum(['WIN', 'LOSE', 'PENDING', 'VOID']);

/**
 * Bot name (alphanumeric with underscores)
 */
export const botNameSchema = z
  .string()
  .regex(/^[a-zA-Z0-9_]+$/, 'Bot name must be alphanumeric with underscores');

// ============================================================
// TYPE EXPORTS
// ============================================================

export type Email = z.infer<typeof emailSchema>;
export type Phone = z.infer<typeof phoneSchema>;
export type DeviceInfo = z.infer<typeof deviceInfoSchema>;
export type Pagination = z.infer<typeof paginationSchema>;
export type AccessType = z.infer<typeof accessTypeSchema>;
export type PredictionResult = z.infer<typeof predictionResultSchema>;
