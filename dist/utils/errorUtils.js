"use strict";
/**
 * Error Handling Utilities
 *
 * Type-safe error handling helpers to replace `error: any` patterns
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getErrorMessage = getErrorMessage;
exports.getErrorStack = getErrorStack;
exports.hasErrorProperty = hasErrorProperty;
exports.getErrorStatusCode = getErrorStatusCode;
exports.createError = createError;
exports.isError = isError;
exports.stringifyError = stringifyError;
/**
 * Extract error message from unknown error type
 * Use this instead of `error: any` in catch blocks
 *
 * @example
 * try {
 *   // ... code
 * } catch (error: unknown) {
 *   const message = getErrorMessage(error);
 *   logger.error('Operation failed:', message);
 * }
 */
function getErrorMessage(error) {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    if (error && typeof error === 'object' && 'message' in error) {
        return String(error.message);
    }
    return 'An unknown error occurred';
}
/**
 * Extract error stack from unknown error type
 */
function getErrorStack(error) {
    if (error instanceof Error) {
        return error.stack;
    }
    return undefined;
}
/**
 * Check if error has a specific property
 */
function hasErrorProperty(error, property) {
    return error !== null && typeof error === 'object' && property in error;
}
/**
 * Extract HTTP status code from error if available
 */
function getErrorStatusCode(error) {
    if (hasErrorProperty(error, 'statusCode')) {
        return typeof error.statusCode === 'number' ? error.statusCode : undefined;
    }
    if (hasErrorProperty(error, 'status')) {
        return typeof error.status === 'number' ? error.status : undefined;
    }
    return undefined;
}
/**
 * Create a standardized error object
 */
function createError(message, code, details) {
    const error = new Error(message);
    if (code)
        error.code = code;
    if (details)
        error.details = details;
    return error;
}
/**
 * Type guard to check if value is an Error
 */
function isError(value) {
    return value instanceof Error;
}
/**
 * Safely stringify an error for logging
 */
function stringifyError(error) {
    if (error instanceof Error) {
        return JSON.stringify({
            name: error.name,
            message: error.message,
            stack: error.stack,
        });
    }
    try {
        return JSON.stringify(error);
    }
    catch {
        return String(error);
    }
}
