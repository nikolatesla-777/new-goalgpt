/**
 * Live Standings Sync Job
 * 
 * Syncs real-time standings from TheSports /table/live endpoint
 * Updates standings with temporary points for ongoing matches
 * 
 * Frequency: Every 2 minutes (when live matches exist)
 */

import { pool } from '../database/connection';
import { theSportsAPI } from '../core/TheSportsAPIManager';
import { logger } from '../utils/logger';

interface LiveStandingsResponse {
  code: number;
  results: Array<{
    season_id: string;
    tables: Array<{
      rows: Array<{
        team_id: string;
        position: number;
        points: number;
        total: number;
        won: number;
        draw: number;
        loss: number;
        goals: number;
        goals_against: number;
        goal_diff: number;
        updated_at: number;
      }>;
    }>;
    updated_at: number;
  }>;
}

export async function syncLiveStandings(): Promise<void> {
  try {
    logger.info('[LiveStandings] Starting live standings sync...');

    // Check if there are any live matches in Süper Lig
    const liveMatchesResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM ts_matches m
      INNER JOIN ts_seasons s ON m.season_id = s.external_id
      WHERE s.competition_id = '8y39mp1h6jmojxg'
        AND m.status_id IN (2, 3, 4, 5, 7)
    `);

    const hasLiveMatches = parseInt(liveMatchesResult.rows[0].count) > 0;

    if (!hasLiveMatches) {
      logger.info('[LiveStandings] No live matches, skipping sync');
      return;
    }

    // Fetch live standings from TheSports API
    const response: LiveStandingsResponse = await theSportsAPI.get('/table/live', {});

    if (!response.results || response.results.length === 0) {
      logger.info('[LiveStandings] No live standings data from API');
      return;
    }

    // Process each season's live standings
    for (const seasonData of response.results) {
      const seasonId = seasonData.season_id;

      // Check if this is Süper Lig 2025-2026
      const seasonCheck = await pool.query(`
        SELECT s.external_id, c.name
        FROM ts_seasons s
        INNER JOIN ts_competitions c ON s.competition_id = c.external_id
        WHERE s.external_id = $1
          AND c.external_id = '8y39mp1h6jmojxg'
      `, [seasonId]);

      if (seasonCheck.rows.length === 0) {
        continue; // Not Süper Lig, skip
      }

      const tables = seasonData.tables;
      if (!tables || tables.length === 0 || !tables[0].rows) {
        continue;
      }

      const liveStandings = tables[0].rows;

      // Store live standings in database
      await pool.query(`
        INSERT INTO ts_standings_live (
          season_id,
          standings,
          raw_response,
          updated_at
        )
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (season_id)
        DO UPDATE SET
          standings = EXCLUDED.standings,
          raw_response = EXCLUDED.raw_response,
          updated_at = NOW()
      `, [seasonId, JSON.stringify(liveStandings), JSON.stringify(seasonData)]);

      logger.info(`[LiveStandings] ✅ Synced live standings for season ${seasonId} (${liveStandings.length} teams)`);
    }

  } catch (error: any) {
    logger.error('[LiveStandings] Sync failed:', error);
    throw error;
  }
}

// Run every 2 minutes
export const LIVE_STANDINGS_INTERVAL = 2 * 60 * 1000; // 2 minutes
