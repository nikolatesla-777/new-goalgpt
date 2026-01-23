"use strict";
/**
 * Match Analysis Service (H2H)
 *
 * Handles business logic for /match/analysis endpoint
 * Returns historical confrontation, recent results, and goal distribution
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchAnalysisService = void 0;
const TheSportsAPIManager_1 = require("../../../core/TheSportsAPIManager");
const logger_1 = require("../../../utils/logger");
const cache_service_1 = require("../../../utils/cache/cache.service");
const types_1 = require("../../../utils/cache/types");
class MatchAnalysisService {
    constructor() {
        this.client = TheSportsAPIManager_1.theSportsAPI;
    }
    /**
     * Get match analysis (H2H) with cache support
     */
    async getMatchAnalysis(params) {
        const { match_id } = params;
        const cacheKey = `${types_1.CacheKeyPrefix.TheSports}:match:analysis:${match_id}`;
        const cached = await cache_service_1.cacheService.get(cacheKey);
        if (cached) {
            logger_1.logger.debug(`Cache hit for match analysis: ${cacheKey}`);
            return cached;
        }
        logger_1.logger.info(`Fetching match analysis (H2H): ${match_id}`);
        const response = await this.client.get('/match/analysis', { match_id });
        // Cache for 1 hour (H2H data doesn't change frequently)
        await cache_service_1.cacheService.set(cacheKey, response, types_1.CacheTTL.Hour);
        return response;
    }
}
exports.MatchAnalysisService = MatchAnalysisService;
