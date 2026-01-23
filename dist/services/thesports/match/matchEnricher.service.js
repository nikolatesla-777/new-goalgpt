"use strict";
/**
 * Match Enricher Service
 *
 * Enriches match data with team names and logos
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchEnricherService = void 0;
const logger_1 = require("../../../utils/logger");
class MatchEnricherService {
    constructor(teamDataService, teamLogoService, competitionService) {
        this.teamDataService = teamDataService;
        this.teamLogoService = teamLogoService;
        this.competitionService = competitionService;
    }
    /**
     * Enrich matches with team names, logos, and competition data
     */
    async enrichMatches(matches) {
        if (matches.length === 0)
            return [];
        // Collect all unique team and competition IDs
        const teamIds = new Set();
        const competitionIds = new Set();
        matches.forEach(match => {
            if (match.home_team_id)
                teamIds.add(match.home_team_id);
            if (match.away_team_id)
                teamIds.add(match.away_team_id);
            if (match.competition_id)
                competitionIds.add(match.competition_id);
        });
        // Batch fetch team and competition data
        const teams = await this.teamDataService.getTeamsByIds(Array.from(teamIds));
        const competitions = await this.competitionService.getCompetitionsByIds(Array.from(competitionIds));
        // Fetch missing teams individually from API if not in cache/DB
        const missingTeamIds = Array.from(teamIds).filter(id => !teams.has(id));
        if (missingTeamIds.length > 0) {
            logger_1.logger.debug(`Fetching ${missingTeamIds.length} missing teams from API`);
            // Fetch in parallel but limit concurrency
            const fetchPromises = missingTeamIds.slice(0, 10).map(async (teamId) => {
                try {
                    const team = await this.teamDataService.getTeamById(teamId);
                    if (team && team.name && team.name !== 'Unknown Team') {
                        teams.set(teamId, team);
                        logger_1.logger.debug(`Successfully fetched team ${teamId}: ${team.name}`);
                    }
                }
                catch (error) {
                    logger_1.logger.warn(`Failed to fetch team ${teamId} from API:`, error.message);
                }
            });
            await Promise.all(fetchPromises);
        }
        // Enrich matches
        const enrichedMatches = matches.map((match) => {
            // Try to get team from map, or fetch individually as last resort
            let homeTeam = teams.get(match.home_team_id);
            if (!homeTeam || homeTeam.name === 'Unknown Team') {
                // Try to fetch individually
                this.teamDataService.getTeamById(match.home_team_id)
                    .then(team => {
                    if (team && team.name && team.name !== 'Unknown Team') {
                        logger_1.logger.debug(`Fetched home team ${match.home_team_id}: ${team.name}`);
                    }
                })
                    .catch(() => { });
                homeTeam = {
                    id: match.home_team_id,
                    name: 'Unknown Team',
                    short_name: null,
                    logo_url: null,
                };
            }
            let awayTeam = teams.get(match.away_team_id);
            if (!awayTeam || awayTeam.name === 'Unknown Team') {
                // Try to fetch individually
                this.teamDataService.getTeamById(match.away_team_id)
                    .then(team => {
                    if (team && team.name && team.name !== 'Unknown Team') {
                        logger_1.logger.debug(`Fetched away team ${match.away_team_id}: ${team.name}`);
                    }
                })
                    .catch(() => { });
                awayTeam = {
                    id: match.away_team_id,
                    name: 'Unknown Team',
                    short_name: null,
                    logo_url: null,
                };
            }
            const competition = match.competition_id
                ? competitions.get(match.competition_id) || null
                : null;
            // Fetch logos if missing (non-blocking)
            if (!homeTeam.logo_url) {
                this.teamLogoService.getTeamLogoUrl(match.home_team_id)
                    .then(logoUrl => {
                    if (logoUrl) {
                        logger_1.logger.debug(`Fetched logo for home team: ${match.home_team_id}`);
                    }
                })
                    .catch(err => logger_1.logger.warn(`Failed to fetch logo for ${match.home_team_id}:`, err));
            }
            if (!awayTeam.logo_url) {
                this.teamLogoService.getTeamLogoUrl(match.away_team_id)
                    .then(logoUrl => {
                    if (logoUrl) {
                        logger_1.logger.debug(`Fetched logo for away team: ${match.away_team_id}`);
                    }
                })
                    .catch(err => logger_1.logger.warn(`Failed to fetch logo for ${match.away_team_id}:`, err));
            }
            return {
                ...match,
                home_team: homeTeam,
                away_team: awayTeam,
                competition: competition || undefined,
            };
        });
        return enrichedMatches;
    }
    /**
     * Get team data or create placeholder
     */
    async getOrFetchTeam(teamId, teams) {
        if (teams.has(teamId)) {
            const team = teams.get(teamId);
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
            return teams.get(teamId);
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
exports.MatchEnricherService = MatchEnricherService;
