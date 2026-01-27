"use strict";
/**
 * Prediction Unlock Routes
 *
 * Endpoints for FREE users to unlock predictions with credits
 *
 * Endpoints:
 * - POST /api/predictions/:id/unlock - Unlock a prediction
 * - GET  /api/predictions/:id/access - Check if user has access
 * - GET  /api/predictions/unlocked   - Get user's unlocked predictions
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
exports.predictionUnlockRoutes = predictionUnlockRoutes;
var auth_middleware_1 = require("../middleware/auth.middleware");
var predictionUnlock_service_1 = require("../services/predictionUnlock.service");
var credits_service_1 = __importDefault(require("../services/credits.service"));
// ============================================================================
// ROUTES
// ============================================================================
function predictionUnlockRoutes(fastify) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            /**
             * POST /api/predictions/:id/unlock
             * Unlock a prediction using credits
             */
            fastify.post('/:id/unlock', { preHandler: auth_middleware_1.requireAuth }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var userId, predictionId, result, error_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            userId = request.user.userId;
                            predictionId = request.params.id;
                            return [4 /*yield*/, (0, predictionUnlock_service_1.unlockPrediction)(userId, predictionId)];
                        case 1:
                            result = _a.sent();
                            if (!result.success) {
                                return [2 /*return*/, reply.status(400).send({
                                        success: false,
                                        error: result.error || 'UNLOCK_FAILED',
                                        message: result.message,
                                        newBalance: result.newBalance,
                                        unlockCost: predictionUnlock_service_1.UNLOCK_COST,
                                    })];
                            }
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    message: result.message,
                                    newBalance: result.newBalance,
                                    unlockCost: predictionUnlock_service_1.UNLOCK_COST,
                                })];
                        case 2:
                            error_1 = _a.sent();
                            fastify.log.error('Unlock prediction error:', error_1);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'UNLOCK_FAILED',
                                    message: error_1.message || 'Tahmin kilidi açılamadı',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * GET /api/predictions/:id/access
             * Check if user has access to a prediction
             */
            fastify.get('/:id/access', { preHandler: auth_middleware_1.requireAuth }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var userId, predictionId, hasAccess, creditsData, balance, error_2;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 3, , 4]);
                            userId = request.user.userId;
                            predictionId = request.params.id;
                            return [4 /*yield*/, (0, predictionUnlock_service_1.canAccessPrediction)(userId, predictionId)];
                        case 1:
                            hasAccess = _a.sent();
                            return [4 /*yield*/, credits_service_1.default.getUserCredits(userId)];
                        case 2:
                            creditsData = _a.sent();
                            balance = (creditsData === null || creditsData === void 0 ? void 0 : creditsData.balance) || 0;
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    hasAccess: hasAccess,
                                    unlockCost: predictionUnlock_service_1.UNLOCK_COST,
                                    currentBalance: balance,
                                    canAfford: balance >= predictionUnlock_service_1.UNLOCK_COST,
                                })];
                        case 3:
                            error_2 = _a.sent();
                            fastify.log.error('Check access error:', error_2);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'CHECK_ACCESS_FAILED',
                                    message: error_2.message || 'Erişim kontrolü başarısız',
                                })];
                        case 4: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * GET /api/predictions/unlocked
             * Get list of prediction IDs user has unlocked
             */
            fastify.get('/unlocked', { preHandler: auth_middleware_1.requireAuth }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var userId, unlockedIds, stats, creditsData, balance, error_3;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 4, , 5]);
                            userId = request.user.userId;
                            return [4 /*yield*/, (0, predictionUnlock_service_1.getUserUnlockedPredictions)(userId)];
                        case 1:
                            unlockedIds = _a.sent();
                            return [4 /*yield*/, (0, predictionUnlock_service_1.getUserUnlockStats)(userId)];
                        case 2:
                            stats = _a.sent();
                            return [4 /*yield*/, credits_service_1.default.getUserCredits(userId)];
                        case 3:
                            creditsData = _a.sent();
                            balance = (creditsData === null || creditsData === void 0 ? void 0 : creditsData.balance) || 0;
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    data: {
                                        unlockedPredictionIds: unlockedIds,
                                        totalUnlocked: stats.totalUnlocked,
                                        totalCreditsSpent: stats.totalCreditsSpent,
                                        currentBalance: balance,
                                        unlockCost: predictionUnlock_service_1.UNLOCK_COST,
                                    },
                                })];
                        case 4:
                            error_3 = _a.sent();
                            fastify.log.error('Get unlocked predictions error:', error_3);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'GET_UNLOCKED_FAILED',
                                    message: error_3.message || 'Açılan tahminler alınamadı',
                                })];
                        case 5: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * GET /api/predictions/unlock-info
             * Get unlock cost and user balance info
             */
            fastify.get('/unlock-info', { preHandler: auth_middleware_1.requireAuth }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var userId, creditsData, balance, error_4;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            userId = request.user.userId;
                            return [4 /*yield*/, credits_service_1.default.getUserCredits(userId)];
                        case 1:
                            creditsData = _a.sent();
                            balance = (creditsData === null || creditsData === void 0 ? void 0 : creditsData.balance) || 0;
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    data: {
                                        unlockCost: predictionUnlock_service_1.UNLOCK_COST,
                                        currentBalance: balance,
                                        canAfford: balance >= predictionUnlock_service_1.UNLOCK_COST,
                                        predictionsCanUnlock: Math.floor(balance / predictionUnlock_service_1.UNLOCK_COST),
                                    },
                                })];
                        case 2:
                            error_4 = _a.sent();
                            fastify.log.error('Get unlock info error:', error_4);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'GET_INFO_FAILED',
                                    message: error_4.message || 'Bilgi alınamadı',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            return [2 /*return*/];
        });
    });
}
