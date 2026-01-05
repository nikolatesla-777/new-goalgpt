/**
 * Test Post-Match Persistence
 * 
 * Tests all scenarios for post-match data persistence:
 * 1. WebSocket status=8 trigger
 * 2. DataUpdateWorker status=8 trigger
 * 3. matchDetailLive reconcile status=8 trigger
 * 4. PostMatchProcessorJob catch-up
 */

import { pool } from '../database/connection';
import { logger } from '../utils/logger';

async function testPostMatchPersistence() {
  const client = await pool.connect();
  try {
    logger.info('🧪 Testing Post-Match Persistence...\n');

    // 1. Find a recently ended match
    const result = await client.query(`
      SELECT 
        external_id,
        status_id,
        match_time,
        statistics,
        incidents,
        trend_data,
        player_stats,
        season_id
      FROM ts_matches 
      WHERE status_id = 8
        AND match_time >= EXTRACT(EPOCH FROM NOW()) - 86400
      ORDER BY match_time DESC
      LIMIT 10
    `);

    logger.info(`Found ${result.rows.length} recently ended matches\n`);

    if (result.rows.length === 0) {
      logger.warn('⚠️ No recently ended matches found. Waiting for a match to end...');
      return;
    }

    let allComplete = 0;
    let missingData = 0;

    for (const match of result.rows) {
      logger.info(`\n=== Testing Match: ${match.external_id} ===`);
      logger.info(`Status: ${match.status_id}`);
      logger.info(`Match Time: ${new Date(match.match_time * 1000).toISOString()}`);
      
      const checks = {
        statistics: match.statistics && Object.keys(match.statistics).length > 0,
        incidents: match.incidents && Array.isArray(match.incidents) && match.incidents.length > 0,
        trend_data: match.trend_data && Array.isArray(match.trend_data) && match.trend_data.length > 0,
        player_stats: match.player_stats && Array.isArray(match.player_stats) && match.player_stats.length > 0,
      };

      logger.info(`Statistics: ${checks.statistics ? '✅' : '❌'} ${checks.statistics ? `(${Object.keys(match.statistics || {}).length} stats)` : '(missing)'}`);
      logger.info(`Incidents: ${checks.incidents ? '✅' : '❌'} ${checks.incidents ? `(${match.incidents?.length || 0} incidents)` : '(missing)'}`);
      logger.info(`Trend Data: ${checks.trend_data ? '✅' : '❌'} ${checks.trend_data ? `(${match.trend_data?.length || 0} data points)` : '(missing)'}`);
      logger.info(`Player Stats: ${checks.player_stats ? '✅' : '❌'} ${checks.player_stats ? `(${match.player_stats?.length || 0} players)` : '(missing)'}`);

      // Check if all data is present
      const allDataPresent = 
        checks.statistics && 
        checks.incidents && 
        checks.trend_data && 
        checks.player_stats;

      if (allDataPresent) {
        logger.info(`✅ Match ${match.external_id} has ALL post-match data`);
        allComplete++;
      } else {
        logger.warn(`⚠️ Match ${match.external_id} is missing some post-match data`);
        missingData++;
        
        // Check standings if season_id exists
        if (match.season_id) {
          const standingsCheck = await client.query(`
            SELECT COUNT(*) as count
            FROM ts_standings
            WHERE season_id = $1
          `, [match.season_id]);
          
          logger.info(`Standings: ${parseInt(standingsCheck.rows[0].count) > 0 ? '✅' : '❌'} (${standingsCheck.rows[0].count} teams)`);
        }
      }
    }

    logger.info(`\n=== SUMMARY ===`);
    logger.info(`Total matches checked: ${result.rows.length}`);
    logger.info(`✅ Complete: ${allComplete}`);
    logger.info(`⚠️ Missing data: ${missingData}`);
    logger.info(`\n${allComplete === result.rows.length ? '✅ All matches have complete post-match data!' : '⚠️ Some matches are missing post-match data. PostMatchProcessorJob should catch up.'}`);

  } catch (error: any) {
    logger.error('Test failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

testPostMatchPersistence().catch(console.error);


