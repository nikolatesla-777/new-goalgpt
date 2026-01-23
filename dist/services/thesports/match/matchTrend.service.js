"use strict";
/**
 * Match Trend Service
 *
 * Handles business logic for /match/trend/live and /match/trend/detail endpoints
 * CRITICAL:
 * - Use /live endpoint for real-time matches (status IN (2,3,4,5,7))
 * - Use /detail endpoint for finished matches or when /live returns no data
 * According to TheSports API docs:
 * - /match/trend/live: "Returns home and away team trend details for real-time matches"
 * - Recommended request frequency: 1 minute/time
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchTrendService = void 0;
const TheSportsAPIManager_1 = require("../../../core/TheSportsAPIManager");
const logger_1 = require("../../../utils/logger");
const cache_service_1 = require("../../../utils/cache/cache.service");
const types_1 = require("../../../utils/cache/types");
class MatchTrendService {
    constructor() {
        this.client = TheSportsAPIManager_1.theSportsAPI;
    }
    /**
     * Parse trend data from TheSports API format to frontend format
     * API returns: { match_id, trend: { count, per, data: [[first_half_values], [second_half_values]] } }
     * Frontend expects: { match_id, first_half: TrendPoint[], second_half: TrendPoint[] }
     */
    parseTrendData(apiResponse, matchId) {
        try {
            // Handle different response formats
            const trendObj = apiResponse?.trend || apiResponse?.results?.trend;
            if (!trendObj || !trendObj.data || !Array.isArray(trendObj.data)) {
                return null;
            }
            const data = trendObj.data;
            const firstHalfArray = data[0] || [];
            const secondHalfArray = data[1] || [];
            // Convert arrays to TrendPoint[] format
            // Each value represents the trend value for that minute
            // Positive = home team, Negative = away team
            const firstHalf = firstHalfArray.map((value, index) => ({
                minute: index + 1,
                home_value: value > 0 ? value : 0,
                away_value: value < 0 ? Math.abs(value) : 0,
            }));
            const secondHalf = secondHalfArray.map((value, index) => ({
                minute: index + 46, // Second half starts at minute 46
                home_value: value > 0 ? value : 0,
                away_value: value < 0 ? Math.abs(value) : 0,
            }));
            return {
                match_id: matchId,
                first_half: firstHalf,
                second_half: secondHalf,
            };
        }
        catch (error) {
            logger_1.logger.error(`Error parsing trend data for ${matchId}:`, error);
            return null;
        }
    }
    /**
     * Get match trend live (for real-time matches)
     * CRITICAL: Use this endpoint for matches in progress (status IN (2,3,4,5,7))
     * According to TheSports API docs: "Real-time match trends. Returns home and away team trend details for real-time matches"
     */
    async getMatchTrendLive(params) {
        const { match_id } = params;
        const cacheKey = `${types_1.CacheKeyPrefix.TheSports}:match:trend:live:${match_id}`;
        // Don't cache live data - always fetch fresh (cache TTL is very short for live data)
        logger_1.logger.info(`Fetching match trend live: ${match_id}`);
        const rawResponse = await this.client.get('/match/trend/live', { match_id });
        // Parse the response to frontend format
        // API can return single object or array
        if (rawResponse?.results) {
            const results = Array.isArray(rawResponse.results) ? rawResponse.results : [rawResponse.results];
            const parsedResults = results
                .map((item) => {
                const parsed = this.parseTrendData(item, match_id);
                return parsed;
            })
                .filter((item) => item !== null);
            if (parsedResults.length > 0) {
                return {
                    code: rawResponse.code,
                    results: parsedResults,
                    err: rawResponse.err,
                };
            }
        }
        // If parsing fails, return original response
        return rawResponse;
    }
    /**
     * Get match trend detail (for finished matches or fallback)
     * CRITICAL: Use this endpoint for finished matches or when /live returns no data
     * Request limit: Matches within 30 days before today
     */
    async getMatchTrendDetail(params) {
        const { match_id } = params;
        const cacheKey = `${types_1.CacheKeyPrefix.TheSports}:match:trend:detail:${match_id}`;
        const cached = await cache_service_1.cacheService.get(cacheKey);
        // Only use cache if it has actual data (not empty results)
        if (cached && cached.results && typeof cached.results === 'object' && !Array.isArray(cached.results)) {
            const results = cached.results;
            if (results.first_half?.length > 0 || results.second_half?.length > 0 || results.overtime?.length > 0) {
                logger_1.logger.debug(`Cache hit for match trend detail: ${cacheKey}`);
                return cached;
            }
        }
        logger_1.logger.info(`Fetching match trend detail: ${match_id}`);
        const response = await this.client.get('/match/trend/detail', { match_id });
        // Only cache if response has actual data
        if (response && response.results) {
            const results = Array.isArray(response.results) ? response.results[0] : response.results;
            // Check if results is an empty object (API returns {} when no trend data available)
            if (results && typeof results === 'object' && !Array.isArray(results)) {
                if ((results.first_half?.length ?? 0) > 0 || (results.second_half?.length ?? 0) > 0 || (results.overtime?.length ?? 0) > 0) {
                    await cache_service_1.cacheService.set(cacheKey, response, types_1.CacheTTL.Hour);
                }
                else {
                    logger_1.logger.debug(`Trend data not available for match ${match_id} (empty results)`);
                }
            }
        }
        return response;
    }
    /**
     * Get match trend (automatically chooses live or detail based on match status)
     * CRITICAL: For live matches (status IN (2,3,4,5,7)), uses /live endpoint
     * For finished matches, uses /detail endpoint
     *
     * Returns MatchTrendResponse format (normalized) for both endpoints
     */
    async getMatchTrend(params, matchStatus) {
        const { match_id } = params;
        // If match is live, use /live endpoint
        if (matchStatus && [2, 3, 4, 5, 7].includes(matchStatus)) {
            logger_1.logger.debug(`Match ${match_id} is live (status=${matchStatus}), using /live endpoint`);
            try {
                const liveResponse = await this.getMatchTrendLive(params);
                // Check if live response has data
                // MatchTrendLiveResponse.results is MatchTrendData[] (array)
                if (liveResponse && liveResponse.results && Array.isArray(liveResponse.results) && liveResponse.results.length > 0) {
                    // Normalize to MatchTrendResponse format (results can be array or single object)
                    // For consistency with frontend, return first element if array
                    const normalizedResponse = {
                        code: liveResponse.code,
                        results: liveResponse.results[0], // Return first match trend data
                        err: liveResponse.err,
                    };
                    return normalizedResponse;
                }
                // If /live returns no data, fallback to /detail
                logger_1.logger.debug(`Match ${match_id} /live returned no data, falling back to /detail`);
            }
            catch (error) {
                logger_1.logger.warn(`Match ${match_id} /live failed, falling back to /detail:`, error.message);
                // Fallback to /detail on error
            }
        }
        // Use /detail endpoint for finished matches or as fallback
        return await this.getMatchTrendDetail(params);
    }
}
exports.MatchTrendService = MatchTrendService;
