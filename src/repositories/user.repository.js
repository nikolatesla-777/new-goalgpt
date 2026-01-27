"use strict";
/**
 * User Repository
 *
 * All database access for user-related entities including push tokens and profiles.
 * This is the ONLY place where DB access is allowed for user operations.
 *
 * PR-4: Repository Layer Lockdown
 */
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
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
exports.getUserProfile = getUserProfile;
exports.deactivatePushTokens = deactivatePushTokens;
exports.upsertPushToken = upsertPushToken;
exports.getUserByOAuthProvider = getUserByOAuthProvider;
exports.getUserByEmail = getUserByEmail;
exports.getUserByPhone = getUserByPhone;
exports.getUserById = getUserById;
exports.getUserByEmailWithPassword = getUserByEmailWithPassword;
exports.getUserByPhoneWithPassword = getUserByPhoneWithPassword;
exports.createEmailPasswordUser = createEmailPasswordUser;
exports.createOAuthUser = createOAuthUser;
exports.getOAuthIdentity = getOAuthIdentity;
exports.linkOAuthProvider = linkOAuthProvider;
exports.updateUserInfo = updateUserInfo;
exports.updateUserLastLogin = updateUserLastLogin;
exports.getUserAuthContext = getUserAuthContext;
var kysely_1 = require("../database/kysely");
var kysely_2 = require("kysely");
var logger_1 = require("../utils/logger");
// ============================================================
// USER PROFILE OPERATIONS
// ============================================================
/**
 * Get complete user profile with XP, credits, and VIP subscription
 *
 * @param userId - The user's ID
 * @returns User profile with all gamification data, or null if user not found
 */
function getUserProfile(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var userProfile, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, kysely_1.db
                            .selectFrom('customer_users as cu')
                            .leftJoin('customer_xp as xp', 'xp.customer_user_id', 'cu.id')
                            .leftJoin('customer_credits as credits', 'credits.customer_user_id', 'cu.id')
                            .leftJoin('customer_subscriptions as sub', function (join) {
                            return join
                                .onRef('sub.customer_user_id', '=', 'cu.id')
                                .on('sub.status', '=', 'active')
                                .on('sub.expired_at', '>', (0, kysely_2.sql)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["NOW()"], ["NOW()"]))));
                        })
                            .select([
                            'cu.id',
                            'cu.email',
                            'cu.full_name as name',
                            'cu.phone',
                            'cu.username',
                            'cu.referral_code',
                            'cu.role',
                            'cu.created_at',
                            'xp.xp_points',
                            'xp.level',
                            'xp.level_progress',
                            'xp.current_streak_days',
                            'xp.longest_streak_days',
                            'xp.total_earned as total_xp_earned',
                            'credits.balance as credit_balance',
                            'credits.lifetime_earned as credits_lifetime_earned',
                            'credits.lifetime_spent as credits_lifetime_spent',
                            'sub.expired_at as vip_expires_at',
                            (0, kysely_2.sql)(templateObject_2 || (templateObject_2 = __makeTemplateObject(["CASE WHEN sub.id IS NOT NULL THEN true ELSE false END"], ["CASE WHEN sub.id IS NOT NULL THEN true ELSE false END"]))).as('is_vip'),
                        ])
                            .where('cu.id', '=', userId)
                            .executeTakeFirst()];
                case 1:
                    userProfile = _a.sent();
                    return [2 /*return*/, userProfile !== null && userProfile !== void 0 ? userProfile : null];
                case 2:
                    error_1 = _a.sent();
                    logger_1.logger.error('[UserRepository] Failed to get user profile:', error_1);
                    throw error_1;
                case 3: return [2 /*return*/];
            }
        });
    });
}
// ============================================================
// PUSH TOKEN OPERATIONS
// ============================================================
/**
 * Deactivate push tokens for a user
 * Used during logout to invalidate FCM tokens
 *
 * @param userId - The user's ID
 * @param deviceId - Optional specific device ID to deactivate (if not provided, deactivates all)
 */
function deactivatePushTokens(userId, deviceId) {
    return __awaiter(this, void 0, void 0, function () {
        var query, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 5, , 6]);
                    query = kysely_1.db
                        .updateTable('customer_push_tokens')
                        .set({ is_active: false, updated_at: (0, kysely_2.sql)(templateObject_3 || (templateObject_3 = __makeTemplateObject(["NOW()"], ["NOW()"]))) })
                        .where('customer_user_id', '=', userId);
                    if (!deviceId) return [3 /*break*/, 2];
                    // Only invalidate specific device
                    return [4 /*yield*/, query.where('device_id', '=', deviceId).execute()];
                case 1:
                    // Only invalidate specific device
                    _a.sent();
                    return [3 /*break*/, 4];
                case 2: 
                // Invalidate all devices for this user
                return [4 /*yield*/, query.execute()];
                case 3:
                    // Invalidate all devices for this user
                    _a.sent();
                    _a.label = 4;
                case 4: return [3 /*break*/, 6];
                case 5:
                    error_2 = _a.sent();
                    logger_1.logger.error('[UserRepository] Failed to deactivate push tokens:', error_2);
                    throw error_2;
                case 6: return [2 /*return*/];
            }
        });
    });
}
/**
 * Upsert FCM push token for a user
 * Creates new token or updates existing one based on device_id
 *
 * @param userId - The user's ID
 * @param deviceInfo - Device and FCM token information
 */
function upsertPushToken(userId, deviceInfo) {
    return __awaiter(this, void 0, void 0, function () {
        var error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, kysely_1.db
                            .insertInto('customer_push_tokens')
                            .values({
                            customer_user_id: userId,
                            token: deviceInfo.fcmToken,
                            platform: deviceInfo.platform,
                            device_id: deviceInfo.deviceId,
                            app_version: deviceInfo.appVersion || null,
                            is_active: true,
                            created_at: (0, kysely_2.sql)(templateObject_4 || (templateObject_4 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                            updated_at: (0, kysely_2.sql)(templateObject_5 || (templateObject_5 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                        })
                            .onConflict(function (oc) {
                            return oc.columns(['customer_user_id', 'device_id']).doUpdateSet({
                                token: deviceInfo.fcmToken,
                                platform: deviceInfo.platform,
                                app_version: deviceInfo.appVersion || null,
                                is_active: true,
                                updated_at: (0, kysely_2.sql)(templateObject_6 || (templateObject_6 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                            });
                        })
                            .execute()];
                case 1:
                    _a.sent();
                    return [3 /*break*/, 3];
                case 2:
                    error_3 = _a.sent();
                    logger_1.logger.error('[UserRepository] Failed to upsert push token:', error_3);
                    throw error_3;
                case 3: return [2 /*return*/];
            }
        });
    });
}
// ============================================================
// USER LOOKUP OPERATIONS
// ============================================================
/**
 * Get user by OAuth provider credentials
 * Used to check if user exists with Google/Apple/Phone OAuth
 *
 * @param provider - OAuth provider (google, apple, phone)
 * @param providerId - Provider-specific user ID
 * @returns User info or null if not found
 */
function getUserByOAuthProvider(provider, providerId) {
    return __awaiter(this, void 0, void 0, function () {
        var user, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, kysely_1.db
                            .selectFrom('customer_oauth_identities as coi')
                            .innerJoin('customer_users as cu', 'cu.id', 'coi.customer_user_id')
                            .select([
                            'cu.id',
                            'cu.email',
                            'cu.full_name as name',
                            'cu.phone',
                            'cu.username',
                            'cu.referral_code',
                            'cu.role',
                            'cu.created_at',
                        ])
                            .where('coi.provider', '=', provider)
                            .where('coi.provider_user_id', '=', providerId)
                            .where('coi.deleted_at', 'is', null)
                            .where('cu.deleted_at', 'is', null)
                            .executeTakeFirst()];
                case 1:
                    user = _a.sent();
                    return [2 /*return*/, user !== null && user !== void 0 ? user : null];
                case 2:
                    error_4 = _a.sent();
                    logger_1.logger.error('[UserRepository] Failed to get user by OAuth provider:', error_4);
                    throw error_4;
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get user by email address
 * Used for account linking when OAuth provides email
 *
 * @param email - User's email address
 * @returns User info or null if not found
 */
function getUserByEmail(email) {
    return __awaiter(this, void 0, void 0, function () {
        var user, error_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, kysely_1.db
                            .selectFrom('customer_users')
                            .select(['id', 'email', 'full_name as name', 'phone', 'username', 'referral_code', 'role', 'created_at'])
                            .where('email', '=', email)
                            .where('deleted_at', 'is', null)
                            .executeTakeFirst()];
                case 1:
                    user = _a.sent();
                    return [2 /*return*/, user !== null && user !== void 0 ? user : null];
                case 2:
                    error_5 = _a.sent();
                    logger_1.logger.error('[UserRepository] Failed to get user by email:', error_5);
                    throw error_5;
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get user by phone number
 * Used for phone-based authentication
 *
 * @param phone - User's phone number (E.164 format)
 * @returns User info or null if not found
 */
function getUserByPhone(phone) {
    return __awaiter(this, void 0, void 0, function () {
        var user, error_6;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, kysely_1.db
                            .selectFrom('customer_users')
                            .select(['id', 'email', 'full_name as name', 'phone', 'username', 'referral_code', 'role', 'created_at'])
                            .where('phone', '=', phone)
                            .where('deleted_at', 'is', null)
                            .executeTakeFirst()];
                case 1:
                    user = _a.sent();
                    return [2 /*return*/, user !== null && user !== void 0 ? user : null];
                case 2:
                    error_6 = _a.sent();
                    logger_1.logger.error('[UserRepository] Failed to get user by phone:', error_6);
                    throw error_6;
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get user by ID
 * Used for token refresh and user lookups
 *
 * @param userId - User's unique ID
 * @returns User info or null if not found
 */
function getUserById(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var user, error_7;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, kysely_1.db
                            .selectFrom('customer_users')
                            .select(['id', 'email', 'full_name as name', 'phone', 'username', 'referral_code', 'role', 'created_at'])
                            .where('id', '=', userId)
                            .where('deleted_at', 'is', null)
                            .executeTakeFirst()];
                case 1:
                    user = _a.sent();
                    return [2 /*return*/, user !== null && user !== void 0 ? user : null];
                case 2:
                    error_7 = _a.sent();
                    logger_1.logger.error('[UserRepository] Failed to get user by ID:', error_7);
                    throw error_7;
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get user by email with password hash
 * Used for email/password authentication (includes password_hash for verification)
 *
 * @param email - User's email address (will be normalized to lowercase)
 * @returns User with password hash or null if not found
 */
function getUserByEmailWithPassword(email) {
    return __awaiter(this, void 0, void 0, function () {
        var normalizedEmail, user, error_8;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    normalizedEmail = email.toLowerCase().trim();
                    return [4 /*yield*/, kysely_1.db
                            .selectFrom('customer_users')
                            .select([
                            'id',
                            'email',
                            'full_name as name',
                            'phone',
                            'username',
                            'referral_code',
                            'role',
                            'created_at',
                            'password_hash',
                        ])
                            .where('email', '=', normalizedEmail)
                            .where('deleted_at', 'is', null)
                            .executeTakeFirst()];
                case 1:
                    user = _a.sent();
                    return [2 /*return*/, user !== null && user !== void 0 ? user : null];
                case 2:
                    error_8 = _a.sent();
                    logger_1.logger.error('[UserRepository] Failed to get user by email with password:', error_8);
                    throw error_8;
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get user by phone with password hash
 * Used for legacy phone/password authentication (includes password_hash for verification)
 *
 * @param phone - User's phone number (normalized: no spaces/dashes)
 * @returns User with password hash or null if not found
 */
function getUserByPhoneWithPassword(phone) {
    return __awaiter(this, void 0, void 0, function () {
        var normalizedPhone, row, user, error_9;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    normalizedPhone = phone.replace(/[\s\-\(\)]/g, '');
                    return [4 /*yield*/, kysely_1.db
                            .selectFrom('customer_users')
                            .selectAll()
                            .where('phone', '=', normalizedPhone)
                            .where('deleted_at', 'is', null)
                            .executeTakeFirst()];
                case 1:
                    row = _a.sent();
                    if (!row)
                        return [2 /*return*/, null];
                    user = {
                        id: row.id,
                        email: row.email,
                        name: row.full_name,
                        phone: row.phone,
                        username: row.username,
                        referral_code: row.referral_code,
                        role: row.role,
                        created_at: row.created_at,
                        password_hash: row.password_hash,
                        profile_image_url: row.profile_image_url,
                    };
                    return [2 /*return*/, user !== null && user !== void 0 ? user : null];
                case 2:
                    error_9 = _a.sent();
                    logger_1.logger.error('[UserRepository] Failed to get user by phone with password:', error_9);
                    throw error_9;
                case 3: return [2 /*return*/];
            }
        });
    });
}
// ============================================================
// USER CREATION OPERATIONS
// ============================================================
/**
 * Create new user with email/password authentication
 * Atomically creates user with password, XP, and credits (no OAuth identity)
 *
 * @param email - User's email (will be normalized)
 * @param passwordHash - Bcrypt hashed password
 * @param name - User's full name (optional)
 * @returns Created user's basic info
 */
function createEmailPasswordUser(email, passwordHash, name) {
    return __awaiter(this, void 0, void 0, function () {
        var createdUser_1, normalizedEmail_1, error_10;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    normalizedEmail_1 = email.toLowerCase().trim();
                    return [4 /*yield*/, kysely_1.db.transaction().execute(function (trx) { return __awaiter(_this, void 0, void 0, function () {
                            var referralCode, newUser;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        referralCode = "GG".concat(Math.random().toString(36).substring(2, 8).toUpperCase());
                                        return [4 /*yield*/, trx
                                                .insertInto('customer_users')
                                                .values({
                                                email: normalizedEmail_1,
                                                password_hash: passwordHash,
                                                full_name: name || null,
                                                phone: null,
                                                username: null,
                                                referral_code: referralCode,
                                                role: 'user',
                                                is_active: true,
                                                is_online: false,
                                                two_fa_enabled: false,
                                                created_at: new Date(),
                                                updated_at: new Date(),
                                            })
                                                .returning(['id', 'email', 'full_name as name', 'phone', 'username', 'referral_code', 'role', 'created_at'])
                                                .executeTakeFirstOrThrow()];
                                    case 1:
                                        newUser = _a.sent();
                                        createdUser_1 = newUser;
                                        // Initialize XP
                                        return [4 /*yield*/, trx
                                                .insertInto('customer_xp')
                                                .values({
                                                customer_user_id: newUser.id,
                                                xp_points: 0,
                                                level: 'bronze',
                                                level_progress: 0,
                                                total_earned: 0,
                                                current_streak_days: 0,
                                                longest_streak_days: 0,
                                                achievements_count: 0,
                                                created_at: new Date(),
                                                updated_at: new Date(),
                                            })
                                                .execute()];
                                    case 2:
                                        // Initialize XP
                                        _a.sent();
                                        // Initialize Credits with 100 welcome bonus
                                        return [4 /*yield*/, trx
                                                .insertInto('customer_credits')
                                                .values({
                                                customer_user_id: newUser.id,
                                                balance: 100,
                                                lifetime_earned: 100,
                                                lifetime_spent: 0,
                                                created_at: new Date(),
                                                updated_at: new Date(),
                                            })
                                                .execute()];
                                    case 3:
                                        // Initialize Credits with 100 welcome bonus
                                        _a.sent();
                                        logger_1.logger.info('[UserRepository] New user created via email/password:', {
                                            userId: newUser.id,
                                            email: normalizedEmail_1,
                                        });
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _a.sent();
                    return [2 /*return*/, createdUser_1];
                case 2:
                    error_10 = _a.sent();
                    logger_1.logger.error('[UserRepository] Failed to create email/password user:', error_10);
                    throw error_10;
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Create new user with OAuth authentication
 * Atomically creates user, OAuth identity, XP, and credits in a transaction
 *
 * @param oauthData - OAuth provider data (Google/Apple/Phone)
 * @returns Created user's basic info
 */
function createOAuthUser(oauthData) {
    return __awaiter(this, void 0, void 0, function () {
        var createdUser_2, error_11;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, kysely_1.db.transaction().execute(function (trx) { return __awaiter(_this, void 0, void 0, function () {
                            var referralCode, userValues, newUser;
                            var _a, _b;
                            return __generator(this, function (_c) {
                                switch (_c.label) {
                                    case 0:
                                        referralCode = "GOAL-".concat(Math.random().toString(36).substring(2, 8).toUpperCase());
                                        userValues = {
                                            referral_code: referralCode,
                                            created_at: (0, kysely_2.sql)(templateObject_7 || (templateObject_7 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                                            updated_at: (0, kysely_2.sql)(templateObject_8 || (templateObject_8 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                                        };
                                        if (oauthData.provider === 'google') {
                                            userValues.email = oauthData.email;
                                            userValues.full_name = oauthData.name || ((_a = oauthData.email) === null || _a === void 0 ? void 0 : _a.split('@')[0]) || null;
                                            userValues.google_id = oauthData.providerId;
                                            userValues.phone = null;
                                            userValues.username = null;
                                        }
                                        else if (oauthData.provider === 'apple') {
                                            userValues.email = oauthData.email;
                                            userValues.full_name = oauthData.name || ((_b = oauthData.email) === null || _b === void 0 ? void 0 : _b.split('@')[0]) || null;
                                            userValues.apple_id = oauthData.providerId;
                                            userValues.phone = null;
                                            userValues.username = null;
                                        }
                                        else if (oauthData.provider === 'phone') {
                                            userValues.phone = oauthData.providerId;
                                            userValues.email = null;
                                            userValues.full_name = null;
                                            userValues.username = null;
                                        }
                                        return [4 /*yield*/, trx
                                                .insertInto('customer_users')
                                                .values(userValues)
                                                .returning(['id', 'email', 'full_name as name', 'phone', 'username', 'referral_code', 'role', 'created_at'])
                                                .executeTakeFirstOrThrow()];
                                    case 1:
                                        newUser = _c.sent();
                                        createdUser_2 = newUser;
                                        // Create OAuth identity
                                        return [4 /*yield*/, trx
                                                .insertInto('customer_oauth_identities')
                                                .values({
                                                customer_user_id: newUser.id,
                                                provider: oauthData.provider,
                                                provider_user_id: oauthData.providerId,
                                                email: oauthData.email || null,
                                                display_name: oauthData.name || null,
                                                profile_photo_url: oauthData.picture || null,
                                                is_primary: true,
                                                last_login_at: (0, kysely_2.sql)(templateObject_9 || (templateObject_9 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                                                linked_at: (0, kysely_2.sql)(templateObject_10 || (templateObject_10 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                                                created_at: (0, kysely_2.sql)(templateObject_11 || (templateObject_11 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                                                updated_at: (0, kysely_2.sql)(templateObject_12 || (templateObject_12 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                                            })
                                                .execute()];
                                    case 2:
                                        // Create OAuth identity
                                        _c.sent();
                                        // Initialize XP
                                        return [4 /*yield*/, trx
                                                .insertInto('customer_xp')
                                                .values({
                                                customer_user_id: newUser.id,
                                                xp_points: 0,
                                                level: 'bronze',
                                                level_progress: 0,
                                                total_earned: 0,
                                                current_streak_days: 0,
                                                longest_streak_days: 0,
                                                achievements_count: 0,
                                                created_at: (0, kysely_2.sql)(templateObject_13 || (templateObject_13 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                                                updated_at: (0, kysely_2.sql)(templateObject_14 || (templateObject_14 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                                            })
                                                .execute()];
                                    case 3:
                                        // Initialize XP
                                        _c.sent();
                                        // Initialize Credits
                                        return [4 /*yield*/, trx
                                                .insertInto('customer_credits')
                                                .values({
                                                customer_user_id: newUser.id,
                                                balance: 0,
                                                lifetime_earned: 0,
                                                lifetime_spent: 0,
                                                created_at: (0, kysely_2.sql)(templateObject_15 || (templateObject_15 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                                                updated_at: (0, kysely_2.sql)(templateObject_16 || (templateObject_16 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                                            })
                                                .execute()];
                                    case 4:
                                        // Initialize Credits
                                        _c.sent();
                                        logger_1.logger.info("[UserRepository] New user created via ".concat(oauthData.provider, " OAuth:"), {
                                            userId: newUser.id,
                                            provider: oauthData.provider,
                                        });
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _a.sent();
                    return [2 /*return*/, createdUser_2];
                case 2:
                    error_11 = _a.sent();
                    logger_1.logger.error('[UserRepository] Failed to create OAuth user:', error_11);
                    throw error_11;
                case 3: return [2 /*return*/];
            }
        });
    });
}
// ============================================================
// OAUTH LINKING OPERATIONS
// ============================================================
/**
 * Check if OAuth identity exists
 * Used to prevent duplicate OAuth links
 *
 * @param provider - OAuth provider (google, apple)
 * @param providerId - Provider-specific user ID
 * @returns OAuth identity with customer_user_id or null
 */
function getOAuthIdentity(provider, providerId) {
    return __awaiter(this, void 0, void 0, function () {
        var identity, error_12;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, kysely_1.db
                            .selectFrom('customer_oauth_identities')
                            .select(['customer_user_id'])
                            .where('provider', '=', provider)
                            .where('provider_user_id', '=', providerId)
                            .executeTakeFirst()];
                case 1:
                    identity = _a.sent();
                    return [2 /*return*/, identity !== null && identity !== void 0 ? identity : null];
                case 2:
                    error_12 = _a.sent();
                    logger_1.logger.error('[UserRepository] Failed to get OAuth identity:', error_12);
                    throw error_12;
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Link OAuth provider to existing user
 * Updates or creates OAuth identity for account linking
 *
 * @param userId - Existing user's ID
 * @param oauthData - OAuth provider data to link
 */
function linkOAuthProvider(userId, oauthData) {
    return __awaiter(this, void 0, void 0, function () {
        var error_13;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, kysely_1.db
                            .insertInto('customer_oauth_identities')
                            .values({
                            customer_user_id: userId,
                            provider: oauthData.provider,
                            provider_user_id: oauthData.providerId,
                            email: oauthData.email || null,
                            display_name: oauthData.name || null,
                            profile_photo_url: oauthData.picture || null,
                            is_primary: true,
                            last_login_at: (0, kysely_2.sql)(templateObject_17 || (templateObject_17 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                            linked_at: (0, kysely_2.sql)(templateObject_18 || (templateObject_18 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                            created_at: (0, kysely_2.sql)(templateObject_19 || (templateObject_19 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                            updated_at: (0, kysely_2.sql)(templateObject_20 || (templateObject_20 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                        })
                            .onConflict(function (oc) {
                            return oc.columns(['customer_user_id', 'provider']).doUpdateSet({
                                provider_user_id: oauthData.providerId,
                                email: oauthData.email || null,
                                display_name: oauthData.name || null,
                                profile_photo_url: oauthData.picture || null,
                                last_login_at: (0, kysely_2.sql)(templateObject_21 || (templateObject_21 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                                updated_at: (0, kysely_2.sql)(templateObject_22 || (templateObject_22 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                            });
                        })
                            .execute()];
                case 1:
                    _a.sent();
                    return [3 /*break*/, 3];
                case 2:
                    error_13 = _a.sent();
                    logger_1.logger.error('[UserRepository] Failed to link OAuth provider:', error_13);
                    throw error_13;
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Update user email and/or name
 * Used during OAuth migration to update legacy account info
 *
 * @param userId - User's ID
 * @param email - New email (optional)
 * @param name - New name (optional)
 */
function updateUserInfo(userId, email, name) {
    return __awaiter(this, void 0, void 0, function () {
        var updateData, error_14;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    updateData = {};
                    if (email)
                        updateData.email = email;
                    if (name)
                        updateData.full_name = name;
                    if (!(Object.keys(updateData).length > 0)) return [3 /*break*/, 2];
                    return [4 /*yield*/, kysely_1.db
                            .updateTable('customer_users')
                            .set(updateData)
                            .where('id', '=', userId)
                            .execute()];
                case 1:
                    _a.sent();
                    _a.label = 2;
                case 2: return [3 /*break*/, 4];
                case 3:
                    error_14 = _a.sent();
                    logger_1.logger.error('[UserRepository] Failed to update user info:', error_14);
                    throw error_14;
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Update user's last login timestamp
 * Called after successful authentication
 *
 * @param userId - The user's ID
 */
function updateUserLastLogin(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var error_15;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, kysely_1.db
                            .updateTable('customer_users')
                            .set({ updated_at: (0, kysely_2.sql)(templateObject_23 || (templateObject_23 = __makeTemplateObject(["NOW()"], ["NOW()"]))) })
                            .where('id', '=', userId)
                            .execute()];
                case 1:
                    _a.sent();
                    return [3 /*break*/, 3];
                case 2:
                    error_15 = _a.sent();
                    logger_1.logger.error('[UserRepository] Failed to update last login:', error_15);
                    throw error_15;
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get user's authentication context (XP, credits, subscription)
 * Used after login to build user profile response
 *
 * @param userId - The user's ID
 * @returns User's gamification and subscription data
 */
function getUserAuthContext(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, xp, credits, subscription, error_16;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, Promise.all([
                            kysely_1.db
                                .selectFrom('customer_xp')
                                .select(['xp_points', 'level', 'level_progress'])
                                .where('customer_user_id', '=', userId)
                                .executeTakeFirst(),
                            kysely_1.db
                                .selectFrom('customer_credits')
                                .select(['balance', 'lifetime_earned'])
                                .where('customer_user_id', '=', userId)
                                .executeTakeFirst(),
                            kysely_1.db
                                .selectFrom('customer_subscriptions')
                                .select(['status', 'expired_at'])
                                .where('customer_user_id', '=', userId)
                                .where('status', '=', 'active')
                                .where('expired_at', '>', new Date())
                                .executeTakeFirst(),
                        ])];
                case 1:
                    _a = _b.sent(), xp = _a[0], credits = _a[1], subscription = _a[2];
                    return [2 /*return*/, {
                            xp: xp !== null && xp !== void 0 ? xp : null,
                            credits: credits !== null && credits !== void 0 ? credits : null,
                            subscription: subscription !== null && subscription !== void 0 ? subscription : null,
                        }];
                case 2:
                    error_16 = _b.sent();
                    logger_1.logger.error('[UserRepository] Failed to get user auth context:', error_16);
                    throw error_16;
                case 3: return [2 /*return*/];
            }
        });
    });
}
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10, templateObject_11, templateObject_12, templateObject_13, templateObject_14, templateObject_15, templateObject_16, templateObject_17, templateObject_18, templateObject_19, templateObject_20, templateObject_21, templateObject_22, templateObject_23;
