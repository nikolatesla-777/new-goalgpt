import { FastifyRequest, FastifyReply } from 'fastify';
import { pool } from '../database/connection';
import { logger } from '../utils/logger';

interface PlayerParams {
  playerId: string;
}

/**
 * Get player details by ID
 */
export async function getPlayerById(
  request: FastifyRequest<{ Params: PlayerParams }>,
  reply: FastifyReply
) {
  const { playerId } = request.params;
  const client = await pool.connect();

  try {
    // Get player with team and country info
    const playerResult = await client.query(`
      SELECT 
        p.id,
        p.external_id,
        p.name,
        p.short_name,
        p.logo,
        p.team_id,
        t.name as team_name,
        t.logo_url as team_logo,
        p.country_id,
        c.name as country_name,
        p.nationality,
        p.position,
        p.shirt_number,
        p.age,
        p.birthday,
        p.height,
        p.weight,
        p.market_value,
        p.market_value_currency,
        p.preferred_foot,
        p.season_stats
      FROM ts_players p
      LEFT JOIN ts_teams t ON p.team_id = t.external_id
      LEFT JOIN ts_countries c ON p.country_id = c.external_id
      WHERE p.external_id = $1
    `, [playerId]);

    if (playerResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Player not found' });
    }

    const player = playerResult.rows[0];

    // Get player's recent matches with their stats
    const matchesResult = await client.query(`
      SELECT 
        m.id,
        m.external_id,
        ht.name as home_team_name,
        at.name as away_team_name,
        ht.logo_url as home_team_logo,
        at.logo_url as away_team_logo,
        m.home_score_display as home_score,
        m.away_score_display as away_score,
        m.match_time,
        comp.name as competition_name,
        m.player_stats
      FROM ts_matches m
      LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id
      LEFT JOIN ts_teams at ON m.away_team_id = at.external_id
      LEFT JOIN ts_competitions comp ON m.competition_id = comp.external_id
      WHERE m.player_stats IS NOT NULL
        AND m.player_stats @> $1::jsonb
      ORDER BY m.match_time DESC
      LIMIT 20
    `, [JSON.stringify([{ player_id: playerId }])]);

    // Extract player stats from each match
    const matches = matchesResult.rows.map(match => {
      let playerStats = null;
      if (match.player_stats) {
        const stats = Array.isArray(match.player_stats)
          ? match.player_stats
          : [];
        const playerMatchStats = stats.find((s: any) => s.player_id === playerId);
        if (playerMatchStats) {
          playerStats = {
            goals: playerMatchStats.goals,
            assists: playerMatchStats.assists,
            minutes_played: playerMatchStats.minutes_played,
            rating: playerMatchStats.rating,
          };
        }
      }

      return {
        id: match.id,
        external_id: match.external_id,
        home_team_name: match.home_team_name,
        away_team_name: match.away_team_name,
        home_team_logo: match.home_team_logo,
        away_team_logo: match.away_team_logo,
        home_score: match.home_score,
        away_score: match.away_score,
        match_time: match.match_time,
        competition_name: match.competition_name,
        player_stats: playerStats,
      };
    });

    return reply.send({
      player,
      matches,
    });

  } catch (error: any) {
    logger.error('Error fetching player:', error);
    return reply.status(500).send({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}

/**
 * Search players by name
 */
export async function searchPlayers(
  request: FastifyRequest<{ Querystring: { q?: string; limit?: string } }>,
  reply: FastifyReply
) {
  let client;

  try {
    const q = request.query.q || '';
    const limit = parseInt(request.query.limit || '20', 10);

    if (!q || q.length < 2) {
      return reply.send({ players: [] });
    }

    client = await pool.connect();

    const result = await client.query(`
      SELECT 
        p.external_id,
        p.name,
        p.short_name,
        p.logo,
        p.position,
        p.nationality,
        t.name as team_name,
        t.logo_url as team_logo
      FROM ts_players p
      LEFT JOIN ts_teams t ON p.team_id = t.external_id
      WHERE p.name ILIKE $1
      ORDER BY p.market_value DESC NULLS LAST
      LIMIT $2
    `, [`%${q}%`, limit]);

    return reply.send({ success: true, data: { players: result.rows } });

  } catch (error: any) {
    logger.error('Error searching players:', { error: error.message, stack: error.stack });
    return reply.status(500).send({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}

/**
 * Get players by team ID
 */
export async function getPlayersByTeam(
  request: FastifyRequest<{ Params: { teamId?: string; team_id?: string } }>,
  reply: FastifyReply
) {
  const teamId = request.params.teamId || request.params.team_id;
  if (!teamId) {
    return reply.status(400).send({ success: false, error: 'Team ID is required' });
  }
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT 
        p.external_id,
        p.name,
        p.short_name,
        p.logo,
        p.position,
        p.shirt_number,
        p.age,
        p.nationality,
        p.market_value,
        p.market_value_currency,
        p.season_stats
      FROM ts_players p
      WHERE p.team_id = $1
      ORDER BY 
        CASE p.position 
          WHEN 'G' THEN 1 
          WHEN 'GK' THEN 1
          WHEN 'D' THEN 2 
          WHEN 'DF' THEN 2
          WHEN 'M' THEN 3 
          WHEN 'MF' THEN 3
          WHEN 'F' THEN 4 
          WHEN 'FW' THEN 4
          ELSE 5 
        END,
        p.shirt_number NULLS LAST,
        p.name
    `, [teamId]);

    return reply.send({ success: true, data: { players: result.rows } });

  } catch (error: any) {
    logger.error('Error fetching team players:', error);
    return reply.status(500).send({ success: false, error: 'Internal server error' });
  } finally {
    client.release();
  }
}

