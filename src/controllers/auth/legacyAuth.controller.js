"use strict";
/**
 * Legacy Authentication Controller
 * Handles phone + password login for existing users (backward compatibility)
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.legacyLogin = legacyLogin;
exports.checkLegacyUser = checkLegacyUser;
exports.migrateToOAuth = migrateToOAuth;
var jwt_utils_1 = require("../../utils/jwt.utils");
var bcrypt_1 = __importDefault(require("bcrypt"));
// PR-4: Use repository for all user DB access
var user_repository_1 = require("../../repositories/user.repository");
// ============================================================================
// LEGACY LOGIN (Phone + Password)
// ============================================================================
/**
 * POST /api/auth/legacy/login
 * Login with phone number and password (existing users)
 */
function legacyLogin(request, reply) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, phone, password, deviceInfo, user, passwordMatch, authContext, tokens, error_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 5, , 6]);
                    _a = request.body, phone = _a.phone, password = _a.password, deviceInfo = _a.deviceInfo;
                    // Validate input
                    if (!phone || !password) {
                        return [2 /*return*/, reply.status(400).send({
                                error: 'MISSING_CREDENTIALS',
                                message: 'Telefon numarası ve şifre gereklidir',
                            })];
                    }
                    return [4 /*yield*/, (0, user_repository_1.getUserByPhoneWithPassword)(phone)];
                case 1:
                    user = _b.sent();
                    if (!user) {
                        return [2 /*return*/, reply.status(401).send({
                                error: 'INVALID_CREDENTIALS',
                                message: 'Geçersiz telefon numarası veya şifre',
                            })];
                    }
                    // Check if user has password (legacy account)
                    if (!user.password_hash) {
                        return [2 /*return*/, reply.status(400).send({
                                error: 'NO_PASSWORD_SET',
                                message: 'Bu hesap için şifre ayarlanmamış. Lütfen SMS ile giriş yapın.',
                                suggestOAuth: true,
                            })];
                    }
                    return [4 /*yield*/, bcrypt_1.default.compare(password, user.password_hash)];
                case 2:
                    passwordMatch = _b.sent();
                    if (!passwordMatch) {
                        return [2 /*return*/, reply.status(401).send({
                                error: 'INVALID_CREDENTIALS',
                                message: 'Geçersiz telefon numarası veya şifre',
                            })];
                    }
                    // PR-4: Use repository for last login update
                    return [4 /*yield*/, (0, user_repository_1.updateUserLastLogin)(user.id)];
                case 3:
                    // PR-4: Use repository for last login update
                    _b.sent();
                    return [4 /*yield*/, (0, user_repository_1.getUserAuthContext)(user.id)];
                case 4:
                    authContext = _b.sent();
                    tokens = (0, jwt_utils_1.generateTokens)({
                        userId: user.id,
                        email: user.email || '', // Legacy users may not have email
                        phone: user.phone,
                    });
                    // Return user profile
                    return [2 /*return*/, reply.send({
                            success: true,
                            user: {
                                id: user.id,
                                email: user.email,
                                phone: user.phone,
                                name: user.name,
                                username: user.username,
                                profilePhotoUrl: user.profile_image_url,
                                referralCode: user.referral_code,
                                createdAt: user.created_at,
                                isNewUser: false,
                                hasPassword: true, // Indicate legacy account
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
                                        expiredAt: authContext.subscription.expired_at,
                                    }
                                    : undefined,
                            },
                            tokens: tokens,
                            migration: {
                                available: true,
                                message: 'Google veya Apple hesabınızla bağlantı kurabilirsiniz',
                            },
                        })];
                case 5:
                    error_1 = _b.sent();
                    console.error('❌ Legacy login error:', error_1);
                    return [2 /*return*/, reply.status(500).send({
                            error: 'LOGIN_FAILED',
                            message: 'Giriş işlemi başarısız oldu. Lütfen tekrar deneyin.',
                        })];
                case 6: return [2 /*return*/];
            }
        });
    });
}
// ============================================================================
// CHECK LEGACY USER
// ============================================================================
/**
 * POST /api/auth/legacy/check
 * Check if phone number has legacy account (with password)
 */
function checkLegacyUser(request, reply) {
    return __awaiter(this, void 0, void 0, function () {
        var phone, user, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    phone = request.body.phone;
                    if (!phone) {
                        return [2 /*return*/, reply.status(400).send({
                                error: 'MISSING_PHONE',
                                message: 'Telefon numarası gereklidir',
                            })];
                    }
                    return [4 /*yield*/, (0, user_repository_1.getUserByPhoneWithPassword)(phone)];
                case 1:
                    user = _a.sent();
                    if (!user) {
                        return [2 /*return*/, reply.send({
                                exists: false,
                                hasPassword: false,
                                isLegacyUser: false,
                            })];
                    }
                    return [2 /*return*/, reply.send({
                            exists: true,
                            hasPassword: !!user.password_hash,
                            isLegacyUser: !!user.password_hash,
                            registeredAt: user.created_at,
                        })];
                case 2:
                    error_2 = _a.sent();
                    console.error('❌ Check legacy user error:', error_2);
                    return [2 /*return*/, reply.status(500).send({
                            error: 'CHECK_FAILED',
                            message: 'Kullanıcı kontrolü başarısız oldu',
                        })];
                case 3: return [2 /*return*/];
            }
        });
    });
}
// ============================================================================
// MIGRATE TO OAUTH
// ============================================================================
/**
 * POST /api/auth/legacy/migrate-oauth
 * Migrate legacy account to OAuth (link Google/Apple account)
 */
function migrateToOAuth(request, reply) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, oauthProvider, oauthUserId, email, name_1, userId, existingOAuth, error_3;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 5, , 6]);
                    // Require authentication
                    if (!request.user) {
                        return [2 /*return*/, reply.status(401).send({
                                error: 'UNAUTHORIZED',
                                message: 'Bu işlem için giriş yapmalısınız',
                            })];
                    }
                    _a = request.body, oauthProvider = _a.oauthProvider, oauthUserId = _a.oauthUserId, email = _a.email, name_1 = _a.name;
                    userId = request.user.userId;
                    // Validate input
                    if (!oauthProvider || !oauthUserId) {
                        return [2 /*return*/, reply.status(400).send({
                                error: 'MISSING_OAUTH_DATA',
                                message: 'OAuth bilgileri gereklidir',
                            })];
                    }
                    return [4 /*yield*/, (0, user_repository_1.getOAuthIdentity)(oauthProvider, oauthUserId)];
                case 1:
                    existingOAuth = _b.sent();
                    if (existingOAuth && existingOAuth.customer_user_id !== userId) {
                        return [2 /*return*/, reply.status(409).send({
                                error: 'OAUTH_ALREADY_LINKED',
                                message: 'Bu hesap başka bir kullanıcıya bağlı',
                            })];
                    }
                    if (existingOAuth && existingOAuth.customer_user_id === userId) {
                        return [2 /*return*/, reply.status(200).send({
                                success: true,
                                message: 'Hesap zaten bağlı',
                                alreadyLinked: true,
                            })];
                    }
                    // PR-4: Use repository to link OAuth provider
                    return [4 /*yield*/, (0, user_repository_1.linkOAuthProvider)(userId, {
                            provider: oauthProvider,
                            providerId: oauthUserId,
                            email: email || null,
                            name: name_1 || null,
                            picture: null,
                        })];
                case 2:
                    // PR-4: Use repository to link OAuth provider
                    _b.sent();
                    if (!(email || name_1)) return [3 /*break*/, 4];
                    return [4 /*yield*/, (0, user_repository_1.updateUserInfo)(userId, email, name_1)];
                case 3:
                    _b.sent();
                    _b.label = 4;
                case 4: return [2 /*return*/, reply.send({
                        success: true,
                        message: "".concat(oauthProvider === 'google' ? 'Google' : 'Apple', " hesab\u0131n\u0131z ba\u015Far\u0131yla ba\u011Fland\u0131"),
                        provider: oauthProvider,
                    })];
                case 5:
                    error_3 = _b.sent();
                    console.error('❌ Migrate to OAuth error:', error_3);
                    return [2 /*return*/, reply.status(500).send({
                            error: 'MIGRATION_FAILED',
                            message: 'Hesap bağlama işlemi başarısız oldu',
                        })];
                case 6: return [2 /*return*/];
            }
        });
    });
}
