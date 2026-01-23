"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.optionalAuth = optionalAuth;
exports.requireAdmin = requireAdmin;
exports.requireVIP = requireVIP;
exports.getCurrentUserId = getCurrentUserId;
exports.isAuthenticated = isAuthenticated;
const jwt_utils_1 = require("../utils/jwt.utils");
const kysely_1 = require("../database/kysely");
const logger_1 = require("../utils/logger");
/**
 * Middleware: Require authentication
 * Verifies JWT token and attaches user to request
 * Returns 401 if token is missing or invalid
 */
async function requireAuth(request, reply) {
    try {
        // 1. Extract token from Authorization header
        const token = (0, jwt_utils_1.extractTokenFromHeader)(request.headers.authorization);
        if (!token) {
            return reply.status(401).send({
                error: 'UNAUTHORIZED',
                message: 'Authorization token required',
            });
        }
        // 2. Verify token
        let decoded;
        try {
            decoded = (0, jwt_utils_1.verifyAccessToken)(token);
        }
        catch (err) {
            logger_1.logger.warn('Invalid JWT token:', { error: err.message });
            return reply.status(401).send({
                error: err.message || 'INVALID_TOKEN',
                message: 'Invalid or expired token',
            });
        }
        // 3. Verify user exists in database
        const user = await kysely_1.db
            .selectFrom('customer_users')
            .select(['id', 'email', 'phone', 'deleted_at'])
            .where('id', '=', decoded.userId)
            .executeTakeFirst();
        if (!user) {
            return reply.status(401).send({
                error: 'USER_NOT_FOUND',
                message: 'User not found',
            });
        }
        if (user.deleted_at) {
            return reply.status(401).send({
                error: 'USER_DELETED',
                message: 'User account has been deleted',
            });
        }
        // 4. Attach user to request
        request.user = {
            userId: user.id,
            email: user.email,
            phone: user.phone,
            role: decoded.role,
        };
        // Continue to route handler
    }
    catch (error) {
        logger_1.logger.error('Auth middleware error:', error);
        return reply.status(500).send({
            error: 'INTERNAL_SERVER_ERROR',
            message: 'Authentication error',
        });
    }
}
/**
 * Middleware: Optional authentication
 * Verifies JWT token if provided, but doesn't require it
 * Attaches user to request if token is valid
 */
async function optionalAuth(request, reply) {
    try {
        // Extract token from Authorization header
        const token = (0, jwt_utils_1.extractTokenFromHeader)(request.headers.authorization);
        if (!token) {
            // No token provided, continue without user
            return;
        }
        // Verify token
        let decoded;
        try {
            decoded = (0, jwt_utils_1.verifyAccessToken)(token);
        }
        catch (err) {
            // Invalid token, continue without user
            logger_1.logger.debug('Optional auth: Invalid token', { error: err.message });
            return;
        }
        // Verify user exists
        const user = await kysely_1.db
            .selectFrom('customer_users')
            .select(['id', 'email', 'phone', 'deleted_at'])
            .where('id', '=', decoded.userId)
            .executeTakeFirst();
        if (user && !user.deleted_at) {
            // Attach user to request
            request.user = {
                userId: user.id,
                email: user.email,
                phone: user.phone,
                role: decoded.role,
            };
        }
    }
    catch (error) {
        logger_1.logger.error('Optional auth middleware error:', error);
        // Continue without user on error
    }
}
/**
 * Middleware: Require admin role
 * Must be used after requireAuth
 */
async function requireAdmin(request, reply) {
    if (!request.user) {
        return reply.status(401).send({
            error: 'UNAUTHORIZED',
            message: 'Authentication required',
        });
    }
    // Check if user has admin role
    if (request.user.role !== 'admin') {
        logger_1.logger.warn('Unauthorized admin access attempt:', {
            userId: request.user.userId,
            role: request.user.role,
        });
        return reply.status(403).send({
            error: 'FORBIDDEN',
            message: 'Admin access required',
        });
    }
}
/**
 * Middleware: Require VIP subscription
 * Must be used after requireAuth
 */
async function requireVIP(request, reply) {
    if (!request.user) {
        return reply.status(401).send({
            error: 'UNAUTHORIZED',
            message: 'Authentication required',
        });
    }
    // Check if user has active VIP subscription
    const subscription = await kysely_1.db
        .selectFrom('customer_subscriptions')
        .select(['id', 'status', 'expired_at'])
        .where('customer_user_id', '=', request.user.userId)
        .where('status', '=', 'active')
        .where('expired_at', '>', new Date())
        .executeTakeFirst();
    if (!subscription) {
        return reply.status(403).send({
            error: 'VIP_REQUIRED',
            message: 'VIP subscription required',
        });
    }
}
/**
 * Helper: Get current authenticated user ID
 * Throws error if user is not authenticated
 */
function getCurrentUserId(request) {
    if (!request.user) {
        throw new Error('User not authenticated');
    }
    return request.user.userId;
}
/**
 * Helper: Check if user is authenticated
 */
function isAuthenticated(request) {
    return !!request.user;
}
