/**
 * Test Post-Match Hooks
 * 
 * Tests all hooks that should trigger post-match persistence:
 * 1. WebSocket status=8 trigger
 * 2. DataUpdateWorker status=8 trigger
 * 3. matchDetailLive reconcile status=8 trigger
 * 4. PostMatchProcessorJob catch-up
 */

import 'dotenv/config';
import { pool } from '../database/connection';
import { logger } from '../utils/logger';

async function testPostMatchHooks() {
  logger.info('🔍 Testing Post-Match Hooks...\n');
  const client = await pool.connect();
  try {
    // 1. Check PostMatchProcessorJob is running
    logger.info('1️⃣ Checking PostMatchProcessorJob status...');
    const jobLogs = await client.query(`
      SELECT COUNT(*) as count
      FROM ts_matches 
      WHERE status_id = 8
        AND match_time >= EXTRACT(EPOCH FROM NOW()) - 86400
        AND updated_at >= NOW() - INTERVAL '1 hour'
    `);
    logger.info(`   Recent updates (last hour): ${jobLogs.rows[0].count}`);
    
    // 2. Check for matches with all data complete
    logger.info('\n2️⃣ Checking data completeness...');
    const completeMatches = await client.query(`
      SELECT COUNT(*) as count
      FROM ts_matches 
      WHERE status_id = 8
        AND match_time >= EXTRACT(EPOCH FROM NOW()) - 86400
        AND statistics IS NOT NULL
        AND incidents IS NOT NULL
        AND trend_data IS NOT NULL
        AND player_stats IS NOT NULL
    `);
    logger.info(`   Complete matches: ${completeMatches.rows[0].count}`);
    
    // 3. Check for matches missing data
    logger.info('\n3️⃣ Checking missing data...');
    const missingData = await client.query(`
      SELECT 
        external_id,
        match_time,
        CASE WHEN statistics IS NULL THEN 'statistics' END as missing_stats,
        CASE WHEN incidents IS NULL THEN 'incidents' END as missing_incidents,
        CASE WHEN trend_data IS NULL THEN 'trend_data' END as missing_trend,
        CASE WHEN player_stats IS NULL THEN 'player_stats' END as missing_players
      FROM ts_matches 
      WHERE status_id = 8
        AND match_time >= EXTRACT(EPOCH FROM NOW()) - 86400
        AND (
          statistics IS NULL 
          OR incidents IS NULL 
          OR trend_data IS NULL 
          OR player_stats IS NULL
        )
      ORDER BY match_time DESC
      LIMIT 10
    `);
    
    if (missingData.rows.length > 0) {
      logger.warn(`   ⚠️ Found ${missingData.rows.length} matches with missing data:`);
      missingData.rows.forEach((match: any) => {
        const missing = [
          match.missing_stats,
          match.missing_incidents,
          match.missing_trend,
          match.missing_players,
        ].filter(Boolean);
        logger.warn(`      - ${match.external_id}: missing ${missing.join(', ')}`);
      });
    } else {
      logger.info('   ✅ All matches have complete data!');
    }
    
    // 4. Check recent match endings
    logger.info('\n4️⃣ Checking recent match endings...');
    const recentEndings = await client.query(`
      SELECT 
        external_id,
        match_time,
        updated_at,
        EXTRACT(EPOCH FROM (NOW() - updated_at)) / 60 as minutes_since_update
      FROM ts_matches 
      WHERE status_id = 8
        AND match_time >= EXTRACT(EPOCH FROM NOW()) - 86400
      ORDER BY match_time DESC
      LIMIT 10
    `);
    
    logger.info(`   Recent ended matches (last 10):`);
    recentEndings.rows.forEach((match: any) => {
      logger.info(`      - ${match.external_id}: ended ${Math.round(match.minutes_since_update)} minutes ago`);
    });
    
    // 5. Summary
    logger.info('\n=== SUMMARY ===');
    const totalEnded = await client.query(`
      SELECT COUNT(*) as count
      FROM ts_matches 
      WHERE status_id = 8
        AND match_time >= EXTRACT(EPOCH FROM NOW()) - 86400
    `);
    const totalComplete = completeMatches.rows[0].count;
    const totalMissing = missingData.rows.length;
    
    logger.info(`Total ended matches (last 24h): ${totalEnded.rows[0].count}`);
    logger.info(`Complete: ${totalComplete}`);
    logger.info(`Missing data: ${totalMissing}`);
    
    if (totalMissing === 0) {
      logger.info('✅ All matches have complete data!');
    } else {
      logger.warn(`⚠️ ${totalMissing} matches are missing data. PostMatchProcessorJob should process them.`);
    }
    
  } catch (error: any) {
    logger.error('Error testing post-match hooks:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

testPostMatchHooks().catch(console.error);


