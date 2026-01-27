"use strict";
/**
 * Match Diary Service
 *
 * Handles business logic for /match/diary endpoint
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
exports.MatchDiaryService = void 0;
// PR-5B: Migrated to hardened TheSportsClient via adapter
var thesports_1 = require("../../../integrations/thesports");
var logger_1 = require("../../../utils/logger");
var cache_service_1 = require("../../../utils/cache/cache.service");
var types_1 = require("../../../utils/cache/types");
var teamData_service_1 = require("../team/teamData.service");
var matchEnricher_service_1 = require("./matchEnricher.service");
var teamLogo_service_1 = require("../team/teamLogo.service");
var competition_service_1 = require("../competition/competition.service");
var timestamp_util_1 = require("../../../utils/thesports/timestamp.util");
var MatchDiaryService = /** @class */ (function () {
    function MatchDiaryService() {
        this.client = thesports_1.theSportsAPIAdapter;
        this.teamDataService = new teamData_service_1.TeamDataService();
        this.teamLogoService = new teamLogo_service_1.TeamLogoService();
        this.competitionService = new competition_service_1.CompetitionService();
        this.matchEnricher = new matchEnricher_service_1.MatchEnricherService(this.teamDataService, this.teamLogoService, this.competitionService);
    }
    /**
     * Get match diary for a specific date with cache support and team enrichment
     */
    MatchDiaryService.prototype.getMatchDiary = function () {
        return __awaiter(this, arguments, void 0, function (params) {
            var dateStr, cacheKey, cached, allResults, page, limit, maxPages, hasMore, resultsExtra, response_1, errorMsg, results_1, total, firstMatch, response, teamNamesMap, _i, _a, team, _b, _c, _d, teamId, teamInfo, results, sampleMatch, enrichedResults, finalResults, sampleFinal, matchesWithCompetition, matchesWithCompetitionInfo, coveragePct, enrichedResponse;
            var _this = this;
            var _e, _f, _g, _h, _j;
            if (params === void 0) { params = {}; }
            return __generator(this, function (_k) {
                switch (_k.label) {
                    case 0:
                        if (params.date) {
                            // Convert YYYY-MM-DD to YYYYMMDD
                            dateStr = params.date.replace(/-/g, '');
                            // Validate format: Must be 8 digits (YYYYMMDD)
                            if (!/^\d{8}$/.test(dateStr)) {
                                logger_1.logger.warn("Invalid date format: ".concat(params.date, ". Expected YYYYMMDD format."));
                                // Try to fix: if it's already YYYYMMDD, use it; otherwise use today
                                if (params.date.length === 8 && /^\d{8}$/.test(params.date)) {
                                    dateStr = params.date;
                                }
                                else {
                                    dateStr = (0, timestamp_util_1.getTSIDateString)(); // Use TSI timezone
                                    logger_1.logger.warn("Using today's date instead: ".concat(dateStr));
                                }
                            }
                        }
                        else {
                            dateStr = (0, timestamp_util_1.getTSIDateString)(); // Use TSI timezone
                        }
                        // Final validation: Ensure dateStr is exactly 8 digits
                        if (!/^\d{8}$/.test(dateStr)) {
                            logger_1.logger.error("Date format validation failed: ".concat(dateStr, ". Using today's date."));
                            dateStr = (0, timestamp_util_1.getTSIDateString)(); // Use TSI timezone
                        }
                        cacheKey = this.buildCacheKey(dateStr);
                        if (!!params.forceRefresh) return [3 /*break*/, 2];
                        return [4 /*yield*/, cache_service_1.cacheService.get(cacheKey)];
                    case 1:
                        cached = _k.sent();
                        if (cached) {
                            logger_1.logger.debug("Cache hit for match diary: ".concat(cacheKey));
                            return [2 /*return*/, cached];
                        }
                        return [3 /*break*/, 3];
                    case 2:
                        logger_1.logger.info("\uD83D\uDD04 [MatchDiary] Force refresh - skipping cache");
                        _k.label = 3;
                    case 3:
                        // Fetch from API with PAGINATION
                        // CRITICAL: TheSports API may have default limit - fetch ALL pages
                        logger_1.logger.info("\uD83D\uDD0D [MatchDiary] Fetching match diary for date: ".concat(dateStr, " (format: YYYYMMDD) with pagination"));
                        allResults = [];
                        page = 1;
                        limit = 500;
                        maxPages = 20;
                        hasMore = true;
                        resultsExtra = undefined;
                        _k.label = 4;
                    case 4:
                        if (!(hasMore && page <= maxPages)) return [3 /*break*/, 6];
                        return [4 /*yield*/, this.client.get('/match/diary', { date: dateStr, page: page, limit: limit })];
                    case 5:
                        response_1 = _k.sent();
                        // Check for errors
                        if (response_1.err) {
                            logger_1.logger.warn("[MatchDiary] TheSports API error for diary page ".concat(page, ": ").concat(response_1.err));
                            return [3 /*break*/, 6];
                        }
                        // Check API error codes
                        if ((response_1 === null || response_1 === void 0 ? void 0 : response_1.code) && response_1.code !== 200 && response_1.code !== 0) {
                            errorMsg = response_1.msg || 'TheSports API error';
                            logger_1.logger.warn("[MatchDiary] API error for diary page ".concat(page, ": ").concat(errorMsg));
                            return [3 /*break*/, 6];
                        }
                        results_1 = response_1.results || [];
                        total = (_e = response_1.total) !== null && _e !== void 0 ? _e : 0;
                        // Merge results_extra from first page (contains team/competition data)
                        if (page === 1 && response_1.results_extra) {
                            resultsExtra = response_1.results_extra;
                        }
                        if (results_1.length === 0) {
                            // No more results - stop pagination
                            // CRITICAL: Don't check total === 0, TheSports API returns total=0 even when results exist
                            hasMore = false;
                            logger_1.logger.debug("[MatchDiary] Page ".concat(page, ": No more results (").concat(results_1.length, " results, total=").concat(total, ")"));
                        }
                        else {
                            allResults = allResults.concat(results_1);
                            logger_1.logger.info("[MatchDiary] Page ".concat(page, ": Fetched ").concat(results_1.length, " matches (total so far: ").concat(allResults.length, ")"));
                            // Check if we've fetched all available matches
                            if (results_1.length < limit) {
                                // Last page - fewer results than limit
                                hasMore = false;
                            }
                            else {
                                page++;
                            }
                        }
                        return [3 /*break*/, 4];
                    case 6:
                        if (page > maxPages) {
                            logger_1.logger.warn("[MatchDiary] Hit max page limit (".concat(maxPages, "). Some matches may be missed."));
                        }
                        logger_1.logger.info("\uD83D\uDCCA [MatchDiary] Total fetched: ".concat(allResults.length, " matches for date ").concat(dateStr));
                        // Check if no results found
                        if (allResults.length === 0) {
                            logger_1.logger.warn("\u26A0\uFE0F [MatchDiary] No matches found for date ".concat(dateStr, ". This might be normal if no matches are scheduled."));
                            return [2 /*return*/, { results: [], err: undefined }];
                        }
                        else if (allResults.length < 50) {
                            logger_1.logger.warn("\u26A0\uFE0F [MatchDiary] Only ".concat(allResults.length, " matches found. Expected 200+ for a full day."));
                        }
                        else {
                            logger_1.logger.info("\u2705 [MatchDiary] Good match count: ".concat(allResults.length, " matches"));
                        }
                        // DEBUG: Log raw API match structure (only if THESPORTS_DEBUG=1)
                        if (process.env.THESPORTS_DEBUG === '1' && allResults.length > 0) {
                            firstMatch = allResults[0];
                            logger_1.logger.info('🔍 [DEBUG] Raw API Match Structure (FULL):', JSON.stringify(firstMatch, null, 2));
                            logger_1.logger.info('🔍 [DEBUG] All keys in match object:', Object.keys(firstMatch).join(', '));
                        }
                        if (!resultsExtra) return [3 /*break*/, 10];
                        return [4 /*yield*/, this.cacheResultsExtra(dateStr, resultsExtra)];
                    case 7:
                        _k.sent();
                        return [4 /*yield*/, this.teamDataService.enrichFromResultsExtra(resultsExtra)];
                    case 8:
                        _k.sent();
                        if (!resultsExtra.competition) return [3 /*break*/, 10];
                        return [4 /*yield*/, this.competitionService.enrichFromResultsExtra(resultsExtra)];
                    case 9:
                        _k.sent();
                        _k.label = 10;
                    case 10:
                        response = {
                            results: allResults,
                            results_extra: resultsExtra,
                            total: allResults.length,
                        };
                        teamNamesMap = new Map();
                        if ((_f = response.results_extra) === null || _f === void 0 ? void 0 : _f.team) {
                            // Handle both array and object formats
                            if (Array.isArray(response.results_extra.team)) {
                                // Array format: [{ id: "...", name: "...", logo: "..." }, ...]
                                for (_i = 0, _a = response.results_extra.team; _i < _a.length; _i++) {
                                    team = _a[_i];
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
                                for (_b = 0, _c = Object.entries(response.results_extra.team); _b < _c.length; _b++) {
                                    _d = _c[_b], teamId = _d[0], teamInfo = _d[1];
                                    if (teamInfo && typeof teamInfo === 'object' && teamInfo.name) {
                                        teamNamesMap.set(teamId, {
                                            name: teamInfo.name,
                                            logo_url: teamInfo.logo_url || teamInfo.logo || undefined,
                                        });
                                    }
                                }
                            }
                            logger_1.logger.info("\uD83D\uDCCB Extracted ".concat(teamNamesMap.size, " team names from results_extra (format: ").concat(Array.isArray(response.results_extra.team) ? 'ARRAY' : 'OBJECT', ")"));
                        }
                        results = (response.results || []).map(function (match) {
                            var _a, _b, _c, _d, _e, _f, _g, _h, _j;
                            // Normalize IDs to strings for consistent Map/Object indexing
                            var homeTeamId = match.home_team_id != null ? String(match.home_team_id) : '';
                            var awayTeamId = match.away_team_id != null ? String(match.away_team_id) : '';
                            var competitionId = match.competition_id != null ? String(match.competition_id) : '';
                            // Get team names from results_extra (raw API data) - FIRST PRIORITY
                            var homeTeamInfo = homeTeamId ? teamNamesMap.get(homeTeamId) : undefined;
                            var awayTeamInfo = awayTeamId ? teamNamesMap.get(awayTeamId) : undefined;
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
                            if (competitionId && ((_g = response.results_extra) === null || _g === void 0 ? void 0 : _g.competition)) {
                                var compData = response.results_extra.competition[competitionId];
                                if (compData) {
                                    competitionInfo = {
                                        id: competitionId,
                                        name: compData.name || compData.name_en || compData.name_cn || null,
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
                            return __assign(__assign({}, match), { status_id: validatedStatus, status: validatedStatus, home_score: homeRegularScore, away_score: awayRegularScore, 
                                // CRITICAL: Add overtime and penalty scores for frontend display
                                home_score_overtime: homeOvertimeScore, away_score_overtime: awayOvertimeScore, home_score_penalties: homePenaltyScore, away_score_penalties: awayPenaltyScore, 
                                // CRITICAL: Add live incidents statistics (Array[7] indices 2, 3, 4)
                                home_red_cards: homeRedCards, away_red_cards: awayRedCards, home_yellow_cards: homeYellowCards, away_yellow_cards: awayYellowCards, home_corners: homeCorners, away_corners: awayCorners, 
                                // CRITICAL: Add raw team names - BRUTE FORCE MAPPING
                                home_team_name: homeName, away_team_name: awayName, home_team_logo: (homeTeamInfo === null || homeTeamInfo === void 0 ? void 0 : homeTeamInfo.logo_url) || match.home_logo || ((_h = match.home) === null || _h === void 0 ? void 0 : _h.logo) || null, away_team_logo: (awayTeamInfo === null || awayTeamInfo === void 0 ? void 0 : awayTeamInfo.logo_url) || match.away_logo || ((_j = match.away) === null || _j === void 0 ? void 0 : _j.logo) || null, 
                                // CRITICAL: Add competition info from results_extra
                                competition_info: competitionInfo });
                        });
                        // DEBUG: Log final mapped match sample
                        if (results.length > 0) {
                            sampleMatch = results[0];
                            logger_1.logger.info('✅ [DEBUG] Final Mapped Match Sample:', {
                                id: sampleMatch.id,
                                home_team_id: sampleMatch.home_team_id,
                                home_team_name: sampleMatch.home_team_name,
                                home_team_name_type: typeof sampleMatch.home_team_name,
                                away_team_id: sampleMatch.away_team_id,
                                away_team_name: sampleMatch.away_team_name,
                                away_team_name_type: typeof sampleMatch.away_team_name,
                            });
                        }
                        return [4 /*yield*/, this.matchEnricher.enrichMatches(results)];
                    case 11:
                        enrichedResults = _k.sent();
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
                                // Fallback: keep the enriched team but mark as unknown
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
                                // Fallback: keep the enriched team but mark as unknown
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
                        // DEBUG: Log final result after enrichment
                        if (finalResults.length > 0) {
                            sampleFinal = finalResults[0];
                            logger_1.logger.info('🎯 [DEBUG] Final Result After Enrichment:', {
                                id: sampleFinal.id,
                                home_team_name: (_g = sampleFinal.home_team) === null || _g === void 0 ? void 0 : _g.name,
                                home_team_id: sampleFinal.home_team_id,
                                away_team_name: (_h = sampleFinal.away_team) === null || _h === void 0 ? void 0 : _h.name,
                                away_team_id: sampleFinal.away_team_id,
                                competition_id: sampleFinal.competition_id,
                                competition_name: ((_j = sampleFinal.competition) === null || _j === void 0 ? void 0 : _j.name) || 'MISSING',
                                competition_info: sampleFinal.competition_info ? 'PRESENT' : 'MISSING',
                            });
                        }
                        matchesWithCompetition = finalResults.filter(function (m) { return m.competition && m.competition.name; }).length;
                        matchesWithCompetitionInfo = finalResults.filter(function (m) { return m.competition_info; }).length;
                        coveragePct = finalResults.length > 0 ? Math.round((matchesWithCompetition / finalResults.length) * 100) : 0;
                        logger_1.logger.info("\uD83D\uDCCA [MatchDiary] Final results: ".concat(finalResults.length, " matches, ") +
                            "".concat(matchesWithCompetition, " with competition names (").concat(coveragePct, "%), ") +
                            "".concat(matchesWithCompetitionInfo, " with competition_info"));
                        // CRITICAL: Ensure competition object is always present (even if name is null)
                        // This prevents "Bilinmeyen Lig" in the frontend
                        finalResults.forEach(function (match) {
                            if (match.competition_id) {
                                if (!match.competition) {
                                    logger_1.logger.warn("\u26A0\uFE0F Match ".concat(match.id, " has competition_id ").concat(match.competition_id, " but no competition object. Creating placeholder."));
                                    match.competition = {
                                        id: match.competition_id,
                                        name: null,
                                        logo_url: null,
                                    };
                                }
                                // Ensure competition object has the correct structure
                                if (match.competition && !match.competition.id) {
                                    match.competition.id = match.competition_id;
                                }
                            }
                        });
                        enrichedResponse = __assign(__assign({}, response), { results: finalResults });
                        // Cache full response
                        return [4 /*yield*/, cache_service_1.cacheService.set(cacheKey, enrichedResponse, types_1.CacheTTL.Day)];
                    case 12:
                        // Cache full response
                        _k.sent();
                        return [2 /*return*/, enrichedResponse];
                }
            });
        });
    };
    /**
     * Cache results_extra separately for team data enrichment
     */
    MatchDiaryService.prototype.cacheResultsExtra = function (dateStr, resultsExtra) {
        return __awaiter(this, void 0, void 0, function () {
            var extraCacheKey;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!resultsExtra)
                            return [2 /*return*/];
                        extraCacheKey = "".concat(types_1.CacheKeyPrefix.TheSports, ":diary:extra:").concat(dateStr);
                        return [4 /*yield*/, cache_service_1.cacheService.set(extraCacheKey, resultsExtra, types_1.CacheTTL.Day)];
                    case 1:
                        _a.sent();
                        logger_1.logger.debug("Cached results_extra for date: ".concat(dateStr));
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Build cache key from date
     */
    MatchDiaryService.prototype.buildCacheKey = function (dateStr) {
        return "".concat(types_1.CacheKeyPrefix.TheSports, ":match:diary:").concat(dateStr);
    };
    return MatchDiaryService;
}());
exports.MatchDiaryService = MatchDiaryService;
