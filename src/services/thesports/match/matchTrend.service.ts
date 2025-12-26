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
        if (cached) {
            logger.debug(`Cache hit for match trend detail: ${cacheKey}`);
            return cached;
        }

        logger.info(`Fetching match trend detail: ${match_id}`);
        const response = await this.client.get<MatchTrendResponse>(
            '/match/trend/detail',
            { match_id }
        );

        // Longer cache for historical data
        await cacheService.set(cacheKey, response, CacheTTL.Hour);

        return response;
    }
}
