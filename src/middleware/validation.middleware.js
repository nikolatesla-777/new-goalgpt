"use strict";
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = validate;
exports.validateBody = validateBody;
exports.validateParams = validateParams;
exports.validateQuery = validateQuery;
exports.validateBodyFlexible = validateBodyFlexible;
var zod_1 = require("zod");
var logger_1 = require("../utils/logger");
// Helper to check if schema is a ZodObject (which has .strict() method)
function isZodObject(schema) {
    return schema instanceof zod_1.ZodObject;
}
// ============================================================
// ERROR FORMATTING
// ============================================================
/**
 * Format Zod validation errors into standardized response
 */
function formatZodError(error) {
    return {
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: error.issues.map(function (err) { return ({
            field: err.path.join('.') || 'root',
            message: err.message,
            code: err.code,
        }); }),
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
function validate(options) {
    var _this = this;
    var strict = options.strict !== false; // Default to strict mode
    return function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
        var schema, schema;
        return __generator(this, function (_a) {
            try {
                // Validate body
                if (options.body && request.body !== undefined) {
                    schema = strict && isZodObject(options.body) ? options.body.strict() : options.body;
                    request.body = schema.parse(request.body);
                }
                // Validate params
                if (options.params && request.params) {
                    schema = strict && isZodObject(options.params) ? options.params.strict() : options.params;
                    request.params = schema.parse(request.params);
                }
                // Validate query
                if (options.query && request.query) {
                    // Query params are more lenient - don't use strict by default
                    // because browsers/clients often add extra params
                    request.query = options.query.parse(request.query);
                }
            }
            catch (error) {
                if (error instanceof zod_1.ZodError) {
                    // Log validation failure for monitoring
                    logger_1.logger.warn('[Validation] Request validation failed', {
                        path: request.url,
                        method: request.method,
                        errorCount: error.issues.length,
                        fields: error.issues.map(function (e) { return e.path.join('.'); }),
                    });
                    return [2 /*return*/, reply.status(400).send(formatZodError(error))];
                }
                // Re-throw non-Zod errors
                throw error;
            }
            return [2 /*return*/];
        });
    }); };
}
// ============================================================
// CONVENIENCE FUNCTIONS
// ============================================================
/**
 * Validate request body only
 * @param schema - Zod schema for body validation
 */
function validateBody(schema) {
    return validate({ body: schema });
}
/**
 * Validate URL params only
 * @param schema - Zod schema for params validation
 */
function validateParams(schema) {
    return validate({ params: schema });
}
/**
 * Validate query string only
 * @param schema - Zod schema for query validation
 */
function validateQuery(schema) {
    return validate({ query: schema });
}
/**
 * Validate body with non-strict mode (allows unknown fields)
 * Use for flexible endpoints like external API ingestion
 * @param schema - Zod schema for body validation
 */
function validateBodyFlexible(schema) {
    return validate({ body: schema, strict: false });
}
