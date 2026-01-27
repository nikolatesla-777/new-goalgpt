"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.phoneLogin = phoneLogin;
exports.refreshToken = refreshToken;
var jwt_utils_1 = require("../../utils/jwt.utils");
var logger_1 = require("../../utils/logger");
var referrals_service_1 = require("../../services/referrals.service");
// PR-4: Use repository for all user DB access
var user_repository_1 = require("../../repositories/user.repository");
/**
 * POST /api/auth/phone/login
 * Phone login - Login existing user or create new user
 */
function phoneLogin(request, reply) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, phone, referralCode, deviceInfo, user, isNewUser, userId, refError_1, userProfile, tokens, error_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 14, , 15]);
                    _a = request.body, phone = _a.phone, referralCode = _a.referralCode, deviceInfo = _a.deviceInfo;
                    if (!phone) {
                        return [2 /*return*/, reply.status(400).send({
                                error: 'PHONE_REQUIRED',
                                message: 'Phone number is required',
                            })];
                    }
                    // Validate phone format (basic check)
                    if (!phone.startsWith('+') || phone.length < 10) {
                        return [2 /*return*/, reply.status(400).send({
                                error: 'INVALID_PHONE_FORMAT',
                                message: 'Phone must be in E.164 format (e.g., +905551234567)',
                            })];
                    }
                    return [4 /*yield*/, (0, user_repository_1.getUserByPhone)(phone)];
                case 1:
                    user = _b.sent();
                    isNewUser = false;
                    userId = void 0;
                    if (!!user) return [3 /*break*/, 7];
                    isNewUser = true;
                    return [4 /*yield*/, (0, user_repository_1.createOAuthUser)({
                            provider: 'phone',
                            providerId: phone,
                            email: null,
                            name: null,
                            picture: null,
                        })];
                case 2:
                    // PR-4: Use repository for DB access
                    user = _b.sent();
                    userId = user.id;
                    if (!referralCode) return [3 /*break*/, 6];
                    _b.label = 3;
                case 3:
                    _b.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, (0, referrals_service_1.applyReferralCode)(userId, referralCode.toUpperCase())];
                case 4:
                    _b.sent();
                    logger_1.logger.info("Referral code ".concat(referralCode, " applied for user ").concat(userId));
                    return [3 /*break*/, 6];
                case 5:
                    refError_1 = _b.sent();
                    logger_1.logger.warn("Referral code application failed: ".concat(refError_1.message));
                    return [3 /*break*/, 6];
                case 6: return [3 /*break*/, 10];
                case 7:
                    // Existing user
                    userId = user.id;
                    // PR-4: Use repository for DB access
                    // Update OAuth identity last login
                    return [4 /*yield*/, (0, user_repository_1.linkOAuthProvider)(userId, {
                            provider: 'phone',
                            providerId: phone,
                            email: null,
                            name: null,
                            picture: null,
                        })];
                case 8:
                    // PR-4: Use repository for DB access
                    // Update OAuth identity last login
                    _b.sent();
                    // Update user last login
                    return [4 /*yield*/, (0, user_repository_1.updateUserLastLogin)(userId)];
                case 9:
                    // Update user last login
                    _b.sent();
                    logger_1.logger.info('Existing user logged in via phone auth:', { userId: userId, phone: phone });
                    _b.label = 10;
                case 10:
                    if (!(deviceInfo === null || deviceInfo === void 0 ? void 0 : deviceInfo.fcmToken)) return [3 /*break*/, 12];
                    return [4 /*yield*/, (0, user_repository_1.upsertPushToken)(userId, {
                            fcmToken: deviceInfo.fcmToken,
                            platform: deviceInfo.platform,
                            deviceId: deviceInfo.deviceId,
                            appVersion: deviceInfo.appVersion,
                        })];
                case 11:
                    _b.sent();
                    _b.label = 12;
                case 12: return [4 /*yield*/, (0, user_repository_1.getUserProfile)(userId)];
                case 13:
                    userProfile = _b.sent();
                    if (!userProfile) {
                        return [2 /*return*/, reply.status(500).send({
                                error: 'PROFILE_NOT_FOUND',
                                message: 'User profile could not be retrieved',
                            })];
                    }
                    tokens = (0, jwt_utils_1.generateTokens)({
                        userId: userProfile.id,
                        email: userProfile.email || '', // Phone users may not have email
                        phone: userProfile.phone,
                        role: userProfile.role,
                    });
                    // 6. Return response
                    return [2 /*return*/, reply.status(isNewUser ? 201 : 200).send({
                            success: true,
                            isNewUser: isNewUser,
                            user: {
                                id: userProfile.id,
                                email: userProfile.email,
                                name: userProfile.name,
                                phone: userProfile.phone,
                                username: userProfile.username,
                                referralCode: userProfile.referral_code,
                                xp: {
                                    points: userProfile.xp_points || 0,
                                    level: userProfile.level || 'bronze',
                                    streakDays: userProfile.current_streak_days || 0,
                                },
                                credits: {
                                    balance: userProfile.credit_balance || 0,
                                },
                                role: userProfile.role,
                                isVip: userProfile.is_vip || false,
                                createdAt: userProfile.created_at,
                            },
                            tokens: {
                                accessToken: tokens.accessToken,
                                refreshToken: tokens.refreshToken,
                                expiresIn: tokens.expiresIn,
                            },
                        })];
                case 14:
                    error_1 = _b.sent();
                    logger_1.logger.error('Phone auth error:', error_1);
                    return [2 /*return*/, reply.status(500).send({
                            error: 'INTERNAL_SERVER_ERROR',
                            message: 'An error occurred during authentication',
                        })];
                case 15: return [2 /*return*/];
            }
        });
    });
}
function refreshToken(request, reply) {
    return __awaiter(this, void 0, void 0, function () {
        var refreshToken_1, verifyRefreshToken, decoded, user, tokens, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    refreshToken_1 = request.body.refreshToken;
                    if (!refreshToken_1) {
                        return [2 /*return*/, reply.status(400).send({
                                error: 'REFRESH_TOKEN_REQUIRED',
                                message: 'Refresh token is required',
                            })];
                    }
                    return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('../../utils/jwt.utils')); })];
                case 1:
                    verifyRefreshToken = (_a.sent()).verifyRefreshToken;
                    decoded = void 0;
                    try {
                        decoded = verifyRefreshToken(refreshToken_1);
                    }
                    catch (err) {
                        return [2 /*return*/, reply.status(401).send({
                                error: err.message || 'INVALID_REFRESH_TOKEN',
                                message: 'Invalid or expired refresh token',
                            })];
                    }
                    return [4 /*yield*/, (0, user_repository_1.getUserById)(decoded.userId)];
                case 2:
                    user = _a.sent();
                    if (!user) {
                        return [2 /*return*/, reply.status(404).send({
                                error: 'USER_NOT_FOUND',
                                message: 'User not found',
                            })];
                    }
                    tokens = (0, jwt_utils_1.generateTokens)({
                        userId: user.id,
                        email: user.email || '',
                        phone: user.phone || undefined,
                        role: user.role,
                    });
                    return [2 /*return*/, reply.status(200).send({
                            success: true,
                            tokens: {
                                accessToken: tokens.accessToken,
                                refreshToken: tokens.refreshToken,
                                expiresIn: tokens.expiresIn,
                            },
                        })];
                case 3:
                    error_2 = _a.sent();
                    logger_1.logger.error('Token refresh error:', error_2);
                    return [2 /*return*/, reply.status(500).send({
                            error: 'INTERNAL_SERVER_ERROR',
                            message: 'An error occurred during token refresh',
                        })];
                case 4: return [2 /*return*/];
            }
        });
    });
}
