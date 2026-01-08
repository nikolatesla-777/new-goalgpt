
/**
 * Team Data Service
 * 
 * Handles team data retrieval with cache-first strategy
 */

import { TeamRepository } from '../../../repositories/implementations/TeamRepository';
import { TheSportsClient } from '../client/thesports-client';
import { cacheService } from '../../../utils/cache/cache.service';
import { CacheKeyPrefix, CacheTTL } from '../../../utils/cache/types';
import { logger } from '../../../utils/logger';
import { TeamData, ResultsExtraTeam } from '../../../types/thesports/team';

export class TeamDataService {
  private repository: TeamRepository;
  private client: any;

  constructor(client: any) {
    this.repository = new TeamRepository();
    this.client = client;
  }

  /**
   * Get team by ID (cache-first strategy)
   * 1. Cache
   * 2. Database
   * 3. API
   */
  async getTeamById(teamId: string): Promise<TeamData | null> {
    const cacheKey = `${CacheKeyPrefix.TheSports}:team:${teamId}`;

    // 1. Check cache
    const cached = await cacheService.get<TeamData>(cacheKey);
    if (cached) {
      logger.debug(`Cache hit for team: ${teamId}`);
      return cached;
    }

    // 2. Check database
    const dbTeam = await this.repository.findByExternalId(teamId);
    if (dbTeam) {
      const teamData = this.mapToTeamData(dbTeam);
      await cacheService.set(cacheKey, teamData, CacheTTL.Day);
      return teamData;
    }

    // 3. Fetch from API (if team/detail endpoint exists)
    try {
      const apiTeam = await this.fetchTeamFromAPI(teamId);
      if (apiTeam) {
        await this.repository.createOrUpdate({
          external_id: teamId,
          ...apiTeam,
        });
        await cacheService.set(cacheKey, apiTeam, CacheTTL.Day);
        return apiTeam;
      }
    } catch (error: any) {
      logger.warn(`Failed to fetch team ${teamId} from API:`, error.message);
    }

    return null;
  }

  /**
   * Get multiple teams by IDs (batch processing)
   */
  async getTeamsByIds(teamIds: string[]): Promise<Map<string, TeamData>> {
    const results = new Map<string, TeamData>();
    const missingIds: string[] = [];

    // 1. Check cache for all
    for (const teamId of teamIds) {
      const cacheKey = `${CacheKeyPrefix.TheSports}:team:${teamId}`;
      const cached = await cacheService.get<TeamData>(cacheKey);
      if (cached) {
        results.set(teamId, cached);
      } else {
        missingIds.push(teamId);
      }
    }

    // 2. Check database for missing
    if (missingIds.length > 0) {
      const dbTeams = await this.repository.findByExternalIds(missingIds);
      for (const team of dbTeams) {
        const teamData = this.mapToTeamData(team);
        results.set(team.external_id, teamData);
        
        const cacheKey = `${CacheKeyPrefix.TheSports}:team:${team.external_id}`;
        await cacheService.set(cacheKey, teamData, CacheTTL.Day);
      }

      // 3. Fetch from API for still missing teams
      const stillMissing = missingIds.filter(id => !results.has(id));
      if (stillMissing.length > 0) {
        logger.debug(`Fetching ${stillMissing.length} teams from API individually`);
        // Fetch in parallel but limit to first 10 to avoid overwhelming API
        const fetchPromises = stillMissing.slice(0, 10).map(async (teamId) => {
          try {
            const team = await this.getTeamById(teamId);
            if (team) {
              results.set(teamId, team);
            }
          } catch (error: any) {
            logger.warn(`Failed to fetch individual team ${teamId} from API:`, error.message);
          }
        });
        await Promise.all(fetchPromises);
      }
    }

    return results;
  }

  /**
   * Enrich from results_extra (from API responses)
   * NOTE: results_extra.team can be either an array or an object
   */
  async enrichFromResultsExtra(resultsExtra: { team?: ResultsExtraTeam | Array<{ id: string; name?: string; logo?: string; logo_url?: string; short_name?: string }> }): Promise<void> {
    if (!resultsExtra.team) return;

    const teamsToUpdate: Array<{ external_id: string; data: Partial<TeamData> }> = [];

    // Handle both array and object formats
    if (Array.isArray(resultsExtra.team)) {
      // Array format: [{ id: "...", name: "...", logo: "..." }, ...]
      for (const team of resultsExtra.team) {
        if (team.id) {
          const teamData: TeamData = {
            id: team.id,
            name: team.name || null,
            logo_url: team.logo || team.logo_url || null,
            short_name: team.short_name || null,
          };

          teamsToUpdate.push({
            external_id: team.id,
            data: teamData,
          });

          // Update cache
          const cacheKey = `${CacheKeyPrefix.TheSports}:team:${team.id}`;
          await cacheService.set(cacheKey, teamData, CacheTTL.Day);
        }
      }
    } else {
      // Object format: { "team_id": { name: "...", logo_url: "..." }, ... }
      for (const [teamId, teamInfo] of Object.entries(resultsExtra.team)) {
        const teamData: TeamData = {
          id: teamId,
          name: teamInfo.name || null,
          logo_url: teamInfo.logo_url || null,
          short_name: teamInfo.short_name || null,
        };

        teamsToUpdate.push({
          external_id: teamId,
          data: teamData,
        });

        // Update cache
        const cacheKey = `${CacheKeyPrefix.TheSports}:team:${teamId}`;
        await cacheService.set(cacheKey, teamData, CacheTTL.Day);
      }
    }

    // Batch update database
    for (const { external_id, data } of teamsToUpdate) {
      try {
        await this.repository.createOrUpdate({
          external_id,
          ...data,
        });
      } catch (error: any) {
        logger.error(`Failed to update team ${external_id}:`, error);
      }
    }

    logger.info(`Enriched ${teamsToUpdate.length} teams from results_extra (format: ${Array.isArray(resultsExtra.team) ? 'ARRAY' : 'OBJECT'})`);
  }

  /**
   * Map database Team to TeamData
   */
  private mapToTeamData(team: any): TeamData {
    return {
      id: team.external_id,
      name: team.name,
      short_name: team.short_name,
      logo_url: team.logo_url,
      country_id: team.country_id,
      competition_id: team.competition_id,
    };
  }

  /**
   * Fetch team from API using /team/additional/list with pagination
   * NOTE: /team/list endpoint is not documented in API docs, using /team/additional/list instead
   */
  private async fetchTeamFromAPI(teamId: string): Promise<TeamData | null> {
    try {
      // Use /team/additional/list endpoint (documented endpoint)
      // Search through pages to find the team by ID
      let page = 1;
      let hasMore = true;
      const maxPages = 10; // Limit search to prevent infinite loops

      while (hasMore && page <= maxPages) {
        const response = await this.client.get<any>('/team/additional/list', { 
          page,
          limit: 100, // Fetch 100 teams per page
        });
        
        if (response.results && response.results.length > 0) {
          // Search for the team in current page
          const team = response.results.find((t: any) => t.id === teamId);
          
          if (team) {
            return {
              id: team.id || teamId,
              name: team.name || null,
              logo_url: team.logo_url || team.logo || null,
              short_name: team.short_name || null,
              country_id: team.country_id || null,
              competition_id: team.competition_id || null,
            };
          }
          
          // If results array is empty, stop searching
          if (response.results.length === 0) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          hasMore = false;
        }
      }
      
      logger.debug(`Team ${teamId} not found in first ${maxPages} pages of /team/additional/list`);
      return null;
    } catch (error: any) {
      logger.debug(`Team API fetch failed for ${teamId}:`, error.message);
      return null;
    }
  }
}

