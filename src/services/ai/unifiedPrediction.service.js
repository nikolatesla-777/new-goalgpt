"use strict";
/**
 * Unified Prediction Service
 *
 * Single source of truth for all prediction data.
 * Serves: /admin/predictions, /ai-predictions, /admin/bots, /admin/bots/[botName]
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.unifiedPredictionService = void 0;
var connection_1 = require("../../database/connection");
var logger_1 = require("../../utils/logger");
var UnifiedPredictionService = /** @class */ (function () {
    function UnifiedPredictionService() {
    }
    /**
     * Get predictions with unified filtering
     */
    UnifiedPredictionService.prototype.getPredictions = function () {
        return __awaiter(this, arguments, void 0, function (filter) {
            var _a, status, bot, date, _b, access, _c, page, _d, limit, offset, conditions, params, paramIndex, whereClause, query, countQuery, countParams, statsQuery, botStatsQuery, _e, predictionsResult, countResult, statsResult, botStatsResult, total, statsRow, stats, bots, predictions, error_1;
            var _this = this;
            var _f;
            if (filter === void 0) { filter = {}; }
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0:
                        _a = filter.status, status = _a === void 0 ? 'all' : _a, bot = filter.bot, date = filter.date, _b = filter.access, access = _b === void 0 ? 'all' : _b, _c = filter.page, page = _c === void 0 ? 1 : _c, _d = filter.limit, limit = _d === void 0 ? 50 : _d;
                        offset = (page - 1) * limit;
                        conditions = [];
                        params = [];
                        paramIndex = 1;
                        // Status filter
                        if (status === 'pending') {
                            conditions.push("result = 'pending'");
                        }
                        else if (status === 'matched') {
                            conditions.push("match_id IS NOT NULL");
                        }
                        else if (status === 'won') {
                            conditions.push("result = 'won'");
                        }
                        else if (status === 'lost') {
                            conditions.push("result = 'lost'");
                        }
                        // Bot filter
                        if (bot) {
                            conditions.push("canonical_bot_name ILIKE $".concat(paramIndex));
                            params.push("%".concat(bot, "%"));
                            paramIndex++;
                        }
                        // Date filter
                        if (date) {
                            conditions.push("DATE(created_at) = $".concat(paramIndex));
                            params.push(date);
                            paramIndex++;
                        }
                        // Access filter
                        if (access === 'vip') {
                            conditions.push("access_type = 'VIP'");
                        }
                        else if (access === 'free') {
                            conditions.push("access_type = 'FREE'");
                        }
                        whereClause = conditions.length > 0
                            ? "WHERE ".concat(conditions.join(' AND '))
                            : '';
                        query = "\n      SELECT\n        p.id, p.external_id, p.canonical_bot_name,\n        p.league_name, p.home_team_name, p.away_team_name,\n        -- Prefer live logos from ts_teams, fallback to stored logos (if any)\n        COALESCE(th.logo_url, p.home_team_logo) as home_team_logo,\n        COALESCE(ta.logo_url, p.away_team_logo) as away_team_logo,\n        p.score_at_prediction, p.minute_at_prediction,\n        p.prediction, p.prediction_threshold,\n        p.match_id, p.match_time, p.match_status,\n        p.access_type, p.created_at, p.resulted_at,\n        p.result, p.final_score, p.result_reason, p.source,\n        -- Live scores from ts_matches (fallback to static if NULL)\n        COALESCE(m.home_score_display, NULLIF(SPLIT_PART(p.score_at_prediction, '-', 1), '')::INTEGER, 0) as home_score_display,\n        COALESCE(m.away_score_display, NULLIF(SPLIT_PART(p.score_at_prediction, '-', 2), '')::INTEGER, 0) as away_score_display,\n        -- Live minute and status from ts_matches\n        m.minute as live_match_minute,\n        m.status_id as live_match_status,\n        -- Enhanced Data (Country & Competition)\n        c.name as competition_name,\n        c.logo_url as competition_logo,\n        co.name as country_name,\n        co.logo as country_logo\n      FROM ai_predictions p\n      LEFT JOIN ts_matches m ON p.match_id = m.external_id\n      LEFT JOIN ts_teams th ON m.home_team_id = th.external_id\n      LEFT JOIN ts_teams ta ON m.away_team_id = ta.external_id\n      LEFT JOIN ts_competitions c ON m.competition_id = c.external_id\n      LEFT JOIN ts_countries co ON c.country_id = co.external_id\n      ".concat(whereClause, "\n      ORDER BY p.created_at DESC\n      LIMIT $").concat(paramIndex, " OFFSET $").concat(paramIndex + 1, "\n    ");
                        params.push(limit, offset);
                        countQuery = "SELECT COUNT(*) as total FROM ai_predictions p ".concat(whereClause);
                        countParams = params.slice(0, -2);
                        statsQuery = "\n      SELECT \n        COUNT(*) as total,\n        COUNT(CASE WHEN result = 'pending' THEN 1 END) as pending,\n        COUNT(CASE WHEN match_id IS NOT NULL THEN 1 END) as matched,\n        COUNT(CASE WHEN result = 'won' THEN 1 END) as won,\n        COUNT(CASE WHEN result = 'lost' THEN 1 END) as lost\n      FROM ai_predictions\n    ";
                        botStatsQuery = "\n      SELECT \n        canonical_bot_name as name,\n        COUNT(*) as total,\n        COUNT(CASE WHEN result = 'pending' THEN 1 END) as pending,\n        COUNT(CASE WHEN result = 'won' THEN 1 END) as won,\n        COUNT(CASE WHEN result = 'lost' THEN 1 END) as lost\n      FROM ai_predictions\n      WHERE canonical_bot_name IS NOT NULL\n      GROUP BY canonical_bot_name\n      ORDER BY total DESC\n    ";
                        _g.label = 1;
                    case 1:
                        _g.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, Promise.all([
                                connection_1.pool.query(query, params),
                                connection_1.pool.query(countQuery, countParams),
                                connection_1.pool.query(statsQuery),
                                connection_1.pool.query(botStatsQuery)
                            ])];
                    case 2:
                        _e = _g.sent(), predictionsResult = _e[0], countResult = _e[1], statsResult = _e[2], botStatsResult = _e[3];
                        total = parseInt(((_f = countResult.rows[0]) === null || _f === void 0 ? void 0 : _f.total) || '0');
                        statsRow = statsResult.rows[0];
                        stats = {
                            total: parseInt((statsRow === null || statsRow === void 0 ? void 0 : statsRow.total) || '0'),
                            pending: parseInt((statsRow === null || statsRow === void 0 ? void 0 : statsRow.pending) || '0'),
                            matched: parseInt((statsRow === null || statsRow === void 0 ? void 0 : statsRow.matched) || '0'),
                            won: parseInt((statsRow === null || statsRow === void 0 ? void 0 : statsRow.won) || '0'),
                            lost: parseInt((statsRow === null || statsRow === void 0 ? void 0 : statsRow.lost) || '0'),
                            winRate: this.calculateWinRate(parseInt((statsRow === null || statsRow === void 0 ? void 0 : statsRow.won) || '0'), parseInt((statsRow === null || statsRow === void 0 ? void 0 : statsRow.lost) || '0'))
                        };
                        bots = botStatsResult.rows.map(function (row) { return ({
                            name: row.name,
                            displayName: row.name,
                            total: parseInt(row.total || '0'),
                            pending: parseInt(row.pending || '0'),
                            won: parseInt(row.won || '0'),
                            lost: parseInt(row.lost || '0'),
                            winRate: _this.calculateWinRate(parseInt(row.won || '0'), parseInt(row.lost || '0'))
                        }); });
                        predictions = predictionsResult.rows;
                        return [2 /*return*/, {
                                predictions: predictions,
                                stats: stats,
                                bots: bots,
                                pagination: {
                                    page: page,
                                    limit: limit,
                                    total: total,
                                    totalPages: Math.ceil(total / limit)
                                }
                            }];
                    case 3:
                        error_1 = _g.sent();
                        logger_1.logger.error('[UnifiedPredictionService] getPredictions error:', error_1);
                        throw error_1;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get bot detail with predictions
     */
    UnifiedPredictionService.prototype.getBotDetail = function (botName_1) {
        return __awaiter(this, arguments, void 0, function (botName, page, limit) {
            if (page === void 0) { page = 1; }
            if (limit === void 0) { limit = 50; }
            return __generator(this, function (_a) {
                return [2 /*return*/, this.getPredictions({ bot: botName, page: page, limit: limit }).then(function (result) {
                        var bot = result.bots.find(function (b) {
                            return b.name.toLowerCase().includes(botName.toLowerCase());
                        }) || {
                            name: botName,
                            displayName: botName,
                            total: result.pagination.total,
                            pending: 0,
                            won: 0,
                            lost: 0,
                            winRate: 'N/A'
                        };
                        return {
                            bot: bot,
                            predictions: result.predictions,
                            pagination: result.pagination
                        };
                    })];
            });
        });
    };
    /**
     * Calculate win rate
     */
    UnifiedPredictionService.prototype.calculateWinRate = function (won, lost) {
        var total = won + lost;
        if (total === 0)
            return 'N/A';
        return ((won / total) * 100).toFixed(1) + '%';
    };
    /**
     * Update prediction result (called when match ends)
     */
    UnifiedPredictionService.prototype.updatePredictionResult = function (predictionId, result, finalScore) {
        return __awaiter(this, void 0, void 0, function () {
            var error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, connection_1.pool.query("\n        UPDATE ai_predictions\n        SET \n          result = $1,\n          final_score = $2,\n          resulted_at = NOW(),\n          processed = true\n        WHERE id = $3\n      ", [result, finalScore, predictionId])];
                    case 1:
                        _a.sent();
                        logger_1.logger.info("[UnifiedPredictionService] Updated prediction ".concat(predictionId, " to ").concat(result));
                        return [3 /*break*/, 3];
                    case 2:
                        error_2 = _a.sent();
                        logger_1.logger.error('[UnifiedPredictionService] updatePredictionResult error:', error_2);
                        throw error_2;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Match prediction to a match
     */
    UnifiedPredictionService.prototype.matchPrediction = function (predictionId, matchId, matchUuid, confidence, homeTeamId, awayTeamId) {
        return __awaiter(this, void 0, void 0, function () {
            var matchResult, match, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, connection_1.pool.query("\n        SELECT m.match_time, m.status_id,\n               th.logo_url as home_logo, ta.logo_url as away_logo\n        FROM ts_matches m\n        LEFT JOIN ts_teams th ON m.home_team_id = th.external_id\n        LEFT JOIN ts_teams ta ON m.away_team_id = ta.external_id\n        WHERE m.external_id = $1\n      ", [matchId])];
                    case 1:
                        matchResult = _a.sent();
                        match = matchResult.rows[0];
                        return [4 /*yield*/, connection_1.pool.query("\n        UPDATE ai_predictions\n        SET\n          match_id = $1,\n          confidence = $2,\n          home_team_id = $3,\n          away_team_id = $4,\n          match_time = $5,\n          match_status = $6,\n          home_team_logo = $7,\n          away_team_logo = $8\n        WHERE id = $9\n      ", [
                                matchId,
                                confidence,
                                homeTeamId,
                                awayTeamId,
                                (match === null || match === void 0 ? void 0 : match.match_time) || null,
                                (match === null || match === void 0 ? void 0 : match.status_id) || 1,
                                (match === null || match === void 0 ? void 0 : match.home_logo) || null,
                                (match === null || match === void 0 ? void 0 : match.away_logo) || null,
                                predictionId
                            ])];
                    case 2:
                        _a.sent();
                        logger_1.logger.info("[UnifiedPredictionService] Matched prediction ".concat(predictionId, " to match ").concat(matchId));
                        return [3 /*break*/, 4];
                    case 3:
                        error_3 = _a.sent();
                        logger_1.logger.error('[UnifiedPredictionService] matchPrediction error:', error_3);
                        throw error_3;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Process real-time match event to result predictions
     *
     * Phase 2: This method is now DEPRECATED - use predictionSettlementService instead
     * The settlement service handles period-aware logic (IY vs MS) properly.
     */
    UnifiedPredictionService.prototype.processMatchEvent = function (event) {
        return __awaiter(this, void 0, void 0, function () {
            var type, matchId, statusId;
            return __generator(this, function (_a) {
                // DEPRECATED: Settlement is now handled by predictionSettlementService
                // This method is kept for backward compatibility but logs a warning
                logger_1.logger.warn('[UnifiedPredictionService] processMatchEvent is DEPRECATED - use predictionSettlementService');
                type = event.type, matchId = event.matchId, statusId = event.statusId;
                if (!matchId)
                    return [2 /*return*/];
                // Only log for monitoring - actual settlement handled elsewhere
                if (type === 'MATCH_STATE_CHANGE' && statusId === 8) {
                    logger_1.logger.debug("[UnifiedPredictionService] Match ".concat(matchId, " ended - settlement handled by predictionSettlementService"));
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Check prediction win - Phase 2: Uses prediction_threshold column directly
     */
    UnifiedPredictionService.prototype.checkPredictionWin = function (prediction, threshold, totalGoals) {
        // Simple threshold check - if prediction contains "ÜST" (over)
        if (prediction.toUpperCase().includes('ÜST') || prediction.toLowerCase().includes('over')) {
            return totalGoals > threshold;
        }
        // For "ALT" (under)
        if (prediction.toUpperCase().includes('ALT') || prediction.toLowerCase().includes('under')) {
            return totalGoals < threshold;
        }
        // Default to threshold comparison
        return totalGoals > threshold;
    };
    return UnifiedPredictionService;
}());
exports.unifiedPredictionService = new UnifiedPredictionService();
