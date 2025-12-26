/**
 * Match Team Stats Service
 * 
 * Handles business logic for /match/team_stats/detail endpoint
 * CRITICAL: Uses /detail endpoint (not /list) for specific match data
 */

import { TheSportsClient } from '../client/thesports-client';
import { logger } from '../../../utils/logger';
import { MatchTeamStatsResponse, MatchTeamStatsParams } from '../../../types/thesports/match';
import { cacheService } from '../../../utils/cache/cache.service';
import { CacheKeyPrefix, CacheTTL } from '../../../utils/cache/types';

export class MatchTeamStatsService {
  constructor(private client: TheSportsClient) { }

  /**
   * Get match team stats with cache support
   * CRITICAL: Uses /match/team_stats/detail (not /list) for specific match
   */
  async getMatchTeamStats(params: MatchTeamStatsParams): Promise<MatchTeamStatsResponse> {
    const { match_id } = params;
    const cacheKey = `${CacheKeyPrefix.TheSports}:match:team_stats:${match_id}`;

    const cached = await cacheService.get<MatchTeamStatsResponse>(cacheKey);
    if (cached) {
      logger.debug(`Cache hit for match team stats: ${cacheKey}`);
      return cached;
    }

    logger.info(`Fetching match team stats (detail): ${match_id}`);
    // CRITICAL FIX: Use /detail endpoint for specific match data
    const response = await this.client.get<MatchTeamStatsResponse>(
      '/match/team_stats/detail',
      { match_id }
    );

    await cacheService.set(cacheKey, response, CacheTTL.FiveMinutes);

    return response;
  }
}

