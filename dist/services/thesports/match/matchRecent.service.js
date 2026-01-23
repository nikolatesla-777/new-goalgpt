"use strict";
/**
 * Match Recent Service
 *
 * Handles business logic for /match/recent/list endpoint
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchRecentService = void 0;
const TheSportsAPIManager_1 = require("../../../core/TheSportsAPIManager");
const logger_1 = require("../../../utils/logger");
const cache_service_1 = require("../../../utils/cache/cache.service");
const types_1 = require("../../../utils/cache/types");
const teamData_service_1 = require("../team/teamData.service");
const matchEnricher_service_1 = require("./matchEnricher.service");
const teamLogo_service_1 = require("../team/teamLogo.service");
const competition_service_1 = require("../competition/competition.service");
class MatchRecentService {
    constructor() {
        this.client = TheSportsAPIManager_1.theSportsAPI;
        this.teamDataService = new teamData_service_1.TeamDataService();
        this.teamLogoService = new teamLogo_service_1.TeamLogoService();
        this.competitionService = new competition_service_1.CompetitionService();
        this.matchEnricher = new matchEnricher_service_1.MatchEnricherService(this.teamDataService, this.teamLogoService, this.competitionService);
    }
    /**
     * Get match recent list with cache support and team enrichment
     */
    async getMatchRecentList(params = {}, forceRefresh = false) {
        const { page = 1, limit = 50 } = params;
        // Convert date format from YYYY-MM-DD to YYYYMMDD if provided
        let apiParams = { page, limit };
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
        const cacheKey = this.buildCacheKey(params);
        // Check cache first (unless forceRefresh is true)
        if (!forceRefresh) {
            const cached = await cache_service_1.cacheService.get(cacheKey);
            if (cached) {
                logger_1.logger.debug(`Cache hit for match recent list: ${cacheKey}`);
                return cached;
            }
        }
        // Fetch from API
        logger_1.logger.info(`Fetching match recent list: page=${page}, limit=${limit}, date=${apiParams.date || 'none'}`);
        const response = await this.client.get('/match/recent/list', apiParams);
        // Check for API error (TheSports API uses 'code' and 'msg' for errors, not 'err')
        if (response?.code && response.code !== 200 && response.code !== 0) {
            const errorMsg = response.msg || 'TheSports API error';
            logger_1.logger.warn(`TheSports API error for match recent: ${errorMsg} (code: ${response.code})`);
            // Return empty results with error message
            return {
                results: [],
                err: errorMsg,
            };
        }
        // Also check for 'err' field (backward compatibility)
        if (response.err) {
            logger_1.logger.warn(`TheSports API error for match recent: ${response.err}`);
            // Return empty results with error message
            return {
                results: [],
                err: response.err,
            };
        }
        // Extract and cache results_extra (team data)
        if (response.results_extra?.team) {
            await this.teamDataService.enrichFromResultsExtra(response.results_extra);
        }
        // CRITICAL FIX: Extract team names from results_extra BEFORE enrichment
        // NOTE: results_extra.team is an ARRAY, not an object!
        const teamNamesMap = new Map();
        if (response.results_extra?.team) {
            // Handle both array and object formats
            if (Array.isArray(response.results_extra.team)) {
                // Array format: [{ id: "...", name: "...", logo: "..." }, ...]
                for (const team of response.results_extra.team) {
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
                for (const [teamId, teamInfo] of Object.entries(response.results_extra.team)) {
                    if (teamInfo && typeof teamInfo === 'object' && teamInfo.name) {
                        teamNamesMap.set(teamId, {
                            name: teamInfo.name,
                            logo_url: teamInfo.logo_url || teamInfo.logo || undefined,
                        });
                    }
                }
            }
            logger_1.logger.debug(`📋 Extracted ${teamNamesMap.size} team names from results_extra (format: ${Array.isArray(response.results_extra.team) ? 'ARRAY' : 'OBJECT'})`);
        }
        // Transform and enrich matches - BRUTE FORCE ALL POSSIBLE NAME FIELDS
        const results = (response.results || []).map((match) => {
            // Get team names from results_extra (raw API data) - FIRST PRIORITY
            const homeTeamInfo = teamNamesMap.get(match.home_team_id);
            const awayTeamInfo = teamNamesMap.get(match.away_team_id);
            // BRUTE FORCE: Try ALL possible field names for home team
            const homeName = homeTeamInfo?.name || // From results_extra (highest priority)
                match.home_name || // Common field
                match.host_name || // Common variant
                match.home_team_name || // Snake case
                (Array.isArray(match.home) ? match.home[0] || match.home[1] : null) || // Array variant
                (match.home?.name) || // Object variant
                (match.home_team?.name) || // Nested object
                (Array.isArray(match.home_team) ? match.home_team[0] || match.home_team[1] : null) || // Array variant
                match.localTeam?.name || // Alternative naming
                match.localTeam || // Direct value
                null;
            // BRUTE FORCE: Try ALL possible field names for away team
            const awayName = awayTeamInfo?.name || // From results_extra (highest priority)
                match.away_name || // Common field
                match.visitor_name || // Common variant
                match.away_team_name || // Snake case
                (Array.isArray(match.away) ? match.away[0] || match.away[1] : null) || // Array variant
                (match.away?.name) || // Object variant
                (match.away_team?.name) || // Nested object
                (Array.isArray(match.away_team) ? match.away_team[0] || match.away_team[1] : null) || // Array variant
                match.visitorTeam?.name || // Alternative naming
                match.visitorTeam || // Direct value
                null;
            // Extract score arrays (Array[7] format from API)
            // Index 0: Normal Süre, Index 1: Devre Arası, Index 2: Kırmızı Kart, Index 3: Sarı Kart, Index 4: Korner, Index 5: Uzatma, Index 6: Penaltı
            const homeScores = match.home_scores || (match.home_score !== undefined ? [match.home_score] : null);
            const awayScores = match.away_scores || (match.away_score !== undefined ? [match.away_score] : null);
            const homeRegularScore = Array.isArray(homeScores) && homeScores.length > 0 ? homeScores[0] : (match.home_score || null);
            const homeOvertimeScore = Array.isArray(homeScores) && homeScores.length > 5 ? homeScores[5] : null;
            const homePenaltyScore = Array.isArray(homeScores) && homeScores.length > 6 ? homeScores[6] : null;
            const homeRedCards = Array.isArray(homeScores) && homeScores.length > 2 ? homeScores[2] : null;
            const homeYellowCards = Array.isArray(homeScores) && homeScores.length > 3 ? homeScores[3] : null;
            const homeCorners = Array.isArray(homeScores) && homeScores.length > 4 ? homeScores[4] : null;
            const awayRegularScore = Array.isArray(awayScores) && awayScores.length > 0 ? awayScores[0] : (match.away_score || null);
            const awayOvertimeScore = Array.isArray(awayScores) && awayScores.length > 5 ? awayScores[5] : null;
            const awayPenaltyScore = Array.isArray(awayScores) && awayScores.length > 6 ? awayScores[6] : null;
            const awayRedCards = Array.isArray(awayScores) && awayScores.length > 2 ? awayScores[2] : null;
            const awayYellowCards = Array.isArray(awayScores) && awayScores.length > 3 ? awayScores[3] : null;
            const awayCorners = Array.isArray(awayScores) && awayScores.length > 4 ? awayScores[4] : null;
            // Extract competition info from results_extra
            let competitionInfo = null;
            if (match.competition_id && response.results_extra?.competition) {
                const compData = response.results_extra.competition[match.competition_id];
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
            let validatedStatus = match.status_id || match.status || 0;
            const now = Math.floor(Date.now() / 1000); // Current Unix timestamp (UTC)
            if (match.match_time && match.match_time > now) {
                // Match is in the future, cannot be finished
                if (validatedStatus === 8 || validatedStatus === 12) { // END or CANCEL
                    logger_1.logger.debug(`Match ${match.id || match.match_id} has status ${validatedStatus} but match_time is in the future. Fixing to NOT_STARTED.`);
                    validatedStatus = 1; // NOT_STARTED
                }
            }
            return {
                ...match,
                status: validatedStatus,
                home_score: homeRegularScore,
                away_score: awayRegularScore,
                // CRITICAL: Add overtime and penalty scores for frontend display
                home_score_overtime: homeOvertimeScore,
                away_score_overtime: awayOvertimeScore,
                home_score_penalties: homePenaltyScore,
                away_score_penalties: awayPenaltyScore,
                // CRITICAL: Add live incidents statistics (Array[7] indices 2, 3, 4)
                home_red_cards: homeRedCards,
                away_red_cards: awayRedCards,
                home_yellow_cards: homeYellowCards,
                away_yellow_cards: awayYellowCards,
                home_corners: homeCorners,
                away_corners: awayCorners,
                // CRITICAL: Add raw team names - BRUTE FORCE MAPPING
                home_team_name: homeName,
                away_team_name: awayName,
                home_team_logo: homeTeamInfo?.logo_url || match.home_logo || match.home?.logo || null,
                away_team_logo: awayTeamInfo?.logo_url || match.away_logo || match.away?.logo || null,
                // CRITICAL: Add competition info from results_extra
                competition_info: competitionInfo,
            };
        });
        const enrichedResults = await this.matchEnricher.enrichMatches(results);
        // CRITICAL FIX: Override enriched team names with raw API names if available
        // Also merge competition data from results_extra
        const finalResults = enrichedResults.map((match) => {
            // ALWAYS use raw API names if available (even if enricher found something)
            if (match.home_team_name && typeof match.home_team_name === 'string' && match.home_team_name.trim() !== '') {
                match.home_team = {
                    id: match.home_team_id,
                    name: match.home_team_name,
                    logo_url: match.home_team_logo || match.home_team?.logo_url || null,
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
                    logo_url: match.away_team_logo || match.away_team?.logo_url || null,
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
                logger_1.logger.debug(`✅ Using competition from results_extra: ${match.competition_info.name} (${match.competition_info.id})`);
            }
            else if (match.competition_id) {
                // Fallback 1: Try to get from enriched competition (DB) - only if results_extra didn't provide it
                if (match.competition && match.competition.name && match.competition.name !== 'Bilinmeyen Lig') {
                    logger_1.logger.debug(`Using competition from enricher (DB): ${match.competition.name} (${match.competition_id})`);
                }
                else {
                    // Fallback 2: If competition_id exists but no name, try to fetch immediately
                    logger_1.logger.warn(`⚠️ Competition ${match.competition_id} has no name. Attempting immediate fetch...`);
                    this.competitionService.getCompetitionById(match.competition_id)
                        .then(comp => {
                        if (comp && comp.name) {
                            logger_1.logger.info(`✅ Fetched competition ${match.competition_id}: ${comp.name}`);
                            // Update the match object (non-blocking)
                            match.competition = {
                                id: comp.id,
                                name: comp.name,
                                logo_url: comp.logo_url || null,
                            };
                        }
                    })
                        .catch(err => logger_1.logger.warn(`Failed to fetch competition ${match.competition_id}:`, err));
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
        const enrichedResponse = {
            ...response,
            results: finalResults,
        };
        // Cache response
        await cache_service_1.cacheService.set(cacheKey, enrichedResponse, types_1.CacheTTL.FiveMinutes);
        return enrichedResponse;
    }
    /**
     * Build cache key from parameters
     */
    buildCacheKey(params) {
        const { page = 1, limit = 50, competition_id, season_id, date } = params;
        const parts = [
            types_1.CacheKeyPrefix.TheSports,
            'match',
            'recent',
            `page:${page}`,
            `limit:${limit}`,
        ];
        if (competition_id)
            parts.push(`comp:${competition_id}`);
        if (season_id)
            parts.push(`season:${season_id}`);
        if (date)
            parts.push(`date:${date}`);
        return parts.join(':');
    }
}
exports.MatchRecentService = MatchRecentService;
