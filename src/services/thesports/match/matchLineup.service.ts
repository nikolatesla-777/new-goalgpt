/**
 * Match Lineup Service
 * 
 * Handles business logic for /match/lineup/detail endpoint
 */

import { TheSportsClient } from '../client/thesports-client';
import { logger } from '../../../utils/logger';
import { MatchLineupResponse, MatchLineupParams } from '../../../types/thesports/match';
import { cacheService } from '../../../utils/cache/cache.service';
import { CacheKeyPrefix, CacheTTL } from '../../../utils/cache/types';

export class MatchLineupService {
  constructor(private client: TheSportsClient) {}

  /**
   * Get match lineup with cache support
   */
  async getMatchLineup(params: MatchLineupParams): Promise<MatchLineupResponse> {
    const { match_id } = params;
    const cacheKey = `${CacheKeyPrefix.TheSports}:match:lineup:${match_id}`;

    const cached = await cacheService.get<MatchLineupResponse>(cacheKey);
    if (cached) {
      logger.debug(`Cache hit for match lineup: ${cacheKey}`);
      return cached;
    }

    logger.info(`Fetching match lineup: ${match_id}`);
    const response = await this.client.get<MatchLineupResponse>(
      '/match/lineup/detail',
      { match_id }
    );

    await cacheService.set(cacheKey, response, CacheTTL.Hour);

    return response;
  }
}

