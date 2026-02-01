/**
 * Standings Auto-Sync Job V2
 *
 * IMPROVED APPROACH:
 * 1. Always syncs priority leagues (Süper Lig, etc.)
 * 2. Also syncs leagues from /data/update (recent matches)
 * 3. Ensures major leagues always have fresh standings
 *
 * Frequency: Every 5 minutes
 * Coverage: Priority leagues + recent matches
 */

import { theSportsAPI } from '../core/TheSportsAPIManager';
import { pool } from '../database/connection';
import { logger } from '../utils/logger';
import priorityLeaguesConfig from '../config/priority_leagues.json';

interface SyncResult {
  total: number;
  success: number;
  failed: number;
  leagues: string[];
  priority_synced: number;
  recent_synced: number;
}

export async function runStandingsAutoSyncV2(): Promise<SyncResult> {
  const result: SyncResult = {
    total: 0,
    success: 0,
    failed: 0,
    leagues: [],
    priority_synced: 0,
    recent_synced: 0
  };

  try {
    logger.info('[Standings Auto-Sync V2] Starting...');

    const allSeasonIds: Set<string> = new Set();

    // Step 1: Add priority leagues
    logger.info('[Standings Auto-Sync V2] Adding priority leagues...');
    for (const league of priorityLeaguesConfig.priority_leagues) {
      allSeasonIds.add(league.season_2025_2026_id);
    }
    logger.info(`[Standings Auto-Sync V2] ${allSeasonIds.size} priority leagues`);

    // Step 2: Add leagues from /data/update
    logger.info('[Standings Auto-Sync V2] Checking /data/update for recent matches...');
    const dataUpdate = await theSportsAPI.get('/data/update', {});

    const recentUpdates: any[] = [];
    ['3', '4', '5', '6'].forEach(key => {
      if (dataUpdate.results[key] && Array.isArray(dataUpdate.results[key])) {
        recentUpdates.push(...dataUpdate.results[key]);
      }
    });

    const recentSeasonIds = [...new Set(recentUpdates.map((item: any) => item.season_id))];

    // Filter to 2025-2026 seasons
    if (recentSeasonIds.length > 0) {
      const seasonInfos = await pool.query(`
        SELECT s.external_id
        FROM ts_seasons s
        WHERE s.external_id = ANY($1::text[])
          AND (s.year IN ('2025', '2026') OR s.year LIKE '%2025%' OR s.year LIKE '%2026%')
      `, [recentSeasonIds]);

      seasonInfos.rows.forEach(row => allSeasonIds.add(row.external_id));
    }

    logger.info(`[Standings Auto-Sync V2] Total: ${allSeasonIds.size} seasons to sync`);
    result.total = allSeasonIds.size;

    if (allSeasonIds.size === 0) {
      logger.info('[Standings Auto-Sync V2] No seasons to sync');
      return result;
    }

    // Step 3: Fetch standings for all seasons
    for (const seasonId of Array.from(allSeasonIds)) {
      try {
        const standings = await theSportsAPI.get('/season/recent/table/detail', {
          uuid: seasonId
        });

        if (!standings.results || !standings.results.tables || standings.results.tables.length === 0) {
          logger.debug(`[Standings Auto-Sync V2] No standings for season ${seasonId}`);
          result.failed++;
          continue;
        }

        const table = standings.results.tables[0];
        const rows = table.rows || [];

        if (rows.length === 0) {
          logger.debug(`[Standings Auto-Sync V2] Empty standings for season ${seasonId}`);
          result.failed++;
          continue;
        }

        // Get competition name
        const seasonInfo = await pool.query(`
          SELECT c.name as comp_name
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

        // Track whether it was priority or recent
        const isPriority = priorityLeaguesConfig.priority_leagues.some(
          league => league.season_2025_2026_id === seasonId
        );

        if (isPriority) {
          result.priority_synced++;
          logger.info(`[Standings Auto-Sync V2] ✅ [PRIORITY] ${compName}: ${rows.length} teams`);
        } else {
          result.recent_synced++;
          logger.info(`[Standings Auto-Sync V2] ✅ [RECENT] ${compName}: ${rows.length} teams`);
        }

        // Rate limit (120 requests/min = 1 every 500ms)
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (err: any) {
        logger.error(`[Standings Auto-Sync V2] Failed for season ${seasonId}: ${err.message}`);
        result.failed++;
      }
    }

    logger.info(`[Standings Auto-Sync V2] Complete: ${result.success}/${result.total} leagues updated`);
    logger.info(`[Standings Auto-Sync V2]   Priority: ${result.priority_synced} | Recent: ${result.recent_synced}`);
    logger.info(`[Standings Auto-Sync V2] Updated leagues: ${result.leagues.join(', ')}`);

  } catch (err: any) {
    logger.error(`[Standings Auto-Sync V2] Error: ${err.message}`);
  }

  return result;
}

// For CLI testing
if (require.main === module) {
  runStandingsAutoSyncV2()
    .then(result => {
      console.log('='.repeat(80));
      console.log('STANDINGS AUTO-SYNC V2 RESULT:');
      console.log(`  Total Seasons: ${result.total}`);
      console.log(`  Success: ${result.success}`);
      console.log(`  Failed: ${result.failed}`);
      console.log(`  Priority Leagues: ${result.priority_synced}`);
      console.log(`  Recent Leagues: ${result.recent_synced}`);
      console.log(`  Updated Leagues: ${result.leagues.join(', ')}`);
      console.log('='.repeat(80));
      process.exit(0);
    })
    .catch(err => {
      console.error('Error:', err);
      process.exit(1);
    });
}
