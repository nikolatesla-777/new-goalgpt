"use strict";
/**
 * Match Half Stats Service
 *
 * Handles business logic for /match/half/team_stats/detail endpoint
 * CRITICAL: Uses /detail endpoint (not /list) for specific match data
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchHalfStatsService = void 0;
const TheSportsAPIManager_1 = require("../../../core/TheSportsAPIManager");
const logger_1 = require("../../../utils/logger");
const cache_service_1 = require("../../../utils/cache/cache.service");
const types_1 = require("../../../utils/cache/types");
class MatchHalfStatsService {
    constructor() {
        this.client = TheSportsAPIManager_1.theSportsAPI;
    }
    /**
     * Get match half stats detail (for specific match)
     * CRITICAL: Uses /detail endpoint for specific match data
     */
    async getMatchHalfStatsDetail(params) {
        const { match_id } = params;
        const cacheKey = `${types_1.CacheKeyPrefix.TheSports}:match:half_stats:detail:${match_id}`;
        const cached = await cache_service_1.cacheService.get(cacheKey);
        if (cached) {
            logger_1.logger.debug(`Cache hit for match half stats detail: ${cacheKey}`);
            return cached;
        }
        logger_1.logger.info(`Fetching match half stats detail: ${match_id}`);
        const response = await this.client.get('/match/half/team_stats/detail', { match_id });
        // Longer cache for historical data
        await cache_service_1.cacheService.set(cacheKey, response, types_1.CacheTTL.Hour);
        return response;
    }
}
exports.MatchHalfStatsService = MatchHalfStatsService;
