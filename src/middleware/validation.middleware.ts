/**
 * Validation Middleware - Zod Schema Validation for Fastify Routes
 *
 * PR-10: Schema Validation
 *
 * This middleware validates request body, params, and query using Zod schemas.
 * It follows the same preHandler pattern as auth.middleware.ts for consistency.
 *
 * Features:
 * - Strict mode by default (rejects unknown fields)
 * - Standardized error response format
 * - Type-safe request parsing
 * - Logging of validation failures
 *
 * Usage:
 * ```typescript
 * import { validate } from '../middleware/validation.middleware';
 * import { emailLoginSchema } from '../schemas/auth.schema';
 *
 * fastify.post('/login', {
 *   preHandler: [validate({ body: emailLoginSchema })]
 * }, loginHandler);
 * ```
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { ZodError, ZodSchema, ZodObject, ZodRawShape } from 'zod';
import { logger } from '../utils/logger';

// Helper to check if schema is a ZodObject (which has .strict() method)
function isZodObject(schema: ZodSchema): schema is ZodObject<ZodRawShape> {
  return schema instanceof ZodObject;
}

// ============================================================
// TYPES
// ============================================================

/**
 * Validation error response format
 * Consistent with existing error patterns in the codebase
 */
export interface ValidationErrorResponse {
  success: false;
  error: 'VALIDATION_ERROR';
  message: string;
  details: Array<{
    field: string;
    message: string;
    code?: string;
  }>;
}

/**
 * Validation options
 */
export interface ValidateOptions {
  /** Schema for request body validation */
  body?: ZodSchema;
  /** Schema for URL params validation */
  params?: ZodSchema;
  /** Schema for query string validation */
  query?: ZodSchema;
  /**
   * If true (default), reject unknown fields for security
   * Set to false only for flexible endpoints like external API ingestion
   */
  strict?: boolean;
}

// ============================================================
// ERROR FORMATTING
// ============================================================

/**
 * Format Zod validation errors into standardized response
 */
function formatZodError(error: ZodError): ValidationErrorResponse {
  return {
    success: false,
    error: 'VALIDATION_ERROR',
    message: 'Request validation failed',
    details: error.errors.map((err) => ({
      field: err.path.join('.') || 'root',
      message: err.message,
      code: err.code,
    })),
  };
}

// ============================================================
// VALIDATION MIDDLEWARE
// ============================================================

/**
 * Create validation preHandler middleware
 *
 * @param options - Schemas for body, params, and query validation
 * @returns Fastify preHandler function
 *
 * @example
 * // Validate body only
 * fastify.post('/login', { preHandler: [validate({ body: loginSchema })] }, handler);
 *
 * @example
 * // Validate params and query
 * fastify.get('/users/:id', {
 *   preHandler: [validate({ params: userIdSchema, query: paginationSchema })]
 * }, handler);
 *
 * @example
 * // Combine with auth middleware
 * fastify.post('/protected', {
 *   preHandler: [requireAuth, validate({ body: protectedSchema })]
 * }, handler);
 */
export function validate(options: ValidateOptions) {
  const strict = options.strict !== false; // Default to strict mode

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      // Validate body
      if (options.body && request.body !== undefined) {
        // Only apply strict() to ZodObject schemas
        const schema = strict && isZodObject(options.body) ? options.body.strict() : options.body;
        request.body = schema.parse(request.body);
      }

      // Validate params
      if (options.params && request.params) {
        // Only apply strict() to ZodObject schemas
        const schema = strict && isZodObject(options.params) ? options.params.strict() : options.params;
        request.params = schema.parse(request.params);
      }

      // Validate query
      if (options.query && request.query) {
        // Query params are more lenient - don't use strict by default
        // because browsers/clients often add extra params
        request.query = options.query.parse(request.query);
      }
    } catch (error) {
      if (error instanceof ZodError) {
        // Log validation failure for monitoring
        logger.warn('[Validation] Request validation failed', {
          path: request.url,
          method: request.method,
          errorCount: error.errors.length,
          fields: error.errors.map((e) => e.path.join('.')),
        });

        return reply.status(400).send(formatZodError(error));
      }

      // Re-throw non-Zod errors
      throw error;
    }
  };
}

// ============================================================
// CONVENIENCE FUNCTIONS
// ============================================================

/**
 * Validate request body only
 * @param schema - Zod schema for body validation
 */
export function validateBody(schema: ZodSchema) {
  return validate({ body: schema });
}

/**
 * Validate URL params only
 * @param schema - Zod schema for params validation
 */
export function validateParams(schema: ZodSchema) {
  return validate({ params: schema });
}

/**
 * Validate query string only
 * @param schema - Zod schema for query validation
 */
export function validateQuery(schema: ZodSchema) {
  return validate({ query: schema });
}

/**
 * Validate body with non-strict mode (allows unknown fields)
 * Use for flexible endpoints like external API ingestion
 * @param schema - Zod schema for body validation
 */
export function validateBodyFlexible(schema: ZodSchema) {
  return validate({ body: schema, strict: false });
}
