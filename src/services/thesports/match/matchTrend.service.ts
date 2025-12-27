/**
 * Match Trend Service
 * 
 * Handles business logic for /match/trend/detail endpoint
 * CRITICAL: Uses /detail endpoint (not /live) for specific match data
 */

import { TheSportsClient } from '../client/thesports-client';
import { logger } from '../../../utils/logger';
import { MatchTrendParams, MatchTrendResponse } from '../../../types/thesports/match';
import { cacheService } from '../../../utils/cache/cache.service';
import { CacheKeyPrefix, CacheTTL } from '../../../utils/cache/types';

export class MatchTrendService {
    constructor(private client: TheSportsClient) { }

    /**
     * Get match trend detail (for specific match)
     * CRITICAL: Uses /detail endpoint for specific match data
     */
    async getMatchTrendDetail(params: MatchTrendParams): Promise<MatchTrendResponse> {
        const { match_id } = params;
        const cacheKey = `${CacheKeyPrefix.TheSports}:match:trend:detail:${match_id}`;

        const cached = await cacheService.get<MatchTrendResponse>(cacheKey);
        // Only use cache if it has actual data (not empty results)
        if (cached && cached.results && typeof cached.results === 'object' && !Array.isArray(cached.results)) {
            const results = cached.results as any;
            if (results.first_half?.length > 0 || results.second_half?.length > 0 || results.overtime?.length > 0) {
                logger.debug(`Cache hit for match trend detail: ${cacheKey}`);
                return cached;
            }
        }

        logger.info(`Fetching match trend detail: ${match_id}`);
        const response = await this.client.get<MatchTrendResponse>(
            '/match/trend/detail',
            { match_id }
        );

        // Only cache if response has actual data
        if (response && response.results) {
            const results = Array.isArray(response.results) ? response.results[0] : response.results;
            if (results && (results.first_half?.length > 0 || results.second_half?.length > 0 || results.overtime?.length > 0)) {
                await cacheService.set(cacheKey, response, CacheTTL.Hour);
            }
        }

        return response;
    }
}
