/**
 * Match Team Stats Service
 * 
 * Handles business logic for /match/team_stats/list endpoint
 */

import { TheSportsClient } from '../client/thesports-client';
import { logger } from '../../../utils/logger';
import { MatchTeamStatsResponse, MatchTeamStatsParams } from '../../../types/thesports/match';
import { cacheService } from '../../../utils/cache/cache.service';
import { CacheKeyPrefix, CacheTTL } from '../../../utils/cache/types';

export class MatchTeamStatsService {
  constructor(private client: TheSportsClient) {}

  /**
   * Get match team stats with cache support
   */
  async getMatchTeamStats(params: MatchTeamStatsParams): Promise<MatchTeamStatsResponse> {
    const { match_id } = params;
    const cacheKey = `${CacheKeyPrefix.TheSports}:match:team_stats:${match_id}`;

    const cached = await cacheService.get<MatchTeamStatsResponse>(cacheKey);
    if (cached) {
      logger.debug(`Cache hit for match team stats: ${cacheKey}`);
      return cached;
    }

    logger.info(`Fetching match team stats: ${match_id}`);
    const response = await this.client.get<MatchTeamStatsResponse>(
      '/match/team_stats/list',
      { match_id }
    );

    await cacheService.set(cacheKey, response, CacheTTL.FiveMinutes);

    return response;
  }
}

