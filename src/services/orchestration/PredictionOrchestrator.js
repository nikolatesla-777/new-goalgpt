"use strict";
/**
 * Prediction Orchestrator
 *
 * Event-driven orchestrator for AI prediction CRUD operations.
 * Pattern: EventEmitter + Singleton (same as LiveMatchOrchestrator)
 *
 * Events emitted:
 * - prediction:created (when new prediction ingested)
 * - prediction:updated (when prediction modified)
 * - prediction:deleted (when prediction removed)
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
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
exports.PredictionOrchestrator = void 0;
var events_1 = require("events");
var connection_1 = require("../../database/connection");
var RedisManager_1 = require("../../core/RedisManager");
var logger_1 = require("../../utils/logger");
var PredictionOrchestrator = /** @class */ (function (_super) {
    __extends(PredictionOrchestrator, _super);
    function PredictionOrchestrator() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    PredictionOrchestrator.getInstance = function () {
        if (!this.instance) {
            this.instance = new PredictionOrchestrator();
        }
        return this.instance;
    };
    /**
     * Create new prediction (from ingest or manual)
     *
     * Flow:
     * 1. Acquire Redis lock (prevent duplicate ingest)
     * 2. Check existing prediction by external_id
     * 3. Insert to database
     * 4. Emit prediction:created event
     * 5. Release lock
     */
    PredictionOrchestrator.prototype.createPrediction = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var lockKey, lockTTL, redisAvailable, lockAcquired, existing, result, prediction, error_1, redisAvailable;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        lockKey = "prediction:create:".concat(data.external_id);
                        lockTTL = 3;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 12, , 15]);
                        redisAvailable = RedisManager_1.RedisManager.isAvailable();
                        lockAcquired = false;
                        if (!redisAvailable) return [3 /*break*/, 3];
                        return [4 /*yield*/, RedisManager_1.RedisManager.acquireLock(lockKey, 'ingest', lockTTL)];
                    case 2:
                        lockAcquired = _a.sent();
                        if (!lockAcquired) {
                            logger_1.logger.warn("[PredictionOrchestrator] Lock busy for ".concat(data.external_id));
                            return [2 /*return*/, { status: 'duplicate', reason: 'Already processing' }];
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        logger_1.logger.warn('[PredictionOrchestrator] Redis unavailable - proceeding without lock');
                        _a.label = 4;
                    case 4: return [4 /*yield*/, connection_1.pool.query('SELECT id FROM ai_predictions WHERE external_id = $1', [data.external_id])];
                    case 5:
                        existing = _a.sent();
                        if (!(existing.rows.length > 0)) return [3 /*break*/, 8];
                        if (!(redisAvailable && lockAcquired)) return [3 /*break*/, 7];
                        return [4 /*yield*/, RedisManager_1.RedisManager.releaseLock(lockKey)];
                    case 6:
                        _a.sent();
                        _a.label = 7;
                    case 7:
                        logger_1.logger.debug("[PredictionOrchestrator] Duplicate prediction: ".concat(data.external_id));
                        return [2 /*return*/, { status: 'duplicate', predictionId: existing.rows[0].id }];
                    case 8: return [4 /*yield*/, connection_1.pool.query("\n        INSERT INTO ai_predictions (\n          external_id, canonical_bot_name, league_name,\n          home_team_name, away_team_name, home_team_logo, away_team_logo,\n          score_at_prediction, minute_at_prediction, prediction, prediction_threshold,\n          match_id, match_time, match_status, access_type, source, created_at\n        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())\n        RETURNING id, external_id, created_at\n      ", [
                            data.external_id,
                            data.canonical_bot_name,
                            data.league_name,
                            data.home_team_name,
                            data.away_team_name,
                            data.home_team_logo || null,
                            data.away_team_logo || null,
                            data.score_at_prediction,
                            data.minute_at_prediction,
                            data.prediction,
                            data.prediction_threshold,
                            data.match_id || null,
                            data.match_time || null,
                            data.match_status || 1,
                            data.access_type || 'FREE',
                            data.source || 'external',
                        ])];
                    case 9:
                        result = _a.sent();
                        prediction = result.rows[0];
                        // Step 4: Emit event
                        this.emit('prediction:created', {
                            predictionId: prediction.id,
                            externalId: prediction.external_id,
                            botName: data.canonical_bot_name,
                            matchId: data.match_id || '', // Empty string if not matched
                            prediction: data.prediction,
                            accessType: data.access_type || 'FREE',
                            timestamp: Date.now(),
                        });
                        logger_1.logger.info("[PredictionOrchestrator] Created prediction: ".concat(prediction.id, " (").concat(data.external_id, ")"));
                        if (!(redisAvailable && lockAcquired)) return [3 /*break*/, 11];
                        return [4 /*yield*/, RedisManager_1.RedisManager.releaseLock(lockKey)];
                    case 10:
                        _a.sent();
                        _a.label = 11;
                    case 11: return [2 /*return*/, { status: 'success', predictionId: prediction.id }];
                    case 12:
                        error_1 = _a.sent();
                        logger_1.logger.error('[PredictionOrchestrator] createPrediction error:', error_1);
                        redisAvailable = RedisManager_1.RedisManager.isAvailable();
                        if (!redisAvailable) return [3 /*break*/, 14];
                        return [4 /*yield*/, RedisManager_1.RedisManager.releaseLock(lockKey).catch(function () {
                                // Ignore lock release errors
                            })];
                    case 13:
                        _a.sent();
                        _a.label = 14;
                    case 14: return [2 /*return*/, { status: 'error', reason: error_1.message }];
                    case 15: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Update prediction (access_type, match_id, etc.)
     *
     * Flow:
     * 1. Acquire Redis lock
     * 2. Build dynamic UPDATE query based on fields provided
     * 3. Execute update
     * 4. Emit prediction:updated event
     * 5. Release lock
     */
    PredictionOrchestrator.prototype.updatePrediction = function (predictionId, updates) {
        return __awaiter(this, void 0, void 0, function () {
            var lockKey, lockTTL, redisAvailable, lockAcquired, fields, values, paramIndex, query, result, prediction, error_2, redisAvailable;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        lockKey = "prediction:update:".concat(predictionId);
                        lockTTL = 3;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 13, , 16]);
                        redisAvailable = RedisManager_1.RedisManager.isAvailable();
                        lockAcquired = false;
                        if (!redisAvailable) return [3 /*break*/, 3];
                        return [4 /*yield*/, RedisManager_1.RedisManager.acquireLock(lockKey, 'update', lockTTL)];
                    case 2:
                        lockAcquired = _a.sent();
                        if (!lockAcquired) {
                            logger_1.logger.warn("[PredictionOrchestrator] Lock busy for prediction ".concat(predictionId));
                            return [2 /*return*/, { status: 'error', reason: 'Lock busy' }];
                        }
                        _a.label = 3;
                    case 3:
                        fields = [];
                        values = [];
                        paramIndex = 1;
                        if (updates.access_type) {
                            fields.push("access_type = $".concat(paramIndex++));
                            values.push(updates.access_type);
                        }
                        if (updates.match_id !== undefined) {
                            fields.push("match_id = $".concat(paramIndex++));
                            values.push(updates.match_id);
                        }
                        if (updates.match_time !== undefined) {
                            fields.push("match_time = $".concat(paramIndex++));
                            values.push(updates.match_time);
                        }
                        if (updates.match_status !== undefined) {
                            fields.push("match_status = $".concat(paramIndex++));
                            values.push(updates.match_status);
                        }
                        if (!(fields.length === 0)) return [3 /*break*/, 6];
                        if (!(redisAvailable && lockAcquired)) return [3 /*break*/, 5];
                        return [4 /*yield*/, RedisManager_1.RedisManager.releaseLock(lockKey)];
                    case 4:
                        _a.sent();
                        _a.label = 5;
                    case 5: return [2 /*return*/, { status: 'success' }];
                    case 6:
                        values.push(predictionId);
                        query = "\n        UPDATE ai_predictions\n        SET ".concat(fields.join(', '), "\n        WHERE id = $").concat(paramIndex, "\n        RETURNING id, external_id, match_id\n      ");
                        return [4 /*yield*/, connection_1.pool.query(query, values)];
                    case 7:
                        result = _a.sent();
                        if (!(result.rows.length === 0)) return [3 /*break*/, 10];
                        if (!(redisAvailable && lockAcquired)) return [3 /*break*/, 9];
                        return [4 /*yield*/, RedisManager_1.RedisManager.releaseLock(lockKey)];
                    case 8:
                        _a.sent();
                        _a.label = 9;
                    case 9: return [2 /*return*/, { status: 'not_found' }];
                    case 10:
                        prediction = result.rows[0];
                        // Emit event
                        this.emit('prediction:updated', {
                            predictionId: predictionId,
                            matchId: prediction.match_id || '', // Empty string if not matched
                            fields: Object.keys(updates),
                            timestamp: Date.now(),
                        });
                        logger_1.logger.info("[PredictionOrchestrator] Updated prediction: ".concat(predictionId, " (fields: ").concat(Object.keys(updates).join(', '), ")"));
                        if (!(redisAvailable && lockAcquired)) return [3 /*break*/, 12];
                        return [4 /*yield*/, RedisManager_1.RedisManager.releaseLock(lockKey)];
                    case 11:
                        _a.sent();
                        _a.label = 12;
                    case 12: return [2 /*return*/, { status: 'success' }];
                    case 13:
                        error_2 = _a.sent();
                        logger_1.logger.error('[PredictionOrchestrator] updatePrediction error:', error_2);
                        redisAvailable = RedisManager_1.RedisManager.isAvailable();
                        if (!redisAvailable) return [3 /*break*/, 15];
                        return [4 /*yield*/, RedisManager_1.RedisManager.releaseLock(lockKey).catch(function () {
                                // Ignore lock release errors
                            })];
                    case 14:
                        _a.sent();
                        _a.label = 15;
                    case 15: return [2 /*return*/, { status: 'error', reason: error_2.message }];
                    case 16: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Delete prediction
     *
     * Flow:
     * 1. Acquire Redis lock
     * 2. Delete from database
     * 3. Emit prediction:deleted event
     * 4. Release lock
     */
    PredictionOrchestrator.prototype.deletePrediction = function (predictionId) {
        return __awaiter(this, void 0, void 0, function () {
            var lockKey, lockTTL, redisAvailable, lockAcquired, result, prediction, error_3, redisAvailable;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        lockKey = "prediction:delete:".concat(predictionId);
                        lockTTL = 3;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 10, , 13]);
                        redisAvailable = RedisManager_1.RedisManager.isAvailable();
                        lockAcquired = false;
                        if (!redisAvailable) return [3 /*break*/, 3];
                        return [4 /*yield*/, RedisManager_1.RedisManager.acquireLock(lockKey, 'delete', lockTTL)];
                    case 2:
                        lockAcquired = _a.sent();
                        if (!lockAcquired) {
                            logger_1.logger.warn("[PredictionOrchestrator] Lock busy for prediction ".concat(predictionId));
                            return [2 /*return*/, { status: 'error' }];
                        }
                        _a.label = 3;
                    case 3: return [4 /*yield*/, connection_1.pool.query('DELETE FROM ai_predictions WHERE id = $1 RETURNING external_id, match_id', [predictionId])];
                    case 4:
                        result = _a.sent();
                        if (!(result.rows.length === 0)) return [3 /*break*/, 7];
                        if (!(redisAvailable && lockAcquired)) return [3 /*break*/, 6];
                        return [4 /*yield*/, RedisManager_1.RedisManager.releaseLock(lockKey)];
                    case 5:
                        _a.sent();
                        _a.label = 6;
                    case 6: return [2 /*return*/, { status: 'not_found' }];
                    case 7:
                        prediction = result.rows[0];
                        this.emit('prediction:deleted', {
                            predictionId: predictionId,
                            matchId: prediction.match_id || '', // Empty string if not matched
                            timestamp: Date.now(),
                        });
                        logger_1.logger.info("[PredictionOrchestrator] Deleted prediction: ".concat(predictionId));
                        if (!(redisAvailable && lockAcquired)) return [3 /*break*/, 9];
                        return [4 /*yield*/, RedisManager_1.RedisManager.releaseLock(lockKey)];
                    case 8:
                        _a.sent();
                        _a.label = 9;
                    case 9: return [2 /*return*/, { status: 'success' }];
                    case 10:
                        error_3 = _a.sent();
                        logger_1.logger.error('[PredictionOrchestrator] deletePrediction error:', error_3);
                        redisAvailable = RedisManager_1.RedisManager.isAvailable();
                        if (!redisAvailable) return [3 /*break*/, 12];
                        return [4 /*yield*/, RedisManager_1.RedisManager.releaseLock(lockKey).catch(function () {
                                // Ignore lock release errors
                            })];
                    case 11:
                        _a.sent();
                        _a.label = 12;
                    case 12: return [2 /*return*/, { status: 'error' }];
                    case 13: return [2 /*return*/];
                }
            });
        });
    };
    PredictionOrchestrator.instance = null;
    return PredictionOrchestrator;
}(events_1.EventEmitter));
exports.PredictionOrchestrator = PredictionOrchestrator;
