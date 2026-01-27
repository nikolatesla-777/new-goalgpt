"use strict";
/**
 * Prediction Settlement Service
 *
 * TEK MERKEZİ SONUÇLANDIRMA SERVİSİ
 * Tüm tahmin sonuçlandırma logic'i buradan yönetilir.
 *
 * KURALLAR:
 * - IY (İlk Yarı) tahminleri: minute <= 45 → Devre arasında (status=3) HT skoru ile sonuçlanır
 * - MS (Maç Sonu) tahminleri: minute > 45 → Maç sonunda (status=8) final skoru ile sonuçlanır
 * - Instant Win: Gol anında threshold aşıldıysa anında WON işaretlenir
 *
 * ÖZELLİKLER:
 * - Deduplication: Aynı event 5 saniye içinde tekrar işlenmez
 * - Database Lock: SELECT ... FOR UPDATE ile race condition önlenir
 * - Period-Aware: IY/MS tahminleri ayrı ayrı sonuçlandırılır
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
exports.predictionSettlementService = void 0;
exports.setOnPredictionSettled = setOnPredictionSettled;
var connection_1 = require("../../database/connection");
var logger_1 = require("../../utils/logger");
var obsLogger_1 = require("../../utils/obsLogger");
// Callback for WebSocket broadcast (set by server.ts)
var onPredictionSettled = null;
function setOnPredictionSettled(callback) {
    onPredictionSettled = callback;
}
// ============================================================================
// PREDICTION SETTLEMENT SERVICE
// ============================================================================
var PredictionSettlementService = /** @class */ (function () {
    function PredictionSettlementService() {
        var _this = this;
        this.recentSettlements = new Map();
        this.DEDUP_WINDOW_MS = 5000; // 5 saniye deduplication penceresi
        this.CACHE_CLEANUP_INTERVAL_MS = 60000; // 1 dakikada bir cache temizliği
        // Periyodik olarak eski cache entry'lerini temizle
        setInterval(function () { return _this.cleanupCache(); }, this.CACHE_CLEANUP_INTERVAL_MS);
    }
    // ==========================================================================
    // ANA GİRİŞ NOKTASI
    // ==========================================================================
    /**
     * Ana event işleyici - Tüm settlement'lar buradan geçer
     */
    PredictionSettlementService.prototype.processEvent = function (event) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, result, _a, duration, error_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        startTime = Date.now();
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 10, , 11]);
                        // 1. Validation
                        if (!event.matchId) {
                            logger_1.logger.warn('[Settlement] Event rejected: missing matchId');
                            return [2 /*return*/, { settled: 0, winners: 0, losers: 0, skipped: true, reason: 'missing_match_id' }];
                        }
                        // 2. Deduplication check
                        if (this.isDuplicate(event)) {
                            logger_1.logger.debug("[Settlement] Duplicate event skipped: ".concat(event.matchId, ":").concat(event.eventType));
                            return [2 /*return*/, { settled: 0, winners: 0, losers: 0, skipped: true, reason: 'duplicate' }];
                        }
                        result = void 0;
                        _a = event.eventType;
                        switch (_a) {
                            case 'goal': return [3 /*break*/, 2];
                            case 'score_change': return [3 /*break*/, 2];
                            case 'halftime': return [3 /*break*/, 4];
                            case 'fulltime': return [3 /*break*/, 6];
                        }
                        return [3 /*break*/, 8];
                    case 2: return [4 /*yield*/, this.handleGoal(event)];
                    case 3:
                        result = _b.sent();
                        return [3 /*break*/, 9];
                    case 4: return [4 /*yield*/, this.handleHalftime(event)];
                    case 5:
                        result = _b.sent();
                        return [3 /*break*/, 9];
                    case 6: return [4 /*yield*/, this.handleFulltime(event)];
                    case 7:
                        result = _b.sent();
                        return [3 /*break*/, 9];
                    case 8:
                        logger_1.logger.warn("[Settlement] Unknown event type: ".concat(event.eventType));
                        return [2 /*return*/, { settled: 0, winners: 0, losers: 0, skipped: true, reason: 'unknown_event_type' }];
                    case 9:
                        duration = Date.now() - startTime;
                        if (result.settled > 0) {
                            (0, obsLogger_1.logEvent)('info', 'settlement.processed', {
                                match_id: event.matchId,
                                event_type: event.eventType,
                                settled: result.settled,
                                winners: result.winners,
                                losers: result.losers,
                                duration_ms: duration,
                            });
                        }
                        return [2 /*return*/, result];
                    case 10:
                        error_1 = _b.sent();
                        logger_1.logger.error("[Settlement] Error processing event for ".concat(event.matchId, ":"), error_1);
                        (0, obsLogger_1.logEvent)('error', 'settlement.error', {
                            match_id: event.matchId,
                            event_type: event.eventType,
                            error_message: error_1.message,
                        });
                        return [2 /*return*/, { settled: 0, winners: 0, losers: 0, skipped: true, reason: 'error' }];
                    case 11: return [2 /*return*/];
                }
            });
        });
    };
    // ==========================================================================
    // EVENT HANDLERS
    // ==========================================================================
    /**
     * Gol olayı handler - Instant Win kontrolü
     *
     * Sadece threshold aşıldıysa WON işaretler (LOST işaretlemez!)
     * IY tahminleri: Sadece 1. yarıda atılan gollerde kontrol edilir
     * MS tahminleri: Her gol sonrası kontrol edilir
     */
    PredictionSettlementService.prototype.handleGoal = function (event) {
        return __awaiter(this, void 0, void 0, function () {
            var client, settled, pending_1, totalGoals, currentMinute, currentScore, _i, _a, row, period, threshold, error_2;
            var _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, connection_1.pool.connect()];
                    case 1:
                        client = _c.sent();
                        settled = 0;
                        _c.label = 2;
                    case 2:
                        _c.trys.push([2, 15, 17, 18]);
                        return [4 /*yield*/, client.query('BEGIN')];
                    case 3:
                        _c.sent();
                        return [4 /*yield*/, client.query("\n        SELECT id, minute_at_prediction, score_at_prediction,\n               prediction, prediction_threshold,\n               canonical_bot_name, home_team_name, away_team_name\n        FROM ai_predictions\n        WHERE match_id = $1 AND result = 'pending'\n        FOR UPDATE\n      ", [event.matchId])];
                    case 4:
                        pending_1 = _c.sent();
                        if (!(pending_1.rows.length === 0)) return [3 /*break*/, 6];
                        return [4 /*yield*/, client.query('COMMIT')];
                    case 5:
                        _c.sent();
                        return [2 /*return*/, { settled: 0, winners: 0, losers: 0 }];
                    case 6:
                        totalGoals = event.homeScore + event.awayScore;
                        currentMinute = (_b = event.minute) !== null && _b !== void 0 ? _b : 90;
                        currentScore = "".concat(event.homeScore, "-").concat(event.awayScore);
                        _i = 0, _a = pending_1.rows;
                        _c.label = 7;
                    case 7:
                        if (!(_i < _a.length)) return [3 /*break*/, 13];
                        row = _a[_i];
                        period = row.minute_at_prediction <= 45 ? 'IY' : 'MS';
                        threshold = row.prediction_threshold;
                        if (!(totalGoals > threshold)) return [3 /*break*/, 12];
                        if (!(period === 'IY')) return [3 /*break*/, 10];
                        if (!(currentMinute <= 45)) return [3 /*break*/, 9];
                        // INSTANT WIN: final_score'u kaydetme - maç bittiğinde güncellenecek
                        return [4 /*yield*/, this.markWon(client, row.id, 'instant_win_iy', undefined)];
                    case 8:
                        // INSTANT WIN: final_score'u kaydetme - maç bittiğinde güncellenecek
                        _c.sent();
                        settled++;
                        logger_1.logger.info("[Settlement] INSTANT WIN (IY): ".concat(row.id, " - ").concat(totalGoals, " goals > ").concat(threshold, " threshold (score at win: ").concat(currentScore, ")"));
                        // Phase 3: WebSocket broadcast
                        this.broadcastSettlement({
                            predictionId: row.id,
                            matchId: event.matchId,
                            botName: row.canonical_bot_name,
                            prediction: row.prediction,
                            result: 'won',
                            resultReason: 'instant_win_iy',
                            homeTeam: row.home_team_name,
                            awayTeam: row.away_team_name,
                            finalScore: currentScore, // UI için geçici skor
                            timestamp: Date.now(),
                        });
                        _c.label = 9;
                    case 9: return [3 /*break*/, 12];
                    case 10:
                        if (!(period === 'MS')) return [3 /*break*/, 12];
                        // INSTANT WIN: final_score'u kaydetme - maç bittiğinde güncellenecek
                        return [4 /*yield*/, this.markWon(client, row.id, 'instant_win_ms', undefined)];
                    case 11:
                        // INSTANT WIN: final_score'u kaydetme - maç bittiğinde güncellenecek
                        _c.sent();
                        settled++;
                        logger_1.logger.info("[Settlement] INSTANT WIN (MS): ".concat(row.id, " - ").concat(totalGoals, " goals > ").concat(threshold, " threshold (score at win: ").concat(currentScore, ")"));
                        // Phase 3: WebSocket broadcast
                        this.broadcastSettlement({
                            predictionId: row.id,
                            matchId: event.matchId,
                            botName: row.canonical_bot_name,
                            prediction: row.prediction,
                            result: 'won',
                            resultReason: 'instant_win_ms',
                            homeTeam: row.home_team_name,
                            awayTeam: row.away_team_name,
                            finalScore: currentScore, // UI için geçici skor
                            timestamp: Date.now(),
                        });
                        _c.label = 12;
                    case 12:
                        _i++;
                        return [3 /*break*/, 7];
                    case 13: return [4 /*yield*/, client.query('COMMIT')];
                    case 14:
                        _c.sent();
                        // Stats view'ları güncelle
                        if (settled > 0) {
                            this.refreshStatsAsync();
                        }
                        return [2 /*return*/, { settled: settled, winners: settled, losers: 0 }];
                    case 15:
                        error_2 = _c.sent();
                        return [4 /*yield*/, client.query('ROLLBACK')];
                    case 16:
                        _c.sent();
                        throw error_2;
                    case 17:
                        client.release();
                        return [7 /*endfinally*/];
                    case 18: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Devre arası handler - IY tahminlerini sonuçlandır
     *
     * Status 3 (HALF_TIME) geldiğinde çağrılır
     * Sadece minute <= 45 olan tahminleri sonuçlandırır
     *
     * BUGFIX (2026-01-20): Verify match status from DB before settling
     * This prevents false settlements from stale/incorrect status data
     */
    PredictionSettlementService.prototype.handleHalftime = function (event) {
        return __awaiter(this, void 0, void 0, function () {
            var client, winners, losers, matchCheck, actualStatus, pending_2, htTotal, htScore, _i, _a, row, threshold, error_3;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, connection_1.pool.connect()];
                    case 1:
                        client = _b.sent();
                        winners = 0, losers = 0;
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 17, 19, 20]);
                        return [4 /*yield*/, client.query('BEGIN')];
                    case 3:
                        _b.sent();
                        return [4 /*yield*/, client.query("\n        SELECT status_id FROM ts_matches WHERE external_id = $1\n      ", [event.matchId])];
                    case 4:
                        matchCheck = _b.sent();
                        if (!(matchCheck.rows.length > 0)) return [3 /*break*/, 6];
                        actualStatus = matchCheck.rows[0].status_id;
                        if (!(actualStatus !== null && actualStatus < 3)) return [3 /*break*/, 6];
                        return [4 /*yield*/, client.query('COMMIT')];
                    case 5:
                        _b.sent();
                        logger_1.logger.warn("[Settlement] HT: Match ".concat(event.matchId, " is NOT at halftime (status=").concat(actualStatus, "). Skipping settlement."));
                        return [2 /*return*/, { settled: 0, winners: 0, losers: 0, skipped: true, reason: 'match_not_at_halftime' }];
                    case 6: return [4 /*yield*/, client.query("\n        SELECT id, minute_at_prediction, score_at_prediction,\n               prediction, prediction_threshold,\n               canonical_bot_name, home_team_name, away_team_name\n        FROM ai_predictions\n        WHERE match_id = $1\n          AND result = 'pending'\n          AND minute_at_prediction <= 45\n        FOR UPDATE\n      ", [event.matchId])];
                    case 7:
                        pending_2 = _b.sent();
                        if (!(pending_2.rows.length === 0)) return [3 /*break*/, 9];
                        return [4 /*yield*/, client.query('COMMIT')];
                    case 8:
                        _b.sent();
                        logger_1.logger.debug("[Settlement] HT: No pending IY predictions for ".concat(event.matchId));
                        return [2 /*return*/, { settled: 0, winners: 0, losers: 0 }];
                    case 9:
                        htTotal = event.homeScore + event.awayScore;
                        htScore = "".concat(event.homeScore, "-").concat(event.awayScore);
                        logger_1.logger.info("[Settlement] HT Settlement for ".concat(event.matchId, ": HT Score ").concat(htScore, ", ").concat(pending_2.rows.length, " IY predictions"));
                        _i = 0, _a = pending_2.rows;
                        _b.label = 10;
                    case 10:
                        if (!(_i < _a.length)) return [3 /*break*/, 15];
                        row = _a[_i];
                        threshold = row.prediction_threshold;
                        if (!(htTotal > threshold)) return [3 /*break*/, 12];
                        return [4 /*yield*/, this.markWon(client, row.id, 'halftime_settlement', htScore)];
                    case 11:
                        _b.sent();
                        winners++;
                        logger_1.logger.info("[Settlement] HT WON: ".concat(row.id, " - HT ").concat(htTotal, " > ").concat(threshold));
                        // Phase 3: WebSocket broadcast
                        this.broadcastSettlement({
                            predictionId: row.id,
                            matchId: event.matchId,
                            botName: row.canonical_bot_name,
                            prediction: row.prediction,
                            result: 'won',
                            resultReason: 'halftime_settlement',
                            homeTeam: row.home_team_name,
                            awayTeam: row.away_team_name,
                            finalScore: htScore,
                            timestamp: Date.now(),
                        });
                        return [3 /*break*/, 14];
                    case 12: return [4 /*yield*/, this.markLost(client, row.id, 'halftime_threshold_not_met', htScore)];
                    case 13:
                        _b.sent();
                        losers++;
                        logger_1.logger.info("[Settlement] HT LOST: ".concat(row.id, " - HT ").concat(htTotal, " <= ").concat(threshold));
                        // Phase 3: WebSocket broadcast
                        this.broadcastSettlement({
                            predictionId: row.id,
                            matchId: event.matchId,
                            botName: row.canonical_bot_name,
                            prediction: row.prediction,
                            result: 'lost',
                            resultReason: 'halftime_threshold_not_met',
                            homeTeam: row.home_team_name,
                            awayTeam: row.away_team_name,
                            finalScore: htScore,
                            timestamp: Date.now(),
                        });
                        _b.label = 14;
                    case 14:
                        _i++;
                        return [3 /*break*/, 10];
                    case 15: return [4 /*yield*/, client.query('COMMIT')];
                    case 16:
                        _b.sent();
                        // Stats view'ları güncelle
                        if (winners + losers > 0) {
                            this.refreshStatsAsync();
                        }
                        return [2 /*return*/, { settled: winners + losers, winners: winners, losers: losers }];
                    case 17:
                        error_3 = _b.sent();
                        return [4 /*yield*/, client.query('ROLLBACK')];
                    case 18:
                        _b.sent();
                        throw error_3;
                    case 19:
                        client.release();
                        return [7 /*endfinally*/];
                    case 20: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Maç sonu handler - MS tahminlerini sonuçlandır
     *
     * Status 8 (END) geldiğinde çağrılır
     * Sadece minute > 45 olan tahminleri sonuçlandırır
     *
     * BUGFIX (2026-01-20): Verify match status from DB before settling
     */
    PredictionSettlementService.prototype.handleFulltime = function (event) {
        return __awaiter(this, void 0, void 0, function () {
            var client, winners, losers, matchCheck, actualStatus, matchResult, homeScore, awayScore, pending_3, finalTotal, finalScore, _i, _a, row, threshold, error_4;
            var _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0: return [4 /*yield*/, connection_1.pool.connect()];
                    case 1:
                        client = _d.sent();
                        winners = 0, losers = 0;
                        _d.label = 2;
                    case 2:
                        _d.trys.push([2, 19, 21, 22]);
                        return [4 /*yield*/, client.query('BEGIN')];
                    case 3:
                        _d.sent();
                        return [4 /*yield*/, client.query("\n        SELECT status_id FROM ts_matches WHERE external_id = $1\n      ", [event.matchId])];
                    case 4:
                        matchCheck = _d.sent();
                        if (!(matchCheck.rows.length > 0)) return [3 /*break*/, 6];
                        actualStatus = matchCheck.rows[0].status_id;
                        if (!(actualStatus !== null && actualStatus !== 8)) return [3 /*break*/, 6];
                        return [4 /*yield*/, client.query('COMMIT')];
                    case 5:
                        _d.sent();
                        logger_1.logger.warn("[Settlement] FT: Match ".concat(event.matchId, " has NOT ended (status=").concat(actualStatus, "). Skipping settlement."));
                        return [2 /*return*/, { settled: 0, winners: 0, losers: 0, skipped: true, reason: 'match_not_ended' }];
                    case 6: return [4 /*yield*/, client.query("\n        SELECT\n          COALESCE(\n            home_score_display, \n            (home_scores->>0)::INTEGER,\n            $2\n          ) as home_final,\n          COALESCE(\n            away_score_display, \n            (away_scores->>0)::INTEGER,\n            $3\n          ) as away_final\n        FROM ts_matches\n        WHERE external_id = $1\n      ", [event.matchId, event.homeScore, event.awayScore])];
                    case 7:
                        matchResult = _d.sent();
                        homeScore = event.homeScore;
                        awayScore = event.awayScore;
                        if (matchResult.rows.length > 0) {
                            homeScore = (_b = matchResult.rows[0].home_final) !== null && _b !== void 0 ? _b : event.homeScore;
                            awayScore = (_c = matchResult.rows[0].away_final) !== null && _c !== void 0 ? _c : event.awayScore;
                        }
                        return [4 /*yield*/, client.query("\n        SELECT id, minute_at_prediction, score_at_prediction,\n               prediction, prediction_threshold,\n               canonical_bot_name, home_team_name, away_team_name\n        FROM ai_predictions\n        WHERE match_id = $1\n          AND result = 'pending'\n          AND minute_at_prediction > 45\n        FOR UPDATE\n      ", [event.matchId])];
                    case 8:
                        pending_3 = _d.sent();
                        if (!(pending_3.rows.length === 0)) return [3 /*break*/, 10];
                        return [4 /*yield*/, client.query('COMMIT')];
                    case 9:
                        _d.sent();
                        logger_1.logger.debug("[Settlement] FT: No pending MS predictions for ".concat(event.matchId));
                        return [2 /*return*/, { settled: 0, winners: 0, losers: 0 }];
                    case 10:
                        finalTotal = homeScore + awayScore;
                        finalScore = "".concat(homeScore, "-").concat(awayScore);
                        logger_1.logger.info("[Settlement] FT Settlement for ".concat(event.matchId, ": Final Score ").concat(finalScore, " (from DB), ").concat(pending_3.rows.length, " MS predictions"));
                        _i = 0, _a = pending_3.rows;
                        _d.label = 11;
                    case 11:
                        if (!(_i < _a.length)) return [3 /*break*/, 16];
                        row = _a[_i];
                        threshold = row.prediction_threshold;
                        if (!(finalTotal > threshold)) return [3 /*break*/, 13];
                        return [4 /*yield*/, this.markWon(client, row.id, 'fulltime_settlement', finalScore)];
                    case 12:
                        _d.sent();
                        winners++;
                        logger_1.logger.info("[Settlement] FT WON: ".concat(row.id, " - Final ").concat(finalTotal, " > ").concat(threshold));
                        // Phase 3: WebSocket broadcast
                        this.broadcastSettlement({
                            predictionId: row.id,
                            matchId: event.matchId,
                            botName: row.canonical_bot_name,
                            prediction: row.prediction,
                            result: 'won',
                            resultReason: 'fulltime_settlement',
                            homeTeam: row.home_team_name,
                            awayTeam: row.away_team_name,
                            finalScore: finalScore,
                            timestamp: Date.now(),
                        });
                        return [3 /*break*/, 15];
                    case 13: return [4 /*yield*/, this.markLost(client, row.id, 'fulltime_threshold_not_met', finalScore)];
                    case 14:
                        _d.sent();
                        losers++;
                        logger_1.logger.info("[Settlement] FT LOST: ".concat(row.id, " - Final ").concat(finalTotal, " <= ").concat(threshold));
                        // Phase 3: WebSocket broadcast
                        this.broadcastSettlement({
                            predictionId: row.id,
                            matchId: event.matchId,
                            botName: row.canonical_bot_name,
                            prediction: row.prediction,
                            result: 'lost',
                            resultReason: 'fulltime_threshold_not_met',
                            homeTeam: row.home_team_name,
                            awayTeam: row.away_team_name,
                            finalScore: finalScore,
                            timestamp: Date.now(),
                        });
                        _d.label = 15;
                    case 15:
                        _i++;
                        return [3 /*break*/, 11];
                    case 16: 
                    // Maç bittiğinde TÜM tahminlerin (instant win dahil) final_score'unu güncelle
                    return [4 /*yield*/, this.updateAllFinalScores(client, event.matchId, finalScore)];
                    case 17:
                        // Maç bittiğinde TÜM tahminlerin (instant win dahil) final_score'unu güncelle
                        _d.sent();
                        return [4 /*yield*/, client.query('COMMIT')];
                    case 18:
                        _d.sent();
                        // Stats view'ları güncelle
                        if (winners + losers > 0) {
                            this.refreshStatsAsync();
                        }
                        return [2 /*return*/, { settled: winners + losers, winners: winners, losers: losers }];
                    case 19:
                        error_4 = _d.sent();
                        return [4 /*yield*/, client.query('ROLLBACK')];
                    case 20:
                        _d.sent();
                        throw error_4;
                    case 21:
                        client.release();
                        return [7 /*endfinally*/];
                    case 22: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Maç bittiğinde tüm tahminlerin final_score'unu güncelle
     * Bu, instant win ile kazanmış tahminlerin gerçek final skorunu almasını sağlar
     */
    PredictionSettlementService.prototype.updateAllFinalScores = function (client, matchId, finalScore) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, client.query("\n      UPDATE ai_predictions\n      SET final_score = $2,\n          updated_at = NOW()\n      WHERE match_id = $1\n        AND result IN ('won', 'lost')\n        AND (final_score IS NULL OR final_score != $2)\n    ", [matchId, finalScore])];
                    case 1:
                        result = _a.sent();
                        if (result.rowCount > 0) {
                            logger_1.logger.info("[Settlement] Updated final_score to ".concat(finalScore, " for ").concat(result.rowCount, " predictions of match ").concat(matchId));
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    // ==========================================================================
    // HELPER METHODS
    // ==========================================================================
    /**
     * Threshold hesapla (Over X.5 logic) - LEGACY, artık prediction_threshold kullanılıyor
     * "0-0" → 0.5
     * "1-1" → 2.5
     * "2-0" → 2.5
     */
    PredictionSettlementService.prototype.calculateThreshold = function (scoreAtPrediction) {
        var _a, _b;
        var parts = scoreAtPrediction.split('-');
        var predHome = parseInt(((_a = parts[0]) === null || _a === void 0 ? void 0 : _a.trim()) || '0', 10) || 0;
        var predAway = parseInt(((_b = parts[1]) === null || _b === void 0 ? void 0 : _b.trim()) || '0', 10) || 0;
        return predHome + predAway + 0.5;
    };
    /**
     * Tahmini WON olarak işaretle
     * Phase 2: result_reason ve final_score kolonlarını güncelle
     */
    PredictionSettlementService.prototype.markWon = function (client, predictionId, reason, score) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, client.query("\n      UPDATE ai_predictions\n      SET result = 'won',\n          resulted_at = NOW(),\n          updated_at = NOW(),\n          result_reason = $2,\n          final_score = COALESCE($3, final_score)\n      WHERE id = $1 AND result = 'pending'\n    ", [predictionId, reason, score || null])];
                    case 1:
                        _a.sent();
                        (0, obsLogger_1.logEvent)('info', 'settlement.won', {
                            prediction_id: predictionId,
                            reason: reason,
                            score: score,
                        });
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Tahmini LOST olarak işaretle
     * Phase 2: result_reason ve final_score kolonlarını güncelle
     */
    PredictionSettlementService.prototype.markLost = function (client, predictionId, reason, score) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, client.query("\n      UPDATE ai_predictions\n      SET result = 'lost',\n          resulted_at = NOW(),\n          updated_at = NOW(),\n          result_reason = $2,\n          final_score = COALESCE($3, final_score)\n      WHERE id = $1 AND result = 'pending'\n    ", [predictionId, reason, score || null])];
                    case 1:
                        _a.sent();
                        (0, obsLogger_1.logEvent)('info', 'settlement.lost', {
                            prediction_id: predictionId,
                            reason: reason,
                            score: score,
                        });
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * WebSocket broadcast helper
     * Phase 3: Tüm bağlı frontend'lere settlement event'i gönder
     */
    PredictionSettlementService.prototype.broadcastSettlement = function (data) {
        if (onPredictionSettled) {
            try {
                onPredictionSettled(data);
                logger_1.logger.debug("[Settlement] Broadcasted ".concat(data.result, " for ").concat(data.predictionId));
            }
            catch (error) {
                logger_1.logger.warn("[Settlement] Broadcast failed for ".concat(data.predictionId, ":"), error.message);
            }
        }
    };
    /**
     * Deduplication kontrolü
     * Aynı matchId:eventType kombinasyonu 5 saniye içinde tekrar gelirse skip et
     */
    PredictionSettlementService.prototype.isDuplicate = function (event) {
        var key = "".concat(event.matchId, ":").concat(event.eventType);
        var lastTime = this.recentSettlements.get(key);
        if (lastTime && (Date.now() - lastTime) < this.DEDUP_WINDOW_MS) {
            return true;
        }
        this.recentSettlements.set(key, Date.now());
        return false;
    };
    /**
     * Cache temizliği - Eski entry'leri sil
     */
    PredictionSettlementService.prototype.cleanupCache = function () {
        var now = Date.now();
        var expireTime = this.DEDUP_WINDOW_MS * 2; // 10 saniyeden eski olanları sil
        for (var _i = 0, _a = this.recentSettlements.entries(); _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], timestamp = _b[1];
            if (now - timestamp > expireTime) {
                this.recentSettlements.delete(key);
            }
        }
    };
    /**
     * Stats view'ları async olarak güncelle (blocking değil)
     */
    PredictionSettlementService.prototype.refreshStatsAsync = function () {
        connection_1.pool.query('SELECT refresh_prediction_stats()')
            .then(function () { return logger_1.logger.debug('[Settlement] Stats views refreshed'); })
            .catch(function (err) { return logger_1.logger.warn('[Settlement] Stats refresh failed:', err.message); });
    };
    // ==========================================================================
    // BACKWARD COMPATIBILITY
    // ==========================================================================
    /**
     * Legacy settleInstantWin wrapper
     * @deprecated Use processEvent instead
     */
    PredictionSettlementService.prototype.settleInstantWin = function (matchExternalId, homeScore, awayScore, minute, statusId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        logger_1.logger.debug("[Settlement] Legacy settleInstantWin called for ".concat(matchExternalId));
                        return [4 /*yield*/, this.processEvent({
                                matchId: matchExternalId,
                                eventType: 'goal',
                                homeScore: homeScore,
                                awayScore: awayScore,
                                minute: minute,
                                statusId: statusId,
                                timestamp: Date.now(),
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Legacy settleMatchPredictions wrapper
     * @deprecated Use processEvent instead
     */
    PredictionSettlementService.prototype.settleMatchPredictions = function (matchExternalId, homeScore, awayScore, htHome, htAway) {
        return __awaiter(this, void 0, void 0, function () {
            var finalHome, finalAway, halfTimeHome, halfTimeAway, matchResult, match, result;
            var _a, _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        logger_1.logger.debug("[Settlement] Legacy settleMatchPredictions called for ".concat(matchExternalId));
                        finalHome = homeScore;
                        finalAway = awayScore;
                        halfTimeHome = htHome;
                        halfTimeAway = htAway;
                        if (!(finalHome === undefined || finalAway === undefined)) return [3 /*break*/, 2];
                        return [4 /*yield*/, connection_1.pool.query("\n        SELECT\n          home_score_display, away_score_display,\n          (home_scores->>1)::INTEGER as home_score_half,\n          (away_scores->>1)::INTEGER as away_score_half,\n          status_id\n        FROM ts_matches\n        WHERE external_id = $1\n      ", [matchExternalId])];
                    case 1:
                        matchResult = _e.sent();
                        if (matchResult.rows.length > 0) {
                            match = matchResult.rows[0];
                            finalHome = (_a = match.home_score_display) !== null && _a !== void 0 ? _a : 0;
                            finalAway = (_b = match.away_score_display) !== null && _b !== void 0 ? _b : 0;
                            halfTimeHome = (_c = halfTimeHome !== null && halfTimeHome !== void 0 ? halfTimeHome : match.home_score_half) !== null && _c !== void 0 ? _c : null;
                            halfTimeAway = (_d = halfTimeAway !== null && halfTimeAway !== void 0 ? halfTimeAway : match.away_score_half) !== null && _d !== void 0 ? _d : null;
                        }
                        else {
                            logger_1.logger.warn("[Settlement] No match found for ".concat(matchExternalId));
                            return [2 /*return*/, { settled: 0, winners: 0, losers: 0 }];
                        }
                        _e.label = 2;
                    case 2: return [4 /*yield*/, this.processEvent({
                            matchId: matchExternalId,
                            eventType: 'fulltime',
                            homeScore: finalHome,
                            awayScore: finalAway,
                            htHome: halfTimeHome,
                            htAway: halfTimeAway,
                            timestamp: Date.now(),
                        })];
                    case 3:
                        result = _e.sent();
                        return [2 /*return*/, {
                                settled: result.settled,
                                winners: result.winners,
                                losers: result.losers,
                            }];
                }
            });
        });
    };
    return PredictionSettlementService;
}());
// Singleton export
exports.predictionSettlementService = new PredictionSettlementService();
