
/**
 * Team Logo Service
 * 
 * Handles team logo URL retrieval with 4-source strategy
 */

import { TeamRepository } from '../../../repositories/implementations/TeamRepository';
import { theSportsAPI } from '../../../core/TheSportsAPIManager';
import { cacheService } from '../../../utils/cache/cache.service';
import { CacheKeyPrefix } from '../../../utils/cache/types';
import { logger } from '../../../utils/logger';
import axios from 'axios';
import { config } from '../../../config';

export class TeamLogoService {
  private client = theSportsAPI;
  private repository: TeamRepository;

  constructor() {
    this.repository = new TeamRepository();
  }

  /**
   * Get team logo URL (4-source strategy)
   * 1. Database
   * 2. results_extra (from cache)
   * 3. TheSports API team/detail
   * 4. Fallback URL pattern
   */
  async getTeamLogoUrl(teamId: string): Promise<string | null> {
    // 1. Check database
    const team = await this.repository.findByExternalId(teamId);
    if (team?.logo_url) {
      return team.logo_url;
    }

    // 2. Check results_extra from cache
    const resultsExtra = await this.getResultsExtraFromCache();
    if (resultsExtra?.team?.[teamId]?.logo_url) {
      const logoUrl = resultsExtra.team[teamId].logo_url!;
      if (team?.id) {
        await this.repository.update(team.id, { logo_url: logoUrl });
      } else {
        await this.repository.createOrUpdate({
          external_id: teamId,
          logo_url: logoUrl,
        });
      }
      return logoUrl;
    }

    // 3. Try TheSports API team/detail endpoint
    try {
      const teamDetail = await this.fetchTeamDetail(teamId);
      if (teamDetail?.logo_url) {
        await this.repository.update(team?.id || teamId, { logo_url: teamDetail.logo_url });
        return teamDetail.logo_url;
      }
    } catch (error: any) {
      logger.debug(`Team detail endpoint not available for ${teamId}`);
    }

    // 4. Fallback URL pattern
    const fallbackLogoUrl = this.buildFallbackLogoUrl(teamId);
    const isValid = await this.validateLogoUrl(fallbackLogoUrl);

    if (isValid) {
      if (team) {
        await this.repository.update(team.id, { logo_url: fallbackLogoUrl });
      } else {
        await this.repository.createOrUpdate({
          external_id: teamId,
          logo_url: fallbackLogoUrl,
        });
      }
      return fallbackLogoUrl;
    }

    return null;
  }

  /**
   * Get results_extra from cache
   */
  private async getResultsExtraFromCache(): Promise<{ team?: any } | null> {
    const today = new Date().toISOString().split('T')[0];
    const cacheKey = `${CacheKeyPrefix.TheSports}:diary:extra:${today}`;
    return cacheService.get<{ team?: any }>(cacheKey);
  }

  /**
   * Fetch team detail from API
   */
  private async fetchTeamDetail(teamId: string): Promise<{ logo_url?: string } | null> {
    try {
      // TODO: Implement when team/detail endpoint is available
      // const response = await this.client.get('/team/detail', { team_id: teamId });
      // return { logo_url: response.logo_url };
      return null;
    } catch (error: any) {
      return null;
    }
  }

  /**
   * Build fallback logo URL pattern
   */
  private buildFallbackLogoUrl(teamId: string): string {
    const baseUrl = config.thesports?.baseUrl || 'https://api.thesports.com/v1/football';
    const logoBaseUrl = baseUrl.replace('/v1/football', '');
    return `${logoBaseUrl}/logo/team/${teamId}.png`;
  }

  /**
   * Validate logo URL (HEAD request)
   */
  private async validateLogoUrl(url: string): Promise<boolean> {
    try {
      const response = await axios.head(url, { timeout: 5000 });
      return response.status === 200;
    } catch {
      return false;
    }
  }
}

