"use strict";
/**
 * Prediction Matcher Service
 *
 * Automatically matches predictions with NULL match_id to actual matches in ts_matches table
 * Uses team name matching and date proximity to find the correct match
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
exports.predictionMatcherService = exports.PredictionMatcherService = void 0;
var connection_1 = require("../../database/connection");
var logger_1 = require("../../utils/logger");
var teamNameMatcher_service_1 = require("./teamNameMatcher.service");
var unifiedPrediction_service_1 = require("./unifiedPrediction.service");
var PredictionMatcherService = /** @class */ (function () {
    function PredictionMatcherService() {
    }
    /**
     * Match all unmatched predictions (match_id IS NULL)
     * Uses team names and creation date to find matches
     * Processes in batches to avoid connection pool exhaustion
     */
    PredictionMatcherService.prototype.matchUnmatchedPredictions = function () {
        return __awaiter(this, void 0, void 0, function () {
            var unmatchedQuery, result, unmatchedPredictions, BATCH_SIZE, matchResults, i, batch, _i, batch_1, prediction, matchResult, error_1, successCount, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 12, , 13]);
                        logger_1.logger.info('[PredictionMatcher] Starting to match unmatched predictions...');
                        unmatchedQuery = "\n        SELECT\n          id,\n          external_id,\n          home_team_name,\n          away_team_name,\n          league_name,\n          created_at,\n          minute_at_prediction\n        FROM ai_predictions\n        WHERE match_id IS NULL\n          AND created_at > NOW() - INTERVAL '7 days'\n        ORDER BY created_at DESC\n        LIMIT 50\n      ";
                        return [4 /*yield*/, connection_1.pool.query(unmatchedQuery)];
                    case 1:
                        result = _a.sent();
                        unmatchedPredictions = result.rows;
                        logger_1.logger.info("[PredictionMatcher] Found ".concat(unmatchedPredictions.length, " unmatched predictions"));
                        if (unmatchedPredictions.length === 0) {
                            return [2 /*return*/, []];
                        }
                        BATCH_SIZE = 5;
                        matchResults = [];
                        i = 0;
                        _a.label = 2;
                    case 2:
                        if (!(i < unmatchedPredictions.length)) return [3 /*break*/, 11];
                        batch = unmatchedPredictions.slice(i, i + BATCH_SIZE);
                        logger_1.logger.info("[PredictionMatcher] Processing batch ".concat(Math.floor(i / BATCH_SIZE) + 1, "/").concat(Math.ceil(unmatchedPredictions.length / BATCH_SIZE)));
                        _i = 0, batch_1 = batch;
                        _a.label = 3;
                    case 3:
                        if (!(_i < batch_1.length)) return [3 /*break*/, 8];
                        prediction = batch_1[_i];
                        _a.label = 4;
                    case 4:
                        _a.trys.push([4, 6, , 7]);
                        return [4 /*yield*/, this.matchSinglePrediction(prediction.id, prediction.external_id, prediction.home_team_name, prediction.away_team_name, prediction.league_name, prediction.created_at, prediction.minute_at_prediction)];
                    case 5:
                        matchResult = _a.sent();
                        matchResults.push(matchResult);
                        return [3 /*break*/, 7];
                    case 6:
                        error_1 = _a.sent();
                        logger_1.logger.error("[PredictionMatcher] Error matching prediction ".concat(prediction.id, ":"), error_1);
                        matchResults.push({
                            predictionId: prediction.id,
                            predictionExternalId: prediction.external_id,
                            homeTeam: prediction.home_team_name,
                            awayTeam: prediction.away_team_name,
                            matchFound: false,
                            error: error_1.message
                        });
                        return [3 /*break*/, 7];
                    case 7:
                        _i++;
                        return [3 /*break*/, 3];
                    case 8:
                        if (!(i + BATCH_SIZE < unmatchedPredictions.length)) return [3 /*break*/, 10];
                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 100); })];
                    case 9:
                        _a.sent();
                        _a.label = 10;
                    case 10:
                        i += BATCH_SIZE;
                        return [3 /*break*/, 2];
                    case 11:
                        successCount = matchResults.filter(function (r) { return r.matchFound; }).length;
                        logger_1.logger.info("[PredictionMatcher] Matched ".concat(successCount, "/").concat(matchResults.length, " predictions"));
                        return [2 /*return*/, matchResults];
                    case 12:
                        error_2 = _a.sent();
                        logger_1.logger.error('[PredictionMatcher] Error in matchUnmatchedPredictions:', error_2);
                        throw error_2;
                    case 13: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Match a single prediction to a match
     */
    PredictionMatcherService.prototype.matchSinglePrediction = function (predictionId, externalId, homeTeamName, awayTeamName, leagueName, createdAt, minuteAtPrediction) {
        return __awaiter(this, void 0, void 0, function () {
            var matchLookup, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        logger_1.logger.info("[PredictionMatcher] Matching prediction ".concat(externalId, ": ").concat(homeTeamName, " vs ").concat(awayTeamName));
                        return [4 /*yield*/, teamNameMatcher_service_1.teamNameMatcherService.findMatchByTeams(homeTeamName, awayTeamName, minuteAtPrediction, undefined, // No score hint
                            leagueName)];
                    case 1:
                        matchLookup = _a.sent();
                        if (!matchLookup) {
                            logger_1.logger.warn("[PredictionMatcher] No match found for prediction ".concat(externalId));
                            return [2 /*return*/, {
                                    predictionId: predictionId,
                                    predictionExternalId: externalId,
                                    homeTeam: homeTeamName,
                                    awayTeam: awayTeamName,
                                    matchFound: false
                                }];
                        }
                        // Match found! Update the prediction
                        logger_1.logger.info("[PredictionMatcher] Match found for ".concat(externalId, ": ").concat(matchLookup.matchExternalId, " (confidence: ").concat(Math.round(matchLookup.overallConfidence * 100), "%)"));
                        return [4 /*yield*/, unifiedPrediction_service_1.unifiedPredictionService.matchPrediction(predictionId, matchLookup.matchExternalId, matchLookup.matchUuid, matchLookup.overallConfidence, matchLookup.homeTeam.teamId, matchLookup.awayTeam.teamId)];
                    case 2:
                        _a.sent();
                        logger_1.logger.info("[PredictionMatcher] \u2705 Successfully matched prediction ".concat(externalId, " to match ").concat(matchLookup.matchExternalId));
                        return [2 /*return*/, {
                                predictionId: predictionId,
                                predictionExternalId: externalId,
                                homeTeam: homeTeamName,
                                awayTeam: awayTeamName,
                                matchFound: true,
                                matchId: matchLookup.matchExternalId,
                                matchUuid: matchLookup.matchUuid,
                                confidence: matchLookup.overallConfidence
                            }];
                    case 3:
                        error_3 = _a.sent();
                        logger_1.logger.error("[PredictionMatcher] Error matching single prediction ".concat(predictionId, ":"), error_3);
                        return [2 /*return*/, {
                                predictionId: predictionId,
                                predictionExternalId: externalId,
                                homeTeam: homeTeamName,
                                awayTeam: awayTeamName,
                                matchFound: false,
                                error: error_3.message
                            }];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Match a specific prediction by external ID
     * Useful for manual matching or testing
     */
    PredictionMatcherService.prototype.matchByExternalId = function (externalId) {
        return __awaiter(this, void 0, void 0, function () {
            var predQuery, result, prediction, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        predQuery = "\n        SELECT\n          id,\n          external_id,\n          home_team_name,\n          away_team_name,\n          league_name,\n          created_at,\n          minute_at_prediction,\n          match_id\n        FROM ai_predictions\n        WHERE external_id = $1\n      ";
                        return [4 /*yield*/, connection_1.pool.query(predQuery, [externalId])];
                    case 1:
                        result = _a.sent();
                        if (result.rows.length === 0) {
                            throw new Error("Prediction with external_id ".concat(externalId, " not found"));
                        }
                        prediction = result.rows[0];
                        if (prediction.match_id) {
                            logger_1.logger.info("[PredictionMatcher] Prediction ".concat(externalId, " already has match_id: ").concat(prediction.match_id));
                            return [2 /*return*/, {
                                    predictionId: prediction.id,
                                    predictionExternalId: externalId,
                                    homeTeam: prediction.home_team_name,
                                    awayTeam: prediction.away_team_name,
                                    matchFound: true,
                                    matchId: prediction.match_id
                                }];
                        }
                        return [4 /*yield*/, this.matchSinglePrediction(prediction.id, prediction.external_id, prediction.home_team_name, prediction.away_team_name, prediction.league_name, prediction.created_at, prediction.minute_at_prediction)];
                    case 2: return [2 /*return*/, _a.sent()];
                    case 3:
                        error_4 = _a.sent();
                        logger_1.logger.error("[PredictionMatcher] Error matching prediction by external ID ".concat(externalId, ":"), error_4);
                        throw error_4;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    return PredictionMatcherService;
}());
exports.PredictionMatcherService = PredictionMatcherService;
exports.predictionMatcherService = new PredictionMatcherService();
