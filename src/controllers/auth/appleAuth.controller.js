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
exports.appleSignIn = appleSignIn;
var firebase_config_1 = require("../../config/firebase.config");
var jwt_utils_1 = require("../../utils/jwt.utils");
var logger_1 = require("../../utils/logger");
var referrals_service_1 = require("../../services/referrals.service");
// PR-4: Use repository for all user DB access
var user_repository_1 = require("../../repositories/user.repository");
/**
 * POST /api/auth/apple/signin
 * Apple Sign In - Verify token and create/login user
 */
function appleSignIn(request, reply) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, idToken, providedEmail, providedName, referralCode, deviceInfo, decodedToken, firebaseAuth, err_1, appleId, tokenEmail, email, user, isNewUser, userId, refError_1, userProfile, tokens, error_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 20, , 21]);
                    _a = request.body, idToken = _a.idToken, providedEmail = _a.email, providedName = _a.name, referralCode = _a.referralCode, deviceInfo = _a.deviceInfo;
                    if (!idToken) {
                        return [2 /*return*/, reply.status(400).send({
                                error: 'ID_TOKEN_REQUIRED',
                                message: 'Apple ID token is required',
                            })];
                    }
                    decodedToken = void 0;
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    firebaseAuth = (0, firebase_config_1.getFirebaseAuth)();
                    return [4 /*yield*/, firebaseAuth.verifyIdToken(idToken)];
                case 2:
                    decodedToken = _b.sent();
                    return [3 /*break*/, 4];
                case 3:
                    err_1 = _b.sent();
                    logger_1.logger.error('Firebase Apple token verification failed:', err_1);
                    return [2 /*return*/, reply.status(401).send({
                            error: 'INVALID_TOKEN',
                            message: 'Invalid or expired Apple ID token',
                        })];
                case 4:
                    appleId = decodedToken.sub, tokenEmail = decodedToken.email;
                    email = providedEmail || tokenEmail;
                    return [4 /*yield*/, (0, user_repository_1.getUserByOAuthProvider)('apple', appleId)];
                case 5:
                    user = _b.sent();
                    if (!(!user && email)) return [3 /*break*/, 7];
                    return [4 /*yield*/, (0, user_repository_1.getUserByEmail)(email)];
                case 6:
                    user = _b.sent();
                    _b.label = 7;
                case 7:
                    isNewUser = false;
                    userId = void 0;
                    if (!!user) return [3 /*break*/, 13];
                    // Apple Sign In requires email on first sign in
                    if (!email) {
                        return [2 /*return*/, reply.status(400).send({
                                error: 'EMAIL_REQUIRED',
                                message: 'Email is required for first time Apple Sign In',
                            })];
                    }
                    isNewUser = true;
                    return [4 /*yield*/, (0, user_repository_1.createOAuthUser)({
                            provider: 'apple',
                            providerId: appleId,
                            email: email,
                            name: providedName || email.split('@')[0],
                            picture: null, // Apple doesn't provide profile photo
                        })];
                case 8:
                    // PR-4: Use repository for DB access
                    user = _b.sent();
                    userId = user.id;
                    if (!referralCode) return [3 /*break*/, 12];
                    _b.label = 9;
                case 9:
                    _b.trys.push([9, 11, , 12]);
                    return [4 /*yield*/, (0, referrals_service_1.applyReferralCode)(userId, referralCode.toUpperCase())];
                case 10:
                    _b.sent();
                    logger_1.logger.info("Referral code ".concat(referralCode, " applied for user ").concat(userId));
                    return [3 /*break*/, 12];
                case 11:
                    refError_1 = _b.sent();
                    logger_1.logger.warn("Referral code application failed: ".concat(refError_1.message));
                    return [3 /*break*/, 12];
                case 12: return [3 /*break*/, 16];
                case 13:
                    // Existing user
                    userId = user.id;
                    // PR-4: Use repository for DB access
                    // Update or create OAuth identity (for account linking)
                    return [4 /*yield*/, (0, user_repository_1.linkOAuthProvider)(userId, {
                            provider: 'apple',
                            providerId: appleId,
                            email: email || null,
                            name: providedName || null,
                            picture: null,
                        })];
                case 14:
                    // PR-4: Use repository for DB access
                    // Update or create OAuth identity (for account linking)
                    _b.sent();
                    // Update user last login
                    return [4 /*yield*/, (0, user_repository_1.updateUserLastLogin)(userId)];
                case 15:
                    // Update user last login
                    _b.sent();
                    logger_1.logger.info('Existing user logged in via Apple Sign In:', { userId: userId, email: email });
                    _b.label = 16;
                case 16:
                    if (!(deviceInfo === null || deviceInfo === void 0 ? void 0 : deviceInfo.fcmToken)) return [3 /*break*/, 18];
                    return [4 /*yield*/, (0, user_repository_1.upsertPushToken)(userId, {
                            fcmToken: deviceInfo.fcmToken,
                            platform: deviceInfo.platform,
                            deviceId: deviceInfo.deviceId,
                            appVersion: deviceInfo.appVersion,
                        })];
                case 17:
                    _b.sent();
                    _b.label = 18;
                case 18: return [4 /*yield*/, (0, user_repository_1.getUserProfile)(userId)];
                case 19:
                    userProfile = _b.sent();
                    if (!userProfile) {
                        return [2 /*return*/, reply.status(500).send({
                                error: 'PROFILE_NOT_FOUND',
                                message: 'User profile could not be retrieved',
                            })];
                    }
                    tokens = (0, jwt_utils_1.generateTokens)({
                        userId: userProfile.id,
                        email: userProfile.email,
                        phone: userProfile.phone,
                        role: userProfile.role,
                    });
                    // 8. Return response
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
                case 20:
                    error_1 = _b.sent();
                    logger_1.logger.error('Apple Sign In error:', error_1);
                    return [2 /*return*/, reply.status(500).send({
                            error: 'INTERNAL_SERVER_ERROR',
                            message: 'An error occurred during authentication',
                        })];
                case 21: return [2 /*return*/];
            }
        });
    });
}
