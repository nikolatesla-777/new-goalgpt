
/**
 * Match Player Stats Service
 * 
 * Handles business logic for /match/player_stats/list endpoint
 */

import { theSportsAPI } from '../../../core/TheSportsAPIManager';
import { logger } from '../../../utils/logger';
import { MatchPlayerStatsResponse, MatchPlayerStatsParams } from '../../../types/thesports/match';
import { cacheService } from '../../../utils/cache/cache.service';
import { CacheKeyPrefix, CacheTTL } from '../../../utils/cache/types';

export class MatchPlayerStatsService {
    private client = theSportsAPI;

  constructor() {}

  /**
   * Get match player stats with cache support
   */
  async getMatchPlayerStats(params: MatchPlayerStatsParams): Promise<MatchPlayerStatsResponse> {
    const { match_id } = params;
    const cacheKey = `${CacheKeyPrefix.TheSports}:match:player_stats:${match_id}`;

    const cached = await cacheService.get<MatchPlayerStatsResponse>(cacheKey);
    if (cached) {
      logger.debug(`Cache hit for match player stats: ${cacheKey}`);
      return cached;
    }

    logger.info(`Fetching match player stats: ${match_id}`);
    const response = await this.client.get<MatchPlayerStatsResponse>(
      '/match/player_stats/list',
      { match_id }
    );

    await cacheService.set(cacheKey, response, CacheTTL.FiveMinutes);

    return response;
  }
}

