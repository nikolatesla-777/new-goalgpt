
/**
 * Match Half Stats Service
 * 
 * Handles business logic for /match/half/team_stats/detail endpoint
 * CRITICAL: Uses /detail endpoint (not /list) for specific match data
 */

import { TheSportsClient } from '../client/thesports-client';
import { logger } from '../../../utils/logger';
import { MatchHalfStatsParams, MatchHalfStatsResponse } from '../../../types/thesports/match';
import { cacheService } from '../../../utils/cache/cache.service';
import { CacheKeyPrefix, CacheTTL } from '../../../utils/cache/types';

export class MatchHalfStatsService {
    constructor(private client: any) { }

    /**
     * Get match half stats detail (for specific match)
     * CRITICAL: Uses /detail endpoint for specific match data
     */
    async getMatchHalfStatsDetail(params: MatchHalfStatsParams): Promise<MatchHalfStatsResponse> {
        const { match_id } = params;
        const cacheKey = `${CacheKeyPrefix.TheSports}:match:half_stats:detail:${match_id}`;

        const cached = await cacheService.get<MatchHalfStatsResponse>(cacheKey);
        if (cached) {
            logger.debug(`Cache hit for match half stats detail: ${cacheKey}`);
            return cached;
        }

        logger.info(`Fetching match half stats detail: ${match_id}`);
        const response = await this.client.get<MatchHalfStatsResponse>(
            '/match/half/team_stats/detail',
            { match_id }
        );

        // Longer cache for historical data
        await cacheService.set(cacheKey, response, CacheTTL.Hour);

        return response;
    }
}
