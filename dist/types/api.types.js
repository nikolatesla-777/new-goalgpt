"use strict";
/**
 * API Response Types
 *
 * Standardized response format for all API endpoints
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorCodes = void 0;
exports.successResponse = successResponse;
exports.errorResponse = errorResponse;
/**
 * Helper function to create a success response
 */
function successResponse(data, meta) {
    return {
        success: true,
        data,
        meta: {
            timestamp: Date.now(),
            ...meta,
        },
    };
}
/**
 * Helper function to create an error response
 */
function errorResponse(code, message, details) {
    return {
        success: false,
        error: {
            code,
            message,
            details,
        },
        meta: {
            timestamp: Date.now(),
        },
    };
}
/**
 * Common error codes
 */
exports.ErrorCodes = {
    // Authentication errors
    UNAUTHORIZED: 'UNAUTHORIZED',
    INVALID_TOKEN: 'INVALID_TOKEN',
    TOKEN_EXPIRED: 'TOKEN_EXPIRED',
    USER_NOT_FOUND: 'USER_NOT_FOUND',
    // Authorization errors
    FORBIDDEN: 'FORBIDDEN',
    ADMIN_REQUIRED: 'ADMIN_REQUIRED',
    VIP_REQUIRED: 'VIP_REQUIRED',
    // Validation errors
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    INVALID_INPUT: 'INVALID_INPUT',
    MISSING_FIELD: 'MISSING_FIELD',
    // Resource errors
    NOT_FOUND: 'NOT_FOUND',
    ALREADY_EXISTS: 'ALREADY_EXISTS',
    CONFLICT: 'CONFLICT',
    // Rate limiting
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    // Server errors
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
};
