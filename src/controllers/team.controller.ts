/**
 * Team Controller
 * 
 * Handles team-related API endpoints
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { pool } from '../database/connection';
import { TheSportsClient } from '../services/thesports/client/thesports-client';
import { SeasonStandingsService } from '../services/thesports/season/standings.service';
import { logger } from '../utils/logger';

const theSportsClient = new TheSportsClient();
const seasonStandingsService = new SeasonStandingsService(theSportsClient);

/**
 * Get team by ID
 * GET /api/teams/:team_id
 */
export const getTeamById = async (
  request: FastifyRequest<{ Params: { team_id: string } }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    const { team_id } = request.params;
    
    const client = await pool.connect();
    try {
      // Get team info from ts_teams
      const teamResult = await client.query(
        `SELECT external_id, name, short_name, logo_url, country_id, competition_id
         FROM ts_teams WHERE external_id = $1`,
        [team_id]
      );
      
      if (teamResult.rows.length === 0) {
        reply.status(404).send({
          success: false,
          message: 'Team not found',
        });
        return;
      }
      
      const team = teamResult.rows[0];
      
      // Get team's current season (from most recent match)
      const seasonResult = await client.query(
        `SELECT season_id, competition_id 
         FROM ts_matches 
         WHERE home_team_id = $1 OR away_team_id = $1
         ORDER BY match_time DESC
         LIMIT 1`,
        [team_id]
      );
      
      const currentSeasonId = seasonResult.rows[0]?.season_id || null;
      
      // Get competition info
      let competition = null;
      if (team.competition_id) {
        const compResult = await client.query(
          `SELECT external_id, name, logo_url FROM ts_competitions WHERE external_id = $1`,
          [team.competition_id]
        );
        competition = compResult.rows[0] || null;
      }
      
      // Get recent form (last 5 matches)
      const formResult = await client.query(
        `SELECT 
          m.external_id,
          m.home_team_id,
          m.away_team_id,
          m.home_score_display,
          m.away_score_display,
          m.match_time,
          m.status_id,
          ht.name as home_team_name,
          at.name as away_team_name
         FROM ts_matches m
         LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id
         LEFT JOIN ts_teams at ON m.away_team_id = at.external_id
         WHERE (m.home_team_id = $1 OR m.away_team_id = $1)
           AND m.status_id = 8
         ORDER BY m.match_time DESC
         LIMIT 5`,
        [team_id]
      );
      
      // Calculate form (W/D/L)
      const recentForm = formResult.rows.map(match => {
        const isHome = match.home_team_id === team_id;
        const teamScore = isHome ? match.home_score_display : match.away_score_display;
        const opponentScore = isHome ? match.away_score_display : match.home_score_display;
        
        let result = 'D';
        if (teamScore > opponentScore) result = 'W';
        else if (teamScore < opponentScore) result = 'L';
        
        return {
          match_id: match.external_id,
          result,
          score: `${match.home_score_display ?? 0}-${match.away_score_display ?? 0}`,
          opponent: isHome ? match.away_team_name : match.home_team_name,
          isHome,
          date: new Date(match.match_time * 1000).toISOString().split('T')[0],
        };
      });
      
      reply.send({
        success: true,
        data: {
          id: team.external_id,
          name: team.name,
          short_name: team.short_name,
          logo_url: team.logo_url,
          country_id: team.country_id,
          competition: competition,
          current_season_id: currentSeasonId,
          recent_form: recentForm,
        },
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    logger.error('[TeamController] Error in getTeamById:', error);
    reply.status(500).send({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * Get team fixtures (past and upcoming matches)
 * GET /api/teams/:team_id/fixtures
 */
export const getTeamFixtures = async (
  request: FastifyRequest<{ 
    Params: { team_id: string };
    Querystring: { season_id?: string; limit?: string };
  }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    const { team_id } = request.params;
    const { season_id, limit = '50' } = request.query;
    
    // Try to fetch from TheSports API first (for full season data)
    try {
      // Get team's current season if not provided
      let targetSeasonId = season_id;
      
      if (!targetSeasonId) {
        const client = await pool.connect();
        try {
          const seasonResult = await client.query(
            `SELECT season_id FROM ts_matches 
             WHERE home_team_id = $1 OR away_team_id = $1
             ORDER BY match_time DESC LIMIT 1`,
            [team_id]
          );
          targetSeasonId = seasonResult.rows[0]?.season_id;
        } finally {
          client.release();
        }
      }
      
      if (targetSeasonId) {
        // Fetch season matches from API
        const apiResponse = await theSportsClient.get<any>('/match/season/recent', {
          uuid: targetSeasonId,
        });
        
        if (apiResponse.results && Array.isArray(apiResponse.results)) {
          // Filter matches for this team
          const teamMatches = apiResponse.results.filter(
            (m: any) => m.home_team_id === team_id || m.away_team_id === team_id
          );
          
          // Get team names from results_extra or database
          const teamIds = new Set<string>();
          teamMatches.forEach((m: any) => {
            teamIds.add(m.home_team_id);
            teamIds.add(m.away_team_id);
          });
          
          // Fetch team names from database
          const client = await pool.connect();
          try {
            const teamIdsArray = Array.from(teamIds);
            const placeholders = teamIdsArray.map((_, i) => `$${i + 1}`).join(',');
            const teamsResult = await client.query(
              `SELECT external_id, name, logo_url FROM ts_teams WHERE external_id IN (${placeholders})`,
              teamIdsArray
            );
            
            const teamMap = new Map<string, { name: string; logo_url: string }>();
            teamsResult.rows.forEach(t => {
              teamMap.set(t.external_id, { name: t.name, logo_url: t.logo_url });
            });
            
            // Enrich matches with team names and sort
            const enrichedMatches = teamMatches.map((m: any) => ({
              id: m.id,
              match_time: m.match_time,
              status_id: m.status_id,
              home_team: {
                id: m.home_team_id,
                name: teamMap.get(m.home_team_id)?.name || 'Unknown',
                logo_url: teamMap.get(m.home_team_id)?.logo_url || null,
              },
              away_team: {
                id: m.away_team_id,
                name: teamMap.get(m.away_team_id)?.name || 'Unknown',
                logo_url: teamMap.get(m.away_team_id)?.logo_url || null,
              },
              home_score: m.home_scores?.[0] ?? null,
              away_score: m.away_scores?.[0] ?? null,
              round: m.round?.round_num || null,
              is_home: m.home_team_id === team_id,
            })).sort((a: any, b: any) => a.match_time - b.match_time);
            
            // Separate past and upcoming
            const now = Math.floor(Date.now() / 1000);
            const pastMatches = enrichedMatches.filter((m: any) => m.status_id === 8 || m.match_time < now - 7200);
            const upcomingMatches = enrichedMatches.filter((m: any) => m.status_id !== 8 && m.match_time >= now - 7200);
            
            reply.send({
              success: true,
              data: {
                team_id,
                season_id: targetSeasonId,
                total_matches: enrichedMatches.length,
                past_matches: pastMatches.reverse(), // Most recent first
                upcoming_matches: upcomingMatches,
              },
            });
            return;
          } finally {
            client.release();
          }
        }
      }
    } catch (apiError: any) {
      logger.warn(`[TeamController] API fetch failed for team fixtures: ${apiError.message}`);
    }
    
    // Fallback: Get from database (limited to stored matches)
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT 
          m.external_id as id,
          m.match_time,
          m.status_id,
          m.home_team_id,
          m.away_team_id,
          m.home_score_display,
          m.away_score_display,
          m.season_id,
          ht.name as home_team_name,
          ht.logo_url as home_team_logo,
          at.name as away_team_name,
          at.logo_url as away_team_logo
         FROM ts_matches m
         LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id
         LEFT JOIN ts_teams at ON m.away_team_id = at.external_id
         WHERE m.home_team_id = $1 OR m.away_team_id = $1
         ORDER BY m.match_time DESC
         LIMIT $2`,
        [team_id, parseInt(limit)]
      );
      
      const matches = result.rows.map(m => ({
        id: m.id,
        match_time: m.match_time,
        status_id: m.status_id,
        home_team: {
          id: m.home_team_id,
          name: m.home_team_name,
          logo_url: m.home_team_logo,
        },
        away_team: {
          id: m.away_team_id,
          name: m.away_team_name,
          logo_url: m.away_team_logo,
        },
        home_score: m.home_score_display,
        away_score: m.away_score_display,
        is_home: m.home_team_id === team_id,
      }));
      
      const now = Math.floor(Date.now() / 1000);
      const pastMatches = matches.filter(m => m.status_id === 8 || m.match_time < now - 7200);
      const upcomingMatches = matches.filter(m => m.status_id !== 8 && m.match_time >= now - 7200).reverse();
      
      reply.send({
        success: true,
        data: {
          team_id,
          total_matches: matches.length,
          past_matches: pastMatches,
          upcoming_matches: upcomingMatches,
          source: 'database',
        },
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    logger.error('[TeamController] Error in getTeamFixtures:', error);
    reply.status(500).send({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * Get team's position in standings
 * GET /api/teams/:team_id/standings
 */
export const getTeamStandings = async (
  request: FastifyRequest<{ 
    Params: { team_id: string };
    Querystring: { season_id?: string };
  }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    const { team_id } = request.params;
    let { season_id } = request.query;
    
    // Get team's current season if not provided
    if (!season_id) {
      const client = await pool.connect();
      try {
        const seasonResult = await client.query(
          `SELECT season_id FROM ts_matches 
           WHERE home_team_id = $1 OR away_team_id = $1
           ORDER BY match_time DESC LIMIT 1`,
          [team_id]
        );
        season_id = seasonResult.rows[0]?.season_id;
      } finally {
        client.release();
      }
    }
    
    if (!season_id) {
      reply.status(404).send({
        success: false,
        message: 'No season found for this team',
      });
      return;
    }
    
    // Get standings from service
    const standingsResponse = await seasonStandingsService.getSeasonStandings({ season_id });
    
    if (!standingsResponse.results || !Array.isArray(standingsResponse.results)) {
      reply.status(404).send({
        success: false,
        message: 'No standings data found',
      });
      return;
    }
    
    // Find this team in standings
    const teamStanding = standingsResponse.results.find(
      (s: any) => s.team_id === team_id
    );
    
    if (!teamStanding) {
      reply.status(404).send({
        success: false,
        message: 'Team not found in standings',
      });
      return;
    }
    
    reply.send({
      success: true,
      data: {
        season_id,
        team_id,
        standing: teamStanding,
        total_teams: standingsResponse.results.length,
      },
    });
  } catch (error: any) {
    logger.error('[TeamController] Error in getTeamStandings:', error);
    reply.status(500).send({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

