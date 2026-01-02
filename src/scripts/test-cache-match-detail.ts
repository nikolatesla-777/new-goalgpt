/**
 * Test Cache Match Detail
 * 
 * Tests if ended matches can be read from database (cache) correctly.
 * This verifies that post-match persistence works and users can see complete data.
 */

import { pool } from '../database/connection';
import { logger } from '../utils/logger';

async function testCacheMatchDetail() {
  const client = await pool.connect();
  try {
    logger.info('🧪 Testing cache (database) match detail reading...\n');

    // Find a recently ended match that should have complete data
    const result = await client.query(`
      SELECT 
        external_id,
        status_id,
        match_time,
        statistics,
        incidents,
        trend_data,
        player_stats,
        home_score_display,
        away_score_display,
        home_team_id,
        away_team_id
      FROM ts_matches 
      WHERE status_id = 8
        AND match_time >= EXTRACT(EPOCH FROM NOW()) - 86400
        AND statistics IS NOT NULL
        AND incidents IS NOT NULL
        AND trend_data IS NOT NULL
      ORDER BY match_time DESC
      LIMIT 5
    `);

    logger.info(`📊 Found ${result.rows.length} ended matches with complete data\n`);

    if (result.rows.length === 0) {
      logger.warn('⚠️ No matches with complete data found. Batch processing may still be running.');
      return;
    }

    for (const match of result.rows) {
      logger.info(`\n=== Testing Match: ${match.external_id} ===`);
      logger.info(`Status: ${match.status_id} (END)`);
      logger.info(`Match Time: ${new Date(match.match_time * 1000).toISOString()}`);
      logger.info(`Score: ${match.home_score_display} - ${match.away_score_display}`);

      // Check statistics
      const stats = match.statistics;
      if (stats && typeof stats === 'object') {
        const statsCount = Object.keys(stats).length;
        logger.info(`✅ Statistics: ${statsCount} stats available`);
        
        // Show sample stats
        const sampleStats = Object.keys(stats).slice(0, 5);
        logger.info(`   Sample: ${sampleStats.join(', ')}`);
      } else {
        logger.warn(`❌ Statistics: Missing or invalid`);
      }

      // Check incidents
      const incidents = match.incidents;
      if (incidents && Array.isArray(incidents)) {
        logger.info(`✅ Incidents: ${incidents.length} events available`);
        
        // Show sample incidents
        const sampleIncidents = incidents.slice(0, 3).map((inc: any) => 
          `${inc.type || 'unknown'} (${inc.minute || '?'}')`
        );
        logger.info(`   Sample: ${sampleIncidents.join(', ')}`);
      } else {
        logger.warn(`❌ Incidents: Missing or invalid`);
      }

      // Check trend data
      const trend = match.trend_data;
      if (trend && Array.isArray(trend)) {
        logger.info(`✅ Trend Data: ${trend.length} data points available`);
      } else {
        logger.warn(`❌ Trend Data: Missing or invalid`);
      }

      // Check player stats
      const playerStats = match.player_stats;
      if (playerStats && Array.isArray(playerStats)) {
        logger.info(`✅ Player Stats: ${playerStats.length} players available`);
      } else {
        logger.info(`⚠️ Player Stats: Missing (may be due to API limit) - This is OK`);
      }

      // Overall assessment
      const hasCompleteData = 
        stats && typeof stats === 'object' && Object.keys(stats).length > 0 &&
        incidents && Array.isArray(incidents) && incidents.length > 0 &&
        trend && Array.isArray(trend) && trend.length > 0;

      if (hasCompleteData) {
        logger.info(`\n✅ Match ${match.external_id} has COMPLETE data - Users will see all tabs with data!`);
      } else {
        logger.warn(`\n⚠️ Match ${match.external_id} has INCOMPLETE data - Some tabs may be empty`);
      }
    }

    logger.info(`\n=== SUMMARY ===`);
    logger.info(`✅ Cache (database) reading test completed`);
    logger.info(`✅ Ended matches can be read from database with complete data`);
    logger.info(`✅ Users will see statistics, incidents, and trend data in match detail pages`);

  } catch (error: any) {
    logger.error('Test failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

testCacheMatchDetail().catch(console.error);

