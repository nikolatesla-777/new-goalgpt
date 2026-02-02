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
   * GET /api/admin/standings/:competitionId?view=overall|home|away
   *
   * Returns FULL standings table with ALL statistics
   * Columns: Pos, Team, MP, W, D, L, GF, GA, GD, Pts, Last 5, PPG, CS%, BTTS%, xGF, 1.5+%, 2.5+%, AVG
   *
   * Query params:
   * - view: 'overall' (default), 'home', 'away'
   */
  fastify.get('/api/admin/standings/:competitionId', async (request, reply) => {
    const { competitionId } = request.params as { competitionId: string };
    const { view = 'overall' } = request.query as { view?: 'overall' | 'home' | 'away' };

    try {
      // Get standings from database
      const standingsResult = await pool.query(`
        SELECT st.standings, st.updated_at, s.external_id as season_id
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

      const standings = standingsResult.rows[0].standings;
      const seasonId = standingsResult.rows[0].season_id;
      const updatedAt = standingsResult.rows[0].updated_at;

      if (!Array.isArray(standings) || standings.length === 0) {
        return reply.status(404).send({
          error: 'Invalid standings data structure'
        });
      }

      // Map database field names to expected format
      const rows = standings.map((row: any) => ({
        ...row,
        mp: row.total || row.played || row.mp,
        draw: row.draw !== undefined ? row.draw : (row.drawn !== undefined ? row.drawn : 0),
        loss: row.loss !== undefined ? row.loss : (row.lost !== undefined ? row.lost : 0)
      }));

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

      // FOR OVERALL VIEW: Use database standings directly (they're already correct!)
      // Only fetch matches for calculating additional metrics (Last 5, PPG, CS%, etc.)
      if (view === 'overall') {
        // Use database standings for core stats (MP, W, D, L, Pts)
        const calculatedStandings: StandingsRow[] = [];

        // Fetch last 20 matches for each team for additional metrics
        const allMatchesResult = await pool.query(`
          SELECT
            home_team_id,
            away_team_id,
            home_score_display,
            away_score_display,
            match_time,
            statistics
          FROM (
            SELECT
              home_team_id,
              away_team_id,
              home_score_display,
              away_score_display,
              match_time,
              statistics,
              CASE
                WHEN home_team_id = ANY($1::text[]) THEN home_team_id
                ELSE away_team_id
              END as team_id,
              ROW_NUMBER() OVER (
                PARTITION BY
                  CASE
                    WHEN home_team_id = ANY($1::text[]) THEN home_team_id
                    ELSE away_team_id
                  END
                ORDER BY match_time DESC
              ) as rn
            FROM ts_matches
            WHERE (home_team_id = ANY($1::text[]) OR away_team_id = ANY($1::text[]))
              AND status_id = 8
              AND season_id = $2
          ) subquery
          WHERE rn <= 20
        `, [teamIds, seasonId]);

        // Group matches by team
        const matchesByTeam: Record<string, any[]> = {};
        teamIds.forEach(id => matchesByTeam[id] = []);

        allMatchesResult.rows.forEach((match: any) => {
          if (matchesByTeam[match.home_team_id]) {
            matchesByTeam[match.home_team_id].push(match);
          }
          if (matchesByTeam[match.away_team_id]) {
            matchesByTeam[match.away_team_id].push(match);
          }
        });

        // Build standings using DATABASE values + calculated metrics
        for (const row of rows) {
          const teamId = row.team_id;
          const matches = matchesByTeam[teamId] || [];

          // USE DATABASE VALUES for core stats
          // Different leagues use different field names from TheSports API
          const mp = row.total || row.played || row.mp || 0;
          const won = row.won || 0;
          const draw = row.draw || row.drawn || 0;
          const loss = row.loss || row.lost || 0;
          const points = row.points || 0;
          const goalsFor = row.goals_for || row.goals || 0;
          const goalsAgainst = row.goals_against || 0;
          const goalDiff = row.goal_diff || 0;

          // Calculate ADDITIONAL metrics from matches
          let cleanSheets = 0;
          let bttsCount = 0;
          let over15Count = 0;
          let over25Count = 0;
          let totalXgFor = 0;
          let xgCount = 0;

          // Last 5 form
          const last5Form: string[] = [];

          matches.slice(0, Math.min(20, matches.length)).forEach((match: any, index: number) => {
            const isHome = match.home_team_id === teamId;
            const teamScore = isHome ? match.home_score_display : match.away_score_display;
            const opponentScore = isHome ? match.away_score_display : match.home_score_display;
            const totalMatchGoals = teamScore + opponentScore;

            // Last 5 form
            if (index < 5) {
              if (teamScore > opponentScore) {
                last5Form.push('W');
              } else if (teamScore === opponentScore) {
                last5Form.push('D');
              } else {
                last5Form.push('L');
              }
            }

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

            // xG (if available)
            if (match.statistics?.xg) {
              const xgFor = isHome ? match.statistics.xg.home : match.statistics.xg.away;
              if (typeof xgFor === 'number') {
                totalXgFor += xgFor;
                xgCount++;
              }
            }
          });

          const matchCount = matches.length;

          calculatedStandings.push({
            position: row.position,
            team_id: teamId,
            team_name: teamMap[teamId] || teamId,
            mp,
            won,
            draw,
            loss,
            goals_for: goalsFor,
            goals_against: goalsAgainst,
            goal_diff: goalDiff,
            points,
            last_5: last5Form.reverse(),
            ppg: mp > 0 ? parseFloat((points / mp).toFixed(2)) : 0,
            cs_percent: matchCount > 0 ? Math.round((cleanSheets / matchCount) * 100) : 0,
            btts_percent: matchCount > 0 ? Math.round((bttsCount / matchCount) * 100) : 0,
            xgf: xgCount > 0 ? parseFloat((totalXgFor / xgCount).toFixed(2)) : null,
            over_15_percent: matchCount > 0 ? Math.round((over15Count / matchCount) * 100) : 0,
            over_25_percent: matchCount > 0 ? Math.round((over25Count / matchCount) * 100) : 0,
            avg_goals: matchCount > 0 ? parseFloat((goalsFor / mp).toFixed(2)) : 0
          });
        }

        // Check for live matches
        const liveMatchesResult = await pool.query(`
          SELECT
            m.external_id,
            m.home_team_id,
            m.away_team_id,
            m.home_score_display,
            m.away_score_display,
            m.status_id
          FROM ts_matches m
          WHERE m.season_id = $1
            AND m.status_id IN (2, 3, 4, 5, 7)
        `, [seasonId]);

        let hasLiveMatches = liveMatchesResult.rows.length > 0;

        if (hasLiveMatches) {
          const livePointsMap: Record<string, number> = {};

          liveMatchesResult.rows.forEach((match: any) => {
            const homeScore = match.home_score_display || 0;
            const awayScore = match.away_score_display || 0;

            let homePoints = 0;
            let awayPoints = 0;

            if (homeScore > awayScore) {
              homePoints = 3;
            } else if (homeScore < awayScore) {
              awayPoints = 3;
            } else {
              homePoints = 1;
              awayPoints = 1;
            }

            livePointsMap[match.home_team_id] = (livePointsMap[match.home_team_id] || 0) + homePoints;
            livePointsMap[match.away_team_id] = (livePointsMap[match.away_team_id] || 0) + awayPoints;
          });

          calculatedStandings.forEach(team => {
            if (livePointsMap[team.team_id] !== undefined) {
              const tempPoints = livePointsMap[team.team_id];
              (team as any).live_points = team.points + tempPoints;
              (team as any).live_position = team.position;
              (team as any).points_diff = tempPoints;
            }
          });
        }

        return reply.send({
          competition_id: competitionId,
          season_id: seasonId,
          updated_at: updatedAt,
          has_live_matches: hasLiveMatches,
          standings: calculatedStandings
        });
      }

      // FOR HOME/AWAY VIEWS: Use database home/away values (same as overall)
      if (view === 'home') {
        // HOME VIEW: Use home_* fields from database
        const calculatedStandings: StandingsRow[] = [];

        for (const row of rows) {
          const teamId = row.team_id;

          // USE DATABASE VALUES for home stats
          // Different leagues use different field names from TheSports API
          const mp = row.home_played || row.home_total || 0;
          const won = row.home_won || 0;
          const draw = row.home_drawn || row.home_draw || 0;
          const loss = row.home_lost || row.home_loss || 0;
          const points = won * 3 + draw; // Calculate home points
          const goalsFor = row.home_goals_for || row.home_goals || 0;
          const goalsAgainst = row.home_goals_against || 0;
          const goalDiff = goalsFor - goalsAgainst;

          calculatedStandings.push({
            position: row.position,
            team_id: teamId,
            team_name: teamMap[teamId] || teamId,
            mp,
            won,
            draw,
            loss,
            goals_for: goalsFor,
            goals_against: goalsAgainst,
            goal_diff: goalDiff,
            points,
            last_5: [],
            ppg: mp > 0 ? parseFloat((points / mp).toFixed(2)) : 0,
            cs_percent: 0,
            btts_percent: 0,
            xgf: null,
            over_15_percent: 0,
            over_25_percent: 0,
            avg_goals: mp > 0 ? parseFloat((goalsFor / mp).toFixed(2)) : 0
          });
        }

        // Re-sort by home points
        calculatedStandings.sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          if (b.goal_diff !== a.goal_diff) return b.goal_diff - a.goal_diff;
          return b.goals_for - a.goals_for;
        });

        // Recalculate positions
        calculatedStandings.forEach((team, index) => {
          team.position = index + 1;
        });

        return reply.send({
          competition_id: competitionId,
          season_id: seasonId,
          updated_at: updatedAt,
          has_live_matches: false,
          standings: calculatedStandings
        });
      }

      if (view === 'away') {
        // AWAY VIEW: Use away_* fields from database
        const calculatedStandings: StandingsRow[] = [];

        for (const row of rows) {
          const teamId = row.team_id;

          // USE DATABASE VALUES for away stats
          // Different leagues use different field names from TheSports API
          const mp = row.away_played || row.away_total || 0;
          const won = row.away_won || 0;
          const draw = row.away_drawn || row.away_draw || 0;
          const loss = row.away_lost || row.away_loss || 0;
          const points = won * 3 + draw; // Calculate away points
          const goalsFor = row.away_goals_for || row.away_goals || 0;
          const goalsAgainst = row.away_goals_against || 0;
          const goalDiff = goalsFor - goalsAgainst;

          calculatedStandings.push({
            position: row.position,
            team_id: teamId,
            team_name: teamMap[teamId] || teamId,
            mp,
            won,
            draw,
            loss,
            goals_for: goalsFor,
            goals_against: goalsAgainst,
            goal_diff: goalDiff,
            points,
            last_5: [],
            ppg: mp > 0 ? parseFloat((points / mp).toFixed(2)) : 0,
            cs_percent: 0,
            btts_percent: 0,
            xgf: null,
            over_15_percent: 0,
            over_25_percent: 0,
            avg_goals: mp > 0 ? parseFloat((goalsFor / mp).toFixed(2)) : 0
          });
        }

        // Re-sort by away points
        calculatedStandings.sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          if (b.goal_diff !== a.goal_diff) return b.goal_diff - a.goal_diff;
          return b.goals_for - a.goals_for;
        });

        // Recalculate positions
        calculatedStandings.forEach((team, index) => {
          team.position = index + 1;
        });

        return reply.send({
          competition_id: competitionId,
          season_id: seasonId,
          updated_at: updatedAt,
          has_live_matches: false,
          standings: calculatedStandings
        });
      }

      // This should never be reached - overall/home/away all return early
      throw new Error('Unexpected code path: view should be overall, home, or away');

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

      const apiStandings = await theSportsAPI.get('/season/recent/table/detail', {
        uuid: seasonId
      });

      if (!apiStandings.results?.tables?.[0]?.rows) {
        return reply.status(404).send({
          error: 'No standings data from API'
        });
      }

      const rows = apiStandings.results.tables[0].rows;

      // Save to database
      await pool.query(`
        INSERT INTO ts_standings (season_id, standings, raw_response, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (season_id)
        DO UPDATE SET
          standings = EXCLUDED.standings,
          raw_response = EXCLUDED.raw_response,
          updated_at = NOW()
      `, [seasonId, JSON.stringify(rows), JSON.stringify(apiStandings)]);

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
