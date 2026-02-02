
/**
 * Match Enricher Service
 * 
 * Enriches match data with team names and logos
 */

import { TeamDataService } from '../team/teamData.service';
import { TeamLogoService } from '../team/teamLogo.service';
import { CompetitionService } from '../competition/competition.service';
import { MatchRecent } from '../../../types/thesports/match';
import { TeamData } from '../../../types/thesports/team';
import { Competition } from '../competition/competition.service';
import { logger } from '../../../utils/logger';
import { ConcurrencyLimiter } from '../../../utils/concurrency';
import { CONCURRENCY_LIMITS } from '../../../config/features';

export interface EnrichedMatch extends MatchRecent {
  home_team: TeamData;
  away_team: TeamData;
  competition?: Competition;
}

export class MatchEnricherService {
  private teamDataService: TeamDataService;
  private teamLogoService: TeamLogoService;
  private competitionService: CompetitionService;

  constructor(
    teamDataService: TeamDataService,
    teamLogoService: TeamLogoService,
    competitionService: CompetitionService
  ) {
    this.teamDataService = teamDataService;
    this.teamLogoService = teamLogoService;
    this.competitionService = competitionService;
  }

  /**
   * Enrich matches with team names, logos, and competition data
   */
  async enrichMatches(matches: MatchRecent[]): Promise<EnrichedMatch[]> {
    if (matches.length === 0) return [];

    // Collect all unique team and competition IDs
    const teamIds = new Set<string>();
    const competitionIds = new Set<string>();
    matches.forEach(match => {
      if (match.home_team_id) teamIds.add(match.home_team_id);
      if (match.away_team_id) teamIds.add(match.away_team_id);
      if (match.competition_id) competitionIds.add(match.competition_id);
    });

    // Batch fetch team and competition data
    const teams = await this.teamDataService.getTeamsByIds(Array.from(teamIds));
    const competitions = await this.competitionService.getCompetitionsByIds(Array.from(competitionIds));

    // Fetch missing teams individually from API if not in cache/DB
    const missingTeamIds = Array.from(teamIds).filter(id => !teams.has(id));
    if (missingTeamIds.length > 0) {
      logger.debug(`Fetching ${missingTeamIds.length} missing teams from API`);

      // ✅ BOUNDED CONCURRENCY: Prevent pool exhaustion
      const limiter = new ConcurrencyLimiter(CONCURRENCY_LIMITS.MATCH_ENRICHER);
      await limiter.forEach(missingTeamIds.slice(0, 10), async (teamId) => {
        try {
          const team = await this.teamDataService.getTeamById(teamId);
          if (team && team.name && team.name !== 'Unknown Team') {
            teams.set(teamId, team);
            logger.debug(`Successfully fetched team ${teamId}: ${team.name}`);
          }
        } catch (error: any) {
          logger.warn(`Failed to fetch team ${teamId} from API:`, error.message);
        }
      });
    }

    // Enrich matches with existing data
    const enrichedMatches = matches.map((match) => {
        const homeTeam = teams.get(match.home_team_id) || {
          id: match.home_team_id,
          name: 'Unknown Team',
          short_name: null,
          logo_url: null,
        };

        const awayTeam = teams.get(match.away_team_id) || {
          id: match.away_team_id,
          name: 'Unknown Team',
          short_name: null,
          logo_url: null,
        };

        const competition = match.competition_id
          ? competitions.get(match.competition_id) || null
          : null;

        return {
          ...match,
          home_team: homeTeam,
          away_team: awayTeam,
          competition: competition || undefined,
        };
    });

    // ✅ BOUNDED CONCURRENCY: Fetch missing teams/logos with proper tracking
    // Collect all teams that still need fetching
    const teamsToFetch: Array<{ matchIndex: number; teamType: 'home' | 'away'; teamId: string }> = [];
    enrichedMatches.forEach((match, index) => {
      if (match.home_team.name === 'Unknown Team') {
        teamsToFetch.push({ matchIndex: index, teamType: 'home', teamId: match.home_team_id });
      }
      if (match.away_team.name === 'Unknown Team') {
        teamsToFetch.push({ matchIndex: index, teamType: 'away', teamId: match.away_team_id });
      }
    });

    // Fetch missing teams with bounded concurrency
    if (teamsToFetch.length > 0) {
      const limiter = new ConcurrencyLimiter(CONCURRENCY_LIMITS.MATCH_ENRICHER);
      await limiter.forEach(teamsToFetch, async ({ matchIndex, teamType, teamId }) => {
        try {
          const team = await this.teamDataService.getTeamById(teamId);
          if (team && team.name && team.name !== 'Unknown Team') {
            if (teamType === 'home') {
              enrichedMatches[matchIndex].home_team = team;
            } else {
              enrichedMatches[matchIndex].away_team = team;
            }
            logger.debug(`✅ Fetched ${teamType} team ${teamId}: ${team.name}`);
          }
        } catch (error: any) {
          logger.warn(`❌ Failed to fetch ${teamType} team ${teamId}:`, error.message);
        }
      });
    }

    // Fetch logos for teams missing them (with bounded concurrency)
    const logosToFetch: Array<{ matchIndex: number; teamType: 'home' | 'away'; teamId: string }> = [];
    enrichedMatches.forEach((match, index) => {
      if (!match.home_team.logo_url) {
        logosToFetch.push({ matchIndex: index, teamType: 'home', teamId: match.home_team_id });
      }
      if (!match.away_team.logo_url) {
        logosToFetch.push({ matchIndex: index, teamType: 'away', teamId: match.away_team_id });
      }
    });

    if (logosToFetch.length > 0) {
      const limiter = new ConcurrencyLimiter(CONCURRENCY_LIMITS.MATCH_ENRICHER);
      await limiter.forEach(logosToFetch, async ({ matchIndex, teamType, teamId }) => {
        try {
          const logoUrl = await this.teamLogoService.getTeamLogoUrl(teamId);
          if (logoUrl) {
            if (teamType === 'home') {
              enrichedMatches[matchIndex].home_team.logo_url = logoUrl;
            } else {
              enrichedMatches[matchIndex].away_team.logo_url = logoUrl;
            }
            logger.debug(`✅ Fetched logo for ${teamType} team: ${teamId}`);
          }
        } catch (error: any) {
          logger.warn(`❌ Failed to fetch logo for ${teamId}:`, error.message);
        }
      });
    }

    return enrichedMatches;
  }

  /**
   * Get team data or create placeholder
   */
  private async getOrFetchTeam(
    teamId: string,
    teams: Map<string, TeamData>
  ): Promise<TeamData> {
    if (teams.has(teamId)) {
      const team = teams.get(teamId)!;
      // If team has name, return it; otherwise try to fetch
      if (team.name && team.name !== 'Unknown Team') {
        return team;
      }
    }

    // Try to fetch individually (will check cache, DB, then API)
    const team = await this.teamDataService.getTeamById(teamId);
    if (team && team.name && team.name !== 'Unknown Team') {
      teams.set(teamId, team);
      return team;
    }

    // If we have a team from map but it's unknown, return it
    if (teams.has(teamId)) {
      return teams.get(teamId)!;
    }

    // Return placeholder
    return {
      id: teamId,
      name: 'Unknown Team',
      short_name: null,
      logo_url: null,
    };
  }
}

