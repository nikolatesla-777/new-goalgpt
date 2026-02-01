/**
 * Standings Enrichment Service
 *
 * Enriches TheSports standings with FootyStats statistics:
 * - Clean Sheet % (CS)
 * - Both Teams To Score % (BTTS)
 * - Expected Goals For (xGF)
 * - Over 1.5 Goals %
 * - Over 2.5 Goals %
 * - Average Goals
 */

import { pool } from '../../database/connection';
import { footyStatsHobi } from '../../core/FootyStatsHobiManager';

interface TeamEnrichment {
  team_id: string;
  cs_percent?: number;
  btts_percent?: number;
  xgf?: number;
  over_15_percent?: number;
  over_25_percent?: number;
  avg_goals?: number;
}

/**
 * Enrich standings with FootyStats data
 *
 * Strategy:
 * 1. Match TheSports team_id with FootyStats team by name
 * 2. Get team statistics from FootyStats /lastx endpoint
 * 3. Calculate percentages and averages
 *
 * @param teamIds - Array of TheSports team IDs
 * @param seasonYear - Season year (e.g., "2025-2026")
 * @returns Map of team_id -> enrichment data
 */
export async function enrichStandingsWithFootyStats(
  teamIds: string[],
  seasonYear: string
): Promise<Map<string, TeamEnrichment>> {
  const enrichmentMap = new Map<string, TeamEnrichment>();

  try {
    // Get team names from database
    const teamsResult = await pool.query(`
      SELECT external_id, name
      FROM ts_teams
      WHERE external_id = ANY($1::text[])
    `, [teamIds]);

    const teamMap: Record<string, string> = {};
    teamsResult.rows.forEach((team: any) => {
      teamMap[team.external_id] = team.name;
    });

    // Get FootyStats team catalog mapping
    const fsTeamsResult = await pool.query(`
      SELECT
        ft.id as fs_team_id,
        ft.name as fs_name,
        ft.thesports_id as ts_team_id
      FROM fs_teams_catalog ft
      WHERE ft.thesports_id = ANY($1::text[])
    `, [teamIds]);

    const fsTeamMap: Record<string, number> = {};
    fsTeamsResult.rows.forEach((team: any) => {
      fsTeamMap[team.ts_team_id] = team.fs_team_id;
    });

    // For each team, fetch FootyStats statistics
    for (const teamId of teamIds) {
      const fsTeamId = fsTeamMap[teamId];

      if (!fsTeamId) {
        // No FootyStats mapping - skip
        enrichmentMap.set(teamId, {
          team_id: teamId
        });
        continue;
      }

      try {
        // Fetch team statistics from FootyStats /lastx
        const teamStats = await footyStatsHobi.get(`/team/${fsTeamId}/lastx`, {
          params: {
            last_matches: 10 // Last 10 matches for statistics
          }
        });

        if (teamStats && teamStats.data) {
          const stats = teamStats.data;

          // Calculate statistics
          const enrichment: TeamEnrichment = {
            team_id: teamId,
            cs_percent: stats.clean_sheet_percentage || undefined,
            btts_percent: stats.btts_percentage || undefined,
            xgf: stats.avg_xg_for || undefined,
            over_15_percent: stats.over_15_percentage || undefined,
            over_25_percent: stats.over_25_percentage || undefined,
            avg_goals: stats.avg_goals_scored || undefined
          };

          enrichmentMap.set(teamId, enrichment);
        } else {
          enrichmentMap.set(teamId, { team_id: teamId });
        }

        // Rate limit (60 requests/min for Hobi package)
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (err: any) {
        console.error(`Failed to fetch FootyStats data for team ${teamId}:`, err.message);
        enrichmentMap.set(teamId, { team_id: teamId });
      }
    }

  } catch (err: any) {
    console.error('Error enriching standings:', err.message);
  }

  return enrichmentMap;
}

/**
 * Calculate statistics from historical matches (fallback if FootyStats unavailable)
 *
 * @param teamId - TheSports team ID
 * @param seasonId - Season ID
 * @returns Calculated statistics
 */
export async function calculateStatsFromMatches(
  teamId: string,
  seasonId: string
): Promise<Partial<TeamEnrichment>> {
  try {
    const matchesResult = await pool.query(`
      SELECT
        home_team_id,
        away_team_id,
        home_score_display,
        away_score_display,
        statistics
      FROM ts_matches
      WHERE (home_team_id = $1 OR away_team_id = $1)
        AND status_id = 8
        AND season_id = $2
      ORDER BY match_time DESC
      LIMIT 20
    `, [teamId, seasonId]);

    if (matchesResult.rows.length === 0) {
      return {};
    }

    const matches = matchesResult.rows;
    let cleanSheets = 0;
    let bttsCount = 0;
    let over15Count = 0;
    let over25Count = 0;
    let totalGoals = 0;

    matches.forEach((match: any) => {
      const isHome = match.home_team_id === teamId;
      const teamScore = isHome ? match.home_score_display : match.away_score_display;
      const opponentScore = isHome ? match.away_score_display : match.home_score_display;
      const totalMatchGoals = teamScore + opponentScore;

      // Clean sheet: team scored and opponent didn't
      if (teamScore > 0 && opponentScore === 0) {
        cleanSheets++;
      }

      // BTTS: both teams scored
      if (teamScore > 0 && opponentScore > 0) {
        bttsCount++;
      }

      // Over 1.5
      if (totalMatchGoals > 1) {
        over15Count++;
      }

      // Over 2.5
      if (totalMatchGoals > 2) {
        over25Count++;
      }

      totalGoals += teamScore;
    });

    const matchCount = matches.length;

    return {
      cs_percent: matchCount > 0 ? Math.round((cleanSheets / matchCount) * 100) : undefined,
      btts_percent: matchCount > 0 ? Math.round((bttsCount / matchCount) * 100) : undefined,
      over_15_percent: matchCount > 0 ? Math.round((over15Count / matchCount) * 100) : undefined,
      over_25_percent: matchCount > 0 ? Math.round((over25Count / matchCount) * 100) : undefined,
      avg_goals: matchCount > 0 ? parseFloat((totalGoals / matchCount).toFixed(2)) : undefined
    };

  } catch (err: any) {
    console.error('Error calculating stats from matches:', err.message);
    return {};
  }
}
