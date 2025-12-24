/**
 * Match Season Recent Service
 * 
 * Handles business logic for /match/season/recent endpoint
 */

import { TheSportsClient } from '../client/thesports-client';
import { logger } from '../../../utils/logger';
import { MatchSeasonRecentResponse, MatchSeasonRecentParams } from '../../../types/thesports/match';
import { cacheService } from '../../../utils/cache/cache.service';
import { CacheKeyPrefix, CacheTTL } from '../../../utils/cache/types';
import { MatchEnricherService } from './matchEnricher.service';
import { TeamDataService } from '../team/teamData.service';
import { TeamLogoService } from '../team/teamLogo.service';
import { CompetitionService } from '../competition/competition.service';

export class MatchSeasonRecentService {
  private matchEnricher: MatchEnricherService;

  constructor(private client: TheSportsClient) {
    const teamDataService = new TeamDataService(client);
    const teamLogoService = new TeamLogoService(client);
    const competitionService = new CompetitionService(client);
    this.matchEnricher = new MatchEnricherService(teamDataService, teamLogoService, competitionService);
  }

  /**
   * Get match season recent with cache support and team enrichment
   */
  async getMatchSeasonRecent(params: MatchSeasonRecentParams): Promise<MatchSeasonRecentResponse> {
    const { season_id, page = 1, limit = 50 } = params;
    const cacheKey = this.buildCacheKey(params);

    const cached = await cacheService.get<MatchSeasonRecentResponse>(cacheKey);
    if (cached) {
      logger.debug(`Cache hit for match season recent: ${cacheKey}`);
      return cached;
    }

    logger.info(`Fetching match season recent: season_id=${season_id}`);
    const response = await this.client.get<MatchSeasonRecentResponse>(
      '/match/season/recent',
      { season_id, page, limit }
    );

    // Enrich with team data if results exist
    let enrichedResults = response.results || [];
    if (enrichedResults.length > 0) {
      enrichedResults = await this.matchEnricher.enrichMatches(enrichedResults as any);
    }

    const enrichedResponse: MatchSeasonRecentResponse = {
      ...response,
      results: enrichedResults as any,
    };

    await cacheService.set(cacheKey, enrichedResponse, CacheTTL.TenMinutes);

    return enrichedResponse;
  }

  private buildCacheKey(params: MatchSeasonRecentParams): string {
    const { season_id, page = 1, limit = 50 } = params;
    return `${CacheKeyPrefix.TheSports}:match:season:recent:${season_id}:page:${page}:limit:${limit}`;
  }
}

