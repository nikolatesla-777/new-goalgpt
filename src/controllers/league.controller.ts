/**
 * League Controller
 * 
 * Handles league/competition-related API endpoints
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { pool } from '../database/connection';
import { logger } from '../utils/logger';

/**
 * Get league by ID
 * GET /api/leagues/:league_id
 */
export async function getLeagueById(
  request: FastifyRequest<{ Params: { league_id: string } }>,
  reply: FastifyReply
) {
  const { league_id } = request.params;
  const client = await pool.connect();

  try {
    // Get league info
    const leagueResult = await client.query(`
      SELECT 
        c.id,
        c.external_id,
        c.name,
        c.short_name,
        c.logo_url,
        c.country_id,
        cn.name as country_name,
        c.category_id
      FROM ts_competitions c
      LEFT JOIN ts_countries cn ON c.country_id = cn.external_id
      WHERE c.external_id = $1
    `, [league_id]);

    if (leagueResult.rows.length === 0) {
      return reply.status(404).send({ error: 'League not found' });
    }

    const league = leagueResult.rows[0];

    // Get current season
    const seasonResult = await client.query(`
      SELECT external_id, year
      FROM ts_seasons
      WHERE competition_id = $1
      ORDER BY year DESC
      LIMIT 1
    `, [league_id]);

    const currentSeason = seasonResult.rows[0] || null;

    return reply.send({
      league,
      currentSeason,
    });

  } catch (error: any) {
    logger.error('Error fetching league:', { message: error.message, stack: error.stack });
    return reply.status(500).send({ error: 'Internal server error', details: error.message });
  } finally {
    client.release();
  }
}

/**
 * Get league teams
 * GET /api/leagues/:league_id/teams
 */
export async function getLeagueTeams(
  request: FastifyRequest<{ Params: { league_id: string } }>,
  reply: FastifyReply
) {
  const { league_id } = request.params;
  const client = await pool.connect();

  try {
    // Get teams that play in this competition
    const teamsResult = await client.query(`
      SELECT DISTINCT ON (t.external_id)
        t.external_id,
        t.name,
        t.short_name,
        t.logo_url
      FROM ts_teams t
      WHERE t.competition_id = $1
      ORDER BY t.external_id, t.name
    `, [league_id]);

    // If no teams found by competition_id, try to find them from matches
    let teams = teamsResult.rows;
    if (teams.length === 0) {
      const matchTeamsResult = await client.query(`
        SELECT DISTINCT t.external_id, t.name, t.short_name, t.logo_url
        FROM ts_matches m
        JOIN ts_teams t ON (t.external_id = m.home_team_id OR t.external_id = m.away_team_id)
        WHERE m.competition_id = $1
        ORDER BY t.name
      `, [league_id]);
      teams = matchTeamsResult.rows;
    }

    return reply.send({ teams });

  } catch (error: any) {
    logger.error('Error fetching league teams:', error);
    return reply.status(500).send({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}

/**
 * Get league fixtures
 * GET /api/leagues/:league_id/fixtures
 */
export async function getLeagueFixtures(
  request: FastifyRequest<{ 
    Params: { league_id: string };
    Querystring: { limit?: string; status?: string };
  }>,
  reply: FastifyReply
) {
  const { league_id } = request.params;
  const { limit = '50', status } = request.query;
  const client = await pool.connect();

  try {
    let whereClause = 'm.competition_id = $1';
    const params: any[] = [league_id];

    if (status === 'upcoming') {
      whereClause += ' AND m.status_id = 1';
    } else if (status === 'finished') {
      whereClause += ' AND m.status_id = 8';
    } else if (status === 'live') {
      whereClause += ' AND m.status_id IN (2, 3, 4, 5, 7)';
    }

    const fixturesResult = await client.query(`
      SELECT 
        m.external_id as id,
        m.match_time,
        m.status_id,
        m.round,
        m.home_team_id,
        ht.name as home_team_name,
        ht.logo_url as home_team_logo,
        m.away_team_id,
        at.name as away_team_name,
        at.logo_url as away_team_logo,
        m.home_score_display as home_score,
        m.away_score_display as away_score
      FROM ts_matches m
      LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id
      LEFT JOIN ts_teams at ON m.away_team_id = at.external_id
      WHERE ${whereClause}
      ORDER BY m.match_time DESC
      LIMIT $2
    `, [...params, parseInt(limit)]);

    // Group by round if available
    const fixtures = fixturesResult.rows.map(row => ({
      id: row.id,
      match_time: row.match_time,
      status_id: row.status_id,
      round: row.round,
      home_team: {
        id: row.home_team_id,
        name: row.home_team_name,
        logo_url: row.home_team_logo,
      },
      away_team: {
        id: row.away_team_id,
        name: row.away_team_name,
        logo_url: row.away_team_logo,
      },
      home_score: row.home_score,
      away_score: row.away_score,
    }));

    return reply.send({ fixtures });

  } catch (error: any) {
    logger.error('Error fetching league fixtures:', error);
    return reply.status(500).send({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}

/**
 * Get league standings
 * GET /api/leagues/:league_id/standings
 */
export async function getLeagueStandings(
  request: FastifyRequest<{ Params: { league_id: string } }>,
  reply: FastifyReply
) {
  const { league_id } = request.params;
  const client = await pool.connect();

  try {
    // Get current season for this league
    const seasonResult = await client.query(`
      SELECT external_id
      FROM ts_seasons
      WHERE competition_id = $1
      ORDER BY external_id DESC
      LIMIT 1
    `, [league_id]);

    if (seasonResult.rows.length === 0) {
      return reply.send({ standings: [] });
    }

    const seasonId = seasonResult.rows[0].external_id;

    // Get standings from ts_standings
    const standingsResult = await client.query(`
      SELECT 
        s.position,
        s.team_id,
        t.name as team_name,
        t.logo_url as team_logo,
        s.played,
        s.won,
        s.drawn,
        s.lost,
        s.goals_for,
        s.goals_against,
        s.goal_diff,
        s.points
      FROM ts_standings s
      LEFT JOIN ts_teams t ON s.team_id = t.external_id
      WHERE s.season_id = $1
      ORDER BY s.position ASC
    `, [seasonId]);

    return reply.send({ 
      standings: standingsResult.rows,
      season_id: seasonId,
    });

  } catch (error: any) {
    logger.error('Error fetching league standings:', error);
    return reply.status(500).send({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}

