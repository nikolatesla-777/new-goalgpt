/**
 * Standings Auto-Sync Job
 *
 * Automatically syncs standings for all leagues with recent matches
 * Uses /data/update + /season/recent/table/detail workflow
 *
 * Frequency: Every 5 minutes (per API docs)
 * Coverage: All leagues that had matches in last 120 seconds
 */

import { theSportsAPI } from '../core/TheSportsAPIManager';
import { pool } from '../database/connection';
import { logger } from '../utils/logger';

interface SyncResult {
  total: number;
  success: number;
  failed: number;
  leagues: string[];
}

export async function runStandingsAutoSync(): Promise<SyncResult> {
  const result: SyncResult = {
    total: 0,
    success: 0,
    failed: 0,
    leagues: []
  };

  try {
    logger.info('[Standings Auto-Sync] Starting...');

    // Step 1: Get recent season updates from /data/update
    const dataUpdate = await theSportsAPI.get('/data/update', {});

    // Extract all season_ids from keys "3", "4", "5", "6"
    const allSeasonUpdates: any[] = [];
    ['3', '4', '5', '6'].forEach(key => {
      if (dataUpdate.results[key] && Array.isArray(dataUpdate.results[key])) {
        allSeasonUpdates.push(...dataUpdate.results[key]);
      }
    });

    const seasonIds = [...new Set(allSeasonUpdates.map((item: any) => item.season_id))];

    if (seasonIds.length === 0) {
      logger.info('[Standings Auto-Sync] No recent season updates');
      return result;
    }

    logger.info(`[Standings Auto-Sync] Found ${seasonIds.length} seasons with recent changes`);

    // Filter to only 2025-2026 seasons
    const seasonInfos = await pool.query(`
      SELECT s.external_id, s.year, c.name as competition_name
      FROM ts_seasons s
      LEFT JOIN ts_competitions c ON s.competition_id = c.external_id
      WHERE s.external_id = ANY($1::text[])
        AND (s.year IN ('2025', '2026') OR s.year LIKE '%2025%' OR s.year LIKE '%2026%')
    `, [seasonIds]);

    const filtered2025_2026_SeasonIds = seasonInfos.rows.map((r: any) => r.external_id);

    if (filtered2025_2026_SeasonIds.length === 0) {
      logger.info('[Standings Auto-Sync] No 2025-2026 seasons in recent updates');
      return result;
    }

    logger.info(`[Standings Auto-Sync] Filtered to ${filtered2025_2026_SeasonIds.length} seasons for 2025-2026`);
    result.total = filtered2025_2026_SeasonIds.length;

    // Step 2: For each season, fetch and save standings
    for (const seasonId of filtered2025_2026_SeasonIds) {
      try {
        // Fetch standings
        const standings = await theSportsAPI.get('/season/recent/table/detail', {
          uuid: seasonId
        });

        if (!standings.results || !standings.results.tables || standings.results.tables.length === 0) {
          logger.debug(`[Standings Auto-Sync] No standings for season ${seasonId}`);
          result.failed++;
          continue;
        }

        const table = standings.results.tables[0];
        const rows = table.rows || [];

        if (rows.length === 0) {
          logger.debug(`[Standings Auto-Sync] Empty standings for season ${seasonId}`);
          result.failed++;
          continue;
        }

        // Get competition name
        const seasonInfo = await pool.query(`
          SELECT c.name as comp_name, c.external_id as comp_id
          FROM ts_seasons s
          LEFT JOIN ts_competitions c ON s.competition_id = c.external_id
          WHERE s.external_id = $1
          LIMIT 1;
        `, [seasonId]);

        const compName = seasonInfo.rows.length > 0 ? seasonInfo.rows[0].comp_name : 'Unknown';

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

        result.success++;
        result.leagues.push(compName);

        logger.info(`[Standings Auto-Sync] ✅ ${compName}: ${rows.length} teams`);

        // Rate limit (120 requests/min = 1 every 500ms)
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (err: any) {
        logger.error(`[Standings Auto-Sync] Failed for season ${seasonId}: ${err.message}`);
        result.failed++;
      }
    }

    logger.info(`[Standings Auto-Sync] Complete: ${result.success}/${result.total} leagues updated`);
    logger.info(`[Standings Auto-Sync] Updated leagues: ${result.leagues.join(', ')}`);

  } catch (err: any) {
    logger.error(`[Standings Auto-Sync] Error: ${err.message}`);
  }

  return result;
}

// For CLI testing
if (require.main === module) {
  runStandingsAutoSync()
    .then(result => {
      console.log('='.repeat(80));
      console.log('STANDINGS AUTO-SYNC RESULT:');
      console.log(`  Total Seasons: ${result.total}`);
      console.log(`  Success: ${result.success}`);
      console.log(`  Failed: ${result.failed}`);
      console.log(`  Updated Leagues: ${result.leagues.join(', ')}`);
      console.log('='.repeat(80));
      process.exit(0);
    })
    .catch(err => {
      console.error('Error:', err);
      process.exit(1);
    });
}
