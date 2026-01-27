"use strict";
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
exports.requireAuth = requireAuth;
exports.optionalAuth = optionalAuth;
exports.requireAdmin = requireAdmin;
exports.requireVIP = requireVIP;
exports.getCurrentUserId = getCurrentUserId;
exports.isAuthenticated = isAuthenticated;
var jwt_utils_1 = require("../utils/jwt.utils");
var kysely_1 = require("../database/kysely");
var logger_1 = require("../utils/logger");
/**
 * Middleware: Require authentication
 * Verifies JWT token and attaches user to request
 * Returns 401 if token is missing or invalid
 */
function requireAuth(request, reply) {
    return __awaiter(this, void 0, void 0, function () {
        var token, decoded, user, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    token = (0, jwt_utils_1.extractTokenFromHeader)(request.headers.authorization);
                    if (!token) {
                        return [2 /*return*/, reply.status(401).send({
                                error: 'UNAUTHORIZED',
                                message: 'Authorization token required',
                            })];
                    }
                    decoded = void 0;
                    try {
                        decoded = (0, jwt_utils_1.verifyAccessToken)(token);
                    }
                    catch (err) {
                        logger_1.logger.warn('Invalid JWT token:', { error: err.message });
                        return [2 /*return*/, reply.status(401).send({
                                error: err.message || 'INVALID_TOKEN',
                                message: 'Invalid or expired token',
                            })];
                    }
                    return [4 /*yield*/, kysely_1.db
                            .selectFrom('customer_users')
                            .select(['id', 'email', 'phone', 'deleted_at'])
                            .where('id', '=', decoded.userId)
                            .executeTakeFirst()];
                case 1:
                    user = _a.sent();
                    if (!user) {
                        return [2 /*return*/, reply.status(401).send({
                                error: 'USER_NOT_FOUND',
                                message: 'User not found',
                            })];
                    }
                    if (user.deleted_at) {
                        return [2 /*return*/, reply.status(401).send({
                                error: 'USER_DELETED',
                                message: 'User account has been deleted',
                            })];
                    }
                    // 4. Attach user to request
                    request.user = {
                        userId: user.id,
                        email: user.email,
                        phone: user.phone,
                        role: decoded.role,
                    };
                    return [3 /*break*/, 3];
                case 2:
                    error_1 = _a.sent();
                    logger_1.logger.error('Auth middleware error:', error_1);
                    return [2 /*return*/, reply.status(500).send({
                            error: 'INTERNAL_SERVER_ERROR',
                            message: 'Authentication error',
                        })];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Middleware: Optional authentication
 * Verifies JWT token if provided, but doesn't require it
 * Attaches user to request if token is valid
 */
function optionalAuth(request, reply) {
    return __awaiter(this, void 0, void 0, function () {
        var token, decoded, user, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    token = (0, jwt_utils_1.extractTokenFromHeader)(request.headers.authorization);
                    if (!token) {
                        // No token provided, continue without user
                        return [2 /*return*/];
                    }
                    decoded = void 0;
                    try {
                        decoded = (0, jwt_utils_1.verifyAccessToken)(token);
                    }
                    catch (err) {
                        // Invalid token, continue without user
                        logger_1.logger.debug('Optional auth: Invalid token', { error: err.message });
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, kysely_1.db
                            .selectFrom('customer_users')
                            .select(['id', 'email', 'phone', 'deleted_at'])
                            .where('id', '=', decoded.userId)
                            .executeTakeFirst()];
                case 1:
                    user = _a.sent();
                    if (user && !user.deleted_at) {
                        // Attach user to request
                        request.user = {
                            userId: user.id,
                            email: user.email,
                            phone: user.phone,
                            role: decoded.role,
                        };
                    }
                    return [3 /*break*/, 3];
                case 2:
                    error_2 = _a.sent();
                    logger_1.logger.error('Optional auth middleware error:', error_2);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Middleware: Require admin role
 * Must be used after requireAuth
 */
function requireAdmin(request, reply) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            if (!request.user) {
                return [2 /*return*/, reply.status(401).send({
                        error: 'UNAUTHORIZED',
                        message: 'Authentication required',
                    })];
            }
            // Check if user has admin role
            if (request.user.role !== 'admin') {
                logger_1.logger.warn('Unauthorized admin access attempt:', {
                    userId: request.user.userId,
                    role: request.user.role,
                });
                return [2 /*return*/, reply.status(403).send({
                        error: 'FORBIDDEN',
                        message: 'Admin access required',
                    })];
            }
            return [2 /*return*/];
        });
    });
}
/**
 * Middleware: Require VIP subscription
 * Must be used after requireAuth
 */
function requireVIP(request, reply) {
    return __awaiter(this, void 0, void 0, function () {
        var subscription;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!request.user) {
                        return [2 /*return*/, reply.status(401).send({
                                error: 'UNAUTHORIZED',
                                message: 'Authentication required',
                            })];
                    }
                    return [4 /*yield*/, kysely_1.db
                            .selectFrom('customer_subscriptions')
                            .select(['id', 'status', 'expired_at'])
                            .where('customer_user_id', '=', request.user.userId)
                            .where('status', '=', 'active')
                            .where('expired_at', '>', new Date())
                            .executeTakeFirst()];
                case 1:
                    subscription = _a.sent();
                    if (!subscription) {
                        return [2 /*return*/, reply.status(403).send({
                                error: 'VIP_REQUIRED',
                                message: 'VIP subscription required',
                            })];
                    }
                    return [2 /*return*/];
            }
        });
    });
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
