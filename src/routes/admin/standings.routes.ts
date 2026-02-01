import { FastifyInstance } from 'fastify';
import { pool } from '../../database/connection';

interface StandingsRow {
  position: number;
  team_id: string;
  team_name: string;
  mp: number;
  won: number;
  draw: number;
  loss: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  points: number;
  last_5: string[];
  ppg: number;
  cs_percent: number;
  btts_percent: number;
  xgf: number | null;
  over_15_percent: number;
  over_25_percent: number;
  avg_goals: number;
}

export async function adminStandingsRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/admin/standings/:competitionId
   *
   * Returns FULL standings table with ALL statistics
   * Columns: Pos, Team, MP, W, D, L, GF, GA, GD, Pts, Last 5, PPG, CS%, BTTS%, xGF, 1.5+%, 2.5+%, AVG
   */
  fastify.get('/api/admin/standings/:competitionId', async (request, reply) => {
    const { competitionId } = request.params as { competitionId: string };

    try {
      // Get standings from database
      const standingsResult = await pool.query(`
        SELECT st.raw_response, st.updated_at, s.external_id as season_id
        FROM ts_standings st
        INNER JOIN ts_seasons s ON st.season_id = s.external_id
        WHERE s.competition_id = $1
          AND (s.year LIKE '%2025%' OR s.year LIKE '%2026%')
        ORDER BY st.updated_at DESC
        LIMIT 1
      `, [competitionId]);

      if (standingsResult.rows.length === 0) {
        return reply.status(404).send({
          error: 'Standings not found for this competition'
        });
      }

      const rawResponse = standingsResult.rows[0].raw_response;
      const seasonId = standingsResult.rows[0].season_id;
      const updatedAt = standingsResult.rows[0].updated_at;

      if (!rawResponse.results?.tables?.[0]?.rows) {
        return reply.status(404).send({
          error: 'Invalid standings data structure'
        });
      }

      const rows = rawResponse.results.tables[0].rows;

      // Get team names
      const teamIds = rows.map((row: any) => row.team_id);
      const teamsResult = await pool.query(`
        SELECT external_id, name
        FROM ts_teams
        WHERE external_id = ANY($1::text[])
      `, [teamIds]);

      const teamMap: Record<string, string> = {};
      teamsResult.rows.forEach((team: any) => {
        teamMap[team.external_id] = team.name;
      });

      // Calculate ALL statistics for each team
      const standings: StandingsRow[] = [];

      for (const row of rows) {
        const teamId = row.team_id;

        // Get last 20 matches for statistics
        const matchesResult = await pool.query(`
          SELECT
            home_team_id,
            away_team_id,
            home_score_display,
            away_score_display,
            match_time,
            statistics
          FROM ts_matches
          WHERE (home_team_id = $1 OR away_team_id = $1)
            AND status_id = 8
            AND season_id = $2
          ORDER BY match_time DESC
          LIMIT 20
        `, [teamId, seasonId]);

        const matches = matchesResult.rows;

        // Calculate statistics
        let cleanSheets = 0;
        let bttsCount = 0;
        let over15Count = 0;
        let over25Count = 0;
        let totalGoalsScored = 0;
        let totalGoalsConceded = 0;
        let totalXgFor = 0;
        let xgCount = 0;

        // Last 5 form
        const last5Form: string[] = [];

        matches.forEach((match: any, index: number) => {
          const isHome = match.home_team_id === teamId;
          const teamScore = isHome ? match.home_score_display : match.away_score_display;
          const opponentScore = isHome ? match.away_score_display : match.home_score_display;
          const totalMatchGoals = teamScore + opponentScore;

          // Goals
          totalGoalsScored += teamScore;
          totalGoalsConceded += opponentScore;

          // Clean sheet
          if (opponentScore === 0) {
            cleanSheets++;
          }

          // BTTS
          if (teamScore > 0 && opponentScore > 0) {
            bttsCount++;
          }

          // Over 1.5 total goals
          if (totalMatchGoals > 1) {
            over15Count++;
          }

          // Over 2.5 total goals
          if (totalMatchGoals > 2) {
            over25Count++;
          }

          // xG (from statistics if available)
          if (match.statistics && match.statistics.xg) {
            const xgData = isHome ? match.statistics.xg.home : match.statistics.xg.away;
            if (xgData && typeof xgData === 'number') {
              totalXgFor += xgData;
              xgCount++;
            }
          }

          // Last 5 form
          if (index < 5) {
            if (teamScore > opponentScore) last5Form.push('W');
            else if (teamScore < opponentScore) last5Form.push('L');
            else last5Form.push('D');
          }
        });

        const matchCount = matches.length;

        standings.push({
          position: row.position,
          team_id: row.team_id,
          team_name: teamMap[row.team_id] || row.team_id,
          mp: row.total,
          won: row.won,
          draw: row.draw,
          loss: row.loss,
          goals_for: row.goals,
          goals_against: row.goals_against,
          goal_diff: row.goal_diff,
          points: row.points,
          last_5: last5Form.reverse(),
          ppg: row.total > 0 ? parseFloat((row.points / row.total).toFixed(2)) : 0,
          cs_percent: matchCount > 0 ? Math.round((cleanSheets / matchCount) * 100) : 0,
          btts_percent: matchCount > 0 ? Math.round((bttsCount / matchCount) * 100) : 0,
          xgf: xgCount > 0 ? parseFloat((totalXgFor / xgCount).toFixed(2)) : null,
          over_15_percent: matchCount > 0 ? Math.round((over15Count / matchCount) * 100) : 0,
          over_25_percent: matchCount > 0 ? Math.round((over25Count / matchCount) * 100) : 0,
          avg_goals: matchCount > 0 ? parseFloat((totalGoalsScored / matchCount).toFixed(2)) : 0
        });
      }

      return reply.send({
        competition_id: competitionId,
        season_id: seasonId,
        updated_at: updatedAt,
        standings
      });

    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({
        error: 'Failed to fetch standings',
        message: err.message
      });
    }
  });

  /**
   * POST /api/admin/standings/sync/:competitionId
   *
   * Force sync standings for a specific competition
   */
  fastify.post('/api/admin/standings/sync/:competitionId', async (request, reply) => {
    const { competitionId } = request.params as { competitionId: string };

    try {
      // Get season ID
      const seasonResult = await pool.query(`
        SELECT external_id
        FROM ts_seasons
        WHERE competition_id = $1
          AND (year LIKE '%2025%' OR year LIKE '%2026%')
        ORDER BY year DESC
        LIMIT 1
      `, [competitionId]);

      if (seasonResult.rows.length === 0) {
        return reply.status(404).send({
          error: 'Season not found for this competition'
        });
      }

      const seasonId = seasonResult.rows[0].external_id;

      // Import theSportsAPI and sync
      const { theSportsAPI } = await import('../../core/TheSportsAPIManager');

      const standings = await theSportsAPI.get('/season/recent/table/detail', {
        uuid: seasonId
      });

      if (!standings.results?.tables?.[0]?.rows) {
        return reply.status(404).send({
          error: 'No standings data from API'
        });
      }

      const rows = standings.results.tables[0].rows;

      // Save to database
      await pool.query(`
        INSERT INTO ts_standings (season_id, standings, raw_response, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (season_id)
        DO UPDATE SET
          standings = EXCLUDED.standings,
          raw_response = EXCLUDED.raw_response,
          updated_at = NOW()
      `, [seasonId, JSON.stringify(rows), JSON.stringify(standings)]);

      return reply.send({
        success: true,
        message: 'Standings synced successfully',
        teams: rows.length,
        season_id: seasonId
      });

    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({
        error: 'Failed to sync standings',
        message: err.message
      });
    }
  });
}
