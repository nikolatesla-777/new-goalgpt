/**
 * Team Controller
 * 
 * Handles team-related API endpoints
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { pool } from '../database/connection';
import { SeasonStandingsService } from '../services/thesports/season/standings.service';
import { logger } from '../utils/logger';
// SINGLETON: Use shared API client
import { theSportsAPI } from '../core';

const seasonStandingsService = new SeasonStandingsService();

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
/**
 * Get team fixtures (past and upcoming matches)
 * GET /api/teams/:team_id/fixtures
 * REFACTORED: DB-First to support multiple competitions (League, Cup, UCL)
 */
export const getTeamFixtures = async (
  request: FastifyRequest<{
    Params: { team_id: string };
    Querystring: { limit?: string; season_id?: string };
  }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    const { team_id } = request.params;
    const { limit = '100', season_id } = request.query;

    const client = await pool.connect();
    try {
      // If season_id is provided, filter by it. Otherwise get all recent/upcoming.
      // We want to fetch ALL matches for this team across ALL competitions.

      let whereClause = `(m.home_team_id = $1 OR m.away_team_id = $1)`;
      const params: any[] = [team_id];
      let paramIndex = 2;

      if (season_id) {
        whereClause += ` AND m.season_id = $${paramIndex++}`;
        params.push(season_id);
      }

      // Query DB for matches with Competition info
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
          m.competition_id,
          c.name as competition_name,
          c.logo_url as competition_logo,
          c.short_name as competition_short_name,
          ht.name as home_team_name,
          ht.logo_url as home_team_logo,
          at.name as away_team_name,
          at.logo_url as away_team_logo
         FROM ts_matches m
         LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id
         LEFT JOIN ts_teams at ON m.away_team_id = at.external_id
         LEFT JOIN ts_competitions c ON m.competition_id = c.external_id
         WHERE ${whereClause}
         ORDER BY m.match_time DESC
         LIMIT $${paramIndex}`,
        [...params, parseInt(limit)]
      );

      const matches = result.rows.map(m => ({
        id: m.id,
        match_time: m.match_time,
        status_id: m.status_id,
        competition: {
          id: m.competition_id,
          name: m.competition_name,
          short_name: m.competition_short_name,
          logo_url: m.competition_logo
        },
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

      // Split into past and upcoming
      // Past: Finished matches or matches older than 2 hours
      const pastMatches = matches.filter(m => m.status_id === 8 || m.match_time < now - 7200);

      // Upcoming: Not finished and in future (or currently live)
      // Reverse upcoming so closest match is first
      const upcomingMatches = matches
        .filter(m => m.status_id !== 8 && m.match_time >= now - 7200)
        .sort((a, b) => a.match_time - b.match_time);

      reply.send({
        success: true,
        data: {
          team_id,
          total_matches: matches.length,
          past_matches: pastMatches, // Already ordered DESC (most recent first)
          upcoming_matches: upcomingMatches,
          source: 'database_multi_comp',
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
 * DATABASE-FIRST: Check DB first, then API fallback
 */
export const getTeamStandings = async (
  request: FastifyRequest<{
    Params: { team_id: string };
    Querystring: { season_id?: string };
  }>,
  reply: FastifyReply
): Promise<void> => {
  const client = await pool.connect();
  try {
    const { team_id } = request.params;
    let { season_id } = request.query;

    // Get team's competition_id for finding the right standings
    const teamResult = await client.query(
      `SELECT competition_id FROM ts_teams WHERE external_id = $1`,
      [team_id]
    );
    const teamCompetitionId = teamResult.rows[0]?.competition_id;

    // Get team's current season if not provided - prefer the team's main competition
    if (!season_id) {
      const seasonResult = await client.query(
        `SELECT DISTINCT m.season_id, m.competition_id, COUNT(*) as match_count
         FROM ts_matches m
         WHERE (m.home_team_id = $1 OR m.away_team_id = $1)
         GROUP BY m.season_id, m.competition_id
         ORDER BY match_count DESC
         LIMIT 5`,
        [team_id]
      );

      // Prefer the team's main competition, otherwise take the one with most matches
      const preferredSeason = seasonResult.rows.find(
        (r: any) => r.competition_id === teamCompetitionId
      );
      season_id = preferredSeason?.season_id || seasonResult.rows[0]?.season_id;
    }

    if (!season_id) {
      reply.status(404).send({
        success: false,
        message: 'No season found for this team',
      });
      return;
    }

    // STEP 1: Check database first for standings
    const dbStandings = await client.query(
      `SELECT standings, competition_id FROM ts_standings WHERE season_id = $1`,
      [season_id]
    );

    let standingsData: any[] = [];
    let source = 'database';

    if (dbStandings.rows.length > 0 && dbStandings.rows[0].standings) {
      // Parse standings from DB
      const storedStandings = dbStandings.rows[0].standings;
      if (Array.isArray(storedStandings)) {
        standingsData = storedStandings;
      } else if (typeof storedStandings === 'object') {
        // Sometimes standings is stored as { overall: [...] } or similar
        standingsData = storedStandings.overall || storedStandings.total || Object.values(storedStandings).flat();
      }
    }

    // STEP 2: If no standings in DB, try API fallback
    if (standingsData.length === 0) {
      logger.info(`[TeamController] No standings in DB for season ${season_id}, trying API...`);
      try {
        const apiResponse = await seasonStandingsService.getSeasonStandings({ season_id });
        if (apiResponse.results && Array.isArray(apiResponse.results)) {
          standingsData = apiResponse.results;
          source = 'api';

          // Save to database for future use
          const existingRow = await client.query(
            `SELECT id FROM ts_standings WHERE season_id = $1`,
            [season_id]
          );

          if (existingRow.rows.length === 0) {
            await client.query(
              `INSERT INTO ts_standings (id, season_id, standings, updated_at)
               VALUES (gen_random_uuid(), $1, $2, NOW())`,
              [season_id, JSON.stringify(standingsData)]
            );
            logger.info(`[TeamController] Saved standings to DB for season ${season_id}`);
          } else {
            await client.query(
              `UPDATE ts_standings SET standings = $1, updated_at = NOW() WHERE season_id = $2`,
              [JSON.stringify(standingsData), season_id]
            );
            logger.info(`[TeamController] Updated standings in DB for season ${season_id}`);
          }
        }
      } catch (apiError: any) {
        logger.warn(`[TeamController] API fallback failed: ${apiError.message}`);
      }
    }

    if (standingsData.length === 0) {
      reply.status(404).send({
        success: false,
        message: 'No standings data found',
      });
      return;
    }

    // Find this team in standings
    const teamStanding = standingsData.find(
      (s: any) => s.team_id === team_id
    );

    if (!teamStanding) {
      // Return standings anyway but indicate team not found in this particular season
      reply.send({
        success: true,
        data: {
          season_id,
          team_id,
          standing: null,
          standings: standingsData,
          total_teams: standingsData.length,
          source,
          message: 'Team not found in this standings table',
        },
      });
      return;
    }

    reply.send({
      success: true,
      data: {
        season_id,
        team_id,
        standing: teamStanding,
        standings: standingsData,
        total_teams: standingsData.length,
        source,
      },
    });
  } catch (error: any) {
    logger.error('[TeamController] Error in getTeamStandings:', error);
    reply.status(500).send({
      success: false,
      message: error.message || 'Internal server error',
    });
  } finally {
    client.release();
  }
};

/**
 * Search teams by name
 * GET /api/teams/search
 */
export const searchTeams = async (
  request: FastifyRequest<{ Querystring: { q?: string; limit?: string } }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    const { q, limit = '20' } = request.query;

    if (!q || q.length < 2) {
      reply.send({
        success: true,
        data: [],
      });
      return;
    }

    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT external_id, name, logo_url, country_id 
         FROM ts_teams 
         WHERE name ILIKE $1 
         ORDER BY name ASC 
         LIMIT $2`,
        [`%${q}%`, parseInt(limit)]
      );

      reply.send({
        success: true,
        data: result.rows.map(row => ({
          id: row.external_id,
          name: row.name,
          logo_url: row.logo_url,
          country_id: row.country_id,
        })),
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    logger.error('[TeamController] Error in searchTeams:', error);
    reply.status(500).send({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};


