"use strict";
/**
 * Match Recent Service
 *
 * Handles business logic for /match/recent/list endpoint
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
exports.MatchRecentService = void 0;
var TheSportsAPIManager_1 = require("../../../core/TheSportsAPIManager");
var logger_1 = require("../../../utils/logger");
var cache_service_1 = require("../../../utils/cache/cache.service");
var types_1 = require("../../../utils/cache/types");
var teamData_service_1 = require("../team/teamData.service");
var matchEnricher_service_1 = require("./matchEnricher.service");
var teamLogo_service_1 = require("../team/teamLogo.service");
var competition_service_1 = require("../competition/competition.service");
var MatchRecentService = /** @class */ (function () {
    function MatchRecentService() {
        this.client = TheSportsAPIManager_1.theSportsAPI;
        this.teamDataService = new teamData_service_1.TeamDataService();
        this.teamLogoService = new teamLogo_service_1.TeamLogoService();
        this.competitionService = new competition_service_1.CompetitionService();
        this.matchEnricher = new matchEnricher_service_1.MatchEnricherService(this.teamDataService, this.teamLogoService, this.competitionService);
    }
    /**
     * Get match recent list with cache support and team enrichment
     */
    MatchRecentService.prototype.getMatchRecentList = function () {
        return __awaiter(this, arguments, void 0, function (params, forceRefresh) {
            var _a, page, _b, limit, apiParams, cacheKey, cached, response, errorMsg, teamNamesMap, _i, _c, team, _d, _e, _f, teamId, teamInfo, results, enrichedResults, finalResults, enrichedResponse;
            var _this = this;
            var _g, _h;
            if (params === void 0) { params = {}; }
            if (forceRefresh === void 0) { forceRefresh = false; }
            return __generator(this, function (_j) {
                switch (_j.label) {
                    case 0:
                        _a = params.page, page = _a === void 0 ? 1 : _a, _b = params.limit, limit = _b === void 0 ? 50 : _b;
                        apiParams = { page: page, limit: limit };
                        if (params.date) {
                            // Convert YYYY-MM-DD to YYYYMMDD
                            apiParams.date = params.date.replace(/-/g, '');
                        }
                        if (params.time !== undefined && params.time !== null) {
                            // CRITICAL: Time parameter for incremental updates (Last Sync Timestamp + 1)
                            // According to TheSports docs: "obtain new or changed data according to the time"
                            apiParams.time = params.time;
                        }
                        if (params.competition_id)
                            apiParams.competition_id = params.competition_id;
                        if (params.season_id)
                            apiParams.season_id = params.season_id;
                        cacheKey = this.buildCacheKey(params);
                        if (!!forceRefresh) return [3 /*break*/, 2];
                        return [4 /*yield*/, cache_service_1.cacheService.get(cacheKey)];
                    case 1:
                        cached = _j.sent();
                        if (cached) {
                            logger_1.logger.debug("Cache hit for match recent list: ".concat(cacheKey));
                            return [2 /*return*/, cached];
                        }
                        _j.label = 2;
                    case 2:
                        // Fetch from API
                        logger_1.logger.info("Fetching match recent list: page=".concat(page, ", limit=").concat(limit, ", date=").concat(apiParams.date || 'none'));
                        return [4 /*yield*/, this.client.get('/match/recent/list', apiParams)];
                    case 3:
                        response = _j.sent();
                        // Check for API error (TheSports API uses 'code' and 'msg' for errors, not 'err')
                        if ((response === null || response === void 0 ? void 0 : response.code) && response.code !== 200 && response.code !== 0) {
                            errorMsg = response.msg || 'TheSports API error';
                            logger_1.logger.warn("TheSports API error for match recent: ".concat(errorMsg, " (code: ").concat(response.code, ")"));
                            // Return empty results with error message
                            return [2 /*return*/, {
                                    results: [],
                                    err: errorMsg,
                                }];
                        }
                        // Also check for 'err' field (backward compatibility)
                        if (response.err) {
                            logger_1.logger.warn("TheSports API error for match recent: ".concat(response.err));
                            // Return empty results with error message
                            return [2 /*return*/, {
                                    results: [],
                                    err: response.err,
                                }];
                        }
                        if (!((_g = response.results_extra) === null || _g === void 0 ? void 0 : _g.team)) return [3 /*break*/, 5];
                        return [4 /*yield*/, this.teamDataService.enrichFromResultsExtra(response.results_extra)];
                    case 4:
                        _j.sent();
                        _j.label = 5;
                    case 5:
                        teamNamesMap = new Map();
                        if ((_h = response.results_extra) === null || _h === void 0 ? void 0 : _h.team) {
                            // Handle both array and object formats
                            if (Array.isArray(response.results_extra.team)) {
                                // Array format: [{ id: "...", name: "...", logo: "..." }, ...]
                                for (_i = 0, _c = response.results_extra.team; _i < _c.length; _i++) {
                                    team = _c[_i];
                                    if (team.id && team.name) {
                                        teamNamesMap.set(team.id, {
                                            name: team.name,
                                            logo_url: team.logo || team.logo_url || undefined,
                                        });
                                    }
                                }
                            }
                            else {
                                // Object format: { "team_id": { name: "...", logo_url: "..." }, ... }
                                for (_d = 0, _e = Object.entries(response.results_extra.team); _d < _e.length; _d++) {
                                    _f = _e[_d], teamId = _f[0], teamInfo = _f[1];
                                    if (teamInfo && typeof teamInfo === 'object' && teamInfo.name) {
                                        teamNamesMap.set(teamId, {
                                            name: teamInfo.name,
                                            logo_url: teamInfo.logo_url || teamInfo.logo || undefined,
                                        });
                                    }
                                }
                            }
                            logger_1.logger.debug("\uD83D\uDCCB Extracted ".concat(teamNamesMap.size, " team names from results_extra (format: ").concat(Array.isArray(response.results_extra.team) ? 'ARRAY' : 'OBJECT', ")"));
                        }
                        results = (response.results || []).map(function (match) {
                            var _a, _b, _c, _d, _e, _f, _g, _h, _j;
                            // Get team names from results_extra (raw API data) - FIRST PRIORITY
                            var homeTeamInfo = teamNamesMap.get(match.home_team_id);
                            var awayTeamInfo = teamNamesMap.get(match.away_team_id);
                            // BRUTE FORCE: Try ALL possible field names for home team
                            var homeName = (homeTeamInfo === null || homeTeamInfo === void 0 ? void 0 : homeTeamInfo.name) || // From results_extra (highest priority)
                                match.home_name || // Common field
                                match.host_name || // Common variant
                                match.home_team_name || // Snake case
                                (Array.isArray(match.home) ? match.home[0] || match.home[1] : null) || // Array variant
                                ((_a = match.home) === null || _a === void 0 ? void 0 : _a.name) || // Object variant
                                ((_b = match.home_team) === null || _b === void 0 ? void 0 : _b.name) || // Nested object
                                (Array.isArray(match.home_team) ? match.home_team[0] || match.home_team[1] : null) || // Array variant
                                ((_c = match.localTeam) === null || _c === void 0 ? void 0 : _c.name) || // Alternative naming
                                match.localTeam || // Direct value
                                null;
                            // BRUTE FORCE: Try ALL possible field names for away team
                            var awayName = (awayTeamInfo === null || awayTeamInfo === void 0 ? void 0 : awayTeamInfo.name) || // From results_extra (highest priority)
                                match.away_name || // Common field
                                match.visitor_name || // Common variant
                                match.away_team_name || // Snake case
                                (Array.isArray(match.away) ? match.away[0] || match.away[1] : null) || // Array variant
                                ((_d = match.away) === null || _d === void 0 ? void 0 : _d.name) || // Object variant
                                ((_e = match.away_team) === null || _e === void 0 ? void 0 : _e.name) || // Nested object
                                (Array.isArray(match.away_team) ? match.away_team[0] || match.away_team[1] : null) || // Array variant
                                ((_f = match.visitorTeam) === null || _f === void 0 ? void 0 : _f.name) || // Alternative naming
                                match.visitorTeam || // Direct value
                                null;
                            // Extract score arrays (Array[7] format from API)
                            // Index 0: Normal Süre, Index 1: Devre Arası, Index 2: Kırmızı Kart, Index 3: Sarı Kart, Index 4: Korner, Index 5: Uzatma, Index 6: Penaltı
                            var homeScores = match.home_scores || (match.home_score !== undefined ? [match.home_score] : null);
                            var awayScores = match.away_scores || (match.away_score !== undefined ? [match.away_score] : null);
                            var homeRegularScore = Array.isArray(homeScores) && homeScores.length > 0 ? homeScores[0] : (match.home_score || null);
                            var homeOvertimeScore = Array.isArray(homeScores) && homeScores.length > 5 ? homeScores[5] : null;
                            var homePenaltyScore = Array.isArray(homeScores) && homeScores.length > 6 ? homeScores[6] : null;
                            var homeRedCards = Array.isArray(homeScores) && homeScores.length > 2 ? homeScores[2] : null;
                            var homeYellowCards = Array.isArray(homeScores) && homeScores.length > 3 ? homeScores[3] : null;
                            var homeCorners = Array.isArray(homeScores) && homeScores.length > 4 ? homeScores[4] : null;
                            var awayRegularScore = Array.isArray(awayScores) && awayScores.length > 0 ? awayScores[0] : (match.away_score || null);
                            var awayOvertimeScore = Array.isArray(awayScores) && awayScores.length > 5 ? awayScores[5] : null;
                            var awayPenaltyScore = Array.isArray(awayScores) && awayScores.length > 6 ? awayScores[6] : null;
                            var awayRedCards = Array.isArray(awayScores) && awayScores.length > 2 ? awayScores[2] : null;
                            var awayYellowCards = Array.isArray(awayScores) && awayScores.length > 3 ? awayScores[3] : null;
                            var awayCorners = Array.isArray(awayScores) && awayScores.length > 4 ? awayScores[4] : null;
                            // Extract competition info from results_extra
                            var competitionInfo = null;
                            if (match.competition_id && ((_g = response.results_extra) === null || _g === void 0 ? void 0 : _g.competition)) {
                                var compData = response.results_extra.competition[match.competition_id];
                                if (compData) {
                                    competitionInfo = {
                                        id: match.competition_id,
                                        name: compData.name || compData.name_en || null,
                                        logo_url: compData.logo_url || compData.logo || null,
                                    };
                                }
                            }
                            // CRITICAL: Validate status against match_time (timezone fix)
                            // If match_time is in the future, status cannot be "Ended"
                            var validatedStatus = match.status_id || match.status || 0;
                            var now = Math.floor(Date.now() / 1000); // Current Unix timestamp (UTC)
                            if (match.match_time && match.match_time > now) {
                                // Match is in the future, cannot be finished
                                if (validatedStatus === 8 || validatedStatus === 12) { // END or CANCEL
                                    logger_1.logger.debug("Match ".concat(match.id || match.match_id, " has status ").concat(validatedStatus, " but match_time is in the future. Fixing to NOT_STARTED."));
                                    validatedStatus = 1; // NOT_STARTED
                                }
                            }
                            return __assign(__assign({}, match), { status: validatedStatus, home_score: homeRegularScore, away_score: awayRegularScore, 
                                // CRITICAL: Add overtime and penalty scores for frontend display
                                home_score_overtime: homeOvertimeScore, away_score_overtime: awayOvertimeScore, home_score_penalties: homePenaltyScore, away_score_penalties: awayPenaltyScore, 
                                // CRITICAL: Add live incidents statistics (Array[7] indices 2, 3, 4)
                                home_red_cards: homeRedCards, away_red_cards: awayRedCards, home_yellow_cards: homeYellowCards, away_yellow_cards: awayYellowCards, home_corners: homeCorners, away_corners: awayCorners, 
                                // CRITICAL: Add raw team names - BRUTE FORCE MAPPING
                                home_team_name: homeName, away_team_name: awayName, home_team_logo: (homeTeamInfo === null || homeTeamInfo === void 0 ? void 0 : homeTeamInfo.logo_url) || match.home_logo || ((_h = match.home) === null || _h === void 0 ? void 0 : _h.logo) || null, away_team_logo: (awayTeamInfo === null || awayTeamInfo === void 0 ? void 0 : awayTeamInfo.logo_url) || match.away_logo || ((_j = match.away) === null || _j === void 0 ? void 0 : _j.logo) || null, 
                                // CRITICAL: Add competition info from results_extra
                                competition_info: competitionInfo });
                        });
                        return [4 /*yield*/, this.matchEnricher.enrichMatches(results)];
                    case 6:
                        enrichedResults = _j.sent();
                        finalResults = enrichedResults.map(function (match) {
                            var _a, _b;
                            // ALWAYS use raw API names if available (even if enricher found something)
                            if (match.home_team_name && typeof match.home_team_name === 'string' && match.home_team_name.trim() !== '') {
                                match.home_team = {
                                    id: match.home_team_id,
                                    name: match.home_team_name,
                                    logo_url: match.home_team_logo || ((_a = match.home_team) === null || _a === void 0 ? void 0 : _a.logo_url) || null,
                                    short_name: null,
                                };
                            }
                            else if (!match.home_team || match.home_team.name === 'Unknown Team') {
                                match.home_team = match.home_team || {
                                    id: match.home_team_id,
                                    name: 'Unknown Team',
                                    logo_url: null,
                                    short_name: null,
                                };
                            }
                            if (match.away_team_name && typeof match.away_team_name === 'string' && match.away_team_name.trim() !== '') {
                                match.away_team = {
                                    id: match.away_team_id,
                                    name: match.away_team_name,
                                    logo_url: match.away_team_logo || ((_b = match.away_team) === null || _b === void 0 ? void 0 : _b.logo_url) || null,
                                    short_name: null,
                                };
                            }
                            else if (!match.away_team || match.away_team.name === 'Unknown Team') {
                                match.away_team = match.away_team || {
                                    id: match.away_team_id,
                                    name: 'Unknown Team',
                                    logo_url: null,
                                    short_name: null,
                                };
                            }
                            // CRITICAL: Merge competition data from results_extra (highest priority)
                            // results_extra.competition has the most up-to-date data
                            // MUST preserve competition_info even if enricher added a competition
                            if (match.competition_info && match.competition_info.name) {
                                // Use competition_info from results_extra (highest priority - ALWAYS override enricher)
                                match.competition = {
                                    id: match.competition_info.id,
                                    name: match.competition_info.name,
                                    logo_url: match.competition_info.logo_url,
                                };
                                logger_1.logger.debug("\u2705 Using competition from results_extra: ".concat(match.competition_info.name, " (").concat(match.competition_info.id, ")"));
                            }
                            else if (match.competition_id) {
                                // Fallback 1: Try to get from enriched competition (DB) - only if results_extra didn't provide it
                                if (match.competition && match.competition.name && match.competition.name !== 'Bilinmeyen Lig') {
                                    logger_1.logger.debug("Using competition from enricher (DB): ".concat(match.competition.name, " (").concat(match.competition_id, ")"));
                                }
                                else {
                                    // Fallback 2: If competition_id exists but no name, try to fetch immediately
                                    logger_1.logger.warn("\u26A0\uFE0F Competition ".concat(match.competition_id, " has no name. Attempting immediate fetch..."));
                                    _this.competitionService.getCompetitionById(match.competition_id)
                                        .then(function (comp) {
                                        if (comp && comp.name) {
                                            logger_1.logger.info("\u2705 Fetched competition ".concat(match.competition_id, ": ").concat(comp.name));
                                            // Update the match object (non-blocking)
                                            match.competition = {
                                                id: comp.id,
                                                name: comp.name,
                                                logo_url: comp.logo_url || null,
                                            };
                                        }
                                    })
                                        .catch(function (err) { return logger_1.logger.warn("Failed to fetch competition ".concat(match.competition_id, ":"), err); });
                                    // Set placeholder competition to avoid "Unknown League" - but only if we have no competition at all
                                    if (!match.competition) {
                                        match.competition = {
                                            id: match.competition_id,
                                            name: null, // Will be updated when fetch completes
                                            logo_url: null,
                                        };
                                    }
                                }
                            }
                            return match;
                        });
                        enrichedResponse = __assign(__assign({}, response), { results: finalResults });
                        // Cache response
                        return [4 /*yield*/, cache_service_1.cacheService.set(cacheKey, enrichedResponse, types_1.CacheTTL.FiveMinutes)];
                    case 7:
                        // Cache response
                        _j.sent();
                        return [2 /*return*/, enrichedResponse];
                }
            });
        });
    };
    /**
     * Build cache key from parameters
     */
    MatchRecentService.prototype.buildCacheKey = function (params) {
        var _a = params.page, page = _a === void 0 ? 1 : _a, _b = params.limit, limit = _b === void 0 ? 50 : _b, competition_id = params.competition_id, season_id = params.season_id, date = params.date;
        var parts = [
            types_1.CacheKeyPrefix.TheSports,
            'match',
            'recent',
            "page:".concat(page),
            "limit:".concat(limit),
        ];
        if (competition_id)
            parts.push("comp:".concat(competition_id));
        if (season_id)
            parts.push("season:".concat(season_id));
        if (date)
            parts.push("date:".concat(date));
        return parts.join(':');
    };
    return MatchRecentService;
}());
exports.MatchRecentService = MatchRecentService;
