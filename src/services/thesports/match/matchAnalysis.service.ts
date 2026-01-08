
/**
 * Match Analysis Service (H2H)
 *
 * Handles business logic for /match/analysis endpoint
 * Returns historical confrontation, recent results, and goal distribution
 */

import { theSportsAPI } from '../../../core/TheSportsAPIManager';
import { logger } from '../../../utils/logger';
import { MatchAnalysisParams, MatchAnalysisResponse } from '../../../types/thesports/match';
import { cacheService } from '../../../utils/cache/cache.service';
import { CacheKeyPrefix, CacheTTL } from '../../../utils/cache/types';

export class MatchAnalysisService {
    private client = theSportsAPI;

    constructor() { }

    /**
     * Get match analysis (H2H) with cache support
     */
    async getMatchAnalysis(params: MatchAnalysisParams): Promise<MatchAnalysisResponse> {
        const { match_id } = params;
        const cacheKey = `${CacheKeyPrefix.TheSports}:match:analysis:${match_id}`;

        const cached = await cacheService.get<MatchAnalysisResponse>(cacheKey);
        if (cached) {
            logger.debug(`Cache hit for match analysis: ${cacheKey}`);
            return cached;
        }

        logger.info(`Fetching match analysis (H2H): ${match_id}`);
        const response = await this.client.get<MatchAnalysisResponse>(
            '/match/analysis',
            { match_id }
        );

        // Cache for 1 hour (H2H data doesn't change frequently)
        await cacheService.set(cacheKey, response, CacheTTL.Hour);

        return response;
    }
}
