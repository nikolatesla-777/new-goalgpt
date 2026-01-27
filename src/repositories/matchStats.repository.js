"use strict";
/**
 * Match Stats Repository
 *
 * Database operations for ts_match_stats table.
 * Provides upsert functionality for match statistics.
 *
 * Used by:
 * - DataSync workers (background save)
 * - Controllers (read for API response)
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
exports.matchStatsRepository = exports.MatchStatsRepository = void 0;
var connection_1 = require("../database/connection");
var logger_1 = require("../utils/logger");
var MatchStatsRepository = /** @class */ (function () {
    function MatchStatsRepository() {
    }
    /**
     * Upsert match stats to database
     * Uses ON CONFLICT to update if exists
     */
    MatchStatsRepository.prototype.upsertStats = function (stats) {
        return __awaiter(this, void 0, void 0, function () {
            var client, query, values, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, connection_1.pool.connect()];
                    case 1:
                        client = _a.sent();
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, 5, 6]);
                        query = "\n        INSERT INTO ts_match_stats (\n          match_id,\n          home_corner, away_corner,\n          home_yellow_cards, away_yellow_cards,\n          home_red_cards, away_red_cards,\n          home_shots, away_shots,\n          home_shots_on_target, away_shots_on_target,\n          home_possession, away_possession,\n          home_dangerous_attacks, away_dangerous_attacks,\n          home_attacks, away_attacks,\n          home_passes, away_passes,\n          home_accurate_passes, away_accurate_passes,\n          home_tackles, away_tackles,\n          home_interceptions, away_interceptions,\n          home_fouls, away_fouls,\n          home_offsides, away_offsides,\n          home_saves, away_saves,\n          first_half_stats, second_half_stats,\n          last_updated_at\n        ) VALUES (\n          $1,\n          COALESCE($2, 0), COALESCE($3, 0),\n          COALESCE($4, 0), COALESCE($5, 0),\n          COALESCE($6, 0), COALESCE($7, 0),\n          COALESCE($8, 0), COALESCE($9, 0),\n          COALESCE($10, 0), COALESCE($11, 0),\n          COALESCE($12, 50), COALESCE($13, 50),\n          COALESCE($14, 0), COALESCE($15, 0),\n          COALESCE($16, 0), COALESCE($17, 0),\n          COALESCE($18, 0), COALESCE($19, 0),\n          COALESCE($20, 0), COALESCE($21, 0),\n          COALESCE($22, 0), COALESCE($23, 0),\n          COALESCE($24, 0), COALESCE($25, 0),\n          COALESCE($26, 0), COALESCE($27, 0),\n          COALESCE($28, 0), COALESCE($29, 0),\n          COALESCE($30, 0), COALESCE($31, 0),\n          $32::jsonb, $33::jsonb,\n          NOW()\n        )\n        ON CONFLICT (match_id) DO UPDATE SET\n          home_corner = COALESCE(EXCLUDED.home_corner, ts_match_stats.home_corner),\n          away_corner = COALESCE(EXCLUDED.away_corner, ts_match_stats.away_corner),\n          home_yellow_cards = COALESCE(EXCLUDED.home_yellow_cards, ts_match_stats.home_yellow_cards),\n          away_yellow_cards = COALESCE(EXCLUDED.away_yellow_cards, ts_match_stats.away_yellow_cards),\n          home_red_cards = COALESCE(EXCLUDED.home_red_cards, ts_match_stats.home_red_cards),\n          away_red_cards = COALESCE(EXCLUDED.away_red_cards, ts_match_stats.away_red_cards),\n          home_shots = COALESCE(EXCLUDED.home_shots, ts_match_stats.home_shots),\n          away_shots = COALESCE(EXCLUDED.away_shots, ts_match_stats.away_shots),\n          home_shots_on_target = COALESCE(EXCLUDED.home_shots_on_target, ts_match_stats.home_shots_on_target),\n          away_shots_on_target = COALESCE(EXCLUDED.away_shots_on_target, ts_match_stats.away_shots_on_target),\n          home_possession = COALESCE(EXCLUDED.home_possession, ts_match_stats.home_possession),\n          away_possession = COALESCE(EXCLUDED.away_possession, ts_match_stats.away_possession),\n          home_dangerous_attacks = COALESCE(EXCLUDED.home_dangerous_attacks, ts_match_stats.home_dangerous_attacks),\n          away_dangerous_attacks = COALESCE(EXCLUDED.away_dangerous_attacks, ts_match_stats.away_dangerous_attacks),\n          home_attacks = COALESCE(EXCLUDED.home_attacks, ts_match_stats.home_attacks),\n          away_attacks = COALESCE(EXCLUDED.away_attacks, ts_match_stats.away_attacks),\n          home_passes = COALESCE(EXCLUDED.home_passes, ts_match_stats.home_passes),\n          away_passes = COALESCE(EXCLUDED.away_passes, ts_match_stats.away_passes),\n          home_accurate_passes = COALESCE(EXCLUDED.home_accurate_passes, ts_match_stats.home_accurate_passes),\n          away_accurate_passes = COALESCE(EXCLUDED.away_accurate_passes, ts_match_stats.away_accurate_passes),\n          home_tackles = COALESCE(EXCLUDED.home_tackles, ts_match_stats.home_tackles),\n          away_tackles = COALESCE(EXCLUDED.away_tackles, ts_match_stats.away_tackles),\n          home_interceptions = COALESCE(EXCLUDED.home_interceptions, ts_match_stats.home_interceptions),\n          away_interceptions = COALESCE(EXCLUDED.away_interceptions, ts_match_stats.away_interceptions),\n          home_fouls = COALESCE(EXCLUDED.home_fouls, ts_match_stats.home_fouls),\n          away_fouls = COALESCE(EXCLUDED.away_fouls, ts_match_stats.away_fouls),\n          home_offsides = COALESCE(EXCLUDED.home_offsides, ts_match_stats.home_offsides),\n          away_offsides = COALESCE(EXCLUDED.away_offsides, ts_match_stats.away_offsides),\n          home_saves = COALESCE(EXCLUDED.home_saves, ts_match_stats.home_saves),\n          away_saves = COALESCE(EXCLUDED.away_saves, ts_match_stats.away_saves),\n          first_half_stats = COALESCE(EXCLUDED.first_half_stats, ts_match_stats.first_half_stats),\n          second_half_stats = COALESCE(EXCLUDED.second_half_stats, ts_match_stats.second_half_stats),\n          last_updated_at = NOW()\n      ";
                        values = [
                            stats.match_id,
                            stats.home_corner, stats.away_corner,
                            stats.home_yellow_cards, stats.away_yellow_cards,
                            stats.home_red_cards, stats.away_red_cards,
                            stats.home_shots, stats.away_shots,
                            stats.home_shots_on_target, stats.away_shots_on_target,
                            stats.home_possession, stats.away_possession,
                            stats.home_dangerous_attacks, stats.away_dangerous_attacks,
                            stats.home_attacks, stats.away_attacks,
                            stats.home_passes, stats.away_passes,
                            stats.home_accurate_passes, stats.away_accurate_passes,
                            stats.home_tackles, stats.away_tackles,
                            stats.home_interceptions, stats.away_interceptions,
                            stats.home_fouls, stats.away_fouls,
                            stats.home_offsides, stats.away_offsides,
                            stats.home_saves, stats.away_saves,
                            stats.first_half_stats ? JSON.stringify(stats.first_half_stats) : null,
                            stats.second_half_stats ? JSON.stringify(stats.second_half_stats) : null,
                        ];
                        return [4 /*yield*/, client.query(query, values)];
                    case 3:
                        _a.sent();
                        logger_1.logger.debug("[MatchStatsRepo] Upserted stats for match ".concat(stats.match_id));
                        return [2 /*return*/, true];
                    case 4:
                        error_1 = _a.sent();
                        logger_1.logger.error("[MatchStatsRepo] Error upserting stats for ".concat(stats.match_id, ":"), error_1.message);
                        return [2 /*return*/, false];
                    case 5:
                        client.release();
                        return [7 /*endfinally*/];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get match stats from database
     */
    MatchStatsRepository.prototype.getStats = function (matchId) {
        return __awaiter(this, void 0, void 0, function () {
            var client, result, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, connection_1.pool.connect()];
                    case 1:
                        client = _a.sent();
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, 5, 6]);
                        return [4 /*yield*/, client.query('SELECT * FROM ts_match_stats WHERE match_id = $1', [matchId])];
                    case 3:
                        result = _a.sent();
                        if (result.rows.length === 0) {
                            return [2 /*return*/, null];
                        }
                        return [2 /*return*/, result.rows[0]];
                    case 4:
                        error_2 = _a.sent();
                        logger_1.logger.error("[MatchStatsRepo] Error getting stats for ".concat(matchId, ":"), error_2.message);
                        return [2 /*return*/, null];
                    case 5:
                        client.release();
                        return [7 /*endfinally*/];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Parse stats from detail_live API response
     * Extracts stats array and converts to MatchStats object
     */
    MatchStatsRepository.prototype.parseStatsFromDetailLive = function (matchData) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
        var stats = {};
        // Parse stats array: [[home_vals...], [away_vals...]]
        // Index mapping from TheSports API:
        // 0: Corner, 1: Yellow Card, 2: Red Card, 3: Shots Total
        // 4: Shots On Target, 5: Attacks, 6: Dangerous Attacks,
        // 7: Possession, 8: Passes, 9: Accurate Passes, 10: Fouls, 11: Offsides
        if (Array.isArray(matchData.stats) && matchData.stats.length >= 2) {
            var homeStats = matchData.stats[0] || [];
            var awayStats = matchData.stats[1] || [];
            stats.home_corner = (_a = homeStats[0]) !== null && _a !== void 0 ? _a : undefined;
            stats.away_corner = (_b = awayStats[0]) !== null && _b !== void 0 ? _b : undefined;
            stats.home_yellow_cards = (_c = homeStats[1]) !== null && _c !== void 0 ? _c : undefined;
            stats.away_yellow_cards = (_d = awayStats[1]) !== null && _d !== void 0 ? _d : undefined;
            stats.home_red_cards = (_e = homeStats[2]) !== null && _e !== void 0 ? _e : undefined;
            stats.away_red_cards = (_f = awayStats[2]) !== null && _f !== void 0 ? _f : undefined;
            stats.home_shots = (_g = homeStats[3]) !== null && _g !== void 0 ? _g : undefined;
            stats.away_shots = (_h = awayStats[3]) !== null && _h !== void 0 ? _h : undefined;
            stats.home_shots_on_target = (_j = homeStats[4]) !== null && _j !== void 0 ? _j : undefined;
            stats.away_shots_on_target = (_k = awayStats[4]) !== null && _k !== void 0 ? _k : undefined;
            stats.home_attacks = (_l = homeStats[5]) !== null && _l !== void 0 ? _l : undefined;
            stats.away_attacks = (_m = awayStats[5]) !== null && _m !== void 0 ? _m : undefined;
            stats.home_dangerous_attacks = (_o = homeStats[6]) !== null && _o !== void 0 ? _o : undefined;
            stats.away_dangerous_attacks = (_p = awayStats[6]) !== null && _p !== void 0 ? _p : undefined;
            stats.home_possession = (_q = homeStats[7]) !== null && _q !== void 0 ? _q : undefined;
            stats.away_possession = (_r = awayStats[7]) !== null && _r !== void 0 ? _r : undefined;
        }
        return stats;
    };
    return MatchStatsRepository;
}());
exports.MatchStatsRepository = MatchStatsRepository;
// Singleton export
exports.matchStatsRepository = new MatchStatsRepository();
