"use strict";
/**
 * Email/Password Authentication Controller
 * Handles email + password registration and login
 */
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
exports.emailRegister = emailRegister;
exports.emailLogin = emailLogin;
var jwt_utils_1 = require("../../utils/jwt.utils");
var bcrypt = __importStar(require("bcrypt"));
var referrals_service_1 = require("../../services/referrals.service");
// PR-4: Use repository for all user DB access
var user_repository_1 = require("../../repositories/user.repository");
// ============================================================================
// EMAIL/PASSWORD REGISTRATION
// ============================================================================
/**
 * POST /api/auth/register
 * Register new user with email and password
 */
function emailRegister(request, reply) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, email, password, name_1, referralCode, deviceInfo, emailRegex, existingUser, hashedPassword, newUser, referralApplied, refError_1, authContext, tokens, error_1;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 11, , 12]);
                    _a = request.body, email = _a.email, password = _a.password, name_1 = _a.name, referralCode = _a.referralCode, deviceInfo = _a.deviceInfo;
                    // Validate input
                    if (!email || !password) {
                        return [2 /*return*/, reply.status(400).send({
                                error: 'MISSING_CREDENTIALS',
                                message: 'Email ve şifre gereklidir',
                            })];
                    }
                    emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!emailRegex.test(email)) {
                        return [2 /*return*/, reply.status(400).send({
                                error: 'INVALID_EMAIL',
                                message: 'Geçersiz email formatı',
                            })];
                    }
                    // Validate password length
                    if (password.length < 6) {
                        return [2 /*return*/, reply.status(400).send({
                                error: 'WEAK_PASSWORD',
                                message: 'Şifre en az 6 karakter olmalıdır',
                            })];
                    }
                    return [4 /*yield*/, (0, user_repository_1.getUserByEmail)(email)];
                case 1:
                    existingUser = _c.sent();
                    if (existingUser) {
                        return [2 /*return*/, reply.status(409).send({
                                error: 'EMAIL_EXISTS',
                                message: 'Bu email adresi zaten kayıtlı',
                            })];
                    }
                    return [4 /*yield*/, bcrypt.hash(password, 10)];
                case 2:
                    hashedPassword = _c.sent();
                    return [4 /*yield*/, (0, user_repository_1.createEmailPasswordUser)(email, hashedPassword, name_1 || null)];
                case 3:
                    newUser = _c.sent();
                    referralApplied = false;
                    if (!referralCode) return [3 /*break*/, 7];
                    _c.label = 4;
                case 4:
                    _c.trys.push([4, 6, , 7]);
                    return [4 /*yield*/, (0, referrals_service_1.applyReferralCode)(newUser.id, referralCode.toUpperCase())];
                case 5:
                    _c.sent();
                    referralApplied = true;
                    request.log.info("Referral code ".concat(referralCode, " applied for user ").concat(newUser.id));
                    return [3 /*break*/, 7];
                case 6:
                    refError_1 = _c.sent();
                    // Log but don't fail registration if referral fails
                    request.log.warn("Referral code application failed: ".concat(refError_1.message));
                    return [3 /*break*/, 7];
                case 7:
                    if (!((deviceInfo === null || deviceInfo === void 0 ? void 0 : deviceInfo.fcmToken) && (deviceInfo === null || deviceInfo === void 0 ? void 0 : deviceInfo.platform))) return [3 /*break*/, 9];
                    if (!(deviceInfo.platform === 'ios' || deviceInfo.platform === 'android')) return [3 /*break*/, 9];
                    return [4 /*yield*/, (0, user_repository_1.upsertPushToken)(newUser.id, {
                            fcmToken: deviceInfo.fcmToken,
                            platform: deviceInfo.platform,
                            deviceId: deviceInfo.deviceId || 'unknown',
                            appVersion: deviceInfo.appVersion,
                        })];
                case 8:
                    _c.sent();
                    _c.label = 9;
                case 9: return [4 /*yield*/, (0, user_repository_1.getUserAuthContext)(newUser.id)];
                case 10:
                    authContext = _c.sent();
                    tokens = (0, jwt_utils_1.generateTokens)({
                        userId: newUser.id,
                        email: email, // Use input email (guaranteed non-null)
                        phone: newUser.phone,
                        role: newUser.role,
                    });
                    // Return user profile
                    return [2 /*return*/, reply.status(201).send({
                            success: true,
                            user: {
                                id: newUser.id,
                                email: newUser.email || null,
                                phone: newUser.phone,
                                name: newUser.name,
                                username: newUser.username,
                                profilePhotoUrl: null,
                                referralCode: newUser.referral_code,
                                role: newUser.role,
                                referralApplied: referralApplied,
                                createdAt: newUser.created_at,
                                isNewUser: true,
                                xp: authContext.xp
                                    ? {
                                        xpPoints: authContext.xp.xp_points,
                                        level: authContext.xp.level,
                                        levelProgress: Number(authContext.xp.level_progress),
                                    }
                                    : undefined,
                                credits: authContext.credits
                                    ? {
                                        balance: authContext.credits.balance,
                                        lifetimeEarned: authContext.credits.lifetime_earned,
                                    }
                                    : undefined,
                                subscription: authContext.subscription
                                    ? {
                                        status: authContext.subscription.status,
                                        expiredAt: ((_b = authContext.subscription.expired_at) === null || _b === void 0 ? void 0 : _b.toISOString()) || null,
                                    }
                                    : {
                                        status: 'expired',
                                        expiredAt: null,
                                    },
                            },
                            tokens: {
                                accessToken: tokens.accessToken,
                                refreshToken: tokens.refreshToken,
                                expiresIn: 86400, // 24 hours
                            },
                        })];
                case 11:
                    error_1 = _c.sent();
                    request.log.error('Email registration error:');
                    request.log.error(error_1);
                    return [2 /*return*/, reply.status(500).send({
                            error: 'INTERNAL_SERVER_ERROR',
                            message: 'Kayıt işlemi başarısız oldu',
                        })];
                case 12: return [2 /*return*/];
            }
        });
    });
}
// ============================================================================
// EMAIL/PASSWORD LOGIN
// ============================================================================
/**
 * POST /api/auth/login
 * Login with email and password
 */
function emailLogin(request, reply) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, email, password, deviceInfo, user, passwordMatch, authContext, tokens, error_2;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 6, , 7]);
                    _a = request.body, email = _a.email, password = _a.password, deviceInfo = _a.deviceInfo;
                    // Validate input
                    if (!email || !password) {
                        return [2 /*return*/, reply.status(400).send({
                                error: 'MISSING_CREDENTIALS',
                                message: 'Email ve şifre gereklidir',
                            })];
                    }
                    return [4 /*yield*/, (0, user_repository_1.getUserByEmailWithPassword)(email)];
                case 1:
                    user = _c.sent();
                    if (!user) {
                        return [2 /*return*/, reply.status(401).send({
                                error: 'INVALID_CREDENTIALS',
                                message: 'Geçersiz email veya şifre',
                            })];
                    }
                    // Check if user has password
                    if (!user.password_hash) {
                        return [2 /*return*/, reply.status(400).send({
                                error: 'NO_PASSWORD_SET',
                                message: 'Bu hesap için şifre ayarlanmamış. Lütfen sosyal giriş kullanın.',
                            })];
                    }
                    return [4 /*yield*/, bcrypt.compare(password, user.password_hash)];
                case 2:
                    passwordMatch = _c.sent();
                    if (!passwordMatch) {
                        return [2 /*return*/, reply.status(401).send({
                                error: 'INVALID_CREDENTIALS',
                                message: 'Geçersiz email veya şifre',
                            })];
                    }
                    if (!((deviceInfo === null || deviceInfo === void 0 ? void 0 : deviceInfo.fcmToken) && (deviceInfo === null || deviceInfo === void 0 ? void 0 : deviceInfo.platform))) return [3 /*break*/, 4];
                    if (!(deviceInfo.platform === 'ios' || deviceInfo.platform === 'android')) return [3 /*break*/, 4];
                    return [4 /*yield*/, (0, user_repository_1.upsertPushToken)(user.id, {
                            fcmToken: deviceInfo.fcmToken,
                            platform: deviceInfo.platform,
                            deviceId: deviceInfo.deviceId || 'unknown',
                            appVersion: deviceInfo.appVersion,
                        })];
                case 3:
                    _c.sent();
                    _c.label = 4;
                case 4: return [4 /*yield*/, (0, user_repository_1.getUserAuthContext)(user.id)];
                case 5:
                    authContext = _c.sent();
                    tokens = (0, jwt_utils_1.generateTokens)({
                        userId: user.id,
                        email: email, // Use input email (guaranteed non-null)
                        phone: user.phone,
                        role: user.role,
                    });
                    // Return user profile
                    return [2 /*return*/, reply.send({
                            success: true,
                            user: {
                                id: user.id,
                                email: user.email || null,
                                phone: user.phone,
                                name: user.name,
                                username: user.username,
                                profilePhotoUrl: null,
                                referralCode: user.referral_code,
                                role: user.role,
                                createdAt: user.created_at,
                                isNewUser: false,
                                xp: authContext.xp
                                    ? {
                                        xpPoints: authContext.xp.xp_points,
                                        level: authContext.xp.level,
                                        levelProgress: Number(authContext.xp.level_progress),
                                    }
                                    : undefined,
                                credits: authContext.credits
                                    ? {
                                        balance: authContext.credits.balance,
                                        lifetimeEarned: authContext.credits.lifetime_earned,
                                    }
                                    : undefined,
                                subscription: authContext.subscription
                                    ? {
                                        status: authContext.subscription.status,
                                        expiredAt: ((_b = authContext.subscription.expired_at) === null || _b === void 0 ? void 0 : _b.toISOString()) || null,
                                    }
                                    : {
                                        status: 'expired',
                                        expiredAt: null,
                                    },
                            },
                            tokens: {
                                accessToken: tokens.accessToken,
                                refreshToken: tokens.refreshToken,
                                expiresIn: 86400, // 24 hours
                            },
                        })];
                case 6:
                    error_2 = _c.sent();
                    request.log.error('Email login error:');
                    request.log.error(error_2);
                    return [2 /*return*/, reply.status(500).send({
                            error: 'INTERNAL_SERVER_ERROR',
                            message: 'Giriş işlemi başarısız oldu',
                        })];
                case 7: return [2 /*return*/];
            }
        });
    });
}
