"use strict";
/**
 * Match Season Recent Service
 *
 * Handles business logic for /match/season/recent endpoint
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchSeasonRecentService = void 0;
const TheSportsAPIManager_1 = require("../../../core/TheSportsAPIManager");
const logger_1 = require("../../../utils/logger");
const cache_service_1 = require("../../../utils/cache/cache.service");
const types_1 = require("../../../utils/cache/types");
const matchEnricher_service_1 = require("./matchEnricher.service");
const teamData_service_1 = require("../team/teamData.service");
const teamLogo_service_1 = require("../team/teamLogo.service");
const competition_service_1 = require("../competition/competition.service");
class MatchSeasonRecentService {
    constructor() {
        this.client = TheSportsAPIManager_1.theSportsAPI;
        const teamDataService = new teamData_service_1.TeamDataService();
        const teamLogoService = new teamLogo_service_1.TeamLogoService();
        const competitionService = new competition_service_1.CompetitionService();
        this.matchEnricher = new matchEnricher_service_1.MatchEnricherService(teamDataService, teamLogoService, competitionService);
    }
    /**
     * Get match season recent with cache support and team enrichment
     */
    async getMatchSeasonRecent(params) {
        const { season_id, page = 1, limit = 50 } = params;
        const cacheKey = this.buildCacheKey(params);
        const cached = await cache_service_1.cacheService.get(cacheKey);
        if (cached) {
            logger_1.logger.debug(`Cache hit for match season recent: ${cacheKey}`);
            return cached;
        }
        logger_1.logger.info(`Fetching match season recent: season_id=${season_id}`);
        const response = await this.client.get('/match/season/recent', { season_id, page, limit });
        // Enrich with team data if results exist
        let enrichedResults = response.results || [];
        if (enrichedResults.length > 0) {
            enrichedResults = await this.matchEnricher.enrichMatches(enrichedResults);
        }
        const enrichedResponse = {
            ...response,
            results: enrichedResults,
        };
        await cache_service_1.cacheService.set(cacheKey, enrichedResponse, types_1.CacheTTL.TenMinutes);
        return enrichedResponse;
    }
    buildCacheKey(params) {
        const { season_id, page = 1, limit = 50 } = params;
        return `${types_1.CacheKeyPrefix.TheSports}:match:season:recent:${season_id}:page:${page}:limit:${limit}`;
    }
}
exports.MatchSeasonRecentService = MatchSeasonRecentService;
