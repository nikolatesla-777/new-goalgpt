"use strict";
/**
 * Match Team Stats Service
 *
 * Handles business logic for /match/team_stats/detail endpoint
 * CRITICAL: Uses /detail endpoint (not /list) for specific match data
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchTeamStatsService = void 0;
const TheSportsAPIManager_1 = require("../../../core/TheSportsAPIManager");
const logger_1 = require("../../../utils/logger");
const cache_service_1 = require("../../../utils/cache/cache.service");
const types_1 = require("../../../utils/cache/types");
class MatchTeamStatsService {
    constructor() {
        this.client = TheSportsAPIManager_1.theSportsAPI;
    }
    /**
     * Get match team stats with cache support
     * Tries both realtime (/list) and historical (/detail) endpoints
     */
    async getMatchTeamStats(params) {
        const { match_id } = params;
        const cacheKey = `${types_1.CacheKeyPrefix.TheSports}:match:team_stats:${match_id}`;
        const cached = await cache_service_1.cacheService.get(cacheKey);
        if (cached) {
            logger_1.logger.debug(`Cache hit for match team stats: ${cacheKey}`);
            return cached;
        }
        logger_1.logger.info(`Fetching match team stats for: ${match_id}`);
        // Try both endpoints in parallel for maximum coverage
        const [realtimeResult, historicalResult] = await Promise.allSettled([
            this.client.get('/match/team_stats/list'),
            this.client.get('/match/team_stats/detail', { match_id })
        ]);
        let finalResult = { results: [] };
        // Process realtime results (which contains all current matches)
        if (realtimeResult.status === 'fulfilled' && realtimeResult.value) {
            const results = realtimeResult.value.results || [];
            const matchStats = results.find((r) => r.id === match_id || r.match_id === match_id);
            if (matchStats) {
                logger_1.logger.info(`Found realtime team stats for ${match_id}`);
                finalResult.results.push(matchStats);
            }
        }
        // Process historical results if realtime didn't find the match
        if (finalResult.results.length === 0 && historicalResult.status === 'fulfilled' && historicalResult.value) {
            const results = historicalResult.value.results || [];
            if (results.length > 0) {
                logger_1.logger.info(`Found historical team stats for ${match_id}`);
                finalResult.results.push(...results);
            }
        }
        await cache_service_1.cacheService.set(cacheKey, finalResult, types_1.CacheTTL.FiveMinutes);
        return finalResult;
    }
}
exports.MatchTeamStatsService = MatchTeamStatsService;
