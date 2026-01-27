"use strict";
/**
 * Match Detail Live Service
 *
 * Handles business logic for /match/detail_live endpoint
 */
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchDetailLiveService = void 0;
var TheSportsAPIManager_1 = require("../../../core/TheSportsAPIManager");
var logger_1 = require("../../../utils/logger");
var obsLogger_1 = require("../../../utils/obsLogger");
var circuitBreaker_1 = require("../../../utils/circuitBreaker");
var connection_1 = require("../../../database/connection");
var types_1 = require("../../../utils/cache/types");
var cache_fallback_util_1 = require("../../../utils/cache/cache-fallback.util");
var IncidentOrchestrator_1 = require("../../orchestration/IncidentOrchestrator");
var MatchDetailLiveService = /** @class */ (function () {
    function MatchDetailLiveService() {
        this.client = TheSportsAPIManager_1.theSportsAPI;
        // Cached schema capability for reconcile (avoid information_schema queries on every call)
        this.reconcileSchemaChecked = false;
        this.hasIncidentsColumn = false;
        this.hasStatisticsColumn = false;
        this.hasNewScoreColumns = false;
        this.hasLiveKickoffTimeColumn = false;
        this.minuteColumnName = null;
        // Phase 4-2: Single circuit layer - circuit breaker is in TheSportsClient, not here
    }
    /**
     * Get match detail live with cache fallback
     */
    MatchDetailLiveService.prototype.getMatchDetailLive = function (params_1) {
        return __awaiter(this, arguments, void 0, function (params, options) {
            var match_id, cacheKey, circuitError_1;
            var _this = this;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        match_id = params.match_id;
                        cacheKey = "".concat(types_1.CacheKeyPrefix.TheSports, ":match:detail_live:").concat(match_id);
                        if (!options.forceRefresh) return [3 /*break*/, 4];
                        logger_1.logger.info("Force-refresh match detail live: ".concat(match_id));
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.client.get('/match/detail_live', { match_id: match_id })];
                    case 2: return [2 /*return*/, _a.sent()];
                    case 3:
                        circuitError_1 = _a.sent();
                        // Phase 4-2: Circuit breaker is OPEN - return "no usable data" (typed error check)
                        if (circuitError_1 instanceof circuitBreaker_1.CircuitOpenError) {
                            (0, obsLogger_1.logEvent)('warn', 'provider.circuit.skip', {
                                provider: 'thesports-http',
                                endpoint: '/match/detail_live',
                                match_id: match_id,
                            });
                            return [2 /*return*/, { results: [] }]; // Return empty results
                        }
                        throw circuitError_1;
                    case 4: 
                    // Normal cached fetch
                    return [2 /*return*/, (0, cache_fallback_util_1.getWithCacheFallback)(cacheKey, function () { return __awaiter(_this, void 0, void 0, function () {
                            var response, isResultEmpty, globalList, foundInGlobal, circuitError_2;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        logger_1.logger.info("Fetching match detail live: ".concat(match_id));
                                        _a.label = 1;
                                    case 1:
                                        _a.trys.push([1, 5, , 6]);
                                        return [4 /*yield*/, this.client.get('/match/detail_live', { match_id: match_id })];
                                    case 2:
                                        response = _a.sent();
                                        isResultEmpty = !response || !response.results ||
                                            (Array.isArray(response.results) && response.results.length === 0) ||
                                            (typeof response.results === 'object' && Object.keys(response.results).length === 0);
                                        if (!isResultEmpty) return [3 /*break*/, 4];
                                        logger_1.logger.warn("[DetailLive] Direct fetch for ".concat(match_id, " returned empty. Falling back to global live list search."));
                                        return [4 /*yield*/, this.getAllLiveStats()];
                                    case 3:
                                        globalList = _a.sent();
                                        foundInGlobal = globalList.find(function (m) {
                                            return String((m === null || m === void 0 ? void 0 : m.id) || '') === String(match_id) ||
                                                String((m === null || m === void 0 ? void 0 : m.match_id) || '') === String(match_id);
                                        });
                                        if (foundInGlobal) {
                                            logger_1.logger.info("[DetailLive] Found match ".concat(match_id, " in global live list fallback!"));
                                            // Wrap in expected response structure
                                            return [2 /*return*/, { results: [foundInGlobal] }];
                                        }
                                        _a.label = 4;
                                    case 4: return [2 /*return*/, response];
                                    case 5:
                                        circuitError_2 = _a.sent();
                                        // Phase 4-2: Circuit breaker is OPEN - return "no usable data" (typed error check)
                                        if (circuitError_2 instanceof circuitBreaker_1.CircuitOpenError) {
                                            (0, obsLogger_1.logEvent)('warn', 'provider.circuit.skip', {
                                                provider: 'thesports-http',
                                                endpoint: '/match/detail_live',
                                                match_id: match_id,
                                            });
                                            return [2 /*return*/, { results: [] }]; // Return empty results
                                        }
                                        throw circuitError_2;
                                    case 6: return [2 /*return*/];
                                }
                            });
                        }); }, {
                            ttl: types_1.CacheTTL.TenSeconds, // Live data, ultra-short cache for real-time scores
                            staleTtl: types_1.CacheTTL.Minute, // Serve stale data if API fails
                        })];
                }
            });
        });
    };
    /**
     * Get match detail (non-live) - used as fallback when match is not in detail_live
     * This endpoint returns data for finished matches (status 8)
     */
    MatchDetailLiveService.prototype.getMatchDetail = function (matchId) {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.client.get('/match/detail', { match_id: matchId })];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response];
                    case 2:
                        error_1 = _a.sent();
                        logger_1.logger.warn("[MatchDetailLive] Failed to fetch /match/detail for ".concat(matchId, ": ").concat(error_1.message));
                        return [2 /*return*/, null];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get ALL live match stats (no match_id parameter)
     * Returns stats, incidents, score for all currently live matches
     * Cached for 30 seconds
     */
    MatchDetailLiveService.prototype.getAllLiveStats = function () {
        return __awaiter(this, void 0, void 0, function () {
            var cacheKey, cached;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        cacheKey = "".concat(types_1.CacheKeyPrefix.TheSports, ":match:detail_live:all");
                        return [4 /*yield*/, (0, cache_fallback_util_1.getWithCacheFallback)(cacheKey, function () { return __awaiter(_this, void 0, void 0, function () {
                                var response;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            logger_1.logger.info('Fetching ALL live match details (no match_id param)');
                                            return [4 /*yield*/, this.client.get('/match/detail_live')];
                                        case 1:
                                            response = _a.sent();
                                            return [2 /*return*/, (response === null || response === void 0 ? void 0 : response.results) || []];
                                    }
                                });
                            }); }, {
                                ttl: types_1.CacheTTL.TenSeconds, // Ultra-short cache for real-time scores
                                staleTtl: types_1.CacheTTL.Minute,
                            })];
                    case 1:
                        cached = _a.sent();
                        return [2 /*return*/, cached || []];
                }
            });
        });
    };
    /**
     * Get specific match stats by filtering from all live matches
     * This is more reliable than passing match_id to detail_live endpoint
     */
    MatchDetailLiveService.prototype.getMatchStatsFromLive = function (matchId) {
        return __awaiter(this, void 0, void 0, function () {
            var allLiveMatches, matchData;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, this.getAllLiveStats()];
                    case 1:
                        allLiveMatches = _c.sent();
                        matchData = allLiveMatches.find(function (m) { return m.id === matchId; });
                        if (matchData) {
                            logger_1.logger.info("Found stats for match ".concat(matchId, ": ").concat(((_a = matchData.stats) === null || _a === void 0 ? void 0 : _a.length) || 0, " stats, ").concat(((_b = matchData.incidents) === null || _b === void 0 ? void 0 : _b.length) || 0, " incidents"));
                            return [2 /*return*/, {
                                    id: matchData.id,
                                    stats: matchData.stats || [],
                                    incidents: matchData.incidents || [],
                                    score: matchData.score || null,
                                }];
                        }
                        logger_1.logger.warn("Match ".concat(matchId, " not found in live data (may not be currently live)"));
                        return [2 /*return*/, null];
                }
            });
        });
    };
    MatchDetailLiveService.prototype.extractLiveFields = function (resp, matchId) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14, _15, _16, _17, _18, _19, _20, _21, _22;
        // TheSports /match/detail_live payloads can vary by plan/version.
        // We do not assume a single rigid shape; we attempt best-effort extraction.
        // CRITICAL: If response is an array, find the element matching matchId
        // DO NOT fallback to first array element (prevents writing wrong match data)
        var container = (_c = (_b = (_a = resp === null || resp === void 0 ? void 0 : resp.results) !== null && _a !== void 0 ? _a : resp === null || resp === void 0 ? void 0 : resp.result) !== null && _b !== void 0 ? _b : resp === null || resp === void 0 ? void 0 : resp.data) !== null && _c !== void 0 ? _c : resp;
        var unwrapResults = function (r) {
            if (!r || typeof r !== 'object')
                return r;
            if (Array.isArray(r)) {
                if (matchId) {
                    // CRITICAL FIX: Check multiple possible ID fields (id, match_id, external_id)
                    var found = r.find(function (item) {
                        return String((item === null || item === void 0 ? void 0 : item.id) || '') === String(matchId) ||
                            String((item === null || item === void 0 ? void 0 : item.match_id) || '') === String(matchId) ||
                            String((item === null || item === void 0 ? void 0 : item.external_id) || '') === String(matchId);
                    });
                    if (found) {
                        logger_1.logger.debug("[DetailLive] matched detail_live by id match_id=".concat(matchId, " (len=").concat(r.length, ")"));
                        return found;
                    }
                    // CRITICAL: If matchId is not found in the array, return null instead of r[0]
                    logger_1.logger.warn("[DetailLive] match_id=".concat(matchId, " not found in detail_live results (len=").concat(r.length, "). Checked: id, match_id, external_id"));
                    return null;
                }
                return null;
            }
            if (matchId && r[matchId])
                return r[matchId];
            var keys = Object.keys(r);
            if (keys.length === 1) {
                var v = r[keys[0]];
                if (Array.isArray(v)) {
                    if (matchId) {
                        // CRITICAL FIX: Check multiple possible ID fields (id, match_id, external_id)
                        var found = v.find(function (item) {
                            return String((item === null || item === void 0 ? void 0 : item.id) || '') === String(matchId) ||
                                String((item === null || item === void 0 ? void 0 : item.match_id) || '') === String(matchId) ||
                                String((item === null || item === void 0 ? void 0 : item.external_id) || '') === String(matchId);
                        });
                        if (found) {
                            logger_1.logger.debug("[DetailLive] matched detail_live by id match_id=".concat(matchId, " (len=").concat(v.length, ", key=").concat(keys[0], ")"));
                            return found;
                        }
                        // CRITICAL: If matchId is not found in the array, return null instead of v[0]
                        logger_1.logger.warn("[DetailLive] match_id=".concat(matchId, " not found in detail_live results (len=").concat(v.length, ", key=").concat(keys[0], "). Checked: id, match_id, external_id"));
                        return null;
                    }
                    return null;
                }
                return v;
            }
            if (r['1']) {
                var v = r['1'];
                if (Array.isArray(v)) {
                    if (matchId) {
                        // CRITICAL FIX: Check multiple possible ID fields (id, match_id, external_id)
                        var found = v.find(function (item) {
                            return String((item === null || item === void 0 ? void 0 : item.id) || '') === String(matchId) ||
                                String((item === null || item === void 0 ? void 0 : item.match_id) || '') === String(matchId) ||
                                String((item === null || item === void 0 ? void 0 : item.external_id) || '') === String(matchId);
                        });
                        if (found) {
                            logger_1.logger.debug("[DetailLive] matched detail_live by id match_id=".concat(matchId, " (len=").concat(v.length, ", key=1)"));
                            return found;
                        }
                        // CRITICAL: If matchId is not found in the array, return null instead of v[0]
                        logger_1.logger.warn("[DetailLive] match_id=".concat(matchId, " not found in detail_live results (len=").concat(v.length, ", key=1). Checked: id, match_id, external_id"));
                        return null;
                    }
                    return null;
                }
                return v;
            }
            return r;
        };
        var root = unwrapResults(container);
        // CRITICAL FIX: Handle score array format: [match_id, status_id, home_scores[], away_scores[], update_time, ...]
        var statusId = null;
        if (Array.isArray(root === null || root === void 0 ? void 0 : root.score) && root.score.length >= 2 && typeof root.score[1] === 'number') {
            statusId = root.score[1];
            logger_1.logger.debug("[DetailLive] Extracted status_id=".concat(statusId, " from score array format"));
        }
        else {
            statusId =
                (_j = (_g = (_e = (_d = (typeof (root === null || root === void 0 ? void 0 : root.status_id) === 'number' ? root.status_id : null)) !== null && _d !== void 0 ? _d : (typeof (root === null || root === void 0 ? void 0 : root.status) === 'number' ? root.status : null)) !== null && _e !== void 0 ? _e : (typeof ((_f = root === null || root === void 0 ? void 0 : root.match) === null || _f === void 0 ? void 0 : _f.status_id) === 'number' ? root.match.status_id : null)) !== null && _g !== void 0 ? _g : (typeof ((_h = root === null || root === void 0 ? void 0 : root.match) === null || _h === void 0 ? void 0 : _h.status) === 'number' ? root.match.status : null)) !== null && _j !== void 0 ? _j : null;
        }
        // Best-effort score extraction. Prefer explicit display scores if present.
        // CRITICAL FIX: Handle score array format: [match_id, status_id, home_scores[], away_scores[], update_time, ...]
        var homeScoreDisplay = null;
        var awayScoreDisplay = null;
        if (Array.isArray(root === null || root === void 0 ? void 0 : root.score) && root.score.length >= 4) {
            // score[2] = home_scores array, score[3] = away_scores array
            // Index 0 of score array is regular score
            var homeScores = Array.isArray(root.score[2]) ? root.score[2] : null;
            var awayScores = Array.isArray(root.score[3]) ? root.score[3] : null;
            homeScoreDisplay = homeScores && homeScores.length > 0 && typeof homeScores[0] === 'number' ? homeScores[0] : null;
            awayScoreDisplay = awayScores && awayScores.length > 0 && typeof awayScores[0] === 'number' ? awayScores[0] : null;
            if (homeScoreDisplay !== null || awayScoreDisplay !== null) {
                logger_1.logger.debug("[DetailLive] Extracted scores from score array format: ".concat(homeScoreDisplay, "-").concat(awayScoreDisplay));
            }
        }
        if (homeScoreDisplay === null || isNaN(homeScoreDisplay)) {
            homeScoreDisplay =
                (_q = (_o = (_l = (_k = (typeof (root === null || root === void 0 ? void 0 : root.home_score) === 'number' && !isNaN(root.home_score) ? root.home_score : null)) !== null && _k !== void 0 ? _k : (typeof (root === null || root === void 0 ? void 0 : root.home_score_display) === 'number' && !isNaN(root.home_score_display) ? root.home_score_display : null)) !== null && _l !== void 0 ? _l : (typeof ((_m = root === null || root === void 0 ? void 0 : root.score) === null || _m === void 0 ? void 0 : _m.home) === 'number' && !isNaN(root.score.home) ? root.score.home : null)) !== null && _o !== void 0 ? _o : (typeof ((_p = root === null || root === void 0 ? void 0 : root.match) === null || _p === void 0 ? void 0 : _p.home_score) === 'number' && !isNaN(root.match.home_score) ? root.match.home_score : null)) !== null && _q !== void 0 ? _q : null;
        }
        if (awayScoreDisplay === null || isNaN(awayScoreDisplay)) {
            awayScoreDisplay =
                (_w = (_u = (_s = (_r = (typeof (root === null || root === void 0 ? void 0 : root.away_score) === 'number' && !isNaN(root.away_score) ? root.away_score : null)) !== null && _r !== void 0 ? _r : (typeof (root === null || root === void 0 ? void 0 : root.away_score_display) === 'number' && !isNaN(root.away_score_display) ? root.away_score_display : null)) !== null && _s !== void 0 ? _s : (typeof ((_t = root === null || root === void 0 ? void 0 : root.score) === null || _t === void 0 ? void 0 : _t.away) === 'number' && !isNaN(root.score.away) ? root.score.away : null)) !== null && _u !== void 0 ? _u : (typeof ((_v = root === null || root === void 0 ? void 0 : root.match) === null || _v === void 0 ? void 0 : _v.away_score) === 'number' && !isNaN(root.match.away_score) ? root.match.away_score : null)) !== null && _w !== void 0 ? _w : null;
        }
        // Incidents/stats may be arrays or nested in different keys.
        var incidents = (_z = (_y = (_x = (Array.isArray(root === null || root === void 0 ? void 0 : root.incidents) ? root.incidents : null)) !== null && _x !== void 0 ? _x : (Array.isArray(root === null || root === void 0 ? void 0 : root.events) ? root.events : null)) !== null && _y !== void 0 ? _y : (Array.isArray(root === null || root === void 0 ? void 0 : root.match_incidents) ? root.match_incidents : null)) !== null && _z !== void 0 ? _z : null;
        var statistics = (_2 = (_1 = (_0 = (Array.isArray(root === null || root === void 0 ? void 0 : root.statistics) ? root.statistics : null)) !== null && _0 !== void 0 ? _0 : (Array.isArray(root === null || root === void 0 ? void 0 : root.stats) ? root.stats : null)) !== null && _1 !== void 0 ? _1 : (Array.isArray(root === null || root === void 0 ? void 0 : root.technical_statistics) ? root.technical_statistics : null)) !== null && _2 !== void 0 ? _2 : null;
        // Extract provider update_time if available (NOT in score array - only in root object)
        // Score array format: [match_id, status_id, home_scores[], away_scores[], kick_off_timestamp, "Compatible ignore"]
        // update_time is NOT in score array, extract from root object fields
        // CRITICAL FIX: TheSports API uses 'tlive' field for real-time update timestamp
        var updateTimeRaw = null;
        updateTimeRaw =
            (_10 = (_8 = (_6 = (_5 = (_4 = (_3 = (typeof (root === null || root === void 0 ? void 0 : root.tlive) === 'number' ? root.tlive : null)) !== null && _3 !== void 0 ? _3 : (typeof (root === null || root === void 0 ? void 0 : root.update_time) === 'number' ? root.update_time : null)) !== null && _4 !== void 0 ? _4 : (typeof (root === null || root === void 0 ? void 0 : root.updateTime) === 'number' ? root.updateTime : null)) !== null && _5 !== void 0 ? _5 : (typeof (root === null || root === void 0 ? void 0 : root.updated_at) === 'number' ? root.updated_at : null)) !== null && _6 !== void 0 ? _6 : (typeof ((_7 = root === null || root === void 0 ? void 0 : root.match) === null || _7 === void 0 ? void 0 : _7.update_time) === 'number' ? root.match.update_time : null)) !== null && _8 !== void 0 ? _8 : (typeof ((_9 = root === null || root === void 0 ? void 0 : root.match) === null || _9 === void 0 ? void 0 : _9.tlive) === 'number' ? root.match.tlive : null)) !== null && _10 !== void 0 ? _10 : null;
        // Provider-supplied "Kick-off timestamp" (epoch seconds)
        // According to TheSports docs: "Kick-off timestamp" changes in real-time based on match status:
        // - Status FIRST_HALF (2): first half kick-off time
        // - Status SECOND_HALF (4): second half kick-off time
        // This is in score array at index 4, or in root object as live_kickoff_time
        var liveKickoffTimeRaw = null;
        if (Array.isArray(root === null || root === void 0 ? void 0 : root.score) && root.score.length >= 5 && typeof root.score[4] === 'number') {
            // Score array index 4 is "Kick-off timestamp" according to TheSports docs
            liveKickoffTimeRaw = root.score[4];
            logger_1.logger.debug("[DetailLive] Extracted kick-off timestamp=".concat(liveKickoffTimeRaw, " from score array format (index 4)"));
        }
        else {
            // Fallback to root object fields
            liveKickoffTimeRaw =
                (_16 = (_14 = (_12 = (_11 = (typeof (root === null || root === void 0 ? void 0 : root.live_kickoff_time) === 'number' ? root.live_kickoff_time : null)) !== null && _11 !== void 0 ? _11 : (typeof (root === null || root === void 0 ? void 0 : root.liveKickoffTime) === 'number' ? root.liveKickoffTime : null)) !== null && _12 !== void 0 ? _12 : (typeof ((_13 = root === null || root === void 0 ? void 0 : root.match) === null || _13 === void 0 ? void 0 : _13.live_kickoff_time) === 'number' ? root.match.live_kickoff_time : null)) !== null && _14 !== void 0 ? _14 : (typeof ((_15 = root === null || root === void 0 ? void 0 : root.match) === null || _15 === void 0 ? void 0 : _15.liveKickoffTime) === 'number' ? root.match.liveKickoffTime : null)) !== null && _16 !== void 0 ? _16 : null;
        }
        var liveKickoffTime = typeof liveKickoffTimeRaw === 'number' && Number.isFinite(liveKickoffTimeRaw) && liveKickoffTimeRaw > 0
            ? liveKickoffTimeRaw
            : null;
        var updateTime = typeof updateTimeRaw === 'number' && Number.isFinite(updateTimeRaw) && updateTimeRaw > 0
            ? updateTimeRaw
            : null;
        // DEBUG: Log if update_time is missing (critical for provider_update_time tracking)
        if (updateTime === null && matchId) {
            var tliveInfo = (root === null || root === void 0 ? void 0 : root.tlive) !== undefined
                ? "tlive=".concat(JSON.stringify(root.tlive), " (type: ").concat(typeof root.tlive, ")")
                : 'tlive=undefined';
            logger_1.logger.warn("[DetailLive] update_time NOT FOUND for match ".concat(matchId, ". ").concat(tliveInfo, ". Checked fields: tlive, update_time, updateTime, updated_at, match.update_time. Root keys: ").concat(Object.keys(root || {}).join(', ')));
        }
        // Extract minute from provider (WebSocket/detail_live source)
        var minuteRaw = (_22 = (_20 = (_18 = (_17 = (typeof (root === null || root === void 0 ? void 0 : root.minute) === 'number' ? root.minute : null)) !== null && _17 !== void 0 ? _17 : (typeof (root === null || root === void 0 ? void 0 : root.match_minute) === 'number' ? root.match_minute : null)) !== null && _18 !== void 0 ? _18 : (typeof ((_19 = root === null || root === void 0 ? void 0 : root.match) === null || _19 === void 0 ? void 0 : _19.minute) === 'number' ? root.match.minute : null)) !== null && _20 !== void 0 ? _20 : (typeof ((_21 = root === null || root === void 0 ? void 0 : root.match) === null || _21 === void 0 ? void 0 : _21.match_minute) === 'number' ? root.match.match_minute : null)) !== null && _22 !== void 0 ? _22 : null;
        var minute = typeof minuteRaw === 'number' && Number.isFinite(minuteRaw) && !isNaN(minuteRaw) && minuteRaw >= 0
            ? minuteRaw
            : null;
        return { statusId: statusId, homeScoreDisplay: homeScoreDisplay, awayScoreDisplay: awayScoreDisplay, incidents: incidents, statistics: statistics, liveKickoffTime: liveKickoffTime, updateTime: updateTime, minute: minute };
    };
    /**
     * Calculate minute from kickoff timestamps (fallback when provider doesn't supply minute)
     * Uses same logic as MatchMinuteService.calculateMinute()
     */
    MatchDetailLiveService.prototype.calculateMinuteFromKickoffs = function (statusId, firstHalfKickoffTs, secondHalfKickoffTs, overtimeKickoffTs, existingMinute, nowTs) {
        if (statusId === null)
            return null;
        // Status 2 (FIRST_HALF)
        if (statusId === 2) {
            if (firstHalfKickoffTs === null)
                return null;
            var calculated = Math.floor((nowTs - firstHalfKickoffTs) / 60) + 1;
            return Math.min(calculated, 45); // Clamp max 45
        }
        // Status 3 (HALF_TIME) - frozen at 45
        if (statusId === 3) {
            return 45; // Always 45, never NULL
        }
        // Status 4 (SECOND_HALF)
        if (statusId === 4) {
            if (secondHalfKickoffTs === null) {
                // CRITICAL FIX: If second_half_kickoff_ts is NULL but first_half_kickoff_ts exists,
                // estimate second half start time (typically 15 minutes after first half ends)
                // First half = 45 minutes, half-time break = 15 minutes, so second half starts ~60 minutes after first half kickoff
                if (firstHalfKickoffTs !== null) {
                    var estimatedSecondHalfStart = firstHalfKickoffTs + (45 * 60) + (15 * 60); // 45 min first half + 15 min break
                    var calculated_1 = 45 + Math.floor((nowTs - estimatedSecondHalfStart) / 60) + 1;
                    return Math.max(calculated_1, 46); // Clamp min 46
                }
                return null;
            }
            var calculated = 45 + Math.floor((nowTs - secondHalfKickoffTs) / 60) + 1;
            return Math.max(calculated, 46); // Clamp min 46
        }
        // Status 5 (OVERTIME)
        if (statusId === 5) {
            if (overtimeKickoffTs === null)
                return null;
            return 90 + Math.floor((nowTs - overtimeKickoffTs) / 60) + 1;
        }
        // Status 7 (PENALTY) - retain existing minute
        if (statusId === 7) {
            return existingMinute; // Retain last computed value, never NULL if exists
        }
        // Status 8 (END), 9 (DELAY), 10 (INTERRUPT) - retain existing minute
        if (statusId === 8 || statusId === 9 || statusId === 10) {
            return existingMinute; // Retain last computed value, never NULL if exists
        }
        // Unknown status or status 1 (NOT_STARTED) - return null
        return null;
    };
    /**
     * Detect schema capabilities once per process to keep reconcile fast.
     */
    MatchDetailLiveService.prototype.ensureReconcileSchema = function (client) {
        return __awaiter(this, void 0, void 0, function () {
            var res, cols;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (this.reconcileSchemaChecked)
                            return [2 /*return*/];
                        return [4 /*yield*/, client.query("\n      SELECT column_name\n      FROM information_schema.columns\n      WHERE table_name = 'ts_matches'\n        AND column_name IN (\n          'incidents',\n          'statistics',\n          'home_score_regular',\n          'away_score_regular',\n          'home_score_display',\n          'away_score_display',\n          'live_kickoff_time',\n          'minute',\n          'match_minute'\n        )\n    ")];
                    case 1:
                        res = _b.sent();
                        cols = new Set(res.rows.map(function (r) { return r.column_name; }));
                        this.hasIncidentsColumn = cols.has('incidents');
                        this.hasStatisticsColumn = cols.has('statistics');
                        // "New score columns" are considered present if regular score columns exist.
                        this.hasNewScoreColumns = cols.has('home_score_regular') && cols.has('away_score_regular');
                        this.hasLiveKickoffTimeColumn = cols.has('live_kickoff_time');
                        // Some schemas store live minute as `minute` or `match_minute` (we clear it during HT/FT reconciles)
                        this.minuteColumnName = cols.has('minute')
                            ? 'minute'
                            : cols.has('match_minute')
                                ? 'match_minute'
                                : null;
                        this.reconcileSchemaChecked = true;
                        logger_1.logger.info("\uD83D\uDCD0 [DetailLive] Reconcile schema: incidents=".concat(this.hasIncidentsColumn, ", statistics=").concat(this.hasStatisticsColumn, ", newScoreColumns=").concat(this.hasNewScoreColumns, ", liveKickoff=").concat(this.hasLiveKickoffTimeColumn, ", minuteCol=").concat((_a = this.minuteColumnName) !== null && _a !== void 0 ? _a : 'none'));
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Reconcile LIVE state into DB (authoritative fallback when WS misses transitions like HT/FT).
     * IMPORTANT:
     * - external_id is TheSports match id (string)
     * - match_time must remain immutable (fixture time) and is NOT touched here
     * - live_kickoff_time is only persisted if the provider explicitly supplies a kickoff epoch (we never derive it)
     */
    MatchDetailLiveService.prototype.reconcileMatchToDatabase = function (match_id_1) {
        return __awaiter(this, arguments, void 0, function (match_id, providerUpdateTimeOverride) {
            var t0, resp, live, results, foundMatch, providerStatus, ingestionTs, incomingProviderUpdateTime, client, minuteColumn, existingResult, results_1, apiMatch, homeTeamId, awayTeamId, competitionId, matchTime_1, statusId, detailResp, detailMatch, fetchErr_1, diaryHomeScore, diaryAwayScore, today, diaryResp, diaryResults, diaryMatch, diaryErr_1, finalHomeScore, finalAwayScore, insertRes, err_1, existing, existingStatusId, matchTime, nowTs, results_2, minTimeForEnd, updateResult, existingProviderTime, existingEventTime, MAX_VALID_TS, MIN_VALID_TS, isStatusTransition, LIVE_STATUSES, isCriticalTransition, validExistingProviderTime, transitionType, providerTimeToWrite, setParts, values, i, hasLiveData, kickoffTimeToUse, firstHalfKickoffToUse, secondHalfKickoffToUse, overtimeKickoffToUse, finalKickoffTime, source, existingMatchTimeResult, matchTime_2, secondHalfKickoffValue, source, effectiveFirstHalfKickoff, isHalfTime, isFinished, calculatedMinute, incidentOrchestrator, incErr_1, query, res, affected, duration, updatedRowResult, providerUpdateTime;
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
            if (providerUpdateTimeOverride === void 0) { providerUpdateTimeOverride = null; }
            return __generator(this, function (_m) {
                switch (_m.label) {
                    case 0:
                        t0 = Date.now();
                        (0, obsLogger_1.logEvent)('info', 'detail_live.reconcile.start', {
                            match_id: match_id,
                            provider_update_time: providerUpdateTimeOverride !== null ? providerUpdateTimeOverride : undefined,
                        });
                        return [4 /*yield*/, this.getMatchDetailLive({ match_id: match_id }, { forceRefresh: true })];
                    case 1:
                        resp = _m.sent();
                        live = this.extractLiveFields(resp, match_id);
                        results = resp.results || resp.result_list;
                        if (results && Array.isArray(results)) {
                            foundMatch = results.find(function (m) {
                                return String((m === null || m === void 0 ? void 0 : m.id) || (m === null || m === void 0 ? void 0 : m.match_id)) === String(match_id);
                            });
                            if (foundMatch) {
                                providerStatus = Array.isArray(foundMatch.score) ? foundMatch.score[1] : foundMatch.status_id;
                                if (providerStatus === 8 && live.statusId !== 8) {
                                    logger_1.logger.warn("[DetailLive] CRITICAL: Provider says END (8) for ".concat(match_id, " but extractLiveFields returned statusId=").concat(live.statusId, ". ") +
                                        "Forcing status extraction from score array.");
                                    // Force extract status from score array if available
                                    if (Array.isArray(foundMatch.score) && foundMatch.score.length >= 2) {
                                        live.statusId = foundMatch.score[1];
                                        live.homeScoreDisplay = Array.isArray(foundMatch.score[2]) ? foundMatch.score[2][0] : live.homeScoreDisplay;
                                        live.awayScoreDisplay = Array.isArray(foundMatch.score[3]) ? foundMatch.score[3][0] : live.awayScoreDisplay;
                                        logger_1.logger.info("[DetailLive] Fixed extraction: statusId=".concat(live.statusId, ", score=").concat(live.homeScoreDisplay, "-").concat(live.awayScoreDisplay));
                                    }
                                }
                            }
                        }
                        ingestionTs = Math.floor(Date.now() / 1000);
                        incomingProviderUpdateTime = providerUpdateTimeOverride !== null
                            ? providerUpdateTimeOverride
                            : live.updateTime;
                        return [4 /*yield*/, connection_1.pool.connect()];
                    case 2:
                        client = _m.sent();
                        _m.label = 3;
                    case 3:
                        _m.trys.push([3, , 40, 41]);
                        return [4 /*yield*/, this.ensureReconcileSchema(client)];
                    case 4:
                        _m.sent();
                        minuteColumn = this.minuteColumnName || 'minute';
                        return [4 /*yield*/, client.query("SELECT provider_update_time, last_event_ts, status_id, match_time,\n         first_half_kickoff_ts, second_half_kickoff_ts, overtime_kickoff_ts,\n         ".concat(minuteColumn, " as minute\n         FROM ts_matches WHERE external_id = $1"), [match_id])];
                    case 5:
                        existingResult = _m.sent();
                        if (!(existingResult.rows.length === 0)) return [3 /*break*/, 20];
                        results_1 = resp.results || resp.result_list;
                        apiMatch = null;
                        if (results_1 && Array.isArray(results_1)) {
                            apiMatch = results_1.find(function (m) {
                                return String((m === null || m === void 0 ? void 0 : m.id) || (m === null || m === void 0 ? void 0 : m.match_id)) === String(match_id);
                            });
                        }
                        homeTeamId = null;
                        awayTeamId = null;
                        competitionId = null;
                        matchTime_1 = Math.floor(Date.now() / 1000);
                        statusId = live.statusId || 1;
                        if (apiMatch) {
                            // Try to get IDs from various sources
                            homeTeamId = ((_a = apiMatch.home_team) === null || _a === void 0 ? void 0 : _a.id) || apiMatch.home_team_id || null;
                            awayTeamId = ((_b = apiMatch.away_team) === null || _b === void 0 ? void 0 : _b.id) || apiMatch.away_team_id || null;
                            competitionId = ((_c = apiMatch.competition) === null || _c === void 0 ? void 0 : _c.id) || apiMatch.competition_id || null;
                            matchTime_1 = apiMatch.match_time || matchTime_1;
                            statusId = live.statusId || apiMatch.status_id || (Array.isArray(apiMatch.score) ? apiMatch.score[1] : 1);
                        }
                        if (!(!homeTeamId || !awayTeamId || !competitionId)) return [3 /*break*/, 9];
                        logger_1.logger.info("[DetailLive] Match ".concat(match_id, " missing metadata (home=").concat(homeTeamId, ", away=").concat(awayTeamId, ", comp=").concat(competitionId, "). Fetching from /match/detail..."));
                        _m.label = 6;
                    case 6:
                        _m.trys.push([6, 8, , 9]);
                        return [4 /*yield*/, this.getMatchDetail(match_id)];
                    case 7:
                        detailResp = _m.sent();
                        detailMatch = (detailResp === null || detailResp === void 0 ? void 0 : detailResp.results) || detailResp;
                        // Check if we got valid data (not an error response)
                        if (detailMatch && !detailMatch.err) {
                            homeTeamId = homeTeamId || ((_d = detailMatch.home_team) === null || _d === void 0 ? void 0 : _d.id) || detailMatch.home_team_id;
                            awayTeamId = awayTeamId || ((_e = detailMatch.away_team) === null || _e === void 0 ? void 0 : _e.id) || detailMatch.away_team_id;
                            competitionId = competitionId || ((_f = detailMatch.competition) === null || _f === void 0 ? void 0 : _f.id) || detailMatch.competition_id;
                            matchTime_1 = detailMatch.match_time || matchTime_1;
                            logger_1.logger.info("[DetailLive] Got metadata from /match/detail: home=".concat(homeTeamId, ", away=").concat(awayTeamId, ", comp=").concat(competitionId));
                        }
                        return [3 /*break*/, 9];
                    case 8:
                        fetchErr_1 = _m.sent();
                        logger_1.logger.warn("[DetailLive] Failed to fetch /match/detail for ".concat(match_id, ": ").concat(fetchErr_1.message));
                        return [3 /*break*/, 9];
                    case 9:
                        diaryHomeScore = null;
                        diaryAwayScore = null;
                        if (!(!homeTeamId || !awayTeamId)) return [3 /*break*/, 13];
                        logger_1.logger.info("[DetailLive] Match ".concat(match_id, " still missing team IDs after /match/detail. Trying /match/diary..."));
                        _m.label = 10;
                    case 10:
                        _m.trys.push([10, 12, , 13]);
                        today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
                        return [4 /*yield*/, this.client.get('/match/diary', { date: today })];
                    case 11:
                        diaryResp = _m.sent();
                        diaryResults = (diaryResp === null || diaryResp === void 0 ? void 0 : diaryResp.results) || [];
                        diaryMatch = diaryResults.find(function (m) {
                            return String(m === null || m === void 0 ? void 0 : m.id) === String(match_id);
                        });
                        if (diaryMatch) {
                            homeTeamId = homeTeamId || diaryMatch.home_team_id;
                            awayTeamId = awayTeamId || diaryMatch.away_team_id;
                            competitionId = competitionId || diaryMatch.competition_id;
                            matchTime_1 = diaryMatch.match_time || matchTime_1;
                            statusId = diaryMatch.status_id || statusId;
                            // CRITICAL FIX: Extract scores from diary's home_scores/away_scores arrays
                            // Format: [regular, halftime, red_cards, yellow_cards, etc...]
                            if (Array.isArray(diaryMatch.home_scores) && diaryMatch.home_scores.length > 0) {
                                diaryHomeScore = typeof diaryMatch.home_scores[0] === 'number' ? diaryMatch.home_scores[0] : null;
                            }
                            if (Array.isArray(diaryMatch.away_scores) && diaryMatch.away_scores.length > 0) {
                                diaryAwayScore = typeof diaryMatch.away_scores[0] === 'number' ? diaryMatch.away_scores[0] : null;
                            }
                            logger_1.logger.info("[DetailLive] \u2705 Got metadata from /match/diary: home=".concat(homeTeamId, ", away=").concat(awayTeamId, ", comp=").concat(competitionId, ", score=").concat(diaryHomeScore !== null && diaryHomeScore !== void 0 ? diaryHomeScore : '?', "-").concat(diaryAwayScore !== null && diaryAwayScore !== void 0 ? diaryAwayScore : '?', ", status=").concat(statusId));
                        }
                        else {
                            logger_1.logger.warn("[DetailLive] Match ".concat(match_id, " not found in /match/diary for date ").concat(today));
                        }
                        return [3 /*break*/, 13];
                    case 12:
                        diaryErr_1 = _m.sent();
                        logger_1.logger.warn("[DetailLive] Failed to fetch /match/diary: ".concat(diaryErr_1.message));
                        return [3 /*break*/, 13];
                    case 13:
                        if (!(homeTeamId && awayTeamId)) return [3 /*break*/, 18];
                        logger_1.logger.info("[DetailLive] Match ".concat(match_id, " not found in DB. Auto-inserting with home=").concat(homeTeamId, ", away=").concat(awayTeamId, ", comp=").concat(competitionId, "..."));
                        _m.label = 14;
                    case 14:
                        _m.trys.push([14, 16, , 17]);
                        finalHomeScore = (_g = diaryHomeScore !== null && diaryHomeScore !== void 0 ? diaryHomeScore : live.homeScoreDisplay) !== null && _g !== void 0 ? _g : 0;
                        finalAwayScore = (_h = diaryAwayScore !== null && diaryAwayScore !== void 0 ? diaryAwayScore : live.awayScoreDisplay) !== null && _h !== void 0 ? _h : 0;
                        return [4 /*yield*/, client.query("\n               INSERT INTO ts_matches (\n                 external_id, home_team_id, away_team_id, competition_id, \n                 match_time, status_id, \n                 home_score_regular, away_score_regular,\n                 created_at, updated_at\n               ) VALUES (\n                 $1, $2, $3, $4, \n                 $5, $6,\n                 $7, $8,\n                 NOW(), NOW()\n               )\n               ON CONFLICT (external_id) DO UPDATE SET\n                 status_id = EXCLUDED.status_id,\n                 match_time = EXCLUDED.match_time,\n                 home_score_regular = EXCLUDED.home_score_regular,\n                 away_score_regular = EXCLUDED.away_score_regular,\n                 updated_at = NOW()\n               RETURNING external_id\n             ", [
                                match_id,
                                homeTeamId,
                                awayTeamId,
                                competitionId || null, // Competition can be null for obscure leagues
                                matchTime_1,
                                statusId,
                                finalHomeScore,
                                finalAwayScore
                            ])];
                    case 15:
                        insertRes = _m.sent();
                        if (insertRes.rowCount != null && insertRes.rowCount > 0) {
                            logger_1.logger.info("[DetailLive] \u2705 Successfully auto-inserted match ".concat(match_id, " (home=").concat(homeTeamId, ", away=").concat(awayTeamId, ")"));
                            return [2 /*return*/, { updated: true, rowCount: 1, statusId: statusId, score: null, providerUpdateTime: null }];
                        }
                        return [3 /*break*/, 17];
                    case 16:
                        err_1 = _m.sent();
                        // Log detailed error for debugging
                        logger_1.logger.error("[DetailLive] Failed to auto-insert match ".concat(match_id, ": ").concat(err_1.message, ". Home=").concat(homeTeamId, ", Away=").concat(awayTeamId, ", Comp=").concat(competitionId));
                        return [2 /*return*/, { updated: false, rowCount: 0, statusId: live.statusId, score: null, providerUpdateTime: null }];
                    case 17: return [3 /*break*/, 19];
                    case 18:
                        logger_1.logger.warn("[DetailLive] Match ".concat(match_id, " not found in DB, and could not resolve team IDs (home=").concat(homeTeamId, ", away=").concat(awayTeamId, "). Skipping auto-insert."));
                        _m.label = 19;
                    case 19: 
                    // ===== END ENHANCED METADATA RESOLUTION =====
                    return [2 /*return*/, { updated: false, rowCount: 0, statusId: live.statusId, score: null, providerUpdateTime: null }];
                    case 20:
                        existing = existingResult.rows[0];
                        existingStatusId = existing.status_id;
                        matchTime = existing.match_time;
                        nowTs = Math.floor(Date.now() / 1000);
                        if (!(live.statusId === null && live.homeScoreDisplay === null && live.awayScoreDisplay === null)) return [3 /*break*/, 26];
                        results_2 = resp.results || resp.result_list;
                        if (results_2) {
                            logger_1.logger.warn("[DetailLive] Match ".concat(match_id, " not found in detail_live response. ") +
                                "Response structure: results type=".concat(Array.isArray(results_2) ? 'array' : typeof results_2, ", ") +
                                "length=".concat(Array.isArray(results_2) ? results_2.length : 'N/A', ", ") +
                                "keys=".concat(results_2 && typeof results_2 === 'object' ? Object.keys(results_2).join(',') : 'N/A'));
                        }
                        if (!(providerUpdateTimeOverride !== null)) return [3 /*break*/, 21];
                        logger_1.logger.info("[DetailLive] No usable data for ".concat(match_id, " but providerUpdateTimeOverride provided, ") +
                            "performing minimal update (provider_update_time + last_event_ts only)");
                        return [3 /*break*/, 26];
                    case 21:
                        if (!([2, 3, 4, 5, 7].includes(existingStatusId) && matchTime !== null)) return [3 /*break*/, 25];
                        minTimeForEnd = matchTime + (150 * 60);
                        if (!(nowTs >= minTimeForEnd)) return [3 /*break*/, 23];
                        // Match time is old enough (>150 min), safe to transition to END
                        logger_1.logger.info("[DetailLive] Match ".concat(match_id, " not found in provider response and match_time (").concat(matchTime, ") ") +
                            "is ".concat(Math.floor((nowTs - matchTime) / 60), " minutes ago (>150 min). ") +
                            "Transitioning from status ".concat(existingStatusId, " to END (8)."));
                        return [4 /*yield*/, client.query("UPDATE ts_matches \n               SET status_id = 8, updated_at = NOW(), last_event_ts = $1::BIGINT,\n                   ".concat(minuteColumn, " = NULL\n               WHERE external_id = $2 AND status_id IN (2, 3, 4, 5, 7)"), [nowTs, match_id])];
                    case 22:
                        updateResult = _m.sent();
                        if (updateResult.rowCount && updateResult.rowCount > 0) {
                            (0, obsLogger_1.logEvent)('info', 'detail_live.reconcile.done', {
                                match_id: match_id,
                                duration_ms: Date.now() - t0,
                                rowCount: updateResult.rowCount,
                                status_id: 8,
                                reason: 'finished_not_in_provider_response',
                            });
                            return [2 /*return*/, { updated: true, rowCount: updateResult.rowCount, statusId: 8, score: null, providerUpdateTime: null }];
                        }
                        return [3 /*break*/, 24];
                    case 23:
                        // Match time is not old enough, don't transition to END yet
                        logger_1.logger.info("[DetailLive] Match ".concat(match_id, " not found in provider response but match_time (").concat(matchTime, ") ") +
                            "is only ".concat(Math.floor((nowTs - matchTime) / 60), " minutes ago (<150 min). ") +
                            "Not transitioning to END yet. Will retry later.");
                        (0, obsLogger_1.logEvent)('warn', 'detail_live.reconcile.no_data', {
                            match_id: match_id,
                            reason: 'match not found in response array - too recent to mark as finished',
                            existing_status: existingStatusId,
                            minutes_since_match_time: Math.floor((nowTs - matchTime) / 60),
                        });
                        return [2 /*return*/, { updated: false, rowCount: 0, statusId: null, score: null, providerUpdateTime: null }];
                    case 24: return [3 /*break*/, 26];
                    case 25:
                        // Match is not LIVE or match_time is null - cannot transition to END
                        (0, obsLogger_1.logEvent)('warn', 'detail_live.reconcile.no_data', {
                            match_id: match_id,
                            reason: 'match not found in response array',
                            existing_status: existingStatusId,
                        });
                        return [2 /*return*/, { updated: false, rowCount: 0, statusId: null, score: null, providerUpdateTime: null }];
                    case 26:
                        existingProviderTime = existing.provider_update_time !== null ? Number(existing.provider_update_time) : null;
                        existingEventTime = existing.last_event_ts !== null ? Number(existing.last_event_ts) : null;
                        MAX_VALID_TS = ingestionTs + (24 * 60 * 60);
                        MIN_VALID_TS = 1700000000;
                        if (existingEventTime !== null && (existingEventTime > MAX_VALID_TS || existingEventTime < MIN_VALID_TS)) {
                            logger_1.logger.warn("[DetailLive] CORRUPTED last_event_ts detected for ".concat(match_id, ": ").concat(existingEventTime, " ") +
                                "(valid range: ".concat(MIN_VALID_TS, " - ").concat(MAX_VALID_TS, "). Treating as NULL."));
                            existingEventTime = null;
                        }
                        if (existingProviderTime !== null && (existingProviderTime > MAX_VALID_TS || existingProviderTime < MIN_VALID_TS)) {
                            logger_1.logger.warn("[DetailLive] CORRUPTED provider_update_time detected for ".concat(match_id, ": ").concat(existingProviderTime, " ") +
                                "(valid range: ".concat(MIN_VALID_TS, " - ").concat(MAX_VALID_TS, "). Ignoring for freshness check."));
                        }
                        isStatusTransition = live.statusId !== null && live.statusId !== existingStatusId;
                        LIVE_STATUSES = [2, 3, 4, 5, 7];
                        isCriticalTransition = 
                        // NOT_STARTED → ANY LIVE STATUS (handles missed transitions)
                        (existingStatusId === 1 && LIVE_STATUSES.includes(live.statusId)) ||
                            // Standard forward transitions
                            (existingStatusId === 2 && live.statusId === 3) || // FIRST_HALF → HALF_TIME
                            (existingStatusId === 3 && live.statusId === 4) || // HALF_TIME → SECOND_HALF
                            (existingStatusId === 4 && live.statusId === 5) || // SECOND_HALF → OVERTIME
                            (existingStatusId === 5 && live.statusId === 7) || // OVERTIME → PENALTY
                            // Any LIVE → END (final transition)
                            (LIVE_STATUSES.includes(existingStatusId) && live.statusId === 8) ||
                            // NOT_STARTED → END (match finished without us seeing it live)
                            (existingStatusId === 1 && live.statusId === 8);
                        // Check freshness (idempotent guard) - but allow critical status transitions
                        if (!isCriticalTransition) {
                            if (incomingProviderUpdateTime !== null && incomingProviderUpdateTime !== undefined) {
                                validExistingProviderTime = (existingProviderTime !== null &&
                                    existingProviderTime >= MIN_VALID_TS && existingProviderTime <= MAX_VALID_TS)
                                    ? existingProviderTime : null;
                                if (validExistingProviderTime !== null && incomingProviderUpdateTime <= validExistingProviderTime) {
                                    logger_1.logger.debug("Skipping stale update for ".concat(match_id, " (provider time: ").concat(incomingProviderUpdateTime, " <= ").concat(validExistingProviderTime, ")"));
                                    return [2 /*return*/, { updated: false, rowCount: 0, statusId: live.statusId, score: null, providerUpdateTime: null }];
                                }
                            }
                            else {
                                // No provider update_time, use event time comparison (existingEventTime already validated above)
                                if (existingEventTime !== null && ingestionTs <= existingEventTime + 5) {
                                    logger_1.logger.debug("Skipping stale update for ".concat(match_id, " (event time: ").concat(ingestionTs, " <= ").concat(existingEventTime + 5, ")"));
                                    return [2 /*return*/, { updated: false, rowCount: 0, statusId: live.statusId, score: null, providerUpdateTime: null }];
                                }
                            }
                        }
                        else {
                            transitionType = existingStatusId === 1 ? 'MATCH_START' :
                                live.statusId === 8 ? 'MATCH_END' : 'STATUS_CHANGE';
                            logger_1.logger.info("[DetailLive] \u26A1 CRITICAL TRANSITION (".concat(transitionType, ") for ").concat(match_id, ": ") +
                                "status ".concat(existingStatusId, " \u2192 ").concat(live.statusId, ", score ").concat(live.homeScoreDisplay, "-").concat(live.awayScoreDisplay, ". ") +
                                "Bypassing timestamp check (existingEventTime=".concat(existingEventTime, ", existingProviderTime=").concat(existingProviderTime, ")."));
                            // CRITICAL: Save first half stats when transitioning to HALF_TIME
                            if (existingStatusId === 2 && live.statusId === 3) {
                                logger_1.logger.info("[DetailLive] \u26BD HALF_TIME TRANSITION! Saving first half stats for ".concat(match_id));
                                this.saveFirstHalfStatsOnHalftime(match_id).catch(function (err) {
                                    logger_1.logger.error("[DetailLive] Failed to save first half stats for ".concat(match_id, ":"), err);
                                });
                            }
                        }
                        providerTimeToWrite = incomingProviderUpdateTime !== null && incomingProviderUpdateTime !== undefined
                            ? Math.max(existingProviderTime || 0, incomingProviderUpdateTime)
                            : null;
                        setParts = [
                            'updated_at = NOW()',
                            "provider_update_time = CASE \n          WHEN $1::BIGINT IS NOT NULL THEN GREATEST(COALESCE(provider_update_time, 0)::BIGINT, $1::BIGINT)\n          ELSE provider_update_time\n        END",
                            "last_event_ts = $2::BIGINT",
                        ];
                        values = [providerTimeToWrite, ingestionTs];
                        i = 3;
                        hasLiveData = live.statusId !== null || live.homeScoreDisplay !== null || live.awayScoreDisplay !== null;
                        // Status update (only if we have live data)
                        if (hasLiveData && live.statusId !== null) {
                            setParts.push("status_id = $".concat(i++));
                            values.push(live.statusId);
                        }
                        kickoffTimeToUse = live.liveKickoffTime !== null ? live.liveKickoffTime : ingestionTs;
                        firstHalfKickoffToUse = existing.first_half_kickoff_ts;
                        secondHalfKickoffToUse = existing.second_half_kickoff_ts;
                        overtimeKickoffToUse = existing.overtime_kickoff_ts;
                        if (!(hasLiveData && live.statusId !== null)) return [3 /*break*/, 33];
                        if (!((live.statusId === 2 || live.statusId === 3 || live.statusId === 4 || live.statusId === 5 || live.statusId === 7) && existing.first_half_kickoff_ts === null)) return [3 /*break*/, 31];
                        finalKickoffTime = void 0;
                        source = void 0;
                        if (!(live.liveKickoffTime !== null)) return [3 /*break*/, 27];
                        finalKickoffTime = live.liveKickoffTime;
                        source = 'liveKickoff';
                        return [3 /*break*/, 30];
                    case 27:
                        if (!(live.statusId === 2)) return [3 /*break*/, 28];
                        // Match is currently in FIRST_HALF - use ingestionTs (current time) as best estimate
                        // This ensures minute calculation works even if provider doesn't send kickoff time
                        finalKickoffTime = ingestionTs;
                        source = 'ingestionTs_live';
                        return [3 /*break*/, 30];
                    case 28: return [4 /*yield*/, client.query("SELECT match_time FROM ts_matches WHERE external_id = $1", [match_id])];
                    case 29:
                        existingMatchTimeResult = _m.sent();
                        matchTime_2 = ((_j = existingMatchTimeResult.rows[0]) === null || _j === void 0 ? void 0 : _j.match_time) || ingestionTs;
                        finalKickoffTime = matchTime_2;
                        source = 'match_time_fallback';
                        _m.label = 30;
                    case 30:
                        setParts.push("first_half_kickoff_ts = $".concat(i++));
                        values.push(finalKickoffTime);
                        firstHalfKickoffToUse = finalKickoffTime; // Track the new value for minute calculation
                        logger_1.logger.info("[KickoffTS] set first_half_kickoff_ts=".concat(finalKickoffTime, " match_id=").concat(match_id, " source=").concat(source, " status=").concat(live.statusId));
                        return [3 /*break*/, 32];
                    case 31:
                        if (live.statusId === 2 && (existingStatusId === null || existingStatusId === 1)) {
                            // Original transition logic (for logging)
                            if (existing.first_half_kickoff_ts === null) {
                                // Already handled above, but keep for backward compatibility
                                logger_1.logger.debug("[KickoffTS] skip (already set) first_half_kickoff_ts match_id=".concat(match_id));
                            }
                        }
                        _m.label = 32;
                    case 32:
                        // Status 4 (SECOND_HALF): ALWAYS set second_half_kickoff_ts from provider
                        // CRITICAL: TheSports API sends NEW kickoff timestamp for second half in score[4]
                        // This value is DIFFERENT from first half - it's the actual second half start time
                        // We MUST update it every time for accurate minute calculation
                        if (hasLiveData && live.statusId === 4 && live.liveKickoffTime !== null) {
                            // Provider sent second half kickoff time - use it
                            setParts.push("second_half_kickoff_ts = $".concat(i++));
                            values.push(live.liveKickoffTime);
                            secondHalfKickoffToUse = live.liveKickoffTime;
                            logger_1.logger.info("[KickoffTS] set second_half_kickoff_ts=".concat(live.liveKickoffTime, " match_id=").concat(match_id, " source=provider_score_array status=").concat(live.statusId));
                        }
                        else if (live.statusId === 4 && existing.second_half_kickoff_ts === null) {
                            secondHalfKickoffValue = kickoffTimeToUse;
                            if (existing.first_half_kickoff_ts !== null) {
                                // Estimate: first half kickoff + 60 minutes (45 min first half + 15 min break)
                                secondHalfKickoffValue = existing.first_half_kickoff_ts + (60 * 60);
                                logger_1.logger.info("[KickoffTS] Estimating second_half_kickoff_ts=".concat(secondHalfKickoffValue, " from first_half_kickoff_ts=").concat(existing.first_half_kickoff_ts, " for match_id=").concat(match_id));
                            }
                            setParts.push("second_half_kickoff_ts = $".concat(i++));
                            values.push(secondHalfKickoffValue);
                            secondHalfKickoffToUse = secondHalfKickoffValue;
                            logger_1.logger.info("[KickoffTS] set second_half_kickoff_ts=".concat(secondHalfKickoffValue, " match_id=").concat(match_id, " source=estimated existing_status=").concat(existingStatusId));
                        }
                        // Status 5 (OVERTIME): Set overtime_kickoff_ts if NULL
                        // CRITICAL FIX: Don't check existingStatusId - provider says OVERTIME, set it
                        // If we missed SECOND_HALF transition, we still need to set overtime_kickoff_ts
                        if (live.statusId === 5 && existing.overtime_kickoff_ts === null) {
                            setParts.push("overtime_kickoff_ts = $".concat(i++));
                            values.push(kickoffTimeToUse);
                            overtimeKickoffToUse = kickoffTimeToUse; // Track the new value
                            source = live.liveKickoffTime !== null ? 'liveKickoff' : 'now';
                            logger_1.logger.info("[KickoffTS] set overtime_kickoff_ts=".concat(kickoffTimeToUse, " match_id=").concat(match_id, " source=").concat(source, " existing_status=").concat(existingStatusId));
                        }
                        else if (live.statusId === 5 && existing.overtime_kickoff_ts !== null) {
                            logger_1.logger.debug("[KickoffTS] skip (already set) overtime_kickoff_ts match_id=".concat(match_id));
                        }
                        _m.label = 33;
                    case 33:
                        // Persist provider-supplied live kickoff time once (never overwrite) - legacy column
                        if (this.hasLiveKickoffTimeColumn && live.liveKickoffTime !== null) {
                            setParts.push("live_kickoff_time = COALESCE(live_kickoff_time, $".concat(i++, ")"));
                            values.push(live.liveKickoffTime);
                        }
                        // CRITICAL FIX: Update minute from provider if available (provider-authoritative)
                        // Provider's minute value takes precedence over calculated minute
                        // If provider doesn't supply minute, calculate from kickoff timestamps (fallback)
                        if (this.minuteColumnName) {
                            if (live.minute !== null) {
                                // Provider says minute = X, use it (even during HT if provider says so)
                                setParts.push("".concat(this.minuteColumnName, " = $").concat(i++));
                                values.push(live.minute);
                                logger_1.logger.debug("[DetailLive] Setting minute=".concat(live.minute, " from provider for match_id=").concat(match_id));
                            }
                            else {
                                effectiveFirstHalfKickoff = firstHalfKickoffToUse;
                                if (effectiveFirstHalfKickoff === null && live.statusId === 2) {
                                    // Match is in FIRST_HALF but first_half_kickoff_ts is NULL - use ingestionTs as best estimate
                                    effectiveFirstHalfKickoff = ingestionTs;
                                    logger_1.logger.warn("[DetailLive] first_half_kickoff_ts is NULL for status 2 match ".concat(match_id, ", using ingestionTs=").concat(ingestionTs, " for minute calculation"));
                                }
                                isHalfTime = live.statusId === 3;
                                isFinished = live.statusId === 8 || live.statusId === 9;
                                if (isHalfTime || isFinished) {
                                    // Force minute=NULL for terminal states to prevent ghost minutes
                                    setParts.push("".concat(this.minuteColumnName, " = NULL"));
                                    logger_1.logger.info("[DetailLive] Terminal status ".concat(live.statusId, " detected for match_id=").concat(match_id, ". Forcing minute=NULL"));
                                }
                                else {
                                    calculatedMinute = this.calculateMinuteFromKickoffs(live.statusId, effectiveFirstHalfKickoff, // Use new value if we just set it, otherwise existing, or ingestionTs fallback
                                    secondHalfKickoffToUse, // Use new value if we just set it, otherwise existing
                                    overtimeKickoffToUse, // Use new value if we just set it, otherwise existing
                                    existing.minute, ingestionTs);
                                    if (calculatedMinute !== null) {
                                        setParts.push("".concat(this.minuteColumnName, " = $").concat(i++));
                                        values.push(calculatedMinute);
                                        logger_1.logger.info("[DetailLive] Setting calculated minute=".concat(calculatedMinute, " from kickoff_ts for match_id=").concat(match_id, " status=").concat(live.statusId, " (first_half_ts=").concat(effectiveFirstHalfKickoff, ", second_half_ts=").concat(secondHalfKickoffToUse, ")"));
                                    }
                                    else {
                                        // CRITICAL: If we can't calculate minute but match is live, log warning
                                        logger_1.logger.warn("[DetailLive] Cannot calculate minute for match_id=".concat(match_id, " status=").concat(live.statusId, " - kickoff timestamps missing (first_half=").concat(effectiveFirstHalfKickoff, ", second_half=").concat(secondHalfKickoffToUse, ")"));
                                    }
                                }
                            }
                        }
                        // Canonical score update (independent of status)
                        if (this.hasNewScoreColumns) {
                            if (live.homeScoreDisplay !== null) {
                                setParts.push("home_score_regular = $".concat(i++));
                                values.push(live.homeScoreDisplay);
                                setParts.push("home_score_display = $".concat(i++));
                                values.push(live.homeScoreDisplay);
                            }
                            if (live.awayScoreDisplay !== null) {
                                setParts.push("away_score_regular = $".concat(i++));
                                values.push(live.awayScoreDisplay);
                                setParts.push("away_score_display = $".concat(i++));
                                values.push(live.awayScoreDisplay);
                            }
                        }
                        // CRITICAL FIX: Update only index 0 of home_scores/away_scores, preserve other indices
                        // home_scores format: [current, ht, ot, penalty, corner, ...]
                        // We should only update index 0 (current score), not overwrite entire array
                        if (live.homeScoreDisplay !== null) {
                            // Use jsonb_set to update only index 0, preserving other values (HT, OT, etc.)
                            setParts.push("home_scores = jsonb_set(COALESCE(home_scores, '[0,0,0,0,0,0,0]'::jsonb), '{0}', $".concat(i++, "::jsonb)"));
                            values.push(JSON.stringify(live.homeScoreDisplay));
                        }
                        // CRITICAL FIX: Same for away_scores
                        if (live.awayScoreDisplay !== null) {
                            setParts.push("away_scores = jsonb_set(COALESCE(away_scores, '[0,0,0,0,0,0,0]'::jsonb), '{0}', $".concat(i++, "::jsonb)"));
                            values.push(JSON.stringify(live.awayScoreDisplay));
                        }
                        if (!(this.hasIncidentsColumn && live.incidents !== null)) return [3 /*break*/, 37];
                        setParts.push("incidents = $".concat(i++, "::jsonb"));
                        values.push(JSON.stringify(live.incidents));
                        _m.label = 34;
                    case 34:
                        _m.trys.push([34, 36, , 37]);
                        incidentOrchestrator = IncidentOrchestrator_1.IncidentOrchestrator.getInstance();
                        return [4 /*yield*/, incidentOrchestrator.processIncidents(match_id, live.incidents, 'detail_live')];
                    case 35:
                        _m.sent();
                        return [3 /*break*/, 37];
                    case 36:
                        incErr_1 = _m.sent();
                        logger_1.logger.warn("[DetailLive] IncidentOrchestrator failed for ".concat(match_id, ":"), incErr_1);
                        return [3 /*break*/, 37];
                    case 37:
                        if (this.hasStatisticsColumn && live.statistics !== null) {
                            setParts.push("statistics = $".concat(i++, "::jsonb"));
                            values.push(JSON.stringify(live.statistics));
                        }
                        // Nothing to update besides updated_at
                        if (setParts.length === 1) {
                            return [2 /*return*/, { updated: false, rowCount: 0, statusId: live.statusId, score: null, providerUpdateTime: null }];
                        }
                        query = "\n        UPDATE ts_matches\n        SET ".concat(setParts.join(', '), "\n        WHERE external_id = $").concat(i, "\n      ");
                        values.push(String(match_id));
                        return [4 /*yield*/, client.query(query, values)];
                    case 38:
                        res = _m.sent();
                        affected = (_k = res.rowCount) !== null && _k !== void 0 ? _k : 0;
                        if (affected === 0) {
                            logger_1.logger.warn("\u26A0\uFE0F [DetailLive] UPDATE affected 0 rows: matchId=".concat(match_id, ", ") +
                                "status=".concat(live.statusId, ", score=").concat(live.homeScoreDisplay, "-").concat(live.awayScoreDisplay, ". ") +
                                "Match not found in DB or external_id mismatch.");
                            return [2 /*return*/, {
                                    updated: false,
                                    rowCount: 0,
                                    statusId: live.statusId,
                                    score: live.homeScoreDisplay !== null && live.awayScoreDisplay !== null
                                        ? "".concat(live.homeScoreDisplay, "-").concat(live.awayScoreDisplay)
                                        : null,
                                }];
                        }
                        duration = Date.now() - t0;
                        (0, obsLogger_1.logEvent)('info', 'detail_live.reconcile.done', {
                            match_id: match_id,
                            duration_ms: duration,
                            rowCount: affected,
                            status_id: live.statusId,
                        });
                        return [4 /*yield*/, client.query('SELECT provider_update_time FROM ts_matches WHERE external_id = $1', [match_id])];
                    case 39:
                        updatedRowResult = _m.sent();
                        providerUpdateTime = ((_l = updatedRowResult.rows[0]) === null || _l === void 0 ? void 0 : _l.provider_update_time)
                            ? Number(updatedRowResult.rows[0].provider_update_time)
                            : null;
                        return [2 /*return*/, {
                                updated: true,
                                rowCount: affected,
                                statusId: live.statusId,
                                score: live.homeScoreDisplay !== null && live.awayScoreDisplay !== null
                                    ? "".concat(live.homeScoreDisplay, "-").concat(live.awayScoreDisplay)
                                    : null,
                                providerUpdateTime: providerUpdateTime, // Phase 5-S: For watchdog proof logs
                            }];
                    case 40:
                        client.release();
                        return [7 /*endfinally*/];
                    case 41: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Save first half stats when match transitions to HALF_TIME
     * This is called automatically by the DataUpdateWorker when a match reaches halftime
     */
    MatchDetailLiveService.prototype.saveFirstHalfStatsOnHalftime = function (matchId) {
        return __awaiter(this, void 0, void 0, function () {
            var CombinedStatsService, combinedStatsService, hasStats, result, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 7, , 8]);
                        return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('./combinedStats.service')); })];
                    case 1:
                        CombinedStatsService = (_a.sent()).CombinedStatsService;
                        combinedStatsService = new CombinedStatsService();
                        return [4 /*yield*/, combinedStatsService.hasFirstHalfStats(matchId)];
                    case 2:
                        hasStats = _a.sent();
                        if (hasStats) {
                            logger_1.logger.debug("[DetailLive] First half stats already saved for ".concat(matchId, ", skipping"));
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, combinedStatsService.getCombinedMatchStats(matchId)];
                    case 3:
                        result = _a.sent();
                        if (!(result && result.allStats && result.allStats.length > 0)) return [3 /*break*/, 5];
                        return [4 /*yield*/, combinedStatsService.saveFirstHalfStats(matchId, result.allStats)];
                    case 4:
                        _a.sent();
                        logger_1.logger.info("[DetailLive] \u2705 Saved first half stats for ".concat(matchId, " (").concat(result.allStats.length, " stats)"));
                        return [3 /*break*/, 6];
                    case 5:
                        logger_1.logger.warn("[DetailLive] No stats available to save for ".concat(matchId, " at halftime"));
                        _a.label = 6;
                    case 6: return [3 /*break*/, 8];
                    case 7:
                        error_2 = _a.sent();
                        logger_1.logger.error("[DetailLive] Error saving first half stats for ".concat(matchId, ":"), error_2);
                        return [3 /*break*/, 8];
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    return MatchDetailLiveService;
}());
exports.MatchDetailLiveService = MatchDetailLiveService;
