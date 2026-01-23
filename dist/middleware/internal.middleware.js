"use strict";
/**
 * Internal Middleware
 *
 * PR-2: Protects internal API routes
 * Allows access via:
 * - X-Internal-Secret header matching env INTERNAL_SECRET
 * - OR request from localhost (127.0.0.1, ::1)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireInternal = requireInternal;
exports.isInternalSecretConfigured = isInternalSecretConfigured;
const logger_1 = require("../utils/logger");
/**
 * Middleware: Require internal access
 * Checks for X-Internal-Secret header OR localhost origin
 * Returns 403 if neither condition is met
 */
async function requireInternal(request, reply) {
    const INTERNAL_SECRET = process.env.INTERNAL_SECRET;
    // 1. Check X-Internal-Secret header
    const providedSecret = request.headers['x-internal-secret'];
    if (INTERNAL_SECRET && providedSecret === INTERNAL_SECRET) {
        // Valid internal secret provided
        return;
    }
    // 2. Check if request is from localhost
    // request.ip contains the client IP (handles X-Forwarded-For if trustProxy is enabled)
    const clientIp = request.ip;
    const isLocalhost = clientIp === '127.0.0.1' ||
        clientIp === '::1' ||
        clientIp === '::ffff:127.0.0.1' ||
        clientIp === 'localhost';
    if (isLocalhost) {
        // Request from localhost is allowed
        return;
    }
    // 3. Neither condition met - deny access
    logger_1.logger.warn('[Internal] Unauthorized access attempt:', {
        ip: clientIp,
        path: request.url,
        method: request.method,
        hasSecret: !!providedSecret,
    });
    return reply.status(403).send({
        error: 'FORBIDDEN',
        message: 'Internal access required',
    });
}
/**
 * Helper: Check if environment has internal secret configured
 */
function isInternalSecretConfigured() {
    return !!process.env.INTERNAL_SECRET;
}
