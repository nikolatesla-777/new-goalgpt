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
   * Tries both realtime (/list) and historical (/detail) endpoints
   */
  async getMatchTeamStats(params: MatchTeamStatsParams): Promise<MatchTeamStatsResponse> {
    const { match_id } = params;
    const cacheKey = `${CacheKeyPrefix.TheSports}:match:team_stats:${match_id}`;

    const cached = await cacheService.get<MatchTeamStatsResponse>(cacheKey);
    if (cached) {
      logger.debug(`Cache hit for match team stats: ${cacheKey}`);
      return cached;
    }

    logger.info(`Fetching match team stats for: ${match_id}`);

    // Try both endpoints in parallel for maximum coverage
    const [realtimeResult, historicalResult] = await Promise.allSettled([
      this.client.get<any>('/match/team_stats/list'),
      this.client.get<any>('/match/team_stats/detail', { match_id })
    ]);

    let finalResult: any = { results: [] };

    // Process realtime results (which contains all current matches)
    if (realtimeResult.status === 'fulfilled' && realtimeResult.value) {
      const results = realtimeResult.value.results || [];
      const matchStats = results.find((r: any) => r.id === match_id || r.match_id === match_id);
      if (matchStats) {
        logger.info(`Found realtime team stats for ${match_id}`);
        finalResult.results.push(matchStats);
      }
    }

    // Process historical results if realtime didn't find the match
    if (finalResult.results.length === 0 && historicalResult.status === 'fulfilled' && historicalResult.value) {
      const results = historicalResult.value.results || [];
      if (results.length > 0) {
        logger.info(`Found historical team stats for ${match_id}`);
        finalResult.results.push(...results);
      }
    }

    await cacheService.set(cacheKey, finalResult, CacheTTL.FiveMinutes);

    return finalResult;
  }
}

