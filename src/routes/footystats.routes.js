"use strict";
/**
 * FootyStats Integration Routes
 *
 * Admin endpoints for managing FootyStats integration
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.footyStatsRoutes = footyStatsRoutes;
var mapping_service_1 = require("../services/footystats/mapping.service");
var footystats_client_1 = require("../services/footystats/footystats.client");
var logger_1 = require("../utils/logger");
var auth_middleware_1 = require("../middleware/auth.middleware");
// PR-4: Use repository for all FootyStats DB access
var footystats_repository_1 = require("../repositories/footystats.repository");
// Import Turkish trends converter
var trends_generator_1 = require("../services/telegram/trends.generator");
// Import caching service
var cache_service_1 = require("../services/footystats/cache.service");
function footyStatsRoutes(fastify) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            // NOTE: Debug endpoint /footystats/debug-db DELETED for security (exposed DB schema)
            // Search competitions by name or country
            fastify.get('/footystats/search-leagues', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var _a, q, country, query, params, leagues, error_1;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 2, , 3]);
                            _a = request.query, q = _a.q, country = _a.country;
                            if (!q && !country) {
                                return [2 /*return*/, reply.status(400).send({ error: 'q or country parameter required' })];
                            }
                            query = void 0;
                            params = void 0;
                            if (country) {
                                query = "SELECT c.id, c.name, COALESCE(co.name, 'International') as country_name\n                 FROM ts_competitions c\n                 LEFT JOIN ts_countries co ON c.country_id = co.external_id\n                 WHERE LOWER(COALESCE(co.name, 'International')) LIKE $1\n                 ORDER BY c.name\n                 LIMIT 50";
                                params = ["%".concat(country.toLowerCase(), "%")];
                            }
                            else {
                                query = "SELECT c.id, c.name, COALESCE(co.name, 'International') as country_name\n                 FROM ts_competitions c\n                 LEFT JOIN ts_countries co ON c.country_id = co.external_id\n                 WHERE LOWER(c.name) LIKE $1\n                 ORDER BY co.name, c.name\n                 LIMIT 30";
                                params = ["%".concat(q.toLowerCase(), "%")];
                            }
                            return [4 /*yield*/, (0, footystats_repository_1.getLeagues)(query, params)];
                        case 1:
                            leagues = _b.sent();
                            return [2 /*return*/, { count: leagues.length, leagues: leagues }];
                        case 2:
                            error_1 = _b.sent();
                            return [2 /*return*/, reply.status(500).send({ error: error_1.message })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            // Health check for FootyStats integration
            fastify.get('/footystats/health', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var apiHealth, stats;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            apiHealth = footystats_client_1.footyStatsAPI.getHealth();
                            return [4 /*yield*/, mapping_service_1.mappingService.getStats()];
                        case 1:
                            stats = _a.sent();
                            return [2 /*return*/, {
                                    api: apiHealth,
                                    mappings: stats,
                                }];
                    }
                });
            }); });
            // Test FootyStats API - ADMIN ONLY
            fastify.get('/footystats/test', { preHandler: [auth_middleware_1.requireAuth, auth_middleware_1.requireAdmin] }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var q, response, leagues, searchTerm_1, error_2;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 2, , 3]);
                            q = request.query.q;
                            return [4 /*yield*/, footystats_client_1.footyStatsAPI.getLeagueList()];
                        case 1:
                            response = _b.sent();
                            leagues = response.data || [];
                            // Filter if query provided
                            if (q) {
                                searchTerm_1 = q.toLowerCase();
                                leagues = leagues.filter(function (l) {
                                    var _a, _b, _c;
                                    return ((_a = l.name) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(searchTerm_1)) ||
                                        ((_b = l.country) === null || _b === void 0 ? void 0 : _b.toLowerCase().includes(searchTerm_1)) ||
                                        ((_c = l.league_name) === null || _c === void 0 ? void 0 : _c.toLowerCase().includes(searchTerm_1));
                                });
                            }
                            return [2 /*return*/, {
                                    success: true,
                                    leagues_available: ((_a = response.data) === null || _a === void 0 ? void 0 : _a.length) || 0,
                                    filtered_count: leagues.length,
                                    sample: leagues.slice(0, 20).map(function (l) {
                                        var _a, _b;
                                        return ({
                                            name: l.name,
                                            country: l.country,
                                            league_name: l.league_name,
                                            seasons: ((_a = l.season) === null || _a === void 0 ? void 0 : _a.length) || 0,
                                            latest_season: ((_b = l.season) === null || _b === void 0 ? void 0 : _b[l.season.length - 1]) || null,
                                        });
                                    }),
                                }];
                        case 2:
                            error_2 = _b.sent();
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: error_2.message,
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            // Run league mapping
            fastify.post('/footystats/mapping/leagues', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var stats, error_3;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            logger_1.logger.info('[FootyStats] Starting league mapping via API...');
                            return [4 /*yield*/, mapping_service_1.mappingService.mapLeagues()];
                        case 1:
                            stats = _a.sent();
                            return [2 /*return*/, {
                                    success: true,
                                    stats: stats,
                                }];
                        case 2:
                            error_3 = _a.sent();
                            logger_1.logger.error('[FootyStats] League mapping failed:', error_3);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: error_3.message,
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            // Run team mapping for a single league (for testing)
            fastify.post('/footystats/mapping/teams/:leagueId', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var leagueId, stats, error_4;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            leagueId = request.params.leagueId;
                            logger_1.logger.info("[FootyStats] Starting team mapping for league ".concat(leagueId, "..."));
                            return [4 /*yield*/, mapping_service_1.mappingService.mapTeamsForLeague(leagueId)];
                        case 1:
                            stats = _a.sent();
                            return [2 /*return*/, {
                                    success: true,
                                    stats: stats,
                                }];
                        case 2:
                            error_4 = _a.sent();
                            logger_1.logger.error('[FootyStats] Team mapping failed:', error_4.message || error_4);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: error_4.message || String(error_4),
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            // Run team mapping for all leagues
            fastify.post('/footystats/mapping/teams', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var stats, error_5;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            logger_1.logger.info('[FootyStats] Starting team mapping via API...');
                            return [4 /*yield*/, mapping_service_1.mappingService.mapAllTeams()];
                        case 1:
                            stats = _a.sent();
                            return [2 /*return*/, {
                                    success: true,
                                    stats: stats,
                                }];
                        case 2:
                            error_5 = _a.sent();
                            logger_1.logger.error('[FootyStats] Team mapping failed:', error_5.message || error_5);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: error_5.message || String(error_5),
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            // Get mapping stats
            fastify.get('/footystats/mapping/stats', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var stats;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, mapping_service_1.mappingService.getStats()];
                        case 1:
                            stats = _a.sent();
                            return [2 /*return*/, stats];
                    }
                });
            }); });
            // Get unverified mappings
            fastify.get('/footystats/mapping/unverified', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var unverified;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, mapping_service_1.mappingService.getUnverifiedMappings()];
                        case 1:
                            unverified = _a.sent();
                            return [2 /*return*/, {
                                    count: unverified.length,
                                    mappings: unverified,
                                }];
                    }
                });
            }); });
            // Get verified league mappings
            fastify.get('/footystats/mapping/verified-leagues', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var verified;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, (0, footystats_repository_1.getVerifiedLeagueMappings)()];
                        case 1:
                            verified = _a.sent();
                            return [2 /*return*/, { count: verified.length, leagues: verified }];
                    }
                });
            }); });
            // Search mappings by name
            fastify.get('/footystats/mapping/search', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var q, results;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            q = request.query.q;
                            if (!q) {
                                return [2 /*return*/, reply.status(400).send({ error: 'q parameter required' })];
                            }
                            return [4 /*yield*/, (0, footystats_repository_1.searchMappings)(q)];
                        case 1:
                            results = _a.sent();
                            return [2 /*return*/, { count: results.length, mappings: results }];
                    }
                });
            }); });
            // Verify a mapping
            fastify.post('/footystats/mapping/verify', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var _a, entity_type, ts_id;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _a = request.body, entity_type = _a.entity_type, ts_id = _a.ts_id;
                            if (!entity_type || !ts_id) {
                                return [2 /*return*/, reply.status(400).send({ error: 'entity_type and ts_id required' })];
                            }
                            return [4 /*yield*/, mapping_service_1.mappingService.verifyMapping(entity_type, ts_id, 'api')];
                        case 1:
                            _b.sent();
                            return [2 /*return*/, { success: true }];
                    }
                });
            }); });
            // ============================================================================
            // MATCH ANALYSIS ENDPOINT (for AI Lab)
            // ============================================================================
            // Get FootyStats analysis for a match
            fastify.get('/footystats/analysis/:matchId', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var matchId, matchResult, match_1, homeTeamMapping, awayTeamMapping, fsMatchData_1, fsHomeTeamData, fsAwayTeamData, todaysMatches, response_1, response_2, apiError_1, response, error_6;
                var _a, _b, _c, _d, _e, _f;
                return __generator(this, function (_g) {
                    switch (_g.label) {
                        case 0:
                            _g.trys.push([0, 12, , 13]);
                            matchId = request.params.matchId;
                            return [4 /*yield*/, (0, footystats_repository_1.getMatchDetails)(matchId)];
                        case 1:
                            matchResult = _g.sent();
                            if (matchResult.length === 0) {
                                return [2 /*return*/, reply.status(404).send({ error: 'Match not found' })];
                            }
                            match_1 = matchResult[0];
                            return [4 /*yield*/, (0, footystats_repository_1.getTeamMapping)(match_1.home_team_name)];
                        case 2:
                            homeTeamMapping = _g.sent();
                            return [4 /*yield*/, (0, footystats_repository_1.getTeamMapping)(match_1.away_team_name)];
                        case 3:
                            awayTeamMapping = _g.sent();
                            fsMatchData_1 = null;
                            fsHomeTeamData = null;
                            fsAwayTeamData = null;
                            _g.label = 4;
                        case 4:
                            _g.trys.push([4, 10, , 11]);
                            return [4 /*yield*/, footystats_client_1.footyStatsAPI.getTodaysMatches()];
                        case 5:
                            todaysMatches = _g.sent();
                            if (todaysMatches.data) {
                                // Try to find the match by team names
                                fsMatchData_1 = todaysMatches.data.find(function (m) {
                                    var _a, _b, _c, _d, _e, _f, _g, _h;
                                    return (((_a = m.home_name) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes((_b = match_1.home_team_name) === null || _b === void 0 ? void 0 : _b.toLowerCase().split(' ')[0])) ||
                                        ((_c = match_1.home_team_name) === null || _c === void 0 ? void 0 : _c.toLowerCase().includes((_d = m.home_name) === null || _d === void 0 ? void 0 : _d.toLowerCase().split(' ')[0]))) &&
                                        (((_e = m.away_name) === null || _e === void 0 ? void 0 : _e.toLowerCase().includes((_f = match_1.away_team_name) === null || _f === void 0 ? void 0 : _f.toLowerCase().split(' ')[0])) ||
                                            ((_g = match_1.away_team_name) === null || _g === void 0 ? void 0 : _g.toLowerCase().includes((_h = m.away_name) === null || _h === void 0 ? void 0 : _h.toLowerCase().split(' ')[0])));
                                });
                            }
                            if (!(homeTeamMapping.length > 0)) return [3 /*break*/, 7];
                            return [4 /*yield*/, footystats_client_1.footyStatsAPI.getTeamLastX(homeTeamMapping[0].fs_id)];
                        case 6:
                            response_1 = _g.sent();
                            fsHomeTeamData = (_a = response_1.data) === null || _a === void 0 ? void 0 : _a[0];
                            _g.label = 7;
                        case 7:
                            if (!(awayTeamMapping.length > 0)) return [3 /*break*/, 9];
                            return [4 /*yield*/, footystats_client_1.footyStatsAPI.getTeamLastX(awayTeamMapping[0].fs_id)];
                        case 8:
                            response_2 = _g.sent();
                            fsAwayTeamData = (_b = response_2.data) === null || _b === void 0 ? void 0 : _b[0];
                            _g.label = 9;
                        case 9: return [3 /*break*/, 11];
                        case 10:
                            apiError_1 = _g.sent();
                            logger_1.logger.warn("[FootyStats] API error fetching match data: ".concat(apiError_1.message));
                            return [3 /*break*/, 11];
                        case 11:
                            response = {
                                match: {
                                    id: match_1.id,
                                    external_id: match_1.external_id,
                                    home_team: match_1.home_team_name || 'Home Team',
                                    away_team: match_1.away_team_name || 'Away Team',
                                    home_logo: match_1.home_logo || '⚽',
                                    away_logo: match_1.away_logo || '⚽',
                                    date: match_1.match_time,
                                    league: match_1.league_name || 'Unknown League',
                                    status_id: match_1.status_id,
                                },
                                potentials: {
                                    btts_potential: (fsMatchData_1 === null || fsMatchData_1 === void 0 ? void 0 : fsMatchData_1.btts_potential) || null,
                                    over25_potential: (fsMatchData_1 === null || fsMatchData_1 === void 0 ? void 0 : fsMatchData_1.o25_potential) || null,
                                    over15_potential: (fsMatchData_1 === null || fsMatchData_1 === void 0 ? void 0 : fsMatchData_1.avg_potential) ? Math.min(fsMatchData_1.avg_potential + 15, 99) : null,
                                    corners_potential: (fsMatchData_1 === null || fsMatchData_1 === void 0 ? void 0 : fsMatchData_1.corners_potential) || null,
                                    cards_potential: (fsMatchData_1 === null || fsMatchData_1 === void 0 ? void 0 : fsMatchData_1.cards_potential) || null,
                                },
                                xg: {
                                    home_xg_prematch: (fsMatchData_1 === null || fsMatchData_1 === void 0 ? void 0 : fsMatchData_1.team_a_xg_prematch) || (fsHomeTeamData === null || fsHomeTeamData === void 0 ? void 0 : fsHomeTeamData.xg_for_avg_overall) || null,
                                    away_xg_prematch: (fsMatchData_1 === null || fsMatchData_1 === void 0 ? void 0 : fsMatchData_1.team_b_xg_prematch) || (fsAwayTeamData === null || fsAwayTeamData === void 0 ? void 0 : fsAwayTeamData.xg_for_avg_overall) || null,
                                    total_xg: null,
                                },
                                form: {
                                    home_form: (fsHomeTeamData === null || fsHomeTeamData === void 0 ? void 0 : fsHomeTeamData.formRun_overall) || null,
                                    away_form: (fsAwayTeamData === null || fsAwayTeamData === void 0 ? void 0 : fsAwayTeamData.formRun_overall) || null,
                                    home_ppg: (fsHomeTeamData === null || fsHomeTeamData === void 0 ? void 0 : fsHomeTeamData.seasonPPG_overall) || null,
                                    away_ppg: (fsAwayTeamData === null || fsAwayTeamData === void 0 ? void 0 : fsAwayTeamData.seasonPPG_overall) || null,
                                },
                                h2h: (fsMatchData_1 === null || fsMatchData_1 === void 0 ? void 0 : fsMatchData_1.h2h) ? (function () {
                                    var _a, _b, _c, _d, _e, _f, _g;
                                    var totalMatches = ((_a = fsMatchData_1.h2h.previous_matches_results) === null || _a === void 0 ? void 0 : _a.totalMatches) || 0;
                                    var avgGoals = ((_b = fsMatchData_1.h2h.betting_stats) === null || _b === void 0 ? void 0 : _b.avg_goals) || 0;
                                    var bttsPct = ((_c = fsMatchData_1.h2h.betting_stats) === null || _c === void 0 ? void 0 : _c.bttsPercentage) || 0;
                                    var over25Pct = ((_d = fsMatchData_1.h2h.betting_stats) === null || _d === void 0 ? void 0 : _d.over25Percentage) || 0;
                                    // Calculate Over 1.5 and Over 3.5 based on avg_goals and over25Pct
                                    var calculateOver15 = function () {
                                        if (avgGoals >= 3.0)
                                            return 100;
                                        if (avgGoals >= 2.5)
                                            return 95;
                                        if (avgGoals >= 2.0)
                                            return 85;
                                        if (avgGoals >= 1.5)
                                            return 70;
                                        return Math.round(avgGoals * 40);
                                    };
                                    var calculateOver35 = function () {
                                        if (avgGoals >= 4.5)
                                            return 90;
                                        if (avgGoals >= 4.0)
                                            return 75;
                                        if (avgGoals >= 3.5)
                                            return 60;
                                        if (avgGoals >= 3.0)
                                            return 45;
                                        if (avgGoals >= 2.5)
                                            return 30;
                                        return Math.round((avgGoals - 1.5) * 20);
                                    };
                                    // Estimate clean sheets
                                    var estimateCleanSheets = function (isHome) {
                                        var baseCleanSheetPct = 100 - bttsPct;
                                        var adjustment = isHome ? 1.1 : 0.9;
                                        return Math.max(0, Math.round(baseCleanSheetPct * adjustment));
                                    };
                                    return {
                                        total_matches: totalMatches,
                                        home_wins: ((_e = fsMatchData_1.h2h.previous_matches_results) === null || _e === void 0 ? void 0 : _e.team_a_wins) || 0,
                                        draws: ((_f = fsMatchData_1.h2h.previous_matches_results) === null || _f === void 0 ? void 0 : _f.draw) || 0,
                                        away_wins: ((_g = fsMatchData_1.h2h.previous_matches_results) === null || _g === void 0 ? void 0 : _g.team_b_wins) || 0,
                                        btts_percentage: bttsPct,
                                        avg_goals: avgGoals,
                                        over15_pct: calculateOver15(),
                                        over25_pct: over25Pct,
                                        over35_pct: calculateOver35(),
                                        home_clean_sheets_pct: estimateCleanSheets(true),
                                        away_clean_sheets_pct: estimateCleanSheets(false),
                                    };
                                })() : null,
                                odds: fsMatchData_1 ? {
                                    home_win: fsMatchData_1.odds_ft_1 || null,
                                    draw: fsMatchData_1.odds_ft_x || null,
                                    away_win: fsMatchData_1.odds_ft_2 || null,
                                } : null,
                                trends: {
                                    home: ((_c = fsMatchData_1 === null || fsMatchData_1 === void 0 ? void 0 : fsMatchData_1.trends) === null || _c === void 0 ? void 0 : _c.home) || [],
                                    away: ((_d = fsMatchData_1 === null || fsMatchData_1 === void 0 ? void 0 : fsMatchData_1.trends) === null || _d === void 0 ? void 0 : _d.away) || [],
                                },
                                mappings: {
                                    home_team_mapped: homeTeamMapping.length > 0,
                                    away_team_mapped: awayTeamMapping.length > 0,
                                    home_fs_id: ((_e = homeTeamMapping[0]) === null || _e === void 0 ? void 0 : _e.fs_id) || null,
                                    away_fs_id: ((_f = awayTeamMapping[0]) === null || _f === void 0 ? void 0 : _f.fs_id) || null,
                                },
                                data_source: {
                                    has_footystats_match: !!fsMatchData_1,
                                    has_home_team_data: !!fsHomeTeamData,
                                    has_away_team_data: !!fsAwayTeamData,
                                }
                            };
                            // Calculate total xG
                            if (response.xg.home_xg_prematch && response.xg.away_xg_prematch) {
                                response.xg.total_xg = response.xg.home_xg_prematch + response.xg.away_xg_prematch;
                            }
                            return [2 /*return*/, response];
                        case 12:
                            error_6 = _g.sent();
                            logger_1.logger.error('[FootyStats] Analysis endpoint error:', error_6);
                            return [2 /*return*/, reply.status(500).send({ error: error_6.message })];
                        case 13: return [2 /*return*/];
                    }
                });
            }); });
            // Get daily tips (high confidence BTTS and Over 2.5 predictions)
            fastify.get('/footystats/daily-tips', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var _a, bttsData, over25Data, today, todayUnix_1, bttsPicks, over25Picks, error_7;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 2, , 3]);
                            logger_1.logger.info('[FootyStats] Fetching daily tips...');
                            return [4 /*yield*/, Promise.all([
                                    footystats_client_1.footyStatsAPI.getBTTSStats(),
                                    footystats_client_1.footyStatsAPI.getOver25Stats()
                                ])];
                        case 1:
                            _a = _b.sent(), bttsData = _a[0], over25Data = _a[1];
                            today = new Date();
                            todayUnix_1 = Math.floor(today.getTime() / 1000);
                            bttsPicks = (bttsData.data || [])
                                .filter(function (match) {
                                return match.btts_percentage >= 70 &&
                                    match.date_unix >= todayUnix_1 &&
                                    match.date_unix < todayUnix_1 + (24 * 60 * 60);
                            })
                                .slice(0, 10)
                                .map(function (m) { return ({
                                fs_id: m.id,
                                home_name: m.home_name,
                                away_name: m.away_name,
                                league: m.competition_name,
                                date_unix: m.date_unix,
                                confidence: m.btts_percentage,
                                tip_type: 'btts'
                            }); });
                            over25Picks = (over25Data.data || [])
                                .filter(function (match) {
                                return match.over25_percentage >= 70 &&
                                    match.date_unix >= todayUnix_1 &&
                                    match.date_unix < todayUnix_1 + (24 * 60 * 60);
                            })
                                .slice(0, 10)
                                .map(function (m) { return ({
                                fs_id: m.id,
                                home_name: m.home_name,
                                away_name: m.away_name,
                                league: m.competition_name,
                                date_unix: m.date_unix,
                                confidence: m.over25_percentage,
                                tip_type: 'over25'
                            }); });
                            logger_1.logger.info("[FootyStats] Daily tips found: ".concat(bttsPicks.length, " BTTS, ").concat(over25Picks.length, " Over2.5"));
                            return [2 /*return*/, {
                                    success: true,
                                    date: today.toISOString().split('T')[0],
                                    btts_picks: bttsPicks,
                                    over25_picks: over25Picks
                                }];
                        case 2:
                            error_7 = _b.sent();
                            logger_1.logger.error('[FootyStats] Daily tips error:', error_7);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'Failed to fetch daily tips'
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            // Get referee analysis for a match
            fastify.get('/footystats/referee/:matchId', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var matchId, matchDetails, match, refereeId, refereeData, referee, cardsPerMatch, isSternReferee, isLenient, error_8;
                var _a, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            _c.trys.push([0, 3, , 4]);
                            matchId = request.params.matchId;
                            logger_1.logger.info("[FootyStats] Fetching referee analysis for match ".concat(matchId, "..."));
                            return [4 /*yield*/, footystats_client_1.footyStatsAPI.getMatchDetails(parseInt(matchId))];
                        case 1:
                            matchDetails = _c.sent();
                            if (!((_a = matchDetails === null || matchDetails === void 0 ? void 0 : matchDetails.data) === null || _a === void 0 ? void 0 : _a[0])) {
                                return [2 /*return*/, reply.status(404).send({
                                        success: false,
                                        error: 'Match not found'
                                    })];
                            }
                            match = matchDetails.data[0];
                            refereeId = match.referee_id;
                            if (!refereeId) {
                                return [2 /*return*/, reply.status(404).send({
                                        success: false,
                                        error: 'Referee not found for this match'
                                    })];
                            }
                            return [4 /*yield*/, footystats_client_1.footyStatsAPI.getRefereeStats(refereeId)];
                        case 2:
                            refereeData = _c.sent();
                            if (!((_b = refereeData === null || refereeData === void 0 ? void 0 : refereeData.data) === null || _b === void 0 ? void 0 : _b[0])) {
                                return [2 /*return*/, reply.status(404).send({
                                        success: false,
                                        error: 'Referee stats not found'
                                    })];
                            }
                            referee = refereeData.data[0];
                            cardsPerMatch = referee.cards_per_match || 0;
                            isSternReferee = cardsPerMatch > 4.5;
                            isLenient = cardsPerMatch < 3.0;
                            return [2 /*return*/, {
                                    success: true,
                                    referee: {
                                        id: referee.id,
                                        name: referee.full_name,
                                        nationality: referee.nationality,
                                        // Stats
                                        cards_per_match: cardsPerMatch,
                                        penalties_given_per_match: referee.penalties_given_per_match_overall || 0,
                                        btts_percentage: Math.round(referee.btts_percentage || 0),
                                        goals_per_match: referee.goals_per_match_overall || 0,
                                        // Meta
                                        matches_officiated: referee.appearances_overall || 0,
                                        // Badges
                                        is_stern: isSternReferee,
                                        is_lenient: isLenient,
                                    }
                                }];
                        case 3:
                            error_8 = _c.sent();
                            logger_1.logger.error('[FootyStats] Referee analysis error:', error_8);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'Failed to fetch referee data'
                                })];
                        case 4: return [2 /*return*/];
                    }
                });
            }); });
            // Get league standings/tables for a season
            fastify.get('/footystats/league-tables/:seasonId', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var seasonId, tablesData, data, leagueTable, specificTables, formatTable_1, error_9;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            seasonId = request.params.seasonId;
                            logger_1.logger.info("[FootyStats] Fetching league tables for season ".concat(seasonId, "..."));
                            return [4 /*yield*/, footystats_client_1.footyStatsAPI.getLeagueTables(parseInt(seasonId))];
                        case 1:
                            tablesData = _a.sent();
                            if (!(tablesData === null || tablesData === void 0 ? void 0 : tablesData.data)) {
                                return [2 /*return*/, reply.status(404).send({
                                        success: false,
                                        error: 'League tables not found'
                                    })];
                            }
                            data = tablesData.data;
                            leagueTable = data.league_table || data.all_matches_table_overall || [];
                            specificTables = data.specific_tables || [];
                            formatTable_1 = function (table) {
                                return table.map(function (team) { return ({
                                    id: team.id,
                                    name: team.name,
                                    position: team.position,
                                    points: team.points,
                                    matches_played: team.matchesPlayed,
                                    wins: team.seasonWins_overall,
                                    draws: team.seasonDraws_overall,
                                    losses: team.seasonLosses_overall,
                                    goals_for: team.seasonGoals,
                                    goals_against: team.seasonConceded,
                                    goal_difference: team.seasonGoalDifference,
                                    form: team.wdl_record || '',
                                    zone: team.zone || null,
                                    corrections: team.corrections || 0,
                                }); });
                            };
                            return [2 /*return*/, {
                                    success: true,
                                    season_id: parseInt(seasonId),
                                    league_table: formatTable_1(leagueTable),
                                    specific_tables: specificTables.map(function (round) { return ({
                                        round: round.round,
                                        groups: (round.groups || []).map(function (group) { return ({
                                            name: group.name,
                                            table: formatTable_1(group.table || [])
                                        }); })
                                    }); }),
                                    has_groups: specificTables.length > 0,
                                }];
                        case 2:
                            error_9 = _a.sent();
                            logger_1.logger.error('[FootyStats] League tables error:', error_9);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'Failed to fetch league tables'
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            // Get league players for a season
            fastify.get('/footystats/league-players/:seasonId', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var seasonId, _a, _b, page, _c, search, _d, position_1, playersData, players, searchLower_1, formattedPlayers, error_10;
                return __generator(this, function (_e) {
                    switch (_e.label) {
                        case 0:
                            _e.trys.push([0, 2, , 3]);
                            seasonId = request.params.seasonId;
                            _a = request.query, _b = _a.page, page = _b === void 0 ? '1' : _b, _c = _a.search, search = _c === void 0 ? '' : _c, _d = _a.position, position_1 = _d === void 0 ? '' : _d;
                            logger_1.logger.info("[FootyStats] Fetching players for season ".concat(seasonId, ", page ").concat(page, "..."));
                            return [4 /*yield*/, footystats_client_1.footyStatsAPI.getLeaguePlayers(parseInt(seasonId), parseInt(page))];
                        case 1:
                            playersData = _e.sent();
                            if (!(playersData === null || playersData === void 0 ? void 0 : playersData.data)) {
                                return [2 /*return*/, reply.status(404).send({
                                        success: false,
                                        error: 'Players not found'
                                    })];
                            }
                            players = playersData.data;
                            // Client-side filtering (since API doesn't support it)
                            if (search) {
                                searchLower_1 = search.toLowerCase();
                                players = players.filter(function (p) {
                                    var _a, _b;
                                    return ((_a = p.full_name) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(searchLower_1)) ||
                                        ((_b = p.known_as) === null || _b === void 0 ? void 0 : _b.toLowerCase().includes(searchLower_1));
                                });
                            }
                            if (position_1 && position_1 !== 'all') {
                                players = players.filter(function (p) { var _a; return ((_a = p.position) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === position_1.toLowerCase(); });
                            }
                            formattedPlayers = players.map(function (player) { return ({
                                id: player.id,
                                full_name: player.full_name,
                                known_as: player.known_as || player.full_name,
                                age: player.age,
                                position: player.position,
                                nationality: player.nationality,
                                club_team_id: player.club_team_id,
                                appearances: player.appearances_overall || 0,
                                goals: player.goals_overall || 0,
                                assists: player.assists_overall || 0,
                                minutes_played: player.minutes_played_overall || 0,
                            }); });
                            return [2 /*return*/, {
                                    success: true,
                                    season_id: parseInt(seasonId),
                                    page: parseInt(page),
                                    total: formattedPlayers.length,
                                    players: formattedPlayers,
                                }];
                        case 2:
                            error_10 = _e.sent();
                            logger_1.logger.error('[FootyStats] League players error:', error_10);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'Failed to fetch players'
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            // Get detailed stats for a specific player
            fastify.get('/footystats/player-stats/:playerId', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var playerId, playerData, latestSeason, error_11;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            playerId = request.params.playerId;
                            logger_1.logger.info("[FootyStats] Fetching stats for player ".concat(playerId, "..."));
                            return [4 /*yield*/, footystats_client_1.footyStatsAPI.getPlayerStats(parseInt(playerId))];
                        case 1:
                            playerData = _a.sent();
                            if (!(playerData === null || playerData === void 0 ? void 0 : playerData.data) || playerData.data.length === 0) {
                                return [2 /*return*/, reply.status(404).send({
                                        success: false,
                                        error: 'Player stats not found'
                                    })];
                            }
                            latestSeason = playerData.data[0];
                            return [2 /*return*/, {
                                    success: true,
                                    player: {
                                        id: latestSeason.id,
                                        full_name: latestSeason.full_name,
                                        known_as: latestSeason.known_as || latestSeason.full_name,
                                        position: latestSeason.position,
                                        nationality: latestSeason.nationality,
                                        age: latestSeason.age,
                                        club_team_id: latestSeason.club_team_id,
                                        // Basic stats
                                        appearances: latestSeason.appearances_overall || 0,
                                        minutes_played: latestSeason.minutes_played_overall || 0,
                                        goals: latestSeason.goals_overall || 0,
                                        assists: latestSeason.assists_overall || 0,
                                        goals_per_90: latestSeason.goals_per_90_overall || 0,
                                        assists_per_90: latestSeason.assists_per_90_overall || 0,
                                        // Advanced stats
                                        xg_per_90: latestSeason.xg_per_90_overall || 0,
                                        xa_per_90: latestSeason.xa_per_90_overall || 0,
                                        shots_per_90: latestSeason.shots_per_90_overall || 0,
                                        shot_accuracy: latestSeason.shot_accuraccy_percentage_overall || 0,
                                        passes_per_90: latestSeason.passes_per_90_overall || 0,
                                        pass_accuracy: latestSeason.pass_completion_rate_overall || 0,
                                        key_passes_per_90: latestSeason.key_passes_per_90_overall || 0,
                                        // Defensive stats
                                        tackles_per_90: latestSeason.tackles_per_90_overall || 0,
                                        interceptions_per_90: latestSeason.interceptions_per_90_overall || 0,
                                        // Cards
                                        yellow_cards: latestSeason.yellow_cards_overall || 0,
                                        red_cards: latestSeason.red_cards_overall || 0,
                                    },
                                    all_seasons: playerData.data, // Include all seasons for history
                                }];
                        case 2:
                            error_11 = _a.sent();
                            logger_1.logger.error('[FootyStats] Player stats error:', error_11);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'Failed to fetch player stats'
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            // Get today's matches with FootyStats data
            fastify.get('/footystats/today', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var today, cached, response, pool, allTeamNames, uniqueTeamNames, teamLogosResult, teamLogosMap_1, missingTeams_1, fuzzyConditions, fuzzyResult, leagueNamesResult, matchLeagueMap_1, matches, error_12;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 9, , 10]);
                            today = new Date().toISOString().split('T')[0];
                            return [4 /*yield*/, (0, cache_service_1.getCachedTodayMatches)(today)];
                        case 1:
                            cached = _a.sent();
                            if (cached) {
                                logger_1.logger.info("[FootyStats] Today matches - CACHE HIT (".concat(cached.length, " matches)"));
                                return [2 /*return*/, { count: cached.length, matches: cached, cached: true }];
                            }
                            logger_1.logger.info('[FootyStats] Today matches - CACHE MISS, fetching from API');
                            return [4 /*yield*/, footystats_client_1.footyStatsAPI.getTodaysMatches()];
                        case 2:
                            response = _a.sent();
                            if (!response.data || response.data.length === 0) {
                                return [2 /*return*/, { count: 0, matches: [], cached: false }];
                            }
                            return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('../database/connection')); })];
                        case 3:
                            pool = (_a.sent()).pool;
                            allTeamNames = response.data.flatMap(function (m) { return [m.home_name, m.away_name]; });
                            uniqueTeamNames = __spreadArray([], new Set(allTeamNames), true);
                            return [4 /*yield*/, pool.query("SELECT name, logo_url FROM ts_teams WHERE name = ANY($1::text[])", [uniqueTeamNames])];
                        case 4:
                            teamLogosResult = _a.sent();
                            teamLogosMap_1 = new Map();
                            teamLogosResult.rows.forEach(function (row) {
                                teamLogosMap_1.set(row.name.toLowerCase(), row.logo_url);
                            });
                            missingTeams_1 = uniqueTeamNames.filter(function (name) {
                                return !teamLogosMap_1.has(name.toLowerCase());
                            });
                            if (!(missingTeams_1.length > 0)) return [3 /*break*/, 6];
                            fuzzyConditions = missingTeams_1.map(function (name) {
                                var firstWord = name.split(' ')[0];
                                return "LOWER(name) LIKE '%".concat(firstWord.toLowerCase(), "%'");
                            }).join(' OR ');
                            return [4 /*yield*/, pool.query("SELECT name, logo_url FROM ts_teams WHERE ".concat(fuzzyConditions, " LIMIT ").concat(missingTeams_1.length))];
                        case 5:
                            fuzzyResult = _a.sent();
                            fuzzyResult.rows.forEach(function (row) {
                                var matchingTeam = missingTeams_1.find(function (t) {
                                    return row.name.toLowerCase().includes(t.split(' ')[0].toLowerCase());
                                });
                                if (matchingTeam && !teamLogosMap_1.has(matchingTeam.toLowerCase())) {
                                    teamLogosMap_1.set(matchingTeam.toLowerCase(), row.logo_url);
                                }
                            });
                            _a.label = 6;
                        case 6: return [4 /*yield*/, pool.query("SELECT DISTINCT\n           t1.name as home_name,\n           t2.name as away_name,\n           c.name as league_name\n         FROM ts_matches m\n         INNER JOIN ts_teams t1 ON m.home_team_id = t1.external_id\n         INNER JOIN ts_teams t2 ON m.away_team_id = t2.external_id\n         INNER JOIN ts_competitions c ON m.competition_id = c.external_id\n         WHERE (t1.name = ANY($1::text[]) OR t2.name = ANY($1::text[]))\n           AND m.match_time >= extract(epoch from NOW() - INTERVAL '7 days')::bigint\n           AND m.match_time <= extract(epoch from NOW() + INTERVAL '7 days')::bigint", [uniqueTeamNames])];
                        case 7:
                            leagueNamesResult = _a.sent();
                            matchLeagueMap_1 = new Map();
                            leagueNamesResult.rows.forEach(function (row) {
                                var key = "".concat(row.home_name, "|").concat(row.away_name).toLowerCase();
                                matchLeagueMap_1.set(key, row.league_name);
                            });
                            matches = response.data.map(function (m, index) {
                                var homeLogo = teamLogosMap_1.get(m.home_name.toLowerCase()) || null;
                                var awayLogo = teamLogosMap_1.get(m.away_name.toLowerCase()) || null;
                                var matchKey = "".concat(m.home_name, "|").concat(m.away_name).toLowerCase();
                                var leagueName = matchLeagueMap_1.get(matchKey);
                                // Fuzzy fallback: if exact match not found, try partial matching
                                if (!leagueName) {
                                    var homeNameLower = m.home_name.toLowerCase();
                                    var awayNameLower = m.away_name.toLowerCase();
                                    for (var _i = 0, _a = matchLeagueMap_1.entries(); _i < _a.length; _i++) {
                                        var _b = _a[_i], key = _b[0], value = _b[1];
                                        var _c = key.split('|'), dbHome = _c[0], dbAway = _c[1];
                                        // Check if both team names partially match
                                        var homeMatch = dbHome.includes(homeNameLower) || homeNameLower.includes(dbHome.split(' ')[0]);
                                        var awayMatch = dbAway.includes(awayNameLower) || awayNameLower.includes(dbAway.split(' ')[0]);
                                        if (homeMatch && awayMatch) {
                                            leagueName = value;
                                            break;
                                        }
                                    }
                                }
                                leagueName = leagueName || 'Unknown League';
                                return {
                                    fs_id: m.id,
                                    home_name: m.home_name,
                                    away_name: m.away_name,
                                    home_logo: homeLogo,
                                    away_logo: awayLogo,
                                    league_name: leagueName,
                                    country: m.country || null,
                                    date_unix: m.date_unix,
                                    status: m.status,
                                    score: m.homeGoalCount != null ? "".concat(m.homeGoalCount, "-").concat(m.awayGoalCount) : null,
                                    potentials: {
                                        btts: m.btts_potential,
                                        over25: m.o25_potential,
                                        avg: m.avg_potential,
                                        over15: m.o15_potential,
                                        corners: m.corners_potential,
                                        cards: m.cards_potential,
                                        shots: m.team_a_xg_prematch && m.team_b_xg_prematch
                                            ? Math.round((m.team_a_xg_prematch + m.team_b_xg_prematch) * 6)
                                            : null,
                                        fouls: m.corners_potential
                                            ? Math.round(20 + (m.corners_potential * 0.5))
                                            : null,
                                    },
                                    xg: {
                                        home: m.team_a_xg_prematch,
                                        away: m.team_b_xg_prematch,
                                    },
                                    odds: {
                                        home: m.odds_ft_1,
                                        draw: m.odds_ft_x,
                                        away: m.odds_ft_2,
                                    },
                                    trends: m.trends || null,
                                    h2h: m.h2h || null,
                                };
                            });
                            // Cache the processed matches
                            return [4 /*yield*/, (0, cache_service_1.setCachedTodayMatches)(matches, today)];
                        case 8:
                            // Cache the processed matches
                            _a.sent();
                            logger_1.logger.info("[FootyStats] Cached ".concat(matches.length, " today matches"));
                            return [2 /*return*/, { count: matches.length, matches: matches, cached: false }];
                        case 9:
                            error_12 = _a.sent();
                            logger_1.logger.error('[FootyStats] Today matches error:', error_12);
                            return [2 /*return*/, reply.status(500).send({ error: error_12.message })];
                        case 10: return [2 /*return*/];
                    }
                });
            }); });
            // Get detailed FootyStats match data by fs_id
            fastify.get('/footystats/match/:fsId', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var fsId, fsIdNum_1, cached, fsMatch_1, matchResponse, matchErr_1, todaysMatches, homeTeamStats_1, awayTeamStats_1, homeResponse, homeData, awayResponse, awayData, teamError_1, response, error_13;
                var _a, _b, _c, _d, _e, _f, _g;
                return __generator(this, function (_h) {
                    switch (_h.label) {
                        case 0:
                            _h.trys.push([0, 15, , 16]);
                            fsId = request.params.fsId;
                            fsIdNum_1 = parseInt(fsId);
                            return [4 /*yield*/, (0, cache_service_1.getCachedMatchStats)(fsIdNum_1)];
                        case 1:
                            cached = _h.sent();
                            if (cached) {
                                logger_1.logger.info("[FootyStats] Match ".concat(fsIdNum_1, " - CACHE HIT"));
                                return [2 /*return*/, __assign(__assign({}, cached), { cached: true })];
                            }
                            logger_1.logger.info("[FootyStats] Match ".concat(fsIdNum_1, " - CACHE MISS, fetching from API"));
                            fsMatch_1 = null;
                            _h.label = 2;
                        case 2:
                            _h.trys.push([2, 4, , 6]);
                            return [4 /*yield*/, footystats_client_1.footyStatsAPI.getMatchDetails(fsIdNum_1)];
                        case 3:
                            matchResponse = _h.sent();
                            fsMatch_1 = matchResponse.data;
                            logger_1.logger.info("[FootyStats] Got match details for ".concat(fsIdNum_1));
                            return [3 /*break*/, 6];
                        case 4:
                            matchErr_1 = _h.sent();
                            logger_1.logger.warn("[FootyStats] Could not get match details: ".concat(matchErr_1.message));
                            return [4 /*yield*/, footystats_client_1.footyStatsAPI.getTodaysMatches()];
                        case 5:
                            todaysMatches = _h.sent();
                            fsMatch_1 = (_a = todaysMatches.data) === null || _a === void 0 ? void 0 : _a.find(function (m) { return m.id === fsIdNum_1; });
                            return [3 /*break*/, 6];
                        case 6:
                            if (!fsMatch_1) {
                                return [2 /*return*/, reply.status(404).send({ error: 'Match not found in FootyStats' })];
                            }
                            homeTeamStats_1 = null;
                            awayTeamStats_1 = null;
                            logger_1.logger.info("[FootyStats] Match ".concat(fsIdNum_1, " - homeID: ").concat(fsMatch_1.homeID, ", awayID: ").concat(fsMatch_1.awayID));
                            _h.label = 7;
                        case 7:
                            _h.trys.push([7, 12, , 13]);
                            if (!fsMatch_1.homeID) return [3 /*break*/, 9];
                            logger_1.logger.info("[FootyStats] Fetching lastX for home team ".concat(fsMatch_1.homeID));
                            return [4 /*yield*/, footystats_client_1.footyStatsAPI.getTeamLastX(fsMatch_1.homeID)];
                        case 8:
                            homeResponse = _h.sent();
                            logger_1.logger.info("[FootyStats] Home response - data exists: ".concat(!!homeResponse.data, ", length: ").concat(((_b = homeResponse.data) === null || _b === void 0 ? void 0 : _b.length) || 0));
                            if (homeResponse.data && homeResponse.data.length > 0) {
                                logger_1.logger.info("[FootyStats] First element keys: ".concat(Object.keys(homeResponse.data[0]).join(', ')));
                            }
                            homeData = ((_c = homeResponse.data) === null || _c === void 0 ? void 0 : _c.find(function (d) { return d.last_x_match_num === 5; })) || ((_d = homeResponse.data) === null || _d === void 0 ? void 0 : _d[0]);
                            homeTeamStats_1 = homeData === null || homeData === void 0 ? void 0 : homeData.stats; // CORRECT: stats are inside .stats property!
                            logger_1.logger.info("[FootyStats] Home stats - PPG: ".concat(homeTeamStats_1 === null || homeTeamStats_1 === void 0 ? void 0 : homeTeamStats_1.seasonPPG_overall, ", BTTS: ").concat(homeTeamStats_1 === null || homeTeamStats_1 === void 0 ? void 0 : homeTeamStats_1.seasonBTTSPercentage_overall, "%"));
                            _h.label = 9;
                        case 9:
                            if (!fsMatch_1.awayID) return [3 /*break*/, 11];
                            logger_1.logger.info("[FootyStats] Fetching lastX for away team ".concat(fsMatch_1.awayID));
                            return [4 /*yield*/, footystats_client_1.footyStatsAPI.getTeamLastX(fsMatch_1.awayID)];
                        case 10:
                            awayResponse = _h.sent();
                            logger_1.logger.info("[FootyStats] Away response - data exists: ".concat(!!awayResponse.data, ", length: ").concat(((_e = awayResponse.data) === null || _e === void 0 ? void 0 : _e.length) || 0));
                            if (awayResponse.data && awayResponse.data.length > 0) {
                                logger_1.logger.info("[FootyStats] First element keys: ".concat(Object.keys(awayResponse.data[0]).join(', ')));
                            }
                            awayData = ((_f = awayResponse.data) === null || _f === void 0 ? void 0 : _f.find(function (d) { return d.last_x_match_num === 5; })) || ((_g = awayResponse.data) === null || _g === void 0 ? void 0 : _g[0]);
                            awayTeamStats_1 = awayData === null || awayData === void 0 ? void 0 : awayData.stats; // CORRECT: stats are inside .stats property!
                            logger_1.logger.info("[FootyStats] Away stats - PPG: ".concat(awayTeamStats_1 === null || awayTeamStats_1 === void 0 ? void 0 : awayTeamStats_1.seasonPPG_overall, ", BTTS: ").concat(awayTeamStats_1 === null || awayTeamStats_1 === void 0 ? void 0 : awayTeamStats_1.seasonBTTSPercentage_overall, "%"));
                            _h.label = 11;
                        case 11: return [3 /*break*/, 13];
                        case 12:
                            teamError_1 = _h.sent();
                            logger_1.logger.warn("[FootyStats] Could not fetch team form: ".concat(teamError_1.message));
                            return [3 /*break*/, 13];
                        case 13:
                            response = {
                                fs_id: fsMatch_1.id,
                                home_name: fsMatch_1.home_name,
                                away_name: fsMatch_1.away_name,
                                date_unix: fsMatch_1.date_unix,
                                status: fsMatch_1.status,
                                score: fsMatch_1.homeGoalCount != null ? "".concat(fsMatch_1.homeGoalCount, "-").concat(fsMatch_1.awayGoalCount) : null,
                                potentials: {
                                    btts: fsMatch_1.btts_potential || null,
                                    over25: fsMatch_1.o25_potential || null,
                                    over15: fsMatch_1.avg_potential ? Math.min(Math.round(fsMatch_1.avg_potential * 30), 95) : null,
                                    corners: fsMatch_1.corners_potential || null,
                                    cards: fsMatch_1.cards_potential || null,
                                    // Calculate Shots Potential (using real team shot averages)
                                    shots: (function () {
                                        // PRIORITY 1: Use real team shot averages (home team's home avg + away team's away avg)
                                        var homeShotsAvg = (homeTeamStats_1 === null || homeTeamStats_1 === void 0 ? void 0 : homeTeamStats_1.shotsAVG_home) || 0;
                                        var awayShotsAvg = (awayTeamStats_1 === null || awayTeamStats_1 === void 0 ? void 0 : awayTeamStats_1.shotsAVG_away) || 0;
                                        if (homeShotsAvg > 0 && awayShotsAvg > 0) {
                                            return Math.round(homeShotsAvg + awayShotsAvg);
                                        }
                                        // PRIORITY 2: Use overall averages if home/away not available
                                        var homeShotsOverall = (homeTeamStats_1 === null || homeTeamStats_1 === void 0 ? void 0 : homeTeamStats_1.shotsAVG_overall) || 0;
                                        var awayShotsOverall = (awayTeamStats_1 === null || awayTeamStats_1 === void 0 ? void 0 : awayTeamStats_1.shotsAVG_overall) || 0;
                                        if (homeShotsOverall > 0 && awayShotsOverall > 0) {
                                            return Math.round(homeShotsOverall + awayShotsOverall);
                                        }
                                        // FALLBACK: Use xG-based calculation (~6 shots per 1.0 xG)
                                        var homeXg = fsMatch_1.team_a_xg_prematch || (homeTeamStats_1 === null || homeTeamStats_1 === void 0 ? void 0 : homeTeamStats_1.xg_for_avg_overall) || 0;
                                        var awayXg = fsMatch_1.team_b_xg_prematch || (awayTeamStats_1 === null || awayTeamStats_1 === void 0 ? void 0 : awayTeamStats_1.xg_for_avg_overall) || 0;
                                        var totalXg = homeXg + awayXg;
                                        return totalXg > 0 ? Math.round(totalXg * 6) : null;
                                    })(),
                                    // Calculate Fouls Potential (base 20 + corner-based adjustment)
                                    fouls: (function () {
                                        var cornersPot = fsMatch_1.corners_potential || 0;
                                        return cornersPot > 0 ? Math.round(20 + (cornersPot * 0.5)) : null;
                                    })(),
                                },
                                xg: {
                                    home: fsMatch_1.team_a_xg_prematch || (homeTeamStats_1 === null || homeTeamStats_1 === void 0 ? void 0 : homeTeamStats_1.xg_for_avg_overall) || null,
                                    away: fsMatch_1.team_b_xg_prematch || (awayTeamStats_1 === null || awayTeamStats_1 === void 0 ? void 0 : awayTeamStats_1.xg_for_avg_overall) || null,
                                    total: null,
                                },
                                odds: {
                                    home: fsMatch_1.odds_ft_1 || null,
                                    draw: fsMatch_1.odds_ft_x || null,
                                    away: fsMatch_1.odds_ft_2 || null,
                                },
                                form: {
                                    home: homeTeamStats_1 ? (function () {
                                        // Helper function to calculate win percentage
                                        var calcWinPct = function (wins, matches) {
                                            return matches > 0 ? Math.round((wins / matches) * 100) : null;
                                        };
                                        return {
                                            // Form strings for badges (e.g. "WWLDW") - Not available in lastX endpoint
                                            formRun_overall: null,
                                            formRun_home: null,
                                            formRun_away: null,
                                            // PPG (Points Per Game) for each context
                                            ppg_overall: homeTeamStats_1.seasonPPG_overall || null,
                                            ppg_home: homeTeamStats_1.seasonPPG_home || null,
                                            ppg_away: homeTeamStats_1.seasonPPG_away || null,
                                            // Win Percentage (calculated from wins/matches)
                                            win_pct_overall: calcWinPct(homeTeamStats_1.seasonWinsNum_overall, homeTeamStats_1.seasonMatchesPlayed_overall),
                                            win_pct_home: calcWinPct(homeTeamStats_1.seasonWinsNum_home, homeTeamStats_1.seasonMatchesPlayed_home),
                                            win_pct_away: calcWinPct(homeTeamStats_1.seasonWinsNum_away, homeTeamStats_1.seasonMatchesPlayed_away),
                                            // Average Goals (total goals per match)
                                            avg_goals_overall: homeTeamStats_1.seasonAVG_overall || null,
                                            avg_goals_home: homeTeamStats_1.seasonAVG_home || null,
                                            avg_goals_away: homeTeamStats_1.seasonAVG_away || null,
                                            // Goals Scored (goals for per match) - Calculated
                                            scored_overall: homeTeamStats_1.seasonGoals_overall && homeTeamStats_1.seasonMatchesPlayed_overall
                                                ? parseFloat((homeTeamStats_1.seasonGoals_overall / homeTeamStats_1.seasonMatchesPlayed_overall).toFixed(2))
                                                : null,
                                            scored_home: homeTeamStats_1.seasonGoals_home && homeTeamStats_1.seasonMatchesPlayed_home
                                                ? parseFloat((homeTeamStats_1.seasonGoals_home / homeTeamStats_1.seasonMatchesPlayed_home).toFixed(2))
                                                : null,
                                            scored_away: homeTeamStats_1.seasonGoals_away && homeTeamStats_1.seasonMatchesPlayed_away
                                                ? parseFloat((homeTeamStats_1.seasonGoals_away / homeTeamStats_1.seasonMatchesPlayed_away).toFixed(2))
                                                : null,
                                            // Goals Conceded (goals against per match)
                                            conceded_overall: homeTeamStats_1.seasonConcededAVG_overall || null,
                                            conceded_home: homeTeamStats_1.seasonConcededAVG_home || null,
                                            conceded_away: homeTeamStats_1.seasonConcededAVG_away || null,
                                            // BTTS (Both Teams To Score) Percentage
                                            btts_pct_overall: homeTeamStats_1.seasonBTTSPercentage_overall || null,
                                            btts_pct_home: homeTeamStats_1.seasonBTTSPercentage_home || null,
                                            btts_pct_away: homeTeamStats_1.seasonBTTSPercentage_away || null,
                                            // Clean Sheet Percentage
                                            cs_pct_overall: homeTeamStats_1.seasonCSPercentage_overall || null,
                                            cs_pct_home: homeTeamStats_1.seasonCSPercentage_home || null,
                                            cs_pct_away: homeTeamStats_1.seasonCSPercentage_away || null,
                                            // Failed To Score Percentage
                                            fts_pct_overall: homeTeamStats_1.seasonFTSPercentage_overall || null,
                                            fts_pct_home: homeTeamStats_1.seasonFTSPercentage_home || null,
                                            fts_pct_away: homeTeamStats_1.seasonFTSPercentage_away || null,
                                            // Over 2.5 Goals Percentage
                                            over25_pct_overall: homeTeamStats_1.seasonOver25Percentage_overall || null,
                                            over25_pct_home: homeTeamStats_1.seasonOver25Percentage_home || null,
                                            over25_pct_away: homeTeamStats_1.seasonOver25Percentage_away || null,
                                            // xG (Expected Goals)
                                            xg_overall: homeTeamStats_1.xg_for_avg_overall || null,
                                            xg_home: homeTeamStats_1.xg_for_avg_home || null,
                                            xg_away: homeTeamStats_1.xg_for_avg_away || null,
                                            // xGA (Expected Goals Against)
                                            xga_overall: homeTeamStats_1.xg_against_avg_overall || null,
                                            xga_home: homeTeamStats_1.xg_against_avg_home || null,
                                            xga_away: homeTeamStats_1.xg_against_avg_away || null,
                                        };
                                    })() : null,
                                    away: awayTeamStats_1 ? (function () {
                                        // Helper function to calculate win percentage
                                        var calcWinPct = function (wins, matches) {
                                            return matches > 0 ? Math.round((wins / matches) * 100) : null;
                                        };
                                        return {
                                            // Form strings for badges (e.g. "LWDWW") - Not available in lastX endpoint
                                            formRun_overall: null,
                                            formRun_home: null,
                                            formRun_away: null,
                                            // PPG (Points Per Game) for each context
                                            ppg_overall: awayTeamStats_1.seasonPPG_overall || null,
                                            ppg_home: awayTeamStats_1.seasonPPG_home || null,
                                            ppg_away: awayTeamStats_1.seasonPPG_away || null,
                                            // Win Percentage (calculated from wins/matches)
                                            win_pct_overall: calcWinPct(awayTeamStats_1.seasonWinsNum_overall, awayTeamStats_1.seasonMatchesPlayed_overall),
                                            win_pct_home: calcWinPct(awayTeamStats_1.seasonWinsNum_home, awayTeamStats_1.seasonMatchesPlayed_home),
                                            win_pct_away: calcWinPct(awayTeamStats_1.seasonWinsNum_away, awayTeamStats_1.seasonMatchesPlayed_away),
                                            // Average Goals (total goals per match)
                                            avg_goals_overall: awayTeamStats_1.seasonAVG_overall || null,
                                            avg_goals_home: awayTeamStats_1.seasonAVG_home || null,
                                            avg_goals_away: awayTeamStats_1.seasonAVG_away || null,
                                            // Goals Scored (goals for per match) - Calculated
                                            scored_overall: awayTeamStats_1.seasonGoals_overall && awayTeamStats_1.seasonMatchesPlayed_overall
                                                ? parseFloat((awayTeamStats_1.seasonGoals_overall / awayTeamStats_1.seasonMatchesPlayed_overall).toFixed(2))
                                                : null,
                                            scored_home: awayTeamStats_1.seasonGoals_home && awayTeamStats_1.seasonMatchesPlayed_home
                                                ? parseFloat((awayTeamStats_1.seasonGoals_home / awayTeamStats_1.seasonMatchesPlayed_home).toFixed(2))
                                                : null,
                                            scored_away: awayTeamStats_1.seasonGoals_away && awayTeamStats_1.seasonMatchesPlayed_away
                                                ? parseFloat((awayTeamStats_1.seasonGoals_away / awayTeamStats_1.seasonMatchesPlayed_away).toFixed(2))
                                                : null,
                                            // Goals Conceded (goals against per match)
                                            conceded_overall: awayTeamStats_1.seasonConcededAVG_overall || null,
                                            conceded_home: awayTeamStats_1.seasonConcededAVG_home || null,
                                            conceded_away: awayTeamStats_1.seasonConcededAVG_away || null,
                                            // BTTS (Both Teams To Score) Percentage
                                            btts_pct_overall: awayTeamStats_1.seasonBTTSPercentage_overall || null,
                                            btts_pct_home: awayTeamStats_1.seasonBTTSPercentage_home || null,
                                            btts_pct_away: awayTeamStats_1.seasonBTTSPercentage_away || null,
                                            // Clean Sheet Percentage
                                            cs_pct_overall: awayTeamStats_1.seasonCSPercentage_overall || null,
                                            cs_pct_home: awayTeamStats_1.seasonCSPercentage_home || null,
                                            cs_pct_away: awayTeamStats_1.seasonCSPercentage_away || null,
                                            // Failed To Score Percentage
                                            fts_pct_overall: awayTeamStats_1.seasonFTSPercentage_overall || null,
                                            fts_pct_home: awayTeamStats_1.seasonFTSPercentage_home || null,
                                            fts_pct_away: awayTeamStats_1.seasonFTSPercentage_away || null,
                                            // Over 2.5 Goals Percentage
                                            over25_pct_overall: awayTeamStats_1.seasonOver25Percentage_overall || null,
                                            over25_pct_home: awayTeamStats_1.seasonOver25Percentage_home || null,
                                            over25_pct_away: awayTeamStats_1.seasonOver25Percentage_away || null,
                                            // xG (Expected Goals)
                                            xg_overall: awayTeamStats_1.xg_for_avg_overall || null,
                                            xg_home: awayTeamStats_1.xg_for_avg_home || null,
                                            xg_away: awayTeamStats_1.xg_for_avg_away || null,
                                            // xGA (Expected Goals Against)
                                            xga_overall: awayTeamStats_1.xg_against_avg_overall || null,
                                            xga_home: awayTeamStats_1.xg_against_avg_home || null,
                                            xga_away: awayTeamStats_1.xg_against_avg_away || null,
                                        };
                                    })() : null,
                                },
                                h2h: fsMatch_1.h2h ? (function () {
                                    var _a, _b, _c, _d, _e, _f, _g, _h;
                                    var totalMatches = ((_a = fsMatch_1.h2h.previous_matches_results) === null || _a === void 0 ? void 0 : _a.totalMatches) || 0;
                                    var avgGoals = ((_b = fsMatch_1.h2h.betting_stats) === null || _b === void 0 ? void 0 : _b.avg_goals) || 0;
                                    var bttsPct = ((_c = fsMatch_1.h2h.betting_stats) === null || _c === void 0 ? void 0 : _c.bttsPercentage) || 0;
                                    var over25Pct = ((_d = fsMatch_1.h2h.betting_stats) === null || _d === void 0 ? void 0 : _d.over25Percentage) || 0;
                                    // Calculate Over 1.5 and Over 3.5 based on avg_goals and over25Pct
                                    var calculateOver15 = function () {
                                        if (avgGoals >= 3.0)
                                            return 100;
                                        if (avgGoals >= 2.5)
                                            return 95;
                                        if (avgGoals >= 2.0)
                                            return 85;
                                        if (avgGoals >= 1.5)
                                            return 70;
                                        return Math.round(avgGoals * 40); // Rough estimate
                                    };
                                    var calculateOver35 = function () {
                                        if (avgGoals >= 4.5)
                                            return 90;
                                        if (avgGoals >= 4.0)
                                            return 75;
                                        if (avgGoals >= 3.5)
                                            return 60;
                                        if (avgGoals >= 3.0)
                                            return 45;
                                        if (avgGoals >= 2.5)
                                            return 30;
                                        return Math.round((avgGoals - 1.5) * 20); // Rough estimate
                                    };
                                    // Estimate clean sheets (inverse of BTTS with slight adjustment)
                                    var estimateCleanSheets = function (isHome) {
                                        // If BTTS is high, clean sheets are rare
                                        var baseCleanSheetPct = 100 - bttsPct;
                                        // Home teams typically get slightly more clean sheets
                                        var adjustment = isHome ? 1.1 : 0.9;
                                        return Math.max(0, Math.round(baseCleanSheetPct * adjustment));
                                    };
                                    return {
                                        total_matches: totalMatches,
                                        home_wins: ((_e = fsMatch_1.h2h.previous_matches_results) === null || _e === void 0 ? void 0 : _e.team_a_wins) || 0,
                                        draws: ((_f = fsMatch_1.h2h.previous_matches_results) === null || _f === void 0 ? void 0 : _f.draw) || 0,
                                        away_wins: ((_g = fsMatch_1.h2h.previous_matches_results) === null || _g === void 0 ? void 0 : _g.team_b_wins) || 0,
                                        btts_pct: bttsPct,
                                        avg_goals: avgGoals,
                                        // New calculated fields
                                        over15_pct: calculateOver15(),
                                        over25_pct: over25Pct,
                                        over35_pct: calculateOver35(),
                                        home_clean_sheets_pct: estimateCleanSheets(true),
                                        away_clean_sheets_pct: estimateCleanSheets(false),
                                        // Match results
                                        matches: ((_h = fsMatch_1.h2h.previous_matches_ids) === null || _h === void 0 ? void 0 : _h.map(function (m) { return ({
                                            date_unix: m.date_unix,
                                            home_team_id: m.team_a_id,
                                            away_team_id: m.team_b_id,
                                            home_goals: m.team_a_goals,
                                            away_goals: m.team_b_goals,
                                            score: "".concat(m.team_a_goals, "-").concat(m.team_b_goals),
                                        }); })) || [],
                                    };
                                })() : null,
                                trends: (function () {
                                    var _a, _b, _c, _d, _e, _f, _g, _h;
                                    // Convert FootyStats trends to Turkish using trends.generator
                                    var turkishTrends = (0, trends_generator_1.generateTurkishTrends)(fsMatch_1.home_name || 'Home Team', fsMatch_1.away_name || 'Away Team', {
                                        potentials: {
                                            btts: fsMatch_1.btts_potential,
                                            over25: fsMatch_1.o25_potential,
                                            over15: fsMatch_1.avg_potential ? Math.min(Math.round(fsMatch_1.avg_potential * 30), 95) : null,
                                        },
                                        form: {
                                            home: homeTeamStats_1 ? {
                                                ppg: homeTeamStats_1.seasonPPG_overall,
                                                btts_pct: homeTeamStats_1.seasonBTTSPercentage_overall,
                                                over25_pct: homeTeamStats_1.seasonOver25Percentage_overall,
                                                overall: homeTeamStats_1.formRun_overall || null, // NEW: Form string
                                                home_only: homeTeamStats_1.formRun_home || null, // NEW: Home form
                                            } : null,
                                            away: awayTeamStats_1 ? {
                                                ppg: awayTeamStats_1.seasonPPG_overall,
                                                btts_pct: awayTeamStats_1.seasonBTTSPercentage_overall,
                                                over25_pct: awayTeamStats_1.seasonOver25Percentage_overall,
                                                overall: awayTeamStats_1.formRun_overall || null, // NEW: Form string
                                                away_only: awayTeamStats_1.formRun_away || null, // NEW: Away form
                                            } : null,
                                        },
                                        h2h: fsMatch_1.h2h ? {
                                            total_matches: (_a = fsMatch_1.h2h.previous_matches_results) === null || _a === void 0 ? void 0 : _a.totalMatches,
                                            home_wins: (_b = fsMatch_1.h2h.previous_matches_results) === null || _b === void 0 ? void 0 : _b.team_a_wins,
                                            draws: (_c = fsMatch_1.h2h.previous_matches_results) === null || _c === void 0 ? void 0 : _c.draw,
                                            away_wins: (_d = fsMatch_1.h2h.previous_matches_results) === null || _d === void 0 ? void 0 : _d.team_b_wins,
                                            btts_pct: (_e = fsMatch_1.h2h.betting_stats) === null || _e === void 0 ? void 0 : _e.bttsPercentage,
                                            avg_goals: (_f = fsMatch_1.h2h.betting_stats) === null || _f === void 0 ? void 0 : _f.avg_goals,
                                        } : undefined,
                                        xg: {
                                            home: fsMatch_1.team_a_xg_prematch || (homeTeamStats_1 === null || homeTeamStats_1 === void 0 ? void 0 : homeTeamStats_1.xg_for_avg_overall),
                                            away: fsMatch_1.team_b_xg_prematch || (awayTeamStats_1 === null || awayTeamStats_1 === void 0 ? void 0 : awayTeamStats_1.xg_for_avg_overall),
                                            total: null,
                                        },
                                        trends: {
                                            home: ((_g = fsMatch_1.trends) === null || _g === void 0 ? void 0 : _g.home) || [],
                                            away: ((_h = fsMatch_1.trends) === null || _h === void 0 ? void 0 : _h.away) || [],
                                        },
                                    });
                                    // Helper function to determine sentiment from Turkish text
                                    var determineSentiment = function (text) {
                                        var lowerText = text.toLowerCase();
                                        // Positive indicators
                                        if (lowerText.includes('galibiyet') ||
                                            lowerText.includes('güçlü') ||
                                            lowerText.includes('yüksek gol') ||
                                            lowerText.includes('iyi form') ||
                                            lowerText.includes('kalesini gole kapatmış')) {
                                            return 'great';
                                        }
                                        // Negative indicators
                                        if (lowerText.includes('galibiyetsiz') ||
                                            lowerText.includes('zayıf') ||
                                            lowerText.includes('gol yemiş') ||
                                            lowerText.includes('form dalgalan')) {
                                            return 'bad';
                                        }
                                        // Neutral/informational
                                        return 'neutral';
                                    };
                                    // Return Turkish trends with smart sentiment detection
                                    return {
                                        home: turkishTrends.home.map(function (text) { return ({
                                            sentiment: determineSentiment(text),
                                            text: text,
                                        }); }),
                                        away: turkishTrends.away.map(function (text) { return ({
                                            sentiment: determineSentiment(text),
                                            text: text,
                                        }); }),
                                    };
                                })(),
                                // Debug: raw data for troubleshooting
                                _debug: {
                                    has_h2h_raw: !!fsMatch_1.h2h,
                                    has_trends_raw: !!fsMatch_1.trends,
                                    home_team_id: fsMatch_1.homeID,
                                    away_team_id: fsMatch_1.awayID,
                                }
                            };
                            // Calculate total xG
                            if (response.xg.home && response.xg.away) {
                                response.xg.total = response.xg.home + response.xg.away;
                            }
                            // Cache the match data
                            return [4 /*yield*/, (0, cache_service_1.setCachedMatchStats)(response, {
                                    matchDateUnix: fsMatch_1.date_unix,
                                    status: fsMatch_1.status
                                })];
                        case 14:
                            // Cache the match data
                            _h.sent();
                            logger_1.logger.info("[FootyStats] Cached match ".concat(fsIdNum_1, " data"));
                            return [2 /*return*/, __assign(__assign({}, response), { cached: false })];
                        case 15:
                            error_13 = _h.sent();
                            logger_1.logger.error('[FootyStats] Match detail error:', error_13);
                            return [2 /*return*/, reply.status(500).send({ error: error_13.message })];
                        case 16: return [2 /*return*/];
                    }
                });
            }); });
            // Clear all mappings (for re-run) - ADMIN ONLY
            fastify.delete('/footystats/mapping/clear', { preHandler: [auth_middleware_1.requireAuth, auth_middleware_1.requireAdmin] }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var error_14;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            // PR-4: Use repository for DB access
                            return [4 /*yield*/, (0, footystats_repository_1.clearAllMappings)()];
                        case 1:
                            // PR-4: Use repository for DB access
                            _a.sent();
                            return [2 /*return*/, { success: true, message: 'All mappings cleared' }];
                        case 2:
                            error_14 = _a.sent();
                            return [2 /*return*/, reply.status(500).send({ success: false, error: error_14.message })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            // Create migration tables - ADMIN ONLY
            fastify.post('/footystats/migrate', { preHandler: [auth_middleware_1.requireAuth, auth_middleware_1.requireAdmin] }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var error_15;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            // PR-4: Use repository for DB access
                            return [4 /*yield*/, (0, footystats_repository_1.runMigrations)()];
                        case 1:
                            // PR-4: Use repository for DB access
                            _a.sent();
                            return [2 /*return*/, { success: true, message: 'FootyStats tables created' }];
                        case 2:
                            error_15 = _a.sent();
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: error_15.message,
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            // ============================================================================
            // CACHE MANAGEMENT ENDPOINTS - ADMIN ONLY
            // ============================================================================
            // Get cache statistics
            fastify.get('/footystats/cache/stats', { preHandler: [auth_middleware_1.requireAuth, auth_middleware_1.requireAdmin] }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var stats, error_16;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4 /*yield*/, (0, cache_service_1.getCacheStats)()];
                        case 1:
                            stats = _a.sent();
                            return [2 /*return*/, {
                                    success: true,
                                    stats: stats
                                }];
                        case 2:
                            error_16 = _a.sent();
                            logger_1.logger.error('[FootyStats] Cache stats error:', error_16);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: error_16.message
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            // Invalidate cache for a specific match
            fastify.delete('/footystats/cache/invalidate/:matchId', { preHandler: [auth_middleware_1.requireAuth, auth_middleware_1.requireAdmin] }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var matchId, fsIdNum, error_17;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            matchId = request.params.matchId;
                            fsIdNum = parseInt(matchId);
                            return [4 /*yield*/, (0, cache_service_1.invalidateMatchCache)(fsIdNum)];
                        case 1:
                            _a.sent();
                            logger_1.logger.info("[FootyStats] Cache invalidated for match ".concat(fsIdNum));
                            return [2 /*return*/, {
                                    success: true,
                                    message: "Cache invalidated for match ".concat(fsIdNum)
                                }];
                        case 2:
                            error_17 = _a.sent();
                            logger_1.logger.error('[FootyStats] Cache invalidation error:', error_17);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: error_17.message
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            // Cleanup expired cache entries
            fastify.post('/footystats/cache/cleanup', { preHandler: [auth_middleware_1.requireAuth, auth_middleware_1.requireAdmin] }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var error_18;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4 /*yield*/, (0, cache_service_1.cleanupExpiredCache)()];
                        case 1:
                            _a.sent();
                            logger_1.logger.info('[FootyStats] Expired cache cleaned up');
                            return [2 /*return*/, {
                                    success: true,
                                    message: 'Expired cache entries cleaned up'
                                }];
                        case 2:
                            error_18 = _a.sent();
                            logger_1.logger.error('[FootyStats] Cache cleanup error:', error_18);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: error_18.message
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            logger_1.logger.info('[Routes] FootyStats routes registered');
            return [2 /*return*/];
        });
    });
}
