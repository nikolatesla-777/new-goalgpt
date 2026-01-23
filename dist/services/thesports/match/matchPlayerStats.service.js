"use strict";
/**
 * Match Player Stats Service
 *
 * Handles business logic for /match/player_stats/list endpoint
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchPlayerStatsService = void 0;
const TheSportsAPIManager_1 = require("../../../core/TheSportsAPIManager");
const logger_1 = require("../../../utils/logger");
const cache_service_1 = require("../../../utils/cache/cache.service");
const types_1 = require("../../../utils/cache/types");
class MatchPlayerStatsService {
    constructor() {
        this.client = TheSportsAPIManager_1.theSportsAPI;
    }
    /**
     * Get match player stats with cache support
     */
    async getMatchPlayerStats(params) {
        const { match_id } = params;
        const cacheKey = `${types_1.CacheKeyPrefix.TheSports}:match:player_stats:${match_id}`;
        const cached = await cache_service_1.cacheService.get(cacheKey);
        if (cached) {
            logger_1.logger.debug(`Cache hit for match player stats: ${cacheKey}`);
            return cached;
        }
        logger_1.logger.info(`Fetching match player stats: ${match_id}`);
        const response = await this.client.get('/match/player_stats/list', { match_id });
        await cache_service_1.cacheService.set(cacheKey, response, types_1.CacheTTL.FiveMinutes);
        return response;
    }
}
exports.MatchPlayerStatsService = MatchPlayerStatsService;
