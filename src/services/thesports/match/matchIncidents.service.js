"use strict";
/**
 * Match Incidents Service
 *
 * Optimized service for fetching match incidents (goals, cards, substitutions).
 *
 * Strategy:
 * 1. Database-first (FAST - ~50ms)
 * 2. Check staleness (30s for live, 5min for finished)
 * 3. Fallback to TheSports API if stale (with 5s timeout)
 * 4. Graceful error handling (never crash, return empty array)
 *
 * Performance: 10,000ms → 300ms (97% faster than old getMatchDetailLive)
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
exports.matchIncidentsService = exports.MatchIncidentsService = void 0;
var connection_1 = require("../../../database/connection");
var TheSportsAPIManager_1 = require("../../../core/TheSportsAPIManager");
var logger_1 = require("../../../utils/logger");
var IncidentOrchestrator_1 = require("../../orchestration/IncidentOrchestrator");
// PERF FIX Phase 1: Reduced timeout from 5s to 2s (fail fast)
// We prefer quick empty response over slow full response
var INCIDENTS_API_TIMEOUT_MS = 2000;
// Timeout wrapper for API calls
function withTimeout(promise, timeoutMs, fallback) {
    return __awaiter(this, void 0, void 0, function () {
        var timeoutPromise, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    timeoutPromise = new Promise(function (_, reject) {
                        setTimeout(function () { return reject(new Error("API timeout after ".concat(timeoutMs, "ms"))); }, timeoutMs);
                    });
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, Promise.race([promise, timeoutPromise])];
                case 2: return [2 /*return*/, _a.sent()];
                case 3:
                    error_1 = _a.sent();
                    logger_1.logger.warn("[MatchIncidents] API call timed out, returning fallback");
                    return [2 /*return*/, fallback];
                case 4: return [2 /*return*/];
            }
        });
    });
}
var MatchIncidentsService = /** @class */ (function () {
    function MatchIncidentsService() {
    }
    /**
     * Get incidents for a specific match
     *
     * @param matchId - TheSports match ID
     * @returns Object with incidents array
     */
    MatchIncidentsService.prototype.getMatchIncidents = function (matchId) {
        return __awaiter(this, void 0, void 0, function () {
            var incidentOrchestrator, normalizedIncidents, dbResult, apiData, incidents_1, apiError_1, match, incidents, updatedAt, isLive, staleness, maxStalenessMs, apiData, freshIncidents, apiError_2, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 11, , 12]);
                        incidentOrchestrator = IncidentOrchestrator_1.IncidentOrchestrator.getInstance();
                        return [4 /*yield*/, incidentOrchestrator.getMatchIncidents(matchId)];
                    case 1:
                        normalizedIncidents = _a.sent();
                        if (normalizedIncidents.length > 0) {
                            logger_1.logger.debug("[MatchIncidents] \u2713 Found ".concat(normalizedIncidents.length, " incidents in ts_incidents table for ").concat(matchId));
                            return [2 /*return*/, { incidents: normalizedIncidents }];
                        }
                        return [4 /*yield*/, connection_1.pool.query("SELECT\n           incidents,\n           updated_at,\n           status_id\n         FROM ts_matches\n         WHERE external_id = $1", [matchId])];
                    case 2:
                        dbResult = _a.sent();
                        if (!(dbResult.rows.length === 0)) return [3 /*break*/, 6];
                        logger_1.logger.warn("[MatchIncidents] Match ".concat(matchId, " not found in database, fetching from API"));
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, withTimeout(TheSportsAPIManager_1.theSportsAPI.get('/match/detail_live', { match_id: matchId }), INCIDENTS_API_TIMEOUT_MS, null)];
                    case 4:
                        apiData = _a.sent();
                        if (!apiData) {
                            logger_1.logger.warn("[MatchIncidents] API timeout for ".concat(matchId, ", returning empty"));
                            return [2 /*return*/, { incidents: [] }];
                        }
                        incidents_1 = Array.isArray(apiData === null || apiData === void 0 ? void 0 : apiData.results) ? apiData.results : [];
                        if (incidents_1.length > 0) {
                            logger_1.logger.info("[MatchIncidents] \u2713 Fetched ".concat(incidents_1.length, " incidents from API for ").concat(matchId));
                            return [2 /*return*/, { incidents: incidents_1 }];
                        }
                        logger_1.logger.warn("[MatchIncidents] API returned no incidents for ".concat(matchId));
                        return [2 /*return*/, { incidents: [] }];
                    case 5:
                        apiError_1 = _a.sent();
                        logger_1.logger.error("[MatchIncidents] API error for ".concat(matchId, ":"), apiError_1);
                        return [2 /*return*/, { incidents: [] }]; // Graceful fallback - never crash
                    case 6:
                        match = dbResult.rows[0];
                        incidents = match.incidents || [];
                        updatedAt = new Date(match.updated_at);
                        isLive = [2, 3, 4, 5, 7].includes(match.status_id);
                        staleness = Date.now() - updatedAt.getTime();
                        maxStalenessMs = isLive ? 30000 : 300000;
                        // CRITICAL FIX: If incidents is empty, ALWAYS fetch from API
                        // This ensures events are never missing due to empty database cache
                        // PERF FIX Phase 3: Skip API call for NOT_STARTED matches (status_id=1)
                        // - NOT_STARTED matches can't have incidents yet
                        // - This saves ~2s API timeout for matches that haven't started
                        if (incidents.length === 0) {
                            // Skip API call for NOT_STARTED matches - no incidents exist yet
                            if (match.status_id === 1) {
                                logger_1.logger.debug("[MatchIncidents] Skipping API for NOT_STARTED match ".concat(matchId, " (no incidents possible)"));
                                return [2 /*return*/, { incidents: [] }];
                            }
                            logger_1.logger.info("[MatchIncidents] Database incidents empty for ".concat(matchId, ", fetching from API"));
                            // Fall through to STEP 3
                        }
                        else if (staleness < maxStalenessMs) {
                            // Cache is fresh and has data - use it
                            logger_1.logger.debug("[MatchIncidents] \u2713 Using cached incidents for ".concat(matchId, " (age: ").concat(Math.round(staleness / 1000), "s, ").concat(incidents.length, " incidents)"));
                            return [2 /*return*/, { incidents: incidents }];
                        }
                        // ============================================================
                        // STEP 3: FETCH FRESH DATA FROM API (IF STALE OR EMPTY)
                        // ============================================================
                        logger_1.logger.info("[MatchIncidents] Fetching fresh incidents for ".concat(matchId, " (stale: ").concat(Math.round(staleness / 1000), "s, live: ").concat(isLive, ")"));
                        _a.label = 7;
                    case 7:
                        _a.trys.push([7, 9, , 10]);
                        return [4 /*yield*/, withTimeout(TheSportsAPIManager_1.theSportsAPI.get('/match/detail_live', { match_id: matchId }), INCIDENTS_API_TIMEOUT_MS, null)];
                    case 8:
                        apiData = _a.sent();
                        if (!apiData) {
                            // Timeout - return stale data from DB
                            logger_1.logger.warn("[MatchIncidents] API timeout for ".concat(matchId, ", using stale database data (").concat(incidents.length, " incidents)"));
                            return [2 /*return*/, { incidents: incidents }];
                        }
                        freshIncidents = Array.isArray(apiData === null || apiData === void 0 ? void 0 : apiData.results) ? apiData.results : [];
                        if (freshIncidents.length > 0) {
                            logger_1.logger.info("[MatchIncidents] \u2713 Fetched ".concat(freshIncidents.length, " fresh incidents from API for ").concat(matchId));
                            return [2 /*return*/, { incidents: freshIncidents }];
                        }
                        // API returned no incidents - return database data as fallback
                        logger_1.logger.warn("[MatchIncidents] API returned no incidents, using stale database data (".concat(incidents.length, " incidents)"));
                        return [2 /*return*/, { incidents: incidents }];
                    case 9:
                        apiError_2 = _a.sent();
                        // ============================================================
                        // STEP 4: STALE CACHE FALLBACK (API ERROR)
                        // ============================================================
                        logger_1.logger.error("[MatchIncidents] API error for ".concat(matchId, ", using stale database data (").concat(incidents.length, " incidents):"), apiError_2);
                        return [2 /*return*/, { incidents: incidents }]; // Return stale data - better than nothing
                    case 10: return [3 /*break*/, 12];
                    case 11:
                        error_2 = _a.sent();
                        // ============================================================
                        // STEP 5: CRITICAL ERROR HANDLING (NEVER CRASH)
                        // ============================================================
                        logger_1.logger.error("[MatchIncidents] Critical error for ".concat(matchId, ":"), error_2);
                        return [2 /*return*/, { incidents: [] }]; // Last resort - return empty array
                    case 12: return [2 /*return*/];
                }
            });
        });
    };
    return MatchIncidentsService;
}());
exports.MatchIncidentsService = MatchIncidentsService;
// Export singleton instance
exports.matchIncidentsService = new MatchIncidentsService();
