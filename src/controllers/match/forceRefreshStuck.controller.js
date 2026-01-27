"use strict";
/**
 * Force Refresh Stuck Matches Controller
 *
 * Endpoint to manually refresh matches stuck at 90+ minutes
 * Uses /match/detail_live API to get latest status
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
exports.forceRefreshStuckMatches = forceRefreshStuckMatches;
exports.forceRefreshMatch = forceRefreshMatch;
var connection_1 = require("../../database/connection");
var logger_1 = require("../../utils/logger");
var matchDetailLive_service_1 = require("../../services/thesports/match/matchDetailLive.service");
var websocket_routes_1 = require("../../routes/websocket.routes");
var matchDetailLiveService = new matchDetailLive_service_1.MatchDetailLiveService();
/**
 * Force refresh stuck matches (minute >= 105 or minute >= 90 with 15+ min stale)
 */
function forceRefreshStuckMatches(request, reply) {
    return __awaiter(this, void 0, void 0, function () {
        var nowTs, stuckQuery, stuckResult, stuckMatches, refreshedCount, finishedCount, results, _loop_1, _i, stuckMatches_1, match, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 6, , 7]);
                    nowTs = Math.floor(Date.now() / 1000);
                    stuckQuery = "\n      SELECT\n        external_id,\n        status_id,\n        minute,\n        home_score_display,\n        away_score_display,\n        FLOOR(($1 - COALESCE(home_score_timestamp, match_time)) / 60) as mins_since_update\n      FROM ts_matches\n      WHERE status_id IN (2,3,4,5,7)\n        AND (\n          minute >= 105\n          OR (minute >= 90 AND $1 - COALESCE(home_score_timestamp, match_time) > 900)\n        )\n      ORDER BY minute DESC\n      LIMIT 50\n    ";
                    return [4 /*yield*/, connection_1.pool.query(stuckQuery, [nowTs])];
                case 1:
                    stuckResult = _a.sent();
                    stuckMatches = stuckResult.rows;
                    logger_1.logger.info("[ForceRefresh] Found ".concat(stuckMatches.length, " stuck matches"));
                    if (stuckMatches.length === 0) {
                        return [2 /*return*/, reply.send({
                                success: true,
                                message: 'No stuck matches found',
                                refreshed: 0,
                                finished: 0,
                            })];
                    }
                    refreshedCount = 0;
                    finishedCount = 0;
                    results = [];
                    _loop_1 = function (match) {
                        var resp, results_list, matchData, newStatusId, homeScore, awayScore, homeScoreDisplay, awayScoreDisplay, newMinute, updateQuery, updateResult, updated, matchError_1;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 3, , 4]);
                                    logger_1.logger.info("[ForceRefresh] Processing ".concat(match.external_id, " (minute: ").concat(match.minute, ", stale: ").concat(match.mins_since_update, "min)"));
                                    return [4 /*yield*/, matchDetailLiveService.getMatchDetailLive({ match_id: match.external_id }, { forceRefresh: true })];
                                case 1:
                                    resp = _b.sent();
                                    results_list = resp.results || resp.result_list || [];
                                    matchData = results_list.find(function (m) {
                                        return String((m === null || m === void 0 ? void 0 : m.id) || (m === null || m === void 0 ? void 0 : m.match_id)) === String(match.external_id);
                                    });
                                    if (!matchData) {
                                        logger_1.logger.warn("[ForceRefresh] Match ".concat(match.external_id, " not found in detail_live response"));
                                        results.push({
                                            matchId: match.external_id,
                                            status: 'not_found',
                                            message: 'Match not in detail_live response',
                                        });
                                        return [2 /*return*/, "continue"];
                                    }
                                    newStatusId = matchData.status_id;
                                    if (Array.isArray(matchData.score) && matchData.score.length >= 2) {
                                        newStatusId = matchData.score[1];
                                    }
                                    homeScore = match.home_score_display;
                                    awayScore = match.away_score_display;
                                    if (Array.isArray(matchData.score) && matchData.score.length >= 4) {
                                        homeScoreDisplay = Array.isArray(matchData.score[2]) ? matchData.score[2][0] : null;
                                        awayScoreDisplay = Array.isArray(matchData.score[3]) ? matchData.score[3][0] : null;
                                        if (homeScoreDisplay !== null)
                                            homeScore = homeScoreDisplay;
                                        if (awayScoreDisplay !== null)
                                            awayScore = awayScoreDisplay;
                                    }
                                    else if (matchData.home_score !== undefined && matchData.away_score !== undefined) {
                                        homeScore = matchData.home_score;
                                        awayScore = matchData.away_score;
                                    }
                                    newMinute = matchData.minute !== undefined ? matchData.minute : match.minute;
                                    updateQuery = "\n          UPDATE ts_matches\n          SET\n            status_id = $1,\n            minute = $2,\n            home_score_display = $3,\n            away_score_display = $4,\n            status_id_source = 'api_force_refresh',\n            status_id_timestamp = $5,\n            minute_source = 'api_force_refresh',\n            minute_timestamp = $5,\n            home_score_source = 'api_force_refresh',\n            home_score_timestamp = $5,\n            away_score_source = 'api_force_refresh',\n            away_score_timestamp = $5,\n            provider_update_time = COALESCE($6, provider_update_time),\n            updated_at = NOW()\n          WHERE external_id = $7\n          RETURNING status_id, minute, home_score_display, away_score_display\n        ";
                                    return [4 /*yield*/, connection_1.pool.query(updateQuery, [
                                            newStatusId,
                                            newMinute,
                                            homeScore,
                                            awayScore,
                                            nowTs,
                                            matchData.update_time || null,
                                            match.external_id,
                                        ])];
                                case 2:
                                    updateResult = _b.sent();
                                    if (updateResult.rowCount > 0) {
                                        updated = updateResult.rows[0];
                                        refreshedCount++;
                                        if (newStatusId === 8) {
                                            finishedCount++;
                                            logger_1.logger.info("[ForceRefresh] \u2705 Match ".concat(match.external_id, " FINISHED ").concat(updated.home_score_display, "-").concat(updated.away_score_display));
                                        }
                                        else {
                                            logger_1.logger.info("[ForceRefresh] \u2705 Match ".concat(match.external_id, " updated to status=").concat(newStatusId, ", minute=").concat(updated.minute));
                                        }
                                        // Broadcast WebSocket events
                                        if (homeScore !== match.home_score_display || awayScore !== match.away_score_display) {
                                            (0, websocket_routes_1.broadcastEvent)({
                                                type: 'SCORE_CHANGE',
                                                matchId: match.external_id,
                                                homeScore: homeScore,
                                                awayScore: awayScore,
                                                statusId: newStatusId,
                                                timestamp: Date.now(),
                                            });
                                        }
                                        if (newStatusId !== match.status_id) {
                                            (0, websocket_routes_1.broadcastEvent)({
                                                type: 'MATCH_STATE_CHANGE',
                                                matchId: match.external_id,
                                                statusId: newStatusId,
                                                newStatus: newStatusId,
                                                timestamp: Date.now(),
                                            });
                                        }
                                        if (newMinute !== match.minute) {
                                            (0, websocket_routes_1.broadcastEvent)({
                                                type: 'MINUTE_UPDATE',
                                                matchId: match.external_id,
                                                minute: newMinute,
                                                statusId: newStatusId,
                                                timestamp: Date.now(),
                                            });
                                        }
                                        results.push({
                                            matchId: match.external_id,
                                            status: 'updated',
                                            oldStatus: match.status_id,
                                            newStatus: newStatusId,
                                            oldMinute: match.minute,
                                            newMinute: updated.minute,
                                            score: "".concat(updated.home_score_display, "-").concat(updated.away_score_display),
                                        });
                                    }
                                    return [3 /*break*/, 4];
                                case 3:
                                    matchError_1 = _b.sent();
                                    logger_1.logger.error("[ForceRefresh] Error processing ".concat(match.external_id, ": ").concat(matchError_1.message));
                                    results.push({
                                        matchId: match.external_id,
                                        status: 'error',
                                        message: matchError_1.message,
                                    });
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, stuckMatches_1 = stuckMatches;
                    _a.label = 2;
                case 2:
                    if (!(_i < stuckMatches_1.length)) return [3 /*break*/, 5];
                    match = stuckMatches_1[_i];
                    return [5 /*yield**/, _loop_1(match)];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5:
                    logger_1.logger.info("[ForceRefresh] Completed: ".concat(refreshedCount, " refreshed, ").concat(finishedCount, " finished"));
                    return [2 /*return*/, reply.send({
                            success: true,
                            message: "Refreshed ".concat(refreshedCount, " matches, ").concat(finishedCount, " finished"),
                            refreshed: refreshedCount,
                            finished: finishedCount,
                            total: stuckMatches.length,
                            results: results,
                        })];
                case 6:
                    error_1 = _a.sent();
                    logger_1.logger.error('[ForceRefresh] Error:', error_1);
                    return [2 /*return*/, reply.status(500).send({
                            success: false,
                            error: error_1.message,
                        })];
                case 7: return [2 /*return*/];
            }
        });
    });
}
/**
 * Force refresh single match by ID
 */
function forceRefreshMatch(request, reply) {
    return __awaiter(this, void 0, void 0, function () {
        var matchId_1, nowTs, resp, results_list, matchData, newStatusId, homeScore, awayScore, homeScoreDisplay, awayScoreDisplay, newMinute, updateQuery, updateResult, updated, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    matchId_1 = request.params.id;
                    nowTs = Math.floor(Date.now() / 1000);
                    logger_1.logger.info("[ForceRefresh] Manual refresh requested for ".concat(matchId_1));
                    return [4 /*yield*/, matchDetailLiveService.getMatchDetailLive({ match_id: matchId_1 }, { forceRefresh: true })];
                case 1:
                    resp = _a.sent();
                    results_list = resp.results || resp.result_list || [];
                    matchData = results_list.find(function (m) {
                        return String((m === null || m === void 0 ? void 0 : m.id) || (m === null || m === void 0 ? void 0 : m.match_id)) === String(matchId_1);
                    });
                    if (!matchData) {
                        return [2 /*return*/, reply.status(404).send({
                                success: false,
                                error: 'Match not found in detail_live response',
                            })];
                    }
                    newStatusId = matchData.status_id;
                    if (Array.isArray(matchData.score) && matchData.score.length >= 2) {
                        newStatusId = matchData.score[1];
                    }
                    homeScore = 0;
                    awayScore = 0;
                    if (Array.isArray(matchData.score) && matchData.score.length >= 4) {
                        homeScoreDisplay = Array.isArray(matchData.score[2]) ? matchData.score[2][0] : null;
                        awayScoreDisplay = Array.isArray(matchData.score[3]) ? matchData.score[3][0] : null;
                        if (homeScoreDisplay !== null)
                            homeScore = homeScoreDisplay;
                        if (awayScoreDisplay !== null)
                            awayScore = awayScoreDisplay;
                    }
                    else if (matchData.home_score !== undefined && matchData.away_score !== undefined) {
                        homeScore = matchData.home_score;
                        awayScore = matchData.away_score;
                    }
                    newMinute = matchData.minute !== undefined ? matchData.minute : null;
                    updateQuery = "\n      UPDATE ts_matches\n      SET\n        status_id = $1,\n        minute = $2,\n        home_score_display = $3,\n        away_score_display = $4,\n        status_id_source = 'api_manual_refresh',\n        status_id_timestamp = $5,\n        minute_source = 'api_manual_refresh',\n        minute_timestamp = $5,\n        home_score_source = 'api_manual_refresh',\n        home_score_timestamp = $5,\n        away_score_source = 'api_manual_refresh',\n        away_score_timestamp = $5,\n        provider_update_time = COALESCE($6, provider_update_time),\n        updated_at = NOW()\n      WHERE external_id = $7\n      RETURNING status_id, minute, home_score_display, away_score_display\n    ";
                    return [4 /*yield*/, connection_1.pool.query(updateQuery, [
                            newStatusId,
                            newMinute,
                            homeScore,
                            awayScore,
                            nowTs,
                            matchData.update_time || null,
                            matchId_1,
                        ])];
                case 2:
                    updateResult = _a.sent();
                    if (updateResult.rowCount === 0) {
                        return [2 /*return*/, reply.status(404).send({
                                success: false,
                                error: 'Match not found in database',
                            })];
                    }
                    updated = updateResult.rows[0];
                    logger_1.logger.info("[ForceRefresh] \u2705 Match ".concat(matchId_1, " manually refreshed: status=").concat(updated.status_id, ", minute=").concat(updated.minute, ", score=").concat(updated.home_score_display, "-").concat(updated.away_score_display));
                    // Broadcast WebSocket events
                    (0, websocket_routes_1.broadcastEvent)({
                        type: 'SCORE_CHANGE',
                        matchId: matchId_1,
                        homeScore: homeScore,
                        awayScore: awayScore,
                        statusId: newStatusId,
                        timestamp: Date.now(),
                    });
                    (0, websocket_routes_1.broadcastEvent)({
                        type: 'MATCH_STATE_CHANGE',
                        matchId: matchId_1,
                        statusId: newStatusId,
                        newStatus: newStatusId,
                        timestamp: Date.now(),
                    });
                    if (newMinute !== null) {
                        (0, websocket_routes_1.broadcastEvent)({
                            type: 'MINUTE_UPDATE',
                            matchId: matchId_1,
                            minute: newMinute,
                            statusId: newStatusId,
                            timestamp: Date.now(),
                        });
                    }
                    return [2 /*return*/, reply.send({
                            success: true,
                            message: 'Match refreshed successfully',
                            match: {
                                id: matchId_1,
                                status_id: updated.status_id,
                                minute: updated.minute,
                                home_score: updated.home_score_display,
                                away_score: updated.away_score_display,
                            },
                        })];
                case 3:
                    error_2 = _a.sent();
                    logger_1.logger.error("[ForceRefresh] Error refreshing match: ".concat(error_2.message));
                    return [2 /*return*/, reply.status(500).send({
                            success: false,
                            error: error_2.message,
                        })];
                case 4: return [2 /*return*/];
            }
        });
    });
}
