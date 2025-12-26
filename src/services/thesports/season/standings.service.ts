/**
 * Season Standings Service
 * 
 * Handles business logic for /season/recent/table/detail endpoint
 * Returns league standings/table data
 */

import { TheSportsClient } from '../client/thesports-client';
import { logger } from '../../../utils/logger';
import { SeasonStandingsParams, SeasonStandingsResponse } from '../../../types/thesports/season/seasonStandings.types';
import { cacheService } from '../../../utils/cache/cache.service';
import { CacheKeyPrefix, CacheTTL } from '../../../utils/cache/types';

export class SeasonStandingsService {
    constructor(private client: TheSportsClient) { }

    /**
     * Get season standings with cache support
     */
    async getSeasonStandings(params: SeasonStandingsParams): Promise<SeasonStandingsResponse> {
        const { season_id } = params;
        const cacheKey = `${CacheKeyPrefix.TheSports}:season:standings:${season_id}`;

        const cached = await cacheService.get<SeasonStandingsResponse>(cacheKey);
        if (cached) {
            logger.debug(`Cache hit for season standings: ${cacheKey}`);
            return cached;
        }

        logger.info(`Fetching season standings: ${season_id}`);
        const response = await this.client.get<SeasonStandingsResponse>(
            '/season/recent/table/detail',
            { season_id }
        );

        // Cache for 5 minutes (standings can change during matches)
        await cacheService.set(cacheKey, response, CacheTTL.FiveMinutes);

        return response;
    }
}
