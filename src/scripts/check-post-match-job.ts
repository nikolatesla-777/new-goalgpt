/**
 * Check PostMatchProcessorJob Status
 * 
 * Checks if PostMatchProcessorJob is running and can be triggered
 */

import { pool } from '../database/connection';
import { logger } from '../utils/logger';
import { TheSportsClient } from '../services/thesports/client/thesports-client';
import { PostMatchProcessor } from '../services/liveData/postMatchProcessor';

async function checkPostMatchJob() {
  try {
    logger.info('🔍 Checking PostMatchProcessorJob status...\n');

    // Check if there are ended matches needing processing
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          COUNT(*) as total_ended,
          COUNT(CASE WHEN statistics IS NULL OR incidents IS NULL OR trend_data IS NULL OR player_stats IS NULL THEN 1 END) as missing_data
        FROM ts_matches 
        WHERE status_id = 8
          AND match_time >= EXTRACT(EPOCH FROM NOW()) - 86400
      `);

      logger.info(`📊 Ended matches (last 24h):`);
      logger.info(`   Total: ${result.rows[0].total_ended}`);
      logger.info(`   Missing data: ${result.rows[0].missing_data}`);

      // Test PostMatchProcessor
      logger.info(`\n🧪 Testing PostMatchProcessor...`);
      const theSportsClient = new TheSportsClient();
      const processor = new PostMatchProcessor(theSportsClient);
      
      logger.info(`✅ PostMatchProcessor initialized successfully`);
      
      // Try to process one match
      const testMatch = await client.query(`
        SELECT external_id
        FROM ts_matches 
        WHERE status_id = 8
          AND match_time >= EXTRACT(EPOCH FROM NOW()) - 86400
        LIMIT 1
      `);

      if (testMatch.rows.length > 0) {
        const matchId = testMatch.rows[0].external_id;
        logger.info(`\n🔄 Testing manual processing for match: ${matchId}`);
        
        try {
          await processor.onMatchEnded(matchId);
          logger.info(`✅ Manual processing completed successfully`);
        } catch (error: any) {
          logger.error(`❌ Manual processing failed: ${error.message}`);
        }
      } else {
        logger.warn(`⚠️ No ended matches found for testing`);
      }

    } finally {
      client.release();
    }

  } catch (error: any) {
    logger.error('Check failed:', error);
  } finally {
    await pool.end();
  }
}

checkPostMatchJob().catch(console.error);

