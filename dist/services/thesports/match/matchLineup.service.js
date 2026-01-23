"use strict";
/**
 * Match Lineup Service
 *
 * Handles business logic for /match/lineup/detail endpoint
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchLineupService = void 0;
const TheSportsAPIManager_1 = require("../../../core/TheSportsAPIManager");
const logger_1 = require("../../../utils/logger");
const cache_service_1 = require("../../../utils/cache/cache.service");
const types_1 = require("../../../utils/cache/types");
class MatchLineupService {
    constructor() {
        this.client = TheSportsAPIManager_1.theSportsAPI;
    }
    /**
     * Get match lineup with cache support
     */
    async getMatchLineup(params) {
        const { match_id } = params;
        const cacheKey = `${types_1.CacheKeyPrefix.TheSports}:match:lineup:${match_id}`;
        const cached = await cache_service_1.cacheService.get(cacheKey);
        if (cached) {
            logger_1.logger.debug(`Cache hit for match lineup: ${cacheKey}`);
            return cached;
        }
        logger_1.logger.info(`Fetching match lineup: ${match_id}`);
        const response = await this.client.get('/match/lineup/detail', { match_id });
        await cache_service_1.cacheService.set(cacheKey, response, types_1.CacheTTL.Hour);
        return response;
    }
}
exports.MatchLineupService = MatchLineupService;
